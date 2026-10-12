// Downloads the Home Office Register of Licensed Sponsors (Workers) from GOV.UK
// and syncs it into the `sponsors` table. Run daily (see .github/workflows/daily-sync.yml).
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import Papa from 'papaparse';
import dotenv from 'dotenv';
import { normalizeCompanyName } from './lib/normalize.js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const GOV_URL =
  'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers';
const BATCH_SIZE = 2000;

async function syncSponsors() {
  console.log('🚀 Starting sponsor register sync...');

  // 1. Find the current CSV link on the GOV.UK publication page
  const htmlResponse = await fetch(GOV_URL);
  if (!htmlResponse.ok) throw new Error(`GOV.UK page returned ${htmlResponse.status}`);
  const $ = cheerio.load(await htmlResponse.text());

  const href = $('a[href$=".csv"]').first().attr('href');
  if (!href) throw new Error('Could not find the CSV link on GOV.UK (page layout may have changed)');
  const csvUrl = new URL(href, GOV_URL).toString();

  // 2. Download and parse it
  console.log(`📥 Downloading register: ${csvUrl}`);
  const csvResponse = await fetch(csvUrl);
  if (!csvResponse.ok) throw new Error(`CSV download returned ${csvResponse.status}`);
  const parsed = Papa.parse(await csvResponse.text(), { header: true, skipEmptyLines: true });

  // The register has one row per organisation per route, so merge rows by name.
  // Only A-rated sponsors are kept (B-rated sponsors cannot issue new certificates).
  const sponsors = new Map(); // company_name -> Set of routes
  for (const row of parsed.data) {
    const name = (row['Organisation Name'] || row['Organisation name'] || '').trim();
    if (!name) continue;

    const rating = row['Type & Rating'] || '';
    if (rating && !/A\s*rating/i.test(rating)) continue;

    const route = (row['Route'] || '').trim();
    if (!sponsors.has(name)) sponsors.set(name, new Set());
    if (route) sponsors.get(name).add(route);
  }

  const names = [...sponsors.keys()];
  if (names.length < 1000) {
    // Safety net: a near-empty parse means the file format changed. Don't touch the DB.
    throw new Error(`Only parsed ${names.length} sponsors, refusing to sync (format changed?)`);
  }
  console.log(`📦 ${names.length} unique A-rated sponsors. Uploading in batches...`);

  // 3. Upsert in batches
  const timestamp = new Date().toISOString();
  const totalBatches = Math.ceil(names.length / BATCH_SIZE);

  for (let i = 0; i < names.length; i += BATCH_SIZE) {
    const chunk = names.slice(i, i + BATCH_SIZE).map((name) => ({
      company_name: name,
      normalized_name: normalizeCompanyName(name),
      routes: [...sponsors.get(name)],
      last_seen: timestamp,
    }));

    const { error } = await supabase.from('sponsors').upsert(chunk, { onConflict: 'company_name' });
    if (error) {
      // Abort BEFORE the purge so a failed upload can never wipe valid sponsors.
      throw new Error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${error.message}`);
    }
    console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${totalBatches}`);
  }

  // 4. Purge sponsors that were not in today's register (licence revoked or downgraded)
  console.log('🧹 Removing sponsors no longer on the register...');
  const { error: deleteError } = await supabase.from('sponsors').delete().lt('last_seen', timestamp);
  if (deleteError) throw deleteError;

  console.log('🎉 Sponsor sync complete.');
}

syncSponsors().catch((error) => {
  console.error('❌ Sync failed:', error.message);
  process.exit(1);
});

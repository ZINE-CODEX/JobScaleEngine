// Pulls UK jobs from Adzuna, keeps only those from licensed sponsors that don't
// rule out sponsorship, tags them with salary-threshold info, and saves them to
// the `jobs` table. Run on a schedule (see .github/workflows/job-sync.yml).
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { normalizeCompanyName } from './lib/normalize.js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adzunaAppId = process.env.ADZUNA_APP_ID;
const adzunaAppKey = process.env.ADZUNA_APP_KEY;

if (!supabaseUrl || !supabaseKey || !adzunaAppId || !adzunaAppKey) {
  console.error('❌ Missing environment variables. See .env.example.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ---------------------------------------------------------------
// ⚠️ Visa rules change often. Verify these against GOV.UK before relying on them:
// https://www.gov.uk/skilled-worker-visa/your-job
// The real rule is "the higher of the general threshold or the going rate for the
// job's SOC code". This demo only checks the general and new-entrant thresholds.
// ---------------------------------------------------------------
const GENERAL_SALARY_THRESHOLD = 41700;
const NEW_ENTRANT_SALARY_THRESHOLD = 33400;
const REQUIRED_ROUTE = 'Skilled Worker'; // route the sponsor must be licensed for

// Phrases that suggest the employer will NOT sponsor
const NEGATIVE_KEYWORDS = [
  'no sponsorship', 'no visa sponsorship', 'cannot sponsor', 'will not sponsor',
  'not offering sponsorship', 'do not apply if you require sponsorship',
  'right to work in the uk', 'must have the right to work', 'already have the right to work',
  'valid working visa required', 'no tier 2', 'no skilled worker visa',
  'uk passport required', 'british citizen', 'independent right to work', 'without sponsorship',
  'apprentice', 'apprenticeship',
];

// Sectors to search. (Care-worker roles are deliberately excluded: that route
// has been closed to overseas recruitment. Check current rules before adding it back.)
const SEARCH_CATEGORIES = [
  { term: 'software', sector: 'Technology' },
  { term: 'nurse', sector: 'Healthcare' },
  { term: 'engineer', sector: 'Engineering' },
  { term: 'finance', sector: 'Finance' },
];

const PAGES_PER_SECTOR = 3;
const RESULTS_PER_PAGE = 50;

// Cache sponsor lookups so each company is only checked once per run
const sponsorCache = new Map();

async function isLicensedSponsor(companyName) {
  const key = normalizeCompanyName(companyName);
  if (!key) return false;
  if (sponsorCache.has(key)) return sponsorCache.get(key);

  const { data, error } = await supabase
    .from('sponsors')
    .select('company_name')
    .eq('normalized_name', key)
    .contains('routes', [REQUIRED_ROUTE])
    .limit(1);

  const found = !error && Array.isArray(data) && data.length > 0;
  sponsorCache.set(key, found);
  return found;
}

async function syncJobs() {
  console.log('🚀 Starting JobScale job sync...');
  let totalVerified = 0;

  for (const search of SEARCH_CATEGORIES) {
    console.log(`\n🔎 ${search.sector} (keyword: ${search.term})`);

    for (let page = 1; page <= PAGES_PER_SECTOR; page++) {
      try {
        const url =
          `https://api.adzuna.com/v1/api/jobs/gb/search/${page}` +
          `?app_id=${adzunaAppId}&app_key=${adzunaAppKey}` +
          `&results_per_page=${RESULTS_PER_PAGE}&what=${encodeURIComponent(search.term)}`;

        const response = await fetch(url);
        if (!response.ok) {
          console.error(`  ❌ Adzuna returned ${response.status} on page ${page}`);
          continue;
        }
        const data = await response.json();
        const jobs = data.results || [];
        console.log(`  📥 Page ${page}: scanning ${jobs.length} jobs`);

        for (const job of jobs) {
          const companyName = job.company?.display_name;
          if (!companyName || !job.redirect_url) continue;

          // 1. Skip jobs whose description rules out sponsorship
          const description = (job.description || '').toLowerCase();
          if (NEGATIVE_KEYWORDS.some((k) => description.includes(k))) continue;

          // 2. Employer must be on the sponsor register
          if (!(await isLicensedSponsor(companyName))) continue;

          // 3. Salary checks (Adzuna's salary is often an estimate, so we flag that)
          const salary = job.salary_min || 0;
          const visaCategory =
            search.sector === 'Healthcare' ? 'Health & Care Worker' : 'Skilled Worker';

          // 4. Save
          const { error } = await supabase.from('jobs').upsert(
            {
              job_title: job.title,
              company_name: companyName,
              location: job.location?.display_name || 'UK',
              raw_description: job.description,
              application_link: job.redirect_url,
              source: 'adzuna',
              sector: search.sector,
              job_type: 'Full-Time',
              extracted_salary: salary,
              salary_is_estimated: String(job.salary_is_predicted) === '1',
              meets_salary_threshold: salary >= GENERAL_SALARY_THRESHOLD,
              is_new_entrant_eligible: salary >= NEW_ENTRANT_SALARY_THRESHOLD,
              visa_category: visaCategory,
              status: 'active',
              date_verified: new Date().toISOString(),
            },
            { onConflict: 'application_link' }
          );

          if (error) {
            console.error(`  ❌ Could not save "${job.title}": ${error.message}`);
          } else {
            console.log(`  ✅ ${job.title} at ${companyName} (£${salary})`);
            totalVerified++;
          }
        }
      } catch (error) {
        console.error(`  ❌ Error on page ${page}:`, error.message);
      }
    }
  }

  // Expire jobs that haven't been re-verified in 14 days
  console.log('\n🧹 Expiring old jobs...');
  const { error: cleanupError } = await supabase.rpc('expire_old_jobs');
  if (cleanupError) console.error('❌ Cleanup failed:', cleanupError.message);

  console.log(`\n🎉 Done. Saved/updated ${totalVerified} verified jobs.`);
}

syncJobs().catch((error) => {
  console.error('❌ Sync failed:', error.message);
  process.exit(1);
});

// Quick check that your Supabase keys and schema are set up correctly.
// Usage: npm run test:db
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

for (const table of ['sponsors', 'jobs', 'user_alerts']) {
  const { error, count } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error(`❌ ${table}: ${error.message}`);
  } else {
    console.log(`✅ ${table}: reachable (${count ?? 0} rows)`);
  }
}

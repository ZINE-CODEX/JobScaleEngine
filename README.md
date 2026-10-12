# UK Visa JobScale

A job board for international candidates who need UK visa sponsorship. It pulls live UK job listings, checks each employer against the Home Office **Register of Licensed Sponsors**, filters out listings that rule out sponsorship, and flags salary-threshold eligibility, so you only see jobs you can realistically apply for.

> Built to take the manual rule-checking out of a UK job search for international graduates.

## Features

- **Sponsor verification:** employers are matched against the official register (A-rated, Skilled Worker route), refreshed daily.
- **Sponsorship red-flag filter:** drops listings containing phrases like "no sponsorship" or "must have the right to work in the UK", plus apprenticeships.
- **Salary-threshold badges:** shows whether a job meets the general Skilled Worker salary threshold or only the lower new-entrant one.
- **Sector filters and search:** Technology, Healthcare, Engineering, Finance, with keyword search across titles and descriptions.
- **Auth and email capture:** Supabase email/password login and a newsletter signup form.
- **Fully automated:** GitHub Actions refresh sponsors daily and jobs every 6 hours.

## How it works

```
GOV.UK sponsor register (CSV) --> sync-sponsors.js --> Supabase `sponsors`
                                                               |
Adzuna jobs API --> sync-jobs.js --(sponsor + keyword + salary checks)--> Supabase `jobs`
                                                               |
                                          Next.js app (Vercel) reads `jobs`
```

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres + Auth), GitHub Actions, Adzuna API, Cheerio, PapaParse.

## Setup

You need free accounts on **Supabase**, **Adzuna**, **GitHub** and **Vercel**, plus Node.js 20.9+.

### 1. Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**. This creates the tables, the 14-day expiry function and the security policies.
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key
   - `service_role` key (secret, never put it in browser code or Vercel)
4. Go to **Authentication → Providers → Email**. For quick testing you can turn off "Confirm email"; otherwise new users must click the confirmation link before logging in.

### 2. Adzuna

Register at [developer.adzuna.com](https://developer.adzuna.com) and copy your **App ID** and **App Key**.

### 3. Run locally

```bash
git clone <your-repo-url>
cd jobscale
npm install
cp .env.example .env.local     # then fill in your keys
npm run test:db                # checks Supabase connection and tables
npm run sync:sponsors          # downloads the sponsor register (takes a few minutes)
npm run sync:jobs              # fetches and verifies jobs (run AFTER sponsors)
npm run dev                    # http://localhost:3000
```

The site requires login. Open `/signup`, create an account, then you'll land on the job board.

### 4. Deploy to Vercel

1. Push the repo to GitHub, then **Add New → Project** in Vercel and import it.
2. Add these environment variables:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | your Supabase project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your Supabase anon key |

3. Deploy.
4. In Supabase, go to **Authentication → URL Configuration** and set **Site URL** to your Vercel URL so confirmation emails link to the right place.

### 5. Turn on the automatic syncs (GitHub Actions)

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**, and add:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service-role key |
| `ADZUNA_APP_ID` | your Adzuna App ID |
| `ADZUNA_APP_KEY` | your Adzuna App Key |

Then open the **Actions** tab and run **Daily Sponsor Sync** manually once, followed by **Job Aggregator**. After that both run on their schedules. (The job sync needs the sponsors table filled first, otherwise it finds nothing to verify.)

## Project structure

```
app/                 Next.js pages (job board, login, signup, footer form)
lib/normalize.js     Company-name normalisation used for sponsor matching
middleware.ts        Redirects logged-out visitors to /login
sync-sponsors.js     GOV.UK register -> Supabase
sync-jobs.js         Adzuna -> verification -> Supabase
test-db.js           Connection check
supabase/schema.sql  Database schema and security policies
.github/workflows/   Scheduled syncs
```

## Configuration

Edit the constants at the top of [`sync-jobs.js`](sync-jobs.js):

- `GENERAL_SALARY_THRESHOLD` and `NEW_ENTRANT_SALARY_THRESHOLD`: salary limits used for the badges.
- `NEGATIVE_KEYWORDS`: phrases that cause a listing to be skipped.
- `SEARCH_CATEGORIES`: Adzuna search terms and the sector each maps to.

## Known limitations

- **Not legal or immigration advice.** Visa rules and salary thresholds change often. Check [GOV.UK](https://www.gov.uk/skilled-worker-visa) before applying.
- The real salary rule is the *higher* of the general threshold and the **going rate for the job's SOC code**. This project does not check SOC codes yet.
- Adzuna salaries are often estimates (marked "est."), and some listings have none.
- Sponsor matching compares normalised company names, so it favours accuracy over coverage. Employers listed under a different trading name may be missed.
- A licensed sponsor isn't guaranteed to sponsor for a specific role.
- Care-worker roles are excluded because that route has been closed to overseas recruitment. Verify the current rules before changing this.

## Troubleshooting

| Problem | Fix |
|---|---|
| Job board is empty | Run the sponsor sync first, then the job sync. Check `npm run test:db`. |
| `permission denied for table` | Re-run `supabase/schema.sql`, including the grants and policies at the bottom. |
| Can't log in after signup | Confirm the email, or disable "Confirm email" in Supabase Auth settings. |
| Sync says "Could not find the CSV link" | GOV.UK changed the page layout. Update the selector in `sync-sponsors.js`. |
| Adzuna errors (401/429) | Check your keys, or you've hit the free-tier rate limit. |

## License

MIT

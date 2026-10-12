import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import Footer from './Footer'; 

export default async function Home({ searchParams }: { searchParams: Promise<{ category?: string; subscribed?: string; search?: string }> }) {
  const params = await searchParams;
  const currentCategory = params?.category || 'All';
  const isSubscribed = params?.subscribed === 'true';
  // Strip characters that have special meaning inside a PostgREST filter string
  const searchQuery = (params?.search || '').replace(/[,()%*\\]/g, ' ').trim();

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  );

  let dbQuery = supabase
    .from('jobs')
    .select('*')
    .eq('status', 'active') 
    .order('date_verified', { ascending: false });

  if (currentCategory !== 'All') {
    dbQuery = dbQuery.eq('sector', currentCategory);
  }

  // 🌟 THE UPGRADE: Search both Title AND Description using Supabase .or()
  if (searchQuery) {
    dbQuery = dbQuery.or(`job_title.ilike.%${searchQuery}%,raw_description.ilike.%${searchQuery}%`);
  }

  const { data: jobs } = await dbQuery;
  const categories = ['All', 'Healthcare', 'Technology', 'Engineering', 'Finance'];

  // ==========================================
  // 🌟 SERVER ACTION FOR EMAIL CAPTURE
  // ==========================================
  async function addEmail(formData: FormData) { 
    'use server'; 
    const email = formData.get('email');
    if (!email) return;

    const supabaseServer = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
    );

    const { error } = await supabaseServer.from('user_alerts').insert([{ 
      email: email, 
      status: 'active',
      alert_name: 'Daily Newsletter'
    }]);

    // 23505 = already subscribed, treat as success
    if (error && error.code !== '23505') {
      console.error("🚨 DB ERROR!", error);
      return; 
    }

    redirect(`/?subscribed=true&category=${currentCategory}`);
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'Inter, sans-serif', paddingBottom: '100px' }}>

      {/* Navigation */}
      <nav style={{ backgroundColor: '#ffffff', padding: '1rem 2rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.025em' }}>
          UK Visa <span style={{ color: '#3b82f6' }}>JobScale</span>
        </h1>
        <div style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: '500' }}>
          {jobs?.length || 0} Verified Jobs
        </div>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '3rem 1.5rem' }}>

        {/* Header Section */}
        <header style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h2 style={{ fontSize: '3rem', fontWeight: '900', color: '#1e293b', marginBottom: '1rem' }}>Find your way to the UK.</h2>
          <p style={{ fontSize: '1.25rem', color: '#64748b', maxWidth: '600px', margin: '0 auto', marginBottom: '2rem' }}>
            The only job board that cross-references 125,000+ official Home Office licenses in real-time.
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {categories.map((cat) => (
              <Link 
                key={cat} 
                href={cat === 'All' ? '/' : `/?category=${cat}`}
                style={{
                  padding: '8px 20px',
                  borderRadius: '30px',
                  textDecoration: 'none',
                  fontWeight: '600',
                  fontSize: '0.9rem',
                  backgroundColor: currentCategory === cat ? '#0f172a' : '#fff',
                  color: currentCategory === cat ? '#fff' : '#64748b',
                  border: `1px solid ${currentCategory === cat ? '#0f172a' : '#cbd5e1'}`,
                  transition: 'all 0.2s ease'
                }}
              >
                {cat}
              </Link>
            ))}
          </div>

          {/* THE SEARCH BAR */}
          <form method="GET" action="/" style={{ display: 'flex', gap: '10px', justifyContent: 'center', maxWidth: '500px', margin: '0 auto' }}>
            {currentCategory !== 'All' && <input type="hidden" name="category" value={currentCategory} />}
            <input 
              type="text" 
              name="search" 
              defaultValue={searchQuery} 
              placeholder="Search titles or keywords (e.g. React, Python)..." 
              style={{ flex: 1, padding: '12px 20px', borderRadius: '30px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none' }}
            />
            <button type="submit" style={{ padding: '12px 24px', borderRadius: '30px', backgroundColor: '#3b82f6', color: 'white', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
              Search
            </button>
            {searchQuery && (
              <Link href={`/?category=${currentCategory}`} style={{ padding: '12px 24px', borderRadius: '30px', backgroundColor: '#e2e8f0', color: '#0f172a', textDecoration: 'none', fontWeight: '700', display: 'flex', alignItems: 'center' }}>
                Clear
              </Link>
            )}
          </form>
        </header>

        {/* Job Grid */}
        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {jobs?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b', backgroundColor: '#fff', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
              <h3>No jobs found for "{searchQuery || currentCategory}".</h3>
              <p>Try adjusting your search or check back later.</p>
            </div>
          ) : (
            jobs?.map((job) => (
              <div key={job.id} style={{ 
                backgroundColor: '#fff', borderRadius: '16px', padding: '2rem', 
                border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', marginBottom: '0.5rem' }}>{job.job_title}</h3>
                    <p style={{ fontSize: '1rem', color: '#3b82f6', fontWeight: '600', margin: 0 }}>🏢 {job.company_name}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ backgroundColor: '#eff6ff', color: '#1e40af', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                      🛂 {job.visa_category}
                    </span>
                    {job.meets_salary_threshold ? (
                      <span style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                        ✅ Meets salary threshold
                      </span>
                    ) : job.is_new_entrant_eligible ? (
                      <span style={{ backgroundColor: '#fffbeb', color: '#92400e', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '700' }}>
                        🎓 New-entrant salary only
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* 🌟 THE UPGRADE: Show a snippet of the job description */}
                <p style={{ color: '#475569', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
                  {job.raw_description ? job.raw_description.substring(0, 160) + '...' : 'No description provided.'}
                </p>

                <div style={{ display: 'flex', gap: '20px', color: '#64748b', fontSize: '0.875rem', marginBottom: '1.5rem', fontWeight: '500' }}>
                  <span>📍 {job.location}</span>
                  <span>💵 {job.extracted_salary > 0 ? `£${Number(job.extracted_salary).toLocaleString()}${job.salary_is_estimated ? ' (est.)' : ''}` : 'Competitive'}</span>
                </div>

                <a href={job.application_link} target="_blank" rel="noopener noreferrer" style={{
                  display: 'block', textAlign: 'center', backgroundColor: '#0f172a', color: 'white',
                  padding: '12px', borderRadius: '10px', textDecoration: 'none', fontWeight: '600'
                }}>
                  Apply on Official Site
                </a>
              </div>
            ))
          )}
        </div>
      </main>

      <Footer addEmail={addEmail} isSubscribed={isSubscribed} />

    </div>
  );
}
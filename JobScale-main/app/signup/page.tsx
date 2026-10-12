import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export default async function Signup(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams;

  async function handleSignup(formData: FormData) {
    'use server';

    const fullName = formData.get('fullName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const cookieStore = await cookies();

    // Using the SSR client to handle the session properly
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // Ignore if called from a server component
            }
          },
        },
      }
    );

    // Attempt to create the user
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        }
      }
    });

    if (error) {
      console.error("🚨 SIGNUP ERROR:", error.message);
      // Redirect back to signup with the exact error message from Supabase
      redirect(`/signup?error=${encodeURIComponent(error.message)}`);
    }

    // Success! Redirect straight to the homepage so we can test the Bouncer.
    redirect('/'); 
  }

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>

      <nav style={{ padding: '1.5rem 2rem', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.025em', margin: 0 }}>
            UK Visa <span style={{ color: '#3b82f6' }}>JobScale</span>
          </h1>
        </Link>
      </nav>

      <main style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem 1rem' }}>
        <div style={{ backgroundColor: '#ffffff', padding: '3rem', borderRadius: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)', width: '100%', maxWidth: '450px', border: '1px solid #e2e8f0' }}>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.875rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem' }}>Create your account</h2>
            <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Join the only verified UK sponsor job board.</p>
          </div>

          {/* 🚨 THE ERROR MESSAGE UI */}
          {searchParams?.error && (
            <div style={{ backgroundColor: '#fef2f2', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '1.5rem', textAlign: 'center', border: '1px solid #f87171' }}>
              {searchParams.error}
            </div>
          )}

          <form action={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            <div>
              <label htmlFor="fullName" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem' }}>Full Name</label>
              <input type="text" id="fullName" name="fullName" required placeholder="John Doe" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem' }}>Email Address</label>
              <input type="email" id="email" name="email" required placeholder="admin@jobscale.com" style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div>
              <label htmlFor="password" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#334155', marginBottom: '0.5rem' }}>Password</label>
              <input type="password" id="password" name="password" required placeholder="••••••••" minLength={6} style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input type="checkbox" id="consent" name="consent" required style={{ marginTop: '0.25rem', cursor: 'pointer' }} />
              <label htmlFor="consent" style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: '1.4' }}>
                I agree to the Terms of Service and Privacy Policy. I consent to JobScale storing my data.
              </label>
            </div>

            <button type="submit" style={{ backgroundColor: '#0f172a', color: 'white', padding: '0.875rem', borderRadius: '10px', border: 'none', fontWeight: '700', fontSize: '1rem', cursor: 'pointer', marginTop: '0.5rem', transition: 'background-color 0.2s' }}>
              Create Account
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}
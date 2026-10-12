'use client';
import { useEffect, useState } from 'react';
import Toast from './Toast';

export default function Footer({ addEmail, isSubscribed }: { addEmail: (formData: FormData) => void, isSubscribed: boolean }) {
  const [showSubscriptionUI, setShowSubscriptionUI] = useState(true);

  useEffect(() => {
    if (isSubscribed) {
      // 🌟 1. Silently scrub the URL clean so a refresh acts normal
      const url = new URL(window.location.href);
      url.searchParams.delete('subscribed');
      window.history.replaceState({}, '', url.toString());

      // 2. Hide everything after 5 seconds
      const timer = setTimeout(() => setShowSubscriptionUI(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isSubscribed]);

  if (!showSubscriptionUI) return null;

  return (
    <>
      {isSubscribed && <Toast />}

      <section style={{ 
        position: 'fixed', bottom: 0, left: 0, right: 0, 
        backgroundColor: 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(226, 232, 240, 0.8)', padding: '1rem 2rem',
        boxShadow: '0 -10px 15px -3px rgba(0, 0, 0, 0.05)', display: 'flex',
        justifyContent: 'center', alignItems: 'center', gap: '2rem', flexWrap: 'wrap', zIndex: 50
      }}>
        <div style={{ textAlign: 'left' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>Never miss a visa job.</h3>
          <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>Get a daily email with the latest verified roles.</p>
        </div>

        <form action={addEmail} style={{ display: 'flex', gap: '10px', flex: '1 1 auto', maxWidth: '400px' }}>
          <input 
            type="email" name="email" placeholder="Enter your email address" required
            style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
          />
          <button type="submit" style={{ backgroundColor: '#2563eb', color: 'white', padding: '10px 20px', borderRadius: '8px', border: 'none', fontWeight: '700', cursor: 'pointer' }}>
            Subscribe
          </button>
        </form>
      </section>
    </>
  ); 
}
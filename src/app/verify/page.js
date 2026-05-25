'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import Header from '@/components/Header';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const email = searchParams.get('email') || '';
  const action = searchParams.get('action') || 'login'; // 'login' or 'signup'

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!email) {
      setError('Missing email address parameter. Please return to login.');
    }
  }, [email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (code.length !== 6 || !email) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: err } = await db.verifyOtp(email, code);
      
      if (err) {
        throw new Error(err.message);
      }

      setSuccess(true);
      // Wait 1 second and redirect to secure dashboard!
      setTimeout(() => {
        router.push('/dashboard');
      }, 1200);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Verification failed. Please double-check your code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    alert(`A new 6-digit code has been dispatched to ${email}! (If sandbox, use 123456)`);
    try {
      await db.signInWithOtp(email, action === 'signup');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="card animate-fade-in" style={{ maxWidth: '420px', width: '100%', padding: '36px 24px', boxShadow: 'var(--shadow-lg)' }}>
      <div className="pattern-bg" style={{ top: '-40px', right: '-40px' }}></div>
      
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>✉️</div>
        <h2 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Verify Your Email
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          We sent a 6-digit One-Time Passcode (OTP) to <br />
          <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
        </p>
      </div>

      {error && (
        <div style={{ backgroundColor: 'var(--danger-light)', borderLeft: '3px solid var(--danger)', padding: '12px', borderRadius: '6px', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '18px' }}>
          {error}
        </div>
      )}

      {success ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ 
            width: '56px', 
            height: '56px', 
            backgroundColor: 'var(--success-light)', 
            borderRadius: '50%', 
            color: 'var(--success)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 16px auto', 
            fontSize: '28px', 
            fontWeight: 'bold' 
          }}>
            ✓
          </div>
          <h4 style={{ fontWeight: '700', fontSize: '18px', marginBottom: '4px' }}>Verification Successful</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Welcome to LoanShare! Loading your dashboard...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '20px', alignItems: 'center' }}>
            <label className="form-label" style={{ textAlign: 'center', marginBottom: '8px' }}>Enter 6-Digit Code</label>
            <input
              type="text"
              maxLength="6"
              className="form-input"
              placeholder="e.g. 123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} // numbers only
              required
              disabled={loading || !email}
              style={{ 
                letterSpacing: '0.4em', 
                fontSize: '20px', 
                textAlign: 'center', 
                fontWeight: 'bold', 
                maxWidth: '240px',
                padding: '12px'
              }}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || code.length !== 6} 
            className="btn btn-primary btn-full"
            style={{ fontWeight: 'bold', marginBottom: '20px' }}
          >
            {loading ? 'Verifying Code...' : 'Verify & Log In'}
          </button>

          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            Didn't receive the code?{' '}
            <button 
              type="button" 
              onClick={handleResend}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontWeight: '700', cursor: 'pointer', padding: '0' }}
            >
              Resend OTP
            </button>
          </div>
        </form>
      )}

    </div>
  );
}

export default function VerifyPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', padding: '40px 16px' }}>
        <Suspense fallback={
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading verification panel...</p>
          </div>
        }>
          <VerifyContent />
        </Suspense>
      </main>
    </div>
  );
}

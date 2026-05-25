'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import Header from '@/components/Header';

export default function SignUp() {
  const router = useRouter();
  
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password || !username.trim()) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: err } = await db.signUpWithPassword(email.trim(), password, username.trim());
      
      if (err) {
        throw new Error(err.message);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1200);

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', padding: '40px 16px' }}>
        <div className="card animate-fade-in" style={{ maxWidth: '420px', width: '100%', padding: '36px 24px', boxShadow: 'var(--shadow-lg)' }}>
          <div className="pattern-bg" style={{ top: '-40px', right: '-40px' }}></div>
          
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: '8px' }}>
              Create Your Account
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Join LoanShare to coordinate debts, splits, and balances.
            </p>
          </div>

          {error && (
            <div style={{ backgroundColor: 'var(--danger-light)', borderLeft: '3px solid var(--danger)', padding: '12px', borderRadius: '6px', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '18px' }}>
              {error}
            </div>
          )}

          {success ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--success-light)', borderRadius: '50%', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: '20px', fontWeight: 'bold' }}>✓</div>
              <h4 style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>Account Created!</h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading your secure workspace...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Full Name / Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="John Doe"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">Choose Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    style={{ paddingRight: '60px' }}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none' }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading} 
                className="btn btn-primary btn-full"
                style={{ fontWeight: 'bold', marginBottom: '16px' }}
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                Already have an account?{' '}
                <a href="/login" style={{ fontWeight: '700' }}>
                  Log In
                </a>
              </div>
            </form>
          )}

        </div>
      </main>
    </div>
  );
}

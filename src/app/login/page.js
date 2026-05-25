'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import Header from '@/components/Header';

export default function LogIn() {
  const router = useRouter();

  // Connection mode indicator
  const [isMock, setIsMock] = useState(true);
  useEffect(() => {
    setIsMock(db.isMock());
  }, []);

  // Standard Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Show/Hide toggle state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Forgot Password State Machine
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = Enter Email, 2 = Verify Code & Change Password
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotPassword, setForgotPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false); // Show/Hide for reset input
  const [forgotToken, setForgotToken] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Handle Standard Login Form Submission
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: err } = await db.signInWithPassword(email.trim(), password);
      
      if (err) {
        throw new Error(err.message);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 800);

    } catch (err) {
      console.error('Login error:', err);
      // Help the user resolve email confirmation blocks directly on-screen
      if (err.message?.includes('Invalid login credentials') || err.message?.includes('Email not confirmed')) {
        setError(
          isMock 
            ? 'Account not found in local sandbox. Did you sign up first in this browser?' 
            : 'Invalid credentials. If you signed up, make sure your Supabase email is confirmed.\n\n⚠️ IMPORTANT FIX: Supabase requires email verification links by default. To disable this so you can log in instantly, go to your Supabase Dashboard -> Authentication -> Providers -> Email, and toggle OFF "Confirm Email".'
        );
      } else {
        setError(err.message || 'Failed to authenticate. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Request 6-digit Password Reset OTP
  const handleRequestOTP = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    setForgotLoading(true);
    setForgotError('');

    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to request verification code.');
      }

      setForgotToken(data.verificationToken);
      setForgotStep(2);

    } catch (err) {
      console.error('Request password reset error:', err);
      setForgotError(err.message || 'Failed to request verification code. Ensure your SMTP configuration is active.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: Verify OTP and Reset Password (Supports Cloud + Local Mock Resets)
  const handleResetPasswordCommit = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotCode.trim() || !forgotPassword || !forgotToken) return;

    if (forgotPassword.length < 6) {
      setForgotError('Password must be at least 6 characters long.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {
      const res = await fetch('/api/forgot-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim(),
          code: forgotCode.trim(),
          verificationToken: forgotToken,
          newPassword: forgotPassword
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Password reset failed.');
      }

      // If simulated offline reset, perform client-side mock credentials rewrite
      if (data.simulated) {
        const mockUsers = JSON.parse(localStorage.getItem('loan_share_mock_users') || '[]');
        const userIdx = mockUsers.findIndex(u => u.email === forgotEmail.trim().toLowerCase());
        
        if (userIdx !== -1) {
          mockUsers[userIdx].password = forgotPassword;
          localStorage.setItem('loan_share_mock_users', JSON.stringify(mockUsers));
        } else {
          // If mock user doesn't exist yet, seed a mock account for convenience
          mockUsers.push({
            id: `usr-${Date.now()}`,
            email: forgotEmail.trim().toLowerCase(),
            password: forgotPassword,
            user_metadata: {
              display_name: forgotEmail.split('@')[0],
              username: forgotEmail.split('@')[0]
            }
          });
          localStorage.setItem('loan_share_mock_users', JSON.stringify(mockUsers));
        }
      }

      setForgotSuccess(true);
      setTimeout(() => {
        // Reset states and return to login form
        setForgotMode(false);
        setForgotStep(1);
        setForgotSuccess(false);
        setEmail(forgotEmail); // Autofill the reset email into standard login
        setForgotEmail('');
        setForgotCode('');
        setForgotPassword('');
        setForgotToken('');
      }, 2000);

    } catch (err) {
      console.error('Password reset commit error:', err);
      setForgotError(err.message || 'Verification failed. Please check the code.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Helper to cancel forgot password and return to login
  const cancelForgotPassword = () => {
    setForgotMode(false);
    setForgotStep(1);
    setForgotError('');
    setForgotEmail('');
    setForgotCode('');
    setForgotPassword('');
    setForgotToken('');
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', padding: '40px 16px' }}>
        <div className="card animate-fade-in" style={{ maxWidth: '420px', width: '100%', padding: '36px 24px', boxShadow: 'var(--shadow-lg)' }}>
          <div className="pattern-bg" style={{ top: '-40px', right: '-40px' }}></div>
          
          {/* Active Database connection mode indicator badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
            {isMock ? (
              <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '20px', color: '#b45309', backgroundColor: '#fef3c7', border: '1px solid #fcd34d' }}>
                Sandbox Simulator
              </span>
            ) : (
              <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: '20px', color: '#047857', backgroundColor: '#d1fae5', border: '1px solid #6ee7b7' }}>
                Supabase Cloud
              </span>
            )}
          </div>

          {!forgotMode ? (
            /* =======================================================
               STANDARD SIGN-IN FORM
               ======================================================= */
            <>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Welcome Back
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Sign in securely to manage your loan share records.
                </p>
              </div>

              {error && (
                <div style={{ backgroundColor: 'var(--danger-light)', borderLeft: '3px solid var(--danger)', padding: '12px', borderRadius: '6px', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '18px', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                  {error}
                </div>
              )}

              {success ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--success-light)', borderRadius: '50%', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: '20px', fontWeight: 'bold' }}>✓</div>
                  <h4 style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>Authenticated</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Opening your personal dashboard...</p>
                </div>
              ) : (
                <form onSubmit={handleLoginSubmit}>
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <label className="form-label" style={{ marginBottom: 0 }}>Password</label>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotMode(true);
                          setForgotEmail(email);
                        }}
                        style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Forgot Password?
                      </button>
                    </div>
                    
                    {/* Password input with absolute show/hide toggle */}
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
                    {loading ? 'Authenticating...' : 'Sign In'}
                  </button>

                  {isMock && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'var(--bg-primary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', lineHeight: '1.4', marginBottom: '16px' }}>
                      <strong>Sandbox Simulation Mode:</strong> To simulate cloud login, sign up a new account first, or log in using any mock credentials you created in your browser local storage!
                    </div>
                  )}

                  <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    Don't have an account?{' '}
                    <a href="/signup" style={{ fontWeight: '700' }}>
                      Sign Up
                    </a>
                  </div>
                </form>
              )}
            </>
          ) : (
            /* =======================================================
               FORGOT PASSWORD - FLOW & RECOVERY STATE MACHINE
               ======================================================= */
            <>
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '-0.04em', color: 'var(--text-primary)', marginBottom: '8px' }}>
                  Reset Password
                </h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {forgotStep === 1 
                    ? 'Enter your email address to request a secure 6-digit password reset code.' 
                    : 'A 6-digit code has been dispatched. Enter it below to secure a new password.'}
                </p>
              </div>

              {forgotError && (
                <div style={{ backgroundColor: 'var(--danger-light)', borderLeft: '3px solid var(--danger)', padding: '12px', borderRadius: '6px', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '18px', lineHeight: '1.4' }}>
                  {forgotError}
                </div>
              )}

              {forgotSuccess ? (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--success-light)', borderRadius: '50%', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', fontSize: '20px', fontWeight: 'bold' }}>✓</div>
                  <h4 style={{ fontWeight: '700', fontSize: '16px', marginBottom: '4px' }}>Password Reset Successful</h4>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Returning to sign-in page...</p>
                </div>
              ) : (
                <>
                  {forgotStep === 1 ? (
                    /* Step 1: Request Code Form */
                    <form onSubmit={handleRequestOTP}>
                      <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label className="form-label">Registered Email Address</label>
                        <input
                          type="email"
                          className="form-input"
                          placeholder="name@example.com"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          required
                          disabled={forgotLoading}
                        />
                      </div>

                      <button 
                        type="submit" 
                        disabled={forgotLoading} 
                        className="btn btn-primary btn-full"
                        style={{ fontWeight: 'bold', marginBottom: '12px' }}
                      >
                        {forgotLoading ? 'Requesting Code...' : 'Send Reset Code'}
                      </button>

                      <button 
                        type="button" 
                        onClick={cancelForgotPassword}
                        className="btn btn-full"
                        style={{ backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 'bold' }}
                      >
                        Back to Login
                      </button>
                    </form>
                  ) : (
                    /* Step 2: Enter OTP Code & Choose New Password */
                    <form onSubmit={handleResetPasswordCommit}>
                      
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label">6-Digit Verification Code</label>
                        <input
                          type="text"
                          maxLength={6}
                          className="form-input"
                          placeholder="123456"
                          style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '0.2em', fontFamily: 'monospace', fontWeight: 'bold' }}
                          value={forgotCode}
                          onChange={(e) => setForgotCode(e.target.value)}
                          required
                          disabled={forgotLoading}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label className="form-label">Choose New Password</label>
                        {/* New password input with absolute show/hide toggle */}
                        <div style={{ position: 'relative' }}>
                          <input
                            type={showForgotPassword ? 'text' : 'password'}
                            className="form-input"
                            placeholder="Minimum 6 characters"
                            style={{ paddingRight: '60px' }}
                            value={forgotPassword}
                            onChange={(e) => setForgotPassword(e.target.value)}
                            required
                            disabled={forgotLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowForgotPassword(!showForgotPassword)}
                            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none' }}
                          >
                            {showForgotPassword ? 'Hide' : 'Show'}
                          </button>
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        disabled={forgotLoading} 
                        className="btn btn-primary btn-full"
                        style={{ fontWeight: 'bold', marginBottom: '12px' }}
                      >
                        {forgotLoading ? 'Confirming Change...' : 'Confirm New Password'}
                      </button>

                      <button 
                        type="button" 
                        onClick={() => setForgotStep(1)}
                        className="btn btn-full"
                        style={{ backgroundColor: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', fontWeight: 'bold' }}
                      >
                        Change Email / Request New Code
                      </button>
                    </form>
                  )}
                </>
              )}
            </>
          )}

        </div>
      </main>
    </div>
  );
}

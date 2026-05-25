'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { db } from '@/lib/db';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);

  // Profile Settings States
  const [showDropdown, setShowDropdown] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tempName, setTempName] = useState('');
  const [tempEmail, setTempEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  // Custom Email OTP Verification states
  const [verificationStep, setVerificationStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  
  // Feedback states
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ text: '', type: '' });

  // Load theme and user status
  useEffect(() => {
    // 1. Theme loading
    const savedTheme = localStorage.getItem('loan-share-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }

    // 2. Auth checking
    async function checkAuth() {
      try {
        const currentUser = await db.getCurrentUser();
        setUser(currentUser);
        if (currentUser) {
          setTempName(currentUser?.user_metadata?.display_name || currentUser?.user_metadata?.username || '');
          setTempEmail(currentUser?.email || '');
        }
      } catch (err) {
        console.error('Header auth error:', err);
      }
    }
    checkAuth();
    
    // Check session again when path changes (to catch login redirect updates)
    const interval = setInterval(checkAuth, 2000);
    return () => clearInterval(interval);
  }, [pathname]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('loan-share-theme', nextTheme);
  };

  const handleLogout = async () => {
    try {
      await db.signOut();
      setUser(null);
      setShowDropdown(false);
      router.push('/');
    } catch (err) {
      alert('Failed to log out');
    }
  };

  // --- PROFILE UPDATE OPERATIONS ---

  // 1. Save general name / username metadata
  const handleUpdateMetadata = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ text: '', type: '' });

    try {
      await db.updateUserProfile(null, { display_name: tempName.trim() });
      const updatedUser = await db.getCurrentUser();
      setUser(updatedUser);
      setProfileMsg({ text: 'Username updated successfully!', type: 'success' });
    } catch (err) {
      console.error(err);
      setProfileMsg({ text: err.message || 'Failed to update username.', type: 'danger' });
    } finally {
      setProfileSaving(false);
    }
  };

  // 2. Change password
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) return;
    setProfileSaving(true);
    setProfileMsg({ text: '', type: '' });

    try {
      await db.updateUserPassword(newPassword.trim());
      setNewPassword('');
      setProfileMsg({ text: 'Password changed successfully!', type: 'success' });
    } catch (err) {
      console.error(err);
      setProfileMsg({ text: err.message || 'Failed to update password.', type: 'danger' });
    } finally {
      setProfileSaving(false);
    }
  };

  // 3. Request Email update: Trigger Custom SMTP verification code
  const handleRequestEmailChange = async (e) => {
    e.preventDefault();
    if (!tempEmail.trim() || tempEmail.trim().toLowerCase() === user?.email?.toLowerCase()) return;
    
    setProfileSaving(true);
    setProfileMsg({ text: '', type: '' });

    // Mock Offline Sandbox Flow
    if (db.isMock()) {
      setVerificationStep(true);
      setVerificationToken('mock-sim-token');
      setProfileMsg({ 
        text: 'Simulation Mode: Enter simulated OTP "123456" below to confirm email change!', 
        type: 'warning' 
      });
      setProfileSaving(false);
      return;
    }

    // Live Cloud Flow using custom serverless API
    try {
      const res = await fetch('/api/email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail: tempEmail.trim() })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP.');

      setVerificationToken(data.verificationToken);
      setVerificationStep(true);
      
      setProfileMsg({ 
        text: 'A verification passcode has been dispatched to your new email. Please input the 6-digit code below.', 
        type: 'success' 
      });
    } catch (err) {
      console.error(err);
      setProfileMsg({ text: err.message || 'Failed to trigger verification code.', type: 'danger' });
    } finally {
      setProfileSaving(false);
    }
  };

  // 4. Verify Email update using OTP
  const handleVerifyEmailChange = async (e) => {
    e.preventDefault();
    if (!verificationCode.trim()) return;

    setProfileSaving(true);
    setProfileMsg({ text: '', type: '' });

    // Mock Offline Sandbox Flow
    if (db.isMock()) {
      if (verificationCode.trim() === '123456') {
        try {
          await db.updateUserProfile(tempEmail.trim(), null);
          const updatedUser = await db.getCurrentUser();
          setUser(updatedUser);
          setVerificationStep(false);
          setVerificationCode('');
          setProfileMsg({ text: 'Email updated successfully in Local Sandbox!', type: 'success' });
        } catch (err) {
          setProfileMsg({ text: 'Failed to update email.', type: 'danger' });
        }
      } else {
        setProfileMsg({ text: 'Invalid verification passcode. Use 123456.', type: 'danger' });
      }
      setProfileSaving(false);
      return;
    }

    // Live Cloud Flow bypassing default links via admin bypass
    try {
      // Get JWT auth session token
      const sessionString = localStorage.getItem('sb-qfsplljfszkcqklkrzwi-auth-token');
      let accessToken = '';
      if (sessionString) {
        const parsed = JSON.parse(sessionString);
        accessToken = parsed?.access_token || '';
      }

      const res = await fetch('/api/email-otp', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ 
          newEmail: tempEmail.trim(), 
          code: verificationCode.trim(), 
          verificationToken 
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed.');

      const updatedUser = await db.getCurrentUser();
      setUser(updatedUser);
      setVerificationStep(false);
      setVerificationCode('');
      setProfileMsg({ text: 'Your registered email address was updated successfully!', type: 'success' });
      
    } catch (err) {
      console.error(err);
      setProfileMsg({ text: err.message || 'Passcode verification failed. Please try again.', type: 'danger' });
    } finally {
      setProfileSaving(false);
    }
  };

  const usernameLabel = user?.user_metadata?.display_name || user?.user_metadata?.username || '';
  const avatarLetter = (usernameLabel || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <>
      <header className="navbar">
        <div className="container navbar-inner">
          <a href="/" className="logo-container">
            {/* Minimalist modern balance icon (◌ ⇄ ◌) */}
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="logo-svg"
              style={{ width: '28px', height: '28px', verticalAlign: 'middle', marginRight: '6px' }}
            >
              <circle cx="8" cy="12" r="4.5" />
              <circle cx="16" cy="12" r="4.5" />
              <path d="M12 9l2 3-2 3" />
              <path d="M12 15l-2-3 2-3" />
            </svg>
            <span style={{ fontWeight: '800', letterSpacing: '-0.05em' }}>Loan<span style={{ color: 'var(--accent)' }}>Share</span></span>
          </a>

          <div className="nav-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              
              {/* Not Logged In Nav Links */}
              {!user ? (
                <>
                  {pathname !== '/demo' && (
                    <button 
                      onClick={() => router.push('/demo')}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '13px', padding: '6px 14px' }}
                    >
                      Try Demo
                    </button>
                  )}
                  
                  {pathname !== '/login' && pathname !== '/signup' && (
                    <a 
                      href="/login" 
                      style={{ 
                        fontSize: '13px', 
                        fontWeight: '600', 
                        color: 'var(--text-secondary)' 
                      }}
                    >
                      Log In
                    </a>
                  )}

                  {pathname !== '/signup' && (
                    <button 
                      onClick={() => router.push('/signup')}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '13px', padding: '6px 14px', fontWeight: 'bold' }}
                    >
                      Sign Up
                    </button>
                  )}
                </>
              ) : (
                // Logged In Nav Links
                <>
                  {pathname !== '/dashboard' && (
                    <button 
                      onClick={() => router.push('/dashboard')}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '13px', padding: '6px 14px' }}
                    >
                      Dashboard
                    </button>
                  )}
                  
                  {/* Circular User Avatar Dropdown Controller */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowDropdown(!showDropdown)}
                      className="avatar-btn"
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent)',
                        color: 'white',
                        border: '2px solid var(--border)',
                        fontWeight: '800',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                        boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.25)'
                      }}
                      title={usernameLabel || user.email}
                    >
                      {avatarLetter}
                    </button>

                    {/* Navigation Dropdown List */}
                    {showDropdown && (
                      <div 
                        className="card"
                        style={{
                          position: 'absolute',
                          top: '42px',
                          right: '0',
                          width: '200px',
                          padding: '8px',
                          zIndex: 99,
                          boxShadow: 'var(--shadow-lg)',
                          animation: 'fadeIn 0.2s ease-out'
                        }}
                      >
                        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', marginBottom: '6px' }}>
                          <div style={{ fontWeight: '700', fontSize: '13px', color: 'var(--text-primary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {usernameLabel || 'User Account'}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {user.email}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setShowDropdown(false);
                            setShowModal(true);
                            setVerificationStep(false);
                            setProfileMsg({ text: '', type: '' });
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                          </svg>
                          Profile Settings
                        </button>

                        <button
                          onClick={handleLogout}
                          className="btn btn-secondary btn-sm"
                          style={{ width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: '8px 12px', fontSize: '13px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          Log Out
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Theme Toggle Icon */}
              <button 
                onClick={toggleTheme} 
                className="theme-toggle" 
                aria-label="Toggle theme"
                title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
                style={{ flexShrink: 0 }}
              >
                {theme === 'light' ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                )}
              </button>

            </div>
          </div>
        </div>
      </header>

      {/* Global Settings & Profile Modal */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <div 
            className="card animate-scale-in" 
            style={{ 
              maxWidth: '500px', 
              width: '100%', 
              padding: '28px', 
              boxShadow: 'var(--shadow-xl)', 
              position: 'relative',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <div className="pattern-bg"></div>
            
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '-0.03em', margin: 0, color: 'var(--text-primary)' }}>Profile Settings</h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary" 
                  style={{ padding: '0', borderRadius: '50%', minWidth: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {profileMsg.text && (
                <div 
                  className="badge" 
                  style={{ 
                    display: 'block', 
                    padding: '10px 14px', 
                    borderRadius: '6px', 
                    backgroundColor: `var(--${profileMsg.type}-light)`, 
                    color: `var(--${profileMsg.type})`, 
                    border: `1px solid var(--border)`,
                    marginBottom: '20px',
                    fontSize: '13px',
                    textTransform: 'none',
                    fontWeight: 500,
                    lineHeight: '1.4'
                  }}
                >
                  {profileMsg.text}
                </div>
              )}

              {/* Sub-form A: Username change */}
              <form onSubmit={handleUpdateMetadata} style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontWeight: '700' }}>Username / Display Name</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      value={tempName} 
                      onChange={(e) => setTempName(e.target.value)} 
                      placeholder="e.g. John Doe"
                      style={{ flex: 1 }}
                      required
                    />
                    <button 
                      type="submit" 
                      disabled={profileSaving}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '8px 16px', fontWeight: 'bold' }}
                    >
                      Update
                    </button>
                  </div>
                </div>
              </form>

              {/* Sub-form B: Email change with OTP verification */}
              <div style={{ marginBottom: '24px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
                <label className="form-label" style={{ fontWeight: '700', marginBottom: '8px', display: 'block' }}>Email Address</label>
                
                {!verificationStep ? (
                  <form onSubmit={handleRequestEmailChange}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="email" 
                        className="form-input" 
                        value={tempEmail} 
                        onChange={(e) => setTempEmail(e.target.value)} 
                        placeholder="new@example.com"
                        style={{ flex: 1 }}
                        required
                      />
                      <button 
                        type="submit" 
                        disabled={profileSaving || tempEmail.trim().toLowerCase() === user?.email?.toLowerCase()}
                        className="btn className btn-primary btn-sm"
                        style={{ padding: '8px 16px', fontWeight: 'bold' }}
                      >
                        Request OTP
                      </button>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Updating email address will send a verification code to the new email address.
                    </span>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyEmailChange} style={{ animation: 'fadeIn 0.25s ease-out' }}>
                    <div style={{ backgroundColor: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      Enter the 6-digit OTP code sent to <strong>{tempEmail}</strong> to confirm ownership and authorize the change.
                    </div>
                    
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Enter 6-digit code"
                        maxLength="6"
                        value={verificationCode}
                        onChange={(e) => setVerificationCode(e.target.value)}
                        style={{ flex: 1, letterSpacing: '0.2em', fontWeight: '800', textAlign: 'center' }}
                        required
                      />
                      <button 
                        type="submit" 
                        disabled={profileSaving}
                        className="btn btn-success btn-sm"
                        style={{ padding: '8px 16px', fontWeight: 'bold' }}
                      >
                        Verify OTP
                      </button>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setVerificationStep(false)}
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: '10px', fontSize: '11px', border: 'none', padding: '4px 8px' }}
                    >
                      ← Back to Change Email
                    </button>
                  </form>
                )}
              </div>

              {/* Sub-form C: Password change */}
              <form onSubmit={handleUpdatePassword}>
                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label" style={{ fontWeight: '700' }}>Change Account Password</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input 
                      type="password" 
                      className="form-input" 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="Enter new password"
                      style={{ flex: 1 }}
                      required
                      minLength="6"
                    />
                    <button 
                      type="submit" 
                      disabled={profileSaving || !newPassword.trim()}
                      className="btn btn-primary btn-sm"
                      style={{ padding: '8px 16px', fontWeight: 'bold' }}
                    >
                      Save Password
                    </button>
                  </div>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}
    </>
  );
}

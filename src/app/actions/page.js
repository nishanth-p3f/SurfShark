'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import Header from '@/components/Header';

function ActionsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const action = searchParams.get('action'); // 'collect' or 'snooze'
  const loanId = searchParams.get('loanId');
  const urlHours = searchParams.get('hours'); // Optional direct hours snooze

  const [loan, setLoan] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Collect state
  const [selectedAccountId, setSelectedAccountId] = useState('');
  
  // Snooze state
  const [selectedHours, setSelectedHours] = useState(urlHours || '2');

  useEffect(() => {
    if (!loanId || !action) {
      setError('Invalid request. Missing parameters.');
      setLoading(false);
      return;
    }

    async function loadData() {
      try {
        const allLoans = await db.getLoans();
        const foundLoan = allLoans.find(l => l.id === loanId);
        
        if (!foundLoan) {
          setError('Loan record not found. It might have been deleted.');
          setLoading(false);
          return;
        }

        setLoan(foundLoan);

        if (action === 'collect') {
          const allAccounts = await db.getAccounts();
          setAccounts(allAccounts);
          if (allAccounts.length > 0) {
            setSelectedAccountId(allAccounts[0].id);
          }
        }

        // If direct snooze hours are provided in URL, apply immediately!
        if (action === 'snooze' && urlHours) {
          await db.snoozeLoan(loanId, parseInt(urlHours));
          setSuccess(true);
          setSuccessMsg(`Reminder for ${foundLoan.contact_name} has been snoozed for ${urlHours} hours!`);
        }
      } catch (err) {
        console.error('Error loading data for actions page', err);
        setError('Failed to load details from the database.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [loanId, action, urlHours]);

  const handleCollect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      await db.markLoanAsCollected(loanId, selectedAccountId || null);
      
      const accName = selectedAccountId 
        ? accounts.find(a => a.id === selectedAccountId)?.name 
        : 'none';
        
      setSuccess(true);
      setSuccessMsg(
        `Successfully marked ₹${loan.outstanding_amount} from ${loan.contact_name} as collected!` +
        (selectedAccountId ? ` Deposited into ${accName}.` : '')
      );
    } catch (err) {
      console.error(err);
      setError('Failed to update the database. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const hours = parseInt(selectedHours);
      await db.snoozeLoan(loanId, hours);
      setSuccess(true);
      setSuccessMsg(`Reminder for ${loan.contact_name} has been successfully snoozed for ${hours} hours!`);
    } catch (err) {
      console.error(err);
      setError('Failed to snooze reminder. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !success) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            border: '3px solid var(--border)', 
            borderTopColor: 'var(--accent)', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px auto'
          }}></div>
          <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
          <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Processing action...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: '480px', margin: '40px auto', padding: '0 16px', width: '100%' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--danger)', padding: '32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', color: 'var(--danger)', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>Action Failed</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>{error}</p>
          <button className="btn btn-secondary btn-full" onClick={() => router.push('/')}>Go to Dashboard</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div style={{ maxWidth: '480px', margin: '40px auto', padding: '0 16px', width: '100%', animation: 'fadeIn 0.5s ease-out' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--success)', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            backgroundColor: 'var(--success-light)', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 20px auto',
            color: 'var(--success)',
            fontSize: '32px',
            fontWeight: 'bold'
          }}>
            ✓
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, marginBottom: '12px' }}>Success!</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, marginBottom: '28px' }}>{successMsg}</p>
          <button className="btn btn-primary btn-full" onClick={() => router.push('/')}>Open Dashboard</button>
        </div>
      </div>
    );
  }

  const isLend = loan.type === 'lend';

  return (
    <div style={{ maxWidth: '520px', margin: '40px auto', padding: '0 16px', width: '100%', animation: 'fadeIn 0.5s ease-out' }}>
      <div className="card">
        <div className="pattern-bg"></div>
        
        {action === 'collect' ? (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <span className={`badge badge-${loan.type}`} style={{ marginBottom: '12px' }}>
                {isLend ? 'Lent Out (Collect)' : 'Borrowed (Repay)'}
              </span>
              <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
                Confirm Collection
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                You are marking the loan with <strong>{loan.contact_name}</strong> as fully collected and settled.
              </p>
            </div>

            <div style={{ 
              backgroundColor: 'var(--bg-tertiary)', 
              borderRadius: '8px', 
              padding: '16px', 
              marginBottom: '24px', 
              borderLeft: '4px solid var(--success)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Amount to Settlement</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>{loan.contact_name}</div>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--success)' }}>
                ₹${parseFloat(loan.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <form onSubmit={handleCollect}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">🏦 Deposit Into Bank Account</label>
                {accounts.length > 0 ? (
                  <select 
                    className="form-input" 
                    value={selectedAccountId} 
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    style={{ cursor: 'pointer', width: '100%' }}
                  >
                    <option value="">Do not update bank balance (settle only)</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Current: ₹${parseFloat(acc.balance).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', padding: '10px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '6px' }}>
                    No bank accounts linked to sync balance. Settle only.
                  </div>
                )}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  This will automatically {isLend ? 'increase' : 'decrease'} the selected account balance.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => router.push('/')}>Cancel</button>
                <button type="submit" className="btn btn-success" style={{ flex: 2 }}>✓ Confirm Collection</button>
              </div>
            </form>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <span className="badge" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)', marginBottom: '12px' }}>⏰ Snooze Reminder</span>
              <h2 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '8px' }}>
                Snooze Notification
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>
                Choose when you would like to be reminded again to collect from <strong>{loan.contact_name}</strong>.
              </p>
            </div>

            <div style={{ 
              backgroundColor: 'var(--bg-tertiary)', 
              borderRadius: '8px', 
              padding: '16px', 
              marginBottom: '24px', 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Loan Outstanding</div>
                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '2px' }}>{loan.contact_name}</div>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800 }}>
                ₹${parseFloat(loan.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <form onSubmit={handleSnooze}>
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label className="form-label">⏰ Snooze Duration</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {[
                    { label: '2 Hours', val: '2' },
                    { label: '6 Hours', val: '6' },
                    { label: '12 Hours', val: '12' },
                    { label: '24 Hours (1 Day)', val: '24' },
                    { label: '48 Hours (2 Days)', val: '48' },
                    { label: '1 Week', val: '168' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setSelectedHours(opt.val)}
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid ' + (selectedHours === opt.val ? 'var(--accent)' : 'var(--border)'),
                        backgroundColor: selectedHours === opt.val ? 'var(--accent-light)' : 'var(--bg-primary)',
                        color: selectedHours === opt.val ? 'var(--accent)' : 'var(--text-primary)',
                        fontWeight: selectedHours === opt.val ? '700' : '500',
                        cursor: 'pointer',
                        transition: 'var(--transition)',
                        textAlign: 'center'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => router.push('/')}>Cancel</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 2 }}>⏰ Save Snooze</button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActionsPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-primary)', padding: '24px 0' }}>
        <Suspense fallback={
          <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Loading interactive panel...</p>
          </div>
        }>
          <ActionsContent />
        </Suspense>
      </main>
    </div>
  );
}

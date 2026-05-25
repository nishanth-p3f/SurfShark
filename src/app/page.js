'use client';

import { useRouter } from 'next/navigation';
import Header from '@/components/Header';

export default function Home() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      
      {/* HERO SECTION */}
      <section 
        style={{ 
          padding: '80px 20px', 
          textAlign: 'center', 
          background: 'linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div className="pattern-bg" style={{ width: '300px', height: '300px', top: '-100px', right: '10%' }}></div>
        <div className="pattern-bg" style={{ width: '300px', height: '300px', bottom: '-150px', left: '5%', background: 'radial-gradient(circle, var(--danger-light) 0%, transparent 70%)' }}></div>
        
        <div className="container animate-fade-in" style={{ maxWidth: '800px' }}>
          
          {/* Logo large display */}
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="logo-svg"
              style={{ width: '48px', height: '48px', color: 'var(--accent)' }}
            >
              <circle cx="8" cy="12" r="4.5" />
              <circle cx="16" cy="12" r="4.5" />
              <path d="M12 9l2 3-2 3" />
              <path d="M12 15l-2-3 2-3" />
            </svg>
          </div>

          <h1 
            style={{ 
              fontSize: '48px', 
              fontWeight: '900', 
              letterSpacing: '-0.04em', 
              lineHeight: '1.15', 
              color: 'var(--text-primary)',
              marginBottom: '20px'
            }}
          >
            Splits, Borrows & Bank Balances.<br />
            <span style={{ color: 'var(--accent)' }}>Coordinated & Automated.</span>
          </h1>

          <p 
            style={{ 
              fontSize: '18px', 
              color: 'var(--text-secondary)', 
              lineHeight: '1.6', 
              maxWidth: '640px', 
              margin: '0 auto 36px auto',
              fontWeight: '500'
            }}
          >
            Track outstanding debts, lendings, and linked bank account cashflows in one secure dashboard. Get automated email reminders on due dates with direct 1-tap snooze and payment settling.
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '48px' }}>
            <button 
              onClick={() => router.push('/signup')} 
              className="btn btn-primary"
              style={{ padding: '14px 28px', fontSize: '15px', fontWeight: 'bold' }}
            >
              🚀 Create Your Free Account
            </button>
            <button 
              onClick={() => router.push('/demo')} 
              className="btn btn-secondary"
              style={{ padding: '14px 28px', fontSize: '15px', fontWeight: 'bold' }}
            >
              🎮 Try Interactive Sandbox
            </button>
          </div>

          {/* Marketing Mockup Visual */}
          <div 
            className="card" 
            style={{ 
              maxWidth: '720px', 
              margin: '0 auto', 
              padding: '16px', 
              border: '2px solid var(--border)',
              background: 'var(--bg-secondary)',
              textAlign: 'left',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
              <div style={{ width: '10px', height: '10px', backgroundColor: '#ef4444', borderRadius: '50%' }}></div>
              <div style={{ width: '10px', height: '10px', backgroundColor: '#eab308', borderRadius: '50%' }}></div>
              <div style={{ width: '10px', height: '10px', backgroundColor: '#22c55e', borderRadius: '50%' }}></div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '10px', fontFamily: 'monospace' }}>dashboard.loanshare.com</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="form-row">
              <div style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--success)' }}>
                <span className="badge badge-lend" style={{ fontSize: '9px', marginBottom: '6px' }}>Lent Out</span>
                <div style={{ fontWeight: '700', fontSize: '13px' }}>Alex Johnson</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--success)', marginTop: '2px' }}>₹5,000.00</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Due: In 2 Days</div>
              </div>
              <div style={{ backgroundColor: 'var(--bg-primary)', padding: '12px', borderRadius: '6px', borderLeft: '3px solid var(--danger)' }}>
                <span className="badge badge-borrow" style={{ fontSize: '9px', marginBottom: '6px' }}>Borrowed</span>
                <div style={{ fontWeight: '700', fontSize: '13px' }}>Sarah Miller (Rent Help)</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--danger)', marginTop: '2px' }}>₹8,000.00</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Due: 1 Day Ago</div>
              </div>
            </div>

            {/* Simulated interactive email notification banner inside landing */}
            <div 
              style={{ 
                marginTop: '16px', 
                backgroundColor: 'var(--accent-light)', 
                border: '1px dashed var(--accent)', 
                padding: '12px', 
                borderRadius: '6px', 
                fontSize: '12px', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '8px' 
              }}
            >
              <div style={{ color: 'var(--text-primary)' }}>
                ✉️ <strong>Daily Email Alert Triggered:</strong> "Dues Collecting Today: ₹5,000 from Alex Johnson."
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <span className="badge badge-lend" style={{ textTransform: 'none', cursor: 'default' }}>✓ Settle Direct</span>
                <span className="badge" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--accent)', textTransform: 'none', cursor: 'default' }}>⏰ Snooze 24h</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* CORE FEATURES GRID */}
      <section style={{ padding: '64px 20px', backgroundColor: 'var(--bg-secondary)' }}>
        <div className="container">
          
          <h2 
            style={{ 
              fontSize: '32px', 
              fontWeight: '800', 
              textAlign: 'center', 
              letterSpacing: '-0.03em', 
              marginBottom: '48px',
              color: 'var(--text-primary)'
            }}
          >
            Everything You Need to Maintain Financial Balance
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>🏦</div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Linked Bank Cashflows</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Maintain separate balances for your checkings, savings, or physical cash. See your total combined liquidity automatically calculated.
              </p>
            </div>

            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>📈</div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Smart Balance Deductions</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Record splits or borrows, select a linked bank, and the cash is automatically deducted or added. Settling loans adjusts bank balances instantly!
              </p>
            </div>

            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>⏰</div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>1-Tap Email Actions</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Receive beautifully formatted HTML email alerts on due dates. Tapping links in your inbox instantly marks loans as collected or snoozes reminders.
              </p>
            </div>

            <div className="card" style={{ padding: '24px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔒</div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Secure Private Accounts</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Get completely generic multi-user support out of the box. Securely login with email verification code OTPs and safeguard your financial ledgers.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 0', backgroundColor: 'var(--bg-primary)' }}>
        <div className="container" style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: '800', fontSize: '16px', marginBottom: '12px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="logo-svg" style={{ width: '22px', height: '22px' }}>
              <circle cx="8" cy="12" r="4.5" /><circle cx="16" cy="12" r="4.5" />
            </svg>
            <span>LoanShare</span>
          </div>
          <p style={{ fontWeight: '500' }}>Generic Multi-User Financial Coordinator App</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
            Coordinate transactions, splits, and borrows with automatic email alerts.
          </p>
        </div>
      </footer>
    </div>
  );
}

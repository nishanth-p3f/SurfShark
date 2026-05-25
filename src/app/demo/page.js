'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import Header from '@/components/Header';

export default function DemoDashboard() {
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [investments, setInvestments] = useState([]); // Investments state
  
  // App states
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active'); // 'active', 'lends', 'borrows', 'investments', 'history'
  const [activeCreationTab, setActiveCreationTab] = useState('loan'); // 'loan' or 'investment'

  // Bank Form State
  const [newAccName, setNewAccName] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('');
  const [editingAccId, setEditingAccId] = useState(null);
  const [editingAccBalance, setEditingAccBalance] = useState('');

  // Loan Form State
  const [loanType, setLoanType] = useState('lend'); // 'lend' or 'borrow'
  const [contactName, setContactName] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');
  const [syncWithAccount, setSyncWithAccount] = useState(''); // Bank account to adjust

  // Investment Form State
  const [newInvName, setNewInvName] = useState('');
  const [newInvClass, setNewInvClass] = useState('gold'); // 'gold', 'stocks', 'mutual_funds', 'real_estate', 'crypto', 'fd_bonds', 'other'
  const [newInvAmount, setNewInvAmount] = useState('');
  const [newInvValue, setNewInvValue] = useState('');
  const [newInvNotes, setNewInvNotes] = useState('');
  const [syncInvWithAccount, setSyncInvWithAccount] = useState(''); // Bank account to deduct principal from

  // Inline Partial Payment State
  const [payLoanId, setPayLoanId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payAccountId, setPayAccountId] = useState('');

  // Quick reminder / snooze panel state
  const [snoozeLoanId, setSnoozeLoanId] = useState(null);

  // Contact Filtration State
  const [selectedContactFilter, setSelectedContactFilter] = useState('');
  const [emailStatus, setEmailStatus] = useState({ loading: false, msg: '', type: '' });

  // For /demo, we force offline LocalStorage database operations
  useEffect(() => {
    setMounted(true);
    async function loadData() {
      try {
        const accs = await db.getAccounts();
        const lns = await db.getLoans();
        const invs = await db.getInvestments();
        setAccounts(accs);
        setLoans(lns);
        setInvestments(invs);
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Sync databases helper
  const refreshData = async () => {
    try {
      const accs = await db.getAccounts();
      const lns = await db.getLoans();
      const invs = await db.getInvestments();
      setAccounts(accs);
      setLoans(lns);
      setInvestments(invs);
    } catch (err) {
      console.error('Error refreshing data:', err);
    }
  };

  // --- ACTIONS ---

  // Add Bank Account
  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!newAccName.trim() || !newAccBalance) return;
    
    try {
      await db.addAccount({
        name: newAccName,
        balance: parseFloat(newAccBalance) || 0,
        currency: 'INR'
      });
      setNewAccName('');
      setNewAccBalance('');
      await refreshData();
    } catch (err) {
      alert('Failed to add bank account');
    }
  };

  // Edit Account Balance inline
  const handleStartEditBalance = (acc) => {
    setEditingAccId(acc.id);
    setEditingAccBalance(acc.balance.toString());
  };

  const handleSaveBalance = async (id) => {
    if (!editingAccBalance) return;
    try {
      await db.updateAccountBalance(id, parseFloat(editingAccBalance) || 0);
      setEditingAccId(null);
      await refreshData();
    } catch (err) {
      alert('Failed to update balance');
    }
  };

  // Delete Bank Account
  const handleDeleteAccount = async (id) => {
    if (!confirm('Are you sure you want to delete this bank account? This will not affect existing loans.')) return;
    try {
      await db.deleteAccount(id);
      await refreshData();
    } catch (err) {
      alert('Failed to delete account');
    }
  };

  // Add Loan (Lend or Borrow)
  const handleAddLoan = async (e) => {
    e.preventDefault();
    if (!contactName.trim() || !loanAmount || !loanDueDate) return;

    const amt = parseFloat(loanAmount);
    try {
      await db.addLoan({
        type: loanType,
        contact_name: contactName,
        amount: amt,
        due_date: loanDueDate,
        notes: loanNotes,
      });

      if (syncWithAccount) {
        const account = accounts.find(a => a.id === syncWithAccount);
        if (account) {
          const multiplier = loanType === 'lend' ? -1 : 1;
          const newBal = parseFloat(account.balance) + (amt * multiplier);
          await db.updateAccountBalance(account.id, newBal);
        }
      }

      setContactName('');
      setLoanAmount('');
      setLoanDueDate('');
      setLoanNotes('');
      setSyncWithAccount('');
      await refreshData();
    } catch (err) {
      alert('Failed to save loan record');
    }
  };

  // Add Investment
  const handleAddInvestment = async (e) => {
    e.preventDefault();
    if (!newInvName.trim() || !newInvAmount) return;

    const amt = parseFloat(newInvAmount) || 0;
    // Default current value to amount invested if empty
    const val = newInvValue ? parseFloat(newInvValue) : amt;

    try {
      await db.addInvestment({
        asset_name: newInvName.trim(),
        asset_class: newInvClass,
        amount_invested: amt,
        current_value: val,
        notes: newInvNotes.trim()
      });

      if (syncInvWithAccount) {
        const account = accounts.find(a => a.id === syncInvWithAccount);
        if (account) {
          const newBal = parseFloat(account.balance) - amt;
          await db.updateAccountBalance(account.id, newBal);
        }
      }

      setNewInvName('');
      setNewInvClass('gold');
      setNewInvAmount('');
      setNewInvValue('');
      setNewInvNotes('');
      setSyncInvWithAccount('');
      await refreshData();
    } catch (err) {
      alert('Failed to save investment record');
    }
  };

  // Update Investment Value
  const handleUpdateInvestmentValue = async (id, currentVal) => {
    const input = prompt(`Update Current Market Value (Current: ₹${currentVal.toLocaleString('en-IN')})`, currentVal.toString());
    if (input === null) return;
    const newVal = parseFloat(input);
    if (isNaN(newVal) || newVal < 0) {
      alert('Please enter a valid numeric value.');
      return;
    }
    try {
      await db.updateInvestmentValue(id, newVal);
      await refreshData();
    } catch (err) {
      alert('Failed to update investment valuation');
    }
  };

  // Delete Investment
  const handleDeleteInvestment = async (id) => {
    if (!confirm('Are you sure you want to delete this investment record?')) return;
    try {
      await db.deleteInvestment(id);
      await refreshData();
    } catch (err) {
      alert('Failed to delete investment');
    }
  };

  // Mark Loan as Fully Settled
  const handleMarkSettled = async (loanId, currentOutstanding, type) => {
    let depositMsg = type === 'lend' 
      ? 'Which account did you receive these funds into?' 
      : 'Which account did you pay these funds from?';
      
    let optionsStr = accounts.map((a, i) => `${i + 1}. ${a.name} (Bal: ₹${a.balance})`).join('\n');
    let input = prompt(
      `Settle entire outstanding of ₹${currentOutstanding}?\n\n${depositMsg}\n${optionsStr}\n\nType the bank account number (1, 2 etc.) or leave blank/Cancel to settle without adjusting bank balances:`
    );

    let selectedAccId = null;
    if (input) {
      const idx = parseInt(input) - 1;
      if (idx >= 0 && idx < accounts.length) {
        selectedAccId = accounts[idx].id;
      }
    }

    try {
      await db.settleFullLoan(loanId, selectedAccId, parseFloat(currentOutstanding));
      await refreshData();
    } catch (err) {
      alert('Failed to settle loan record');
    }
  };

  // Save Partial Payment
  const handleSavePartialPayment = async (e) => {
    e.preventDefault();
    if (!payAmount || parseFloat(payAmount) <= 0) return;

    const amt = parseFloat(payAmount);
    const targetLoan = loans.find(l => l.id === payLoanId);
    if (!targetLoan) return;

    const newOutstanding = targetLoan.outstanding_amount - amt;

    try {
      await db.updateLoanOutstanding(payLoanId, Math.max(0, newOutstanding), payAccountId || null, amt);
      setPayLoanId(null);
      setPayAmount('');
      setPayAccountId('');
      await refreshData();
    } catch (err) {
      alert('Failed to process partial payment');
    }
  };

  // Quick Snooze Reminder directly from dashboard
  const handleDashboardSnooze = async (loanId, hours) => {
    try {
      await db.snoozeLoan(loanId, hours);
      setSnoozeLoanId(null);
      alert(`Reminder snoozed for ${hours} hours!`);
    } catch (err) {
      alert('Failed to snooze reminder');
    }
  };

  // Simulated Email Report trigger for offline trial mode
  const triggerSendReport = (contactName = '') => {
    setEmailStatus({ 
      loading: true, 
      msg: contactName 
        ? `Compiling offline ledger statement for ${contactName} and preparing email simulation...` 
        : 'Compiling financial balances and preparing email report simulation...', 
      type: 'info' 
    });
    
    setTimeout(() => {
      setEmailStatus({ 
        loading: false, 
        msg: contactName 
          ? `Simulation: statement for ${contactName} compiled and simulated successfully!`
          : 'Simulation: full consolidated report compiled and simulated successfully!', 
        type: 'success' 
      });
    }, 1000);
  };

  // Export active loans / ledgers scoped by contact as a CSV spreadsheet (Simulated Local Mode)
  const handleExportCSV = () => {
    const targetLoans = selectedContactFilter
      ? loans.filter(l => l.contact_name?.trim().toLowerCase() === selectedContactFilter.trim().toLowerCase())
      : loans;

    if (targetLoans.length === 0) {
      alert('No simulated transactions available to export.');
      return;
    }

    const headers = ['Date', 'Type', 'Contact Name', 'Original Amount', 'Outstanding Amount', 'Status', 'Notes'];
    const rows = targetLoans.map(l => [
      l.due_date || '',
      l.type === 'lend' ? 'Lent Out' : 'Borrowed',
      l.contact_name || '',
      l.amount || 0,
      l.outstanding_amount || 0,
      l.status || '',
      (l.notes || '').replace(/"/g, '""')
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = selectedContactFilter 
      ? `loanshare_sim_ledger_${selectedContactFilter.toLowerCase().replace(/\s+/g, '_')}.csv`
      : 'loanshare_sim_portfolio_report.csv';
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- CALCULATIONS FOR SUMMARY CARDS ---
  const uniqueContacts = Array.from(new Set(loans.map(l => l.contact_name?.trim()).filter(Boolean))).sort();

  const activeLoans = loans.filter(l => l.status === 'active');

  // Scope active loans calculations specifically to the selected contact when filtered in sandbox
  const scopedActiveLoans = selectedContactFilter
    ? activeLoans.filter(l => l.contact_name?.trim().toLowerCase() === selectedContactFilter.trim().toLowerCase())
    : activeLoans;

  const totalLent = scopedActiveLoans.filter(l => l.type === 'lend').reduce((sum, l) => sum + parseFloat(l.outstanding_amount), 0);
  const totalBorrowed = scopedActiveLoans.filter(l => l.type === 'borrow').reduce((sum, l) => sum + parseFloat(l.outstanding_amount), 0);
  const bankBalance = accounts.reduce((sum, a) => sum + parseFloat(a.balance), 0);
  
  // Investments Totals
  const totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.amount_invested), 0);
  const totalInvValue = investments.reduce((sum, inv) => sum + parseFloat(inv.current_value), 0);
  const totalInvReturn = totalInvValue - totalInvested;
  const invReturnPercent = totalInvested > 0 ? (totalInvReturn / totalInvested) * 100 : 0;

  // Net Worth scopes to contact returns when filtered, otherwise consolidates banks, loans, and assets
  const netWorth = selectedContactFilter
    ? totalLent - totalBorrowed
    : bankBalance + totalLent - totalBorrowed + totalInvValue;

  // Donut Chart calculations
  const chartTotal = selectedContactFilter
    ? totalLent + totalBorrowed
    : totalLent + totalBorrowed + bankBalance + totalInvValue;

  const lentPct = chartTotal > 0 ? (totalLent / chartTotal) * 100 : 0;
  const borrowPct = chartTotal > 0 ? (totalBorrowed / chartTotal) * 100 : 0;
  const bankPct = (!selectedContactFilter && chartTotal > 0) ? (bankBalance / chartTotal) * 100 : 0;
  const investPct = (!selectedContactFilter && chartTotal > 0) ? (totalInvValue / chartTotal) * 100 : 0;

  let currentStart = 0;
  const segments = [];
  
  if (totalLent > 0) {
    segments.push(`var(--success) ${currentStart}% ${currentStart + lentPct}%`);
    currentStart += lentPct;
  }
  if (totalBorrowed > 0) {
    segments.push(`var(--danger) ${currentStart}% ${currentStart + borrowPct}%`);
    currentStart += borrowPct;
  }
  if (!selectedContactFilter && bankBalance > 0) {
    segments.push(`var(--accent) ${currentStart}% ${currentStart + bankPct}%`);
    currentStart += bankPct;
  }
  if (!selectedContactFilter && totalInvValue > 0) {
    segments.push(`#6366f1 ${currentStart}% ${currentStart + investPct}%`);
    currentStart += investPct;
  }

  const conicGradientString = segments.length > 0 
    ? `conic-gradient(${segments.join(', ')})`
    : `var(--border)`;

  // Filtered Loans for listing (Applies tab filter and contact scope)
  const filteredLoans = loans.filter(l => {
    if (selectedContactFilter && l.contact_name?.trim().toLowerCase() !== selectedContactFilter.trim().toLowerCase()) {
      return false;
    }
    if (activeTab === 'active') return l.status === 'active';
    if (activeTab === 'lends') return l.status === 'active' && l.type === 'lend';
    if (activeTab === 'borrows') return l.status === 'active' && l.type === 'borrow';
    if (activeTab === 'history') return l.status === 'repaid';
    return true;
  });

  // Category tags styles helper for investments
  const getAssetClassBadgeStyle = (assetClass) => {
    switch (assetClass) {
      case 'gold':
        return { color: '#854d0e', backgroundColor: '#fef9c3', border: '1px solid #fde047' };
      case 'stocks':
        return { color: '#1d4ed8', backgroundColor: '#dbeafe', border: '1px solid #93c5fd' };
      case 'mutual_funds':
        return { color: '#4338ca', backgroundColor: '#e0e7ff', border: '1px solid #a5b4fc' };
      case 'real_estate':
        return { color: '#0f766e', backgroundColor: '#ccfbf1', border: '1px solid #5eead4' };
      case 'crypto':
        return { color: '#c2410c', backgroundColor: '#ffedd5', border: '1px solid #fdba74' };
      case 'fd_bonds':
        return { color: '#6d28d9', backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe' };
      default:
        return { color: '#374151', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb' };
    }
  };

  const getAssetClassLabel = (assetClass) => {
    switch (assetClass) {
      case 'gold': return 'Gold';
      case 'stocks': return 'Stocks';
      case 'mutual_funds': return 'Mutual Fund';
      case 'real_estate': return 'Real Estate';
      case 'crypto': return 'Crypto';
      case 'fd_bonds': return 'FD & Bonds';
      default: return 'Other Asset';
    }
  };

  if (!mounted || loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }} />
            <style dangerouslySetInnerHTML={{ __html: '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' }} />
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Loading sandbox environment...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />
      
      <main className="container" style={{ flex: 1, padding: '32px 20px', animation: 'fadeIn 0.4s ease-out' }}>
        
        {/* Sandbox Indicator Banner */}
        <div 
          className="card" 
          style={{ 
            marginBottom: '24px', 
            padding: '16px 20px', 
            backgroundColor: 'var(--accent-light)', 
            borderColor: 'var(--accent)', 
            color: 'var(--text-primary)',
            fontSize: '13px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <div className="pattern-bg"></div>
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div>
              <strong>Interactive Sandbox Mode:</strong> None of this data is saved to a server. To register your private cloud ledger, enable auto-sync, and receive daily reports, click Sign Up!
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => router.push('/signup')} 
                className="btn btn-sm btn-primary" 
                style={{ fontSize: '11px', fontWeight: 'bold' }}
              >
                Create Account
              </button>
              <button 
                onClick={() => router.push('/login')} 
                className="btn btn-sm btn-secondary" 
                style={{ fontSize: '11px', fontWeight: 'bold' }}
              >
                Log In
              </button>
            </div>
          </div>
        </div>

        {/* Global Action Banners (Email simulation status) */}
        {emailStatus.msg && (
          <div 
            className="card" 
            style={{ 
              marginBottom: '24px', 
              padding: '16px', 
              borderLeft: `4px solid var(--${emailStatus.type === 'info' ? 'accent' : emailStatus.type === 'success' ? 'success' : emailStatus.type === 'warning' ? 'warning' : 'danger'})`,
              backgroundColor: `var(--${emailStatus.type === 'info' ? 'accent' : emailStatus.type === 'success' ? 'success' : emailStatus.type === 'warning' ? 'warning' : 'danger'}-light)`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {emailStatus.loading && (
                <div style={{ width: '16px', height: '16px', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              )}
              <span style={{ fontSize: '14px', fontWeight: '600' }}>{emailStatus.msg}</span>
            </div>
            <button 
              onClick={() => setEmailStatus({ loading: false, msg: '', type: '' })} 
              style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Sandbox Title */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '26px', fontWeight: '900', letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
              Offline Trial Workspace
            </h2>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <span className="badge" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>
              Temporary Simulator Storage
            </span>
          </div>
        </div>

        {/* SYSTEM SUMMARY STATS CARDS - 5 CARDS IN MOCK SIMULATOR */}
        <section className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          
          <div className="card stat-card" style={{ borderLeft: '4px solid var(--success)', padding: '20px', minHeight: '110px' }}>
            <div className="pattern-bg"></div>
            <div className="stat-label">Total Lent</div>
            <div className="stat-number" style={{ color: 'var(--success)' }}>
              ₹{totalLent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Dues outstanding from others
            </div>
          </div>

          <div className="card stat-card" style={{ borderLeft: '4px solid var(--danger)', padding: '20px', minHeight: '110px' }}>
            <div className="pattern-bg"></div>
            <div className="stat-label">Total Borrowed</div>
            <div className="stat-number" style={{ color: 'var(--danger)' }}>
              ₹{totalBorrowed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Debts you owe to others
            </div>
          </div>

          {/* Investments summary card */}
          <div className="card stat-card" style={{ borderLeft: '4px solid #6366f1', padding: '20px', minHeight: '110px' }}>
            <div className="pattern-bg"></div>
            <div className="stat-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Total Investments</span>
              {totalInvested > 0 && (
                <span style={{ fontSize: '11px', fontWeight: '700', color: totalInvReturn >= 0 ? '#10b981' : '#ef4444' }}>
                  {totalInvReturn >= 0 ? '+' : ''}{invReturnPercent.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="stat-number" style={{ color: '#4f46e5' }}>
              ₹{totalInvValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Invested: ₹{totalInvested.toLocaleString('en-IN')}</span>
              <span style={{ fontWeight: '600', color: totalInvReturn >= 0 ? '#059669' : '#dc2626' }}>
                {totalInvReturn >= 0 ? 'Profit' : 'Loss'}
              </span>
            </div>
          </div>

          <div className="card stat-card" style={{ padding: '20px', minHeight: '110px' }}>
            <div className="pattern-bg"></div>
            <div className="stat-label">Bank Balances</div>
            <div className="stat-number">
              ₹{bankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Across all linked bank accounts
            </div>
          </div>

          <div 
            className="card stat-card" 
            style={{ 
              background: 'linear-gradient(135deg, var(--bg-secondary) 0%, var(--accent-light) 100%)',
              borderLeft: '4px solid var(--accent)',
              padding: '20px',
              minHeight: '110px'
            }}
          >
            <div className="stat-label" style={{ color: 'var(--accent)' }}>Net Worth Summary</div>
            <div className="stat-number" style={{ color: 'var(--text-primary)' }}>
              ₹{netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '500' }}>
              Banks + Lent + Invested − Borrowed
            </div>
          </div>
        </section>

        {/* PORTFOLIO VISUAL ANALYTICS CARD */}
        <section className="card" style={{ marginBottom: '32px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div className="pattern-bg"></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '-0.03em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📊</span> {selectedContactFilter ? `Simulated Allocation: ${selectedContactFilter}` : 'Simulated Portfolio Allocation'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {selectedContactFilter 
                    ? `Debt-to-credit balance sheet breakdown specifically for ${selectedContactFilter}.`
                    : 'Interactive consolidated overview of bank accounts, receivables, payables, and asset classes.'}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '32px', alignItems: 'center' }}>
                {/* A. CSS Donut Chart */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '10px 0' }}>
                  {chartTotal === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', padding: '30px 0' }}>
                      No active balances available to visualize.
                    </div>
                  ) : (
                    <div 
                      style={{ 
                        position: 'relative', 
                        width: '170px', 
                        height: '170px', 
                        borderRadius: '50%', 
                        background: conicGradientString, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                        transition: 'var(--transition)'
                      }}
                    >
                      {/* Center Cutout */}
                      <div 
                        style={{ 
                          width: '110px', 
                          height: '110px', 
                          borderRadius: '50%', 
                          backgroundColor: 'var(--bg-primary)', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)'
                        }}
                      >
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.05em' }}>
                          {selectedContactFilter ? 'Net Balance' : 'Net Worth'}
                        </span>
                        <span style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text-primary)', marginTop: '2px' }}>
                          ₹{netWorth.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* B. Detailed Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {chartTotal === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      Add assets, investments, or record transactions to unlock simulated visual reporting charts.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {/* 1. Lent Out Segment */}
                      {totalLent > 0 && (
                        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: '4px solid var(--success)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--success)' }} />
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Lent Out (Receivables)</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--success)' }}>₹{totalLent.toLocaleString('en-IN')}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>{lentPct.toFixed(1)}%</div>
                          </div>
                        </div>
                      )}

                      {/* 2. Borrowed Segment */}
                      {totalBorrowed > 0 && (
                        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: '4px solid var(--danger)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--danger)' }} />
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Borrowed (Payables)</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--danger)' }}>₹{totalBorrowed.toLocaleString('en-IN')}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>{borrowPct.toFixed(1)}%</div>
                          </div>
                        </div>
                      )}

                      {/* 3. Bank Balance (Unfiltered only) */}
                      {!selectedContactFilter && bankBalance > 0 && (
                        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: '4px solid var(--accent)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Bank Balances</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--accent)' }}>₹{bankBalance.toLocaleString('en-IN')}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>{bankPct.toFixed(1)}%</div>
                          </div>
                        </div>
                      )}

                      {/* 4. Investments (Unfiltered only) */}
                      {!selectedContactFilter && totalInvValue > 0 && (
                        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', borderLeft: '4px solid #6366f1' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }} />
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>Investments Valuation</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '13px', fontWeight: '800', color: '#4f46e5' }}>₹{totalInvValue.toLocaleString('en-IN')}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>{investPct.toFixed(1)}%</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SYSTEM CONTROL QUICK ACTION BUTTONS (Simulated for Offline Mode) */}
        <section className="card" style={{ marginBottom: '32px', padding: '18px 24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Email & Export Simulation Panel</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Trigger a simulation of summary emails, download CSV spreadsheets, or run due alerts.</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button onClick={handleExportCSV} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                📂 Export Simulated CSV
              </button>
              <button onClick={() => triggerSendReport()} disabled={emailStatus.loading} className="btn btn-secondary btn-sm">
                Simulate Full Email Report
              </button>
              <button onClick={() => {
                setEmailStatus({ loading: true, msg: 'Scanning local database for items due today and compiling simulation alerts...', type: 'info' });
                setTimeout(() => {
                  setEmailStatus({
                    loading: false,
                    msg: 'Simulation: scanning completed. Today\'s due alerts simulated successfully!',
                    type: 'success'
                  });
                }, 1000);
              }} disabled={emailStatus.loading} className="btn btn-primary btn-sm">
                Simulate Today Dues Alert
              </button>
            </div>
          </div>
        </section>

        {/* INTEGRATED RECORD CREATION CARD IN DEMO WORKSPACE */}
        <section id="create-record-section" className="card" style={{ marginBottom: '32px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div className="pattern-bg"></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            
            {/* Horizontal tab selector inside creation card */}
            <div style={{ display: 'flex', gap: '12px', borderBottom: '2px solid var(--border)', paddingBottom: '16px', marginBottom: '20px' }}>
              <button
                type="button"
                onClick={() => setActiveCreationTab('loan')}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeCreationTab === 'loan' ? '3px solid var(--accent)' : '3px solid transparent',
                  color: activeCreationTab === 'loan' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: '800',
                  fontSize: '14px',
                  padding: '4px 8px 10px 8px',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                Create Loan / Borrow Record
              </button>
              <button
                type="button"
                onClick={() => setActiveCreationTab('investment')}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: activeCreationTab === 'investment' ? '3px solid var(--accent)' : '3px solid transparent',
                  color: activeCreationTab === 'investment' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: '800',
                  fontSize: '14px',
                  padding: '4px 8px 10px 8px',
                  cursor: 'pointer',
                  transition: 'var(--transition)'
                }}
              >
                Add Investment Record
              </button>
            </div>

            {activeCreationTab === 'loan' ? (
              /* A. LOAN CREATION FORM */
              <form onSubmit={handleAddLoan}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                  
                  {/* Type toggle */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Record Type</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: 'var(--bg-primary)', padding: '4px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <button
                        type="button"
                        onClick={() => setLoanType('lend')}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: loanType === 'lend' ? 'var(--success)' : 'transparent',
                          color: loanType === 'lend' ? 'white' : 'var(--text-secondary)',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'var(--transition)'
                        }}
                      >
                        I Lent Money
                      </button>
                      <button
                        type="button"
                        onClick={() => setLoanType('borrow')}
                        style={{
                          padding: '10px 8px',
                          borderRadius: '4px',
                          border: 'none',
                          backgroundColor: loanType === 'borrow' ? 'var(--danger)' : 'transparent',
                          color: loanType === 'borrow' ? 'white' : 'var(--text-secondary)',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'var(--transition)'
                        }}
                      >
                        I Borrowed
                      </button>
                    </div>
                  </div>

                  {/* Contact Name */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>{loanType === 'lend' ? 'Lent To (Debtor)' : 'Borrowed From (Creditor)'}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter person's name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Amount */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Amount (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      required
                      step="0.01"
                      min="0.01"
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Due Date */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Due Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={loanDueDate}
                      onChange={(e) => setLoanDueDate(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Sync Bank Balance Option */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Auto-adjust Linked Bank</label>
                    <select
                      className="form-input"
                      value={syncWithAccount}
                      onChange={(e) => setSyncWithAccount(e.target.value)}
                      style={{ cursor: 'pointer', fontSize: '13px', width: '100%' }}
                    >
                      <option value="">Do not adjust bank balances</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {loanType === 'lend' ? 'Deduct from' : 'Deposit to'} {acc.name} (Current: ₹{parseFloat(acc.balance).toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Description / Notes</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Enter details or split reasons (optional)"
                      value={loanNotes}
                      onChange={(e) => setLoanNotes(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button 
                    type="submit" 
                    className={`btn ${loanType === 'lend' ? 'btn-success' : 'btn-danger'}`}
                    style={{ fontWeight: 'bold', padding: '12px 32px', minWidth: '200px' }}
                  >
                    Record New Share
                  </button>
                </div>
              </form>
            ) : (
              /* B. INVESTMENT CREATION FORM */
              <form onSubmit={handleAddInvestment}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                  
                  {/* Asset Name */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Asset / Investment Name</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g., Sharemarket stock, physical gold, mutual funds"
                      value={newInvName}
                      onChange={(e) => setNewInvName(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Asset Class */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Asset Class</label>
                    <select
                      className="form-input"
                      value={newInvClass}
                      onChange={(e) => setNewInvClass(e.target.value)}
                      style={{ cursor: 'pointer', fontSize: '13px', width: '100%' }}
                      required
                    >
                      <option value="gold">Gold</option>
                      <option value="stocks">Stocks / Sharemarket</option>
                      <option value="mutual_funds">Mutual Funds</option>
                      <option value="real_estate">Real Estate</option>
                      <option value="crypto">Cryptocurrencies</option>
                      <option value="fd_bonds">Fixed Deposits & Bonds</option>
                      <option value="other">Other Asset</option>
                    </select>
                  </div>

                  {/* Invested Amount */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Amount Invested (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={newInvAmount}
                      onChange={(e) => setNewInvAmount(e.target.value)}
                      required
                      step="0.01"
                      min="0.01"
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Current Market Value */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Current Market Value (₹)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Same as invested (optional)"
                      value={newInvValue}
                      onChange={(e) => setNewInvValue(e.target.value)}
                      step="0.01"
                      min="0.00"
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Linked account deduction */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Deduct principal from Bank</label>
                    <select
                      className="form-input"
                      value={syncInvWithAccount}
                      onChange={(e) => setSyncInvWithAccount(e.target.value)}
                      style={{ cursor: 'pointer', fontSize: '13px', width: '100%' }}
                    >
                      <option value="">Do not deduct from bank balances</option>
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          Deduct from {acc.name} (Current: ₹{parseFloat(acc.balance).toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Description / Notes */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>Description / Notes</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Folio details, buy quantity, notes"
                      value={newInvNotes}
                      onChange={(e) => setNewInvNotes(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ fontWeight: 'bold', padding: '12px 32px', minWidth: '200px', backgroundColor: '#6366f1', borderColor: '#4f46e5' }}
                  >
                    Add Investment Record
                  </button>
                </div>
              </form>
            )}

          </div>
        </section>

        {/* CORE GRID LAYOUT */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr', gap: '32px' }} className="form-row">
          
          {/* LEFT PANEL: LOANS & INVESTMENTS LISTINGS */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div className="card" style={{ padding: '20px' }}>
              
              {/* EMOJI-FREE TAB CONTROLS */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {[
                    { id: 'active', label: 'All Active' },
                    { id: 'lends', label: 'Lent Out' },
                    { id: 'borrows', label: 'Borrowed' },
                    { id: 'investments', label: 'Investments' }, // Investments list tab!
                    { id: 'history', label: 'Paid History' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: activeTab === tab.id ? 'var(--accent-light)' : 'transparent',
                        color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: activeTab === tab.id ? '700' : '500',
                        fontSize: '13px',
                        cursor: 'pointer',
                        transition: 'var(--transition)'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>
                  {activeTab === 'investments' ? investments.length : filteredLoans.length} items
                </div>
              </div>

              {/* Person-wise filter select box */}
              {activeTab !== 'investments' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', backgroundColor: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '6px', marginBottom: '20px', border: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Filter by Person:</label>
                  <select
                    className="form-input"
                    value={selectedContactFilter}
                    onChange={(e) => setSelectedContactFilter(e.target.value)}
                    style={{ maxWidth: '180px', padding: '4px 8px', fontSize: '13px', cursor: 'pointer', margin: 0 }}
                  >
                    <option value="">All Contacts</option>
                    {uniqueContacts.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  
                  {selectedContactFilter && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          setContactName(selectedContactFilter);
                          setLoanType('lend');
                          setActiveCreationTab('loan');
                          // Scroll to create form smoothly
                          const createSec = document.getElementById('create-record-section');
                          if (createSec) createSec.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        Add Record for {selectedContactFilter}
                      </button>
                      <button
                        onClick={() => triggerSendReport(selectedContactFilter)}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold' }}
                      >
                        Simulate Email Statement
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Dynamic list rendering */}
              <div key={activeTab} style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                
                {activeTab === 'investments' ? (
                  /* I. INVESTMENTS LISTING TAB */
                  investments.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                      <p style={{ fontSize: '14px' }}>No active investments found. Add stocks or gold assets above!</p>
                    </div>
                  ) : (
                    investments.map(inv => {
                      const netProfit = inv.current_value - inv.amount_invested;
                      const returnPct = inv.amount_invested > 0 ? (netProfit / inv.amount_invested) * 100 : 0;
                      
                      return (
                        <div 
                          key={inv.id}
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '16px',
                            position: 'relative',
                            backgroundColor: 'var(--bg-primary)',
                            transition: 'var(--transition)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              {/* Asset category tag */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                                <span 
                                  className="badge" 
                                  style={{ 
                                    padding: '3px 8px', 
                                    fontSize: '10px', 
                                    fontWeight: '700', 
                                    borderRadius: '4px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.02em',
                                    ...getAssetClassBadgeStyle(inv.asset_class)
                                  }}
                                >
                                  {getAssetClassLabel(inv.asset_class)}
                                </span>
                              </div>
                              <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                {inv.asset_name}
                              </h4>
                              {inv.notes && (
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                                  "{inv.notes}"
                                </p>
                              )}
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                Purchase Capital: ₹{parseFloat(inv.amount_invested).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </p>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                ₹{parseFloat(inv.current_value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                              {/* Return label */}
                              <div style={{ fontSize: '12px', fontWeight: '700', color: netProfit >= 0 ? '#059669' : '#dc2626', marginTop: '2px' }}>
                                {netProfit >= 0 ? '+' : ''}₹{netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })} ({netProfit >= 0 ? '+' : ''}{returnPct.toFixed(2)}%)
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                Updated: {new Date(inv.updated_at || inv.created_at).toLocaleDateString('en-IN')}
                              </div>
                            </div>
                          </div>

                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button
                              onClick={() => handleUpdateInvestmentValue(inv.id, inv.current_value)}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '12px', padding: '6px 12px' }}
                            >
                              Update Value
                            </button>
                            <button
                              onClick={() => handleDeleteInvestment(inv.id)}
                              className="btn btn-sm"
                              style={{ fontSize: '11px', padding: '6px 10px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  /* II. LOANS LISTING TAB */
                  filteredLoans.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
                      <p style={{ fontSize: '14px' }}>No loan records found in this category.</p>
                    </div>
                  ) : (
                    filteredLoans.map(loan => {
                      const isLend = loan.type === 'lend';
                      const isRepaid = loan.status === 'repaid';
                      const isOverdue = !isRepaid && new Date(loan.due_date) < new Date(new Date().toISOString().split('T')[0]);
                      
                      return (
                        <div 
                          key={loan.id} 
                          style={{
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            padding: '16px',
                            position: 'relative',
                            backgroundColor: 'var(--bg-primary)',
                            transition: 'var(--transition)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                          }}
                        >
                          {/* Upper Section */}
                          <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <span className={`badge badge-${isRepaid ? 'repaid' : loan.type}`}>
                                  {isRepaid ? 'Settled' : isLend ? 'Lent Out' : 'Borrowed'}
                                </span>
                                {isOverdue && (
                                  <span className="badge" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
                                    Overdue!
                                  </span>
                                )}
                              </div>
                              <h4 style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {loan.contact_name}
                              </h4>
                              {loan.notes && (
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                                  "{loan.notes}"
                                </p>
                              )}
                            </div>
                            
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontSize: '18px', fontWeight: '800', color: isRepaid ? 'var(--text-muted)' : isLend ? 'var(--success)' : 'var(--danger)' }}>
                                ₹{parseFloat(loan.outstanding_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </div>
                              {loan.outstanding_amount !== loan.amount && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'line-through' }}>
                                  Original: ₹{parseFloat(loan.amount).toLocaleString('en-IN')}
                                </div>
                              )}
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', fontWeight: '600' }}>
                                Due: {loan.due_date}
                              </div>
                            </div>
                          </div>

                          {/* Payment and Action Row */}
                          {!isRepaid && (
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                              
                              {/* Record Partial Payment */}
                              {payLoanId === loan.id ? (
                                <form onSubmit={handleSavePartialPayment} style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', width: '100%', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700' }}>Record Payment:</span>
                                  <input 
                                    type="number" 
                                    className="form-input" 
                                    placeholder="Amount (₹)" 
                                    value={payAmount} 
                                    onChange={(e) => setPayAmount(e.target.value)}
                                    max={loan.outstanding_amount}
                                    min="0.01"
                                    step="0.01"
                                    required
                                    style={{ padding: '6px 10px', fontSize: '12px', maxWidth: '90px' }}
                                  />
                                  <select
                                    className="form-input"
                                    value={payAccountId}
                                    onChange={(e) => setPayAccountId(e.target.value)}
                                    style={{ padding: '6px 10px', fontSize: '12px', maxWidth: '140px', cursor: 'pointer' }}
                                  >
                                    <option value="">Sync to Bank (None)</option>
                                    {accounts.map(a => (
                                      <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                  </select>
                                  <button type="submit" className="btn btn-success btn-sm">Save</button>
                                  <button type="button" onClick={() => setPayLoanId(null)} className="btn btn-secondary btn-sm">×</button>
                                </form>
                              ) : snoozeLoanId === loan.id ? (
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', width: '100%', backgroundColor: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                                  <span style={{ fontSize: '12px', fontWeight: '700' }}>Snooze alerts for:</span>
                                  {[2, 12, 24, 48].map(h => (
                                    <button
                                      key={h}
                                      onClick={() => handleDashboardSnooze(loan.id, h)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: '4px 8px', fontSize: '11px' }}
                                    >
                                      {h >= 24 ? `${h/24}d` : `${h}h`}
                                    </button>
                                  ))}
                                  <button type="button" onClick={() => setSnoozeLoanId(null)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>×</button>
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={() => { setPayLoanId(loan.id); setPayAmount(''); setPayAccountId(''); }}
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: '12px', padding: '6px 10px' }}
                                    >
                                      Partial Pay
                                    </button>
                                    <button 
                                      onClick={() => setSnoozeLoanId(loan.id)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ fontSize: '12px', padding: '6px 10px' }}
                                    >
                                      Snooze Alert
                                    </button>
                                  </div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button 
                                      onClick={() => handleMarkSettled(loan.id, loan.outstanding_amount, loan.type)}
                                      className="btn btn-success btn-sm"
                                      style={{ fontSize: '12px', padding: '6px 12px', fontWeight: 'bold' }}
                                    >
                                      Settle Full
                                    </button>
                                  </div>
                                </>
                              )}

                            </div>
                          )}

                          {isRepaid && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '2px' }}>
                              <button 
                                onClick={() => handleDeleteLoan(loan.id)} 
                                className="btn btn-secondary btn-sm" 
                                style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)', borderColor: 'transparent', backgroundColor: 'transparent' }}
                              >
                                Delete History
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )
                )}
              </div>

            </div>
          </section>

          {/* RIGHT PANEL: LINKED BANKS */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* BANK ACCOUNTS CARD */}
            <div className="card">
              <div className="pattern-bg"></div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', borderBottom: '2px solid var(--border)', paddingBottom: '8px', marginBottom: '16px' }}>
                Linked Bank Accounts
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {accounts.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', textAlign: 'center', padding: '16px 0' }}>
                    No bank accounts linked yet. Add one below!
                  </p>
                ) : (
                  accounts.map(acc => (
                    <div 
                      key={acc.id} 
                      style={{
                        padding: '12px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        backgroundColor: 'var(--bg-primary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: '700', fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{acc.name}</div>
                        <button 
                          onClick={() => handleDeleteAccount(acc.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--danger)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            padding: '0',
                            marginTop: '4px',
                            fontWeight: '600'
                          }}
                        >
                          Unlink Account
                        </button>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        {editingAccId === acc.id ? (
                          <div style={{ display: 'flex', gap: '4px', margin: '0' }}>
                            <input
                              type="number"
                              className="form-input"
                              value={editingAccBalance}
                              onChange={(e) => setEditingAccBalance(e.target.value)}
                              style={{ padding: '4px 6px', fontSize: '12px', maxWidth: '80px' }}
                              step="0.01"
                              autoFocus
                            />
                            <button onClick={() => handleSaveBalance(acc.id)} className="btn btn-success btn-sm" style={{ padding: '4px 8px' }}>✓</button>
                            <button onClick={() => setEditingAccId(null)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }}>×</button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => handleStartEditBalance(acc)}
                            style={{ 
                              cursor: 'pointer', 
                              padding: '4px 8px', 
                              borderRadius: '4px', 
                              backgroundColor: 'var(--bg-secondary)', 
                              border: '1px solid var(--border)',
                              fontSize: '14px', 
                              fontWeight: '800',
                              display: 'inline-block'
                            }}
                            title="Click to edit balance"
                          >
                            ₹{parseFloat(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Bank Account Form */}
              <form onSubmit={handleAddAccount} style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Bank Name"
                    className="form-input"
                    value={newAccName}
                    onChange={(e) => setNewAccName(e.target.value)}
                    required
                    style={{ fontSize: '12px', padding: '8px 10px' }}
                  />
                  <input
                    type="number"
                    placeholder="Balance (₹)"
                    className="form-input"
                    value={newAccBalance}
                    onChange={(e) => setNewAccBalance(e.target.value)}
                    required
                    step="0.01"
                    style={{ fontSize: '12px', padding: '8px 10px' }}
                  />
                </div>
                <button type="submit" className="btn btn-secondary btn-sm btn-full">
                  Add Account
                </button>
              </form>
            </div>

          </section>

        </div>

      </main>

      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 0', backgroundColor: 'var(--bg-secondary)', marginTop: '64px' }}>
        <div className="container" style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
          <p style={{ fontWeight: '600' }}>LoanShare Secure Workspace</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Secure multi-user transactions log dashboard with automatic daily reminders.
          </p>
        </div>
      </footer>
    </div>
  );
}

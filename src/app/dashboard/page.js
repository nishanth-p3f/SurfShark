'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import Header from '@/components/Header';

export default function UserDashboard() {
  const router = useRouter();
  
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loans, setLoans] = useState([]);
  const [investments, setInvestments] = useState([]); // Investments state
  
  // App states
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState({ loading: false, msg: '', type: '' });
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

  // Contact & Date Filtration States
  const [selectedContactFilter, setSelectedContactFilter] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');

  // Quick reminder / snooze panel state
  const [snoozeLoanId, setSnoozeLoanId] = useState(null);

  // Split Bill Form States
  const [splitMode, setSplitMode] = useState(false);
  const [splitContacts, setSplitContacts] = useState('');
  const [includeSelfInSplit, setIncludeSelfInSplit] = useState(true);

  // Dues Calendar States
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [activeCalendarDay, setActiveCalendarDay] = useState(null);

  // Glossary Accordion State
  const [showGlossary, setShowGlossary] = useState(false);

  // Toast Notification State (replaces alert())
  const [toast, setToast] = useState({ msg: '', type: '' });

  // Inline Investment Edit State (replaces prompt())
  const [editingInvId, setEditingInvId] = useState(null);
  const [editingInvValue, setEditingInvValue] = useState('');

  // Inline Settle Full State (replaces prompt())
  const [settleLoanId, setSettleLoanId] = useState(null);
  const [settleAccountId, setSettleAccountId] = useState('');

  // Check auth first, then load user data
  useEffect(() => {
    setMounted(true);
    async function initDashboard() {
      try {
        const currentUser = await db.getCurrentUser();
        if (!currentUser) {
          router.push('/login');
          return;
        }
        setUser(currentUser);
        
        const accs = await db.getAccounts();
        const lns = await db.getLoans();
        const invs = await db.getInvestments();
        setAccounts(accs);
        setLoans(lns);
        setInvestments(invs);
      } catch (err) {
        console.error('Failed to initialize dashboard:', err);
      } finally {
        setLoading(false);
      }
    }
    initDashboard();
  }, [router]);

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

  // Toast notification helper (replaces all alert() calls)
  const showToast = (msg, type = 'info') => {
    setToast({ msg, type });
  };

  // Auto-dismiss toast after 3.5 seconds
  useEffect(() => {
    if (!toast.msg) return;
    const timer = setTimeout(() => setToast({ msg: '', type: '' }), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

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
      showToast('Failed to add bank account', 'error');
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
      showToast('Failed to update balance', 'error');
    }
  };

  // Delete Bank Account
  const handleDeleteAccount = async (id) => {
    if (!confirm('Are you sure you want to delete this bank account? This will not affect existing loans.')) return;
    try {
      await db.deleteAccount(id);
      await refreshData();
    } catch (err) {
      showToast('Failed to delete account', 'error');
    }
  };

  // Add Loan (Lend or Borrow with Split Mode)
  const handleAddLoan = async (e) => {
    e.preventDefault();
    if (splitMode) {
      if (!splitContacts.trim() || !loanAmount || !loanDueDate) return;
    } else {
      if (!contactName.trim() || !loanAmount || !loanDueDate) return;
    }

    const amt = parseFloat(loanAmount);
    try {
      if (splitMode) {
        const names = splitContacts.split(',').map(n => n.trim()).filter(Boolean);
        if (names.length === 0) {
          showToast('Please enter at least one contact name to split with.', 'error');
          return;
        }
        const divisor = names.length + (includeSelfInSplit ? 1 : 0);
        const shareAmount = amt / divisor;

        for (const name of names) {
          await db.addLoan({
            type: loanType,
            contact_name: name,
            amount: shareAmount,
            due_date: loanDueDate,
            notes: `${loanNotes ? loanNotes + ' ' : ''}(Split share of total ₹${amt.toLocaleString('en-IN')})`,
          });
        }
      } else {
        await db.addLoan({
          type: loanType,
          contact_name: contactName,
          amount: amt,
          due_date: loanDueDate,
          notes: loanNotes,
        });
      }

      if (syncWithAccount) {
        const account = accounts.find(a => a.id === syncWithAccount);
        if (account) {
          const multiplier = loanType === 'lend' ? -1 : 1;
          const newBal = parseFloat(account.balance) + (amt * multiplier);
          await db.updateAccountBalance(account.id, newBal);
        }
      }

      setContactName('');
      setSplitContacts('');
      setLoanAmount('');
      setLoanDueDate('');
      setLoanNotes('');
      setSyncWithAccount('');
      setSplitMode(false);
      await refreshData();
    } catch (err) {
      showToast('Failed to save loan record', 'error');
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
      showToast('Failed to save investment record', 'error');
    }
  };

  // Update Investment Value (inline edit — no prompt())
  const handleStartEditInvestment = (inv) => {
    setEditingInvId(inv.id);
    setEditingInvValue(inv.current_value.toString());
  };

  const handleSaveInvestmentValue = async (id) => {
    const newVal = parseFloat(editingInvValue);
    if (isNaN(newVal) || newVal < 0) {
      showToast('Please enter a valid numeric value.', 'error');
      return;
    }
    try {
      await db.updateInvestmentValue(id, newVal);
      setEditingInvId(null);
      setEditingInvValue('');
      await refreshData();
      showToast('Investment value updated!', 'success');
    } catch (err) {
      showToast('Failed to update investment valuation', 'error');
    }
  };

  // Delete Investment
  const handleDeleteInvestment = async (id) => {
    if (!confirm('Are you sure you want to delete this investment record?')) return;
    try {
      await db.deleteInvestment(id);
      await refreshData();
    } catch (err) {
      showToast('Failed to delete investment', 'error');
    }
  };

  // Mark Loan as Fully Settled (inline panel — no prompt())
  const handleStartSettle = (loanId) => {
    setSettleLoanId(loanId);
    setSettleAccountId('');
  };

  const handleConfirmSettle = async (loanId, currentOutstanding) => {
    try {
      const selectedAccId = settleAccountId || null;
      await db.settleFullLoan(loanId, selectedAccId, parseFloat(currentOutstanding));
      setSettleLoanId(null);
      setSettleAccountId('');
      await refreshData();
      showToast('Loan settled successfully!', 'success');
    } catch (err) {
      showToast('Failed to settle loan record', 'error');
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
      showToast('Failed to process partial payment', 'error');
    }
  };

  // Quick Snooze Reminder directly from dashboard
  const handleDashboardSnooze = async (loanId, hours) => {
    try {
      await db.snoozeLoan(loanId, hours);
      setSnoozeLoanId(null);
      showToast(`Reminder snoozed for ${hours} hours!`, 'success');
    } catch (err) {
      showToast('Failed to snooze reminder', 'error');
    }
  };

  // Trigger Full Loan Report Email (Supports complete segregated portfolio or specific contact statements)
  const triggerSendReport = async (contactName = '') => {
    setEmailStatus({ 
      loading: true, 
      msg: contactName 
        ? `Compiling ledger statement for ${contactName} and sending email...` 
        : 'Compiling financial balances and sending report email...', 
      type: 'info' 
    });
    
    try {
      const reportLoans = contactName 
        ? loans.filter(l => l.contact_name?.trim().toLowerCase() === contactName.trim().toLowerCase())
        : loans;

      const res = await fetch('/api/report', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          loans: reportLoans, 
          accounts, 
          emailAddress: user?.email,
          contactFilter: contactName 
        })
      });
      const data = await res.json();
      
      if (data.success) {
        setEmailStatus({ 
          loading: false, 
          msg: contactName 
            ? `Ledger statement for ${contactName} emailed successfully!` + (data.simulated ? ' (Simulation Mode)' : '')
            : data.message + (data.simulated ? ' (Simulation Mode)' : ''), 
          type: data.simulated ? 'warning' : 'success' 
        });
      } else {
        throw new Error(data.error || 'Failed to send');
      }
    } catch (err) {
      setEmailStatus({ loading: false, msg: 'Error: Failed to dispatch email. Ensure SMTP configuration is set up.', type: 'danger' });
    }
  };

  // Trigger Cron Daily Due Check manually
  const triggerCheckDues = async () => {
    setEmailStatus({ loading: true, msg: 'Scanning database for items due today and dispatching alerts...', type: 'info' });
    try {
      const res = await fetch('/api/cron');
      const data = await res.json();
      
      if (data.success) {
        setEmailStatus({ 
          loading: false, 
          msg: data.message + (data.simulated ? ' (Simulation Mode)' : ''), 
          type: data.simulated ? 'warning' : 'success' 
        });
      } else {
        throw new Error(data.error || 'Failed to check');
      }
    } catch (err) {
      setEmailStatus({ loading: false, msg: 'Error: Cron check failed.', type: 'danger' });
    }
  };

  // Export active loans / ledgers scoped by contact as a CSV spreadsheet
  const handleExportCSV = () => {
    const targetLoans = selectedContactFilter
      ? loans.filter(l => l.contact_name?.trim().toLowerCase() === selectedContactFilter.trim().toLowerCase())
      : loans;

    if (targetLoans.length === 0) {
      showToast('No transactions available to export.', 'error');
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
      ? `loanshare_ledger_${selectedContactFilter.toLowerCase().replace(/\s+/g, '_')}.csv`
      : 'loanshare_portfolio_report.csv';
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- CALCULATIONS FOR SUMMARY CARDS ---
  const uniqueContacts = Array.from(new Set(loans.map(l => l.contact_name?.trim()).filter(Boolean))).sort();

  const activeLoans = loans.filter(l => l.status === 'active');

  // Scope active loans calculations specifically to the selected contact and date when filtered
  const scopedActiveLoans = activeLoans.filter(l => {
    if (selectedContactFilter && l.contact_name?.trim().toLowerCase() !== selectedContactFilter.trim().toLowerCase()) {
      return false;
    }
    if (selectedDateFilter && l.due_date !== selectedDateFilter) {
      return false;
    }
    return true;
  });

  // Dues Calendar math and helpers
  const calendarYear = currentCalendarDate.getFullYear();
  const calendarMonth = currentCalendarDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentCalendarDate(new Date(calendarYear, calendarMonth - 1, 1));
    setActiveCalendarDay(null);
  };

  const handleNextMonth = () => {
    setCurrentCalendarDate(new Date(calendarYear, calendarMonth + 1, 1));
    setActiveCalendarDay(null);
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June", 
    "July", "August", "September", "October", "November", "December"
  ];

  // Map days of the calendar grid
  const calendarDays = [];
  const firstDayIndex = new Date(calendarYear, calendarMonth, 1).getDay();
  const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarDays.push(new Date(calendarYear, calendarMonth, d));
  }

  // Group active loans by due date string format "YYYY-MM-DD"
  const getDuesForDate = (date) => {
    if (!date) return { lends: [], borrows: [] };
    
    // Format calendar date object as YYYY-MM-DD
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const dayLends = activeLoans.filter(l => l.type === 'lend' && l.due_date === dateStr);
    const dayBorrows = activeLoans.filter(l => l.type === 'borrow' && l.due_date === dateStr);

    return { lends: dayLends, borrows: dayBorrows };
  };

  const handleSelectCalendarDay = (date) => {
    if (!date) return;
    setActiveCalendarDay(date);
  };

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

  // Filtered Loans for listing (Applies tab filter, contact scope, and date scope)
  const filteredLoans = loans.filter(l => {
    if (selectedContactFilter && l.contact_name?.trim().toLowerCase() !== selectedContactFilter.trim().toLowerCase()) {
      return false;
    }
    if (selectedDateFilter && l.due_date !== selectedDateFilter) {
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
            <p style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Initializing your private ledger...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header />

      {/* Toast Notification */}
      {toast.msg && (
        <div className={`toast-notification toast-${toast.type}`}>
          <span>{toast.msg}</span>
          <button
            onClick={() => setToast({ msg: '', type: '' })}
            style={{ background: 'none', border: 'none', color: 'inherit', fontSize: '18px', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}
      
      <main className="container" style={{ flex: 1, padding: '32px 20px', animation: 'fadeIn 0.4s ease-out' }}>
        
        {/* Connection status warning */}
        {db.isMock() && (
          <div 
            className="card" 
            style={{ 
              marginBottom: '24px', 
              padding: '12px 18px', 
              backgroundColor: 'var(--warning-light)', 
              borderColor: 'var(--warning)', 
              color: 'var(--text-primary)',
              fontSize: '13px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div>
              <strong>Running in Offline Mode:</strong> Your changes are currently saved locally. To enable multi-device sync and fully automated daily email reminders, make sure to link your cloud environment variables.
            </div>
            <button 
              onClick={() => router.push('/demo')} 
              className="btn btn-sm btn-secondary" 
              style={{ fontSize: '11px' }}
            >
              Back to Demo
            </button>
          </div>
        )}

        {/* Welcome and mode subtitle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '26px', fontWeight: '900', letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
              Welcome back, {user?.user_metadata?.display_name || user?.user_metadata?.username || 'User'}!
            </h2>
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {db.isMock() ? (
              <span className="badge" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)', border: '1px solid var(--warning)' }}>
                Offline Simulation Ledger
              </span>
            ) : (
              <span className="badge" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', border: '1px solid var(--success)' }}>
                ✓ Secure Cloud Sync Active
              </span>
            )}
          </div>
        </div>

        {/* Global Action Banners (Email status) */}
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

        {/* SYSTEM SUMMARY STATS CARDS - EXPANDED TO 5 CARDS */}
        <section className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          
          <div className="card stat-card" style={{ borderLeft: '4px solid var(--success)', padding: '20px', minHeight: '110px' }}>
            <div className="pattern-bg"></div>
            <div className="stat-label">Total Lent</div>
            <div className="stat-number" style={{ color: 'var(--success)' }}>
              ₹{totalLent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Money others owe you (Dues outstanding)
            </div>
          </div>

          <div className="card stat-card" style={{ borderLeft: '4px solid var(--danger)', padding: '20px', minHeight: '110px' }}>
            <div className="pattern-bg"></div>
            <div className="stat-label">Total Borrowed</div>
            <div className="stat-number" style={{ color: 'var(--danger)' }}>
              ₹{totalBorrowed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Money you owe others (Debts to pay)
            </div>
          </div>

          {/* New Investments summary card */}
          <div className="card stat-card" style={{ borderLeft: '4px solid #6366f1', padding: '20px', minHeight: '110px' }}>
            <div className="pattern-bg"></div>
            <div className="stat-label" style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center' }}>
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
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between' }}>
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
              Cash in hand or in bank accounts
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
              Your total clear wealth & savings
            </div>
          </div>
        </section>

        {/*💡 QUICK ONBOARDING GUIDE & GLOSSARY */}
        <section className="card" style={{ marginBottom: '24px', padding: '16px 20px', borderLeft: '4px solid var(--accent)', backgroundColor: 'var(--bg-secondary)', position: 'relative' }}>
          <div className="pattern-bg"></div>
          <div 
            onClick={() => setShowGlossary(!showGlossary)} 
            style={{ position: 'relative', zIndex: 1, display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '20px' }}>💡</span>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Quick Glossary & Layman Guide</h4>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>Confused about terminology? Click to explore friendly explanations of financial terms.</p>
              </div>
            </div>
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--accent)', transition: 'transform var(--transition)', transform: showGlossary ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
          </div>

          {showGlossary && (
            <div style={{ position: 'relative', zIndex: 1, marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', animation: 'fadeIn 0.3s ease-out' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '12px', color: 'var(--success)' }}>🟢 Lent Money</strong>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                  Use this when you **give money to someone else** (e.g., a friend or colleague). They owe this money back to you. We track it as a receivable.
                </p>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '12px', color: 'var(--danger)' }}>🔴 Borrowed Money</strong>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                  Use this when you **receive money from someone else** that you must pay back later. We track it as your payable debt.
                </p>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '12px', color: 'var(--accent)' }}>🏦 Bank Accounts</strong>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                  Keeps track of physical cash, savings, or checking deposits. Linking a bank account to a loan automatically adjusts your balance.
                </p>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '12px', color: '#6366f1' }}>📐 Bill Splitter</strong>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                  Allows you to divide a single expense (e.g. food/cabs) equally among friends. FACTOR yourself in the calculation to record only their shares!
                </p>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>📅 Interactive Calendar</strong>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                  Visual dues overview. Colored dots (Green for collections, Red for payments) flag dates when cash must be exchanged. Tap a day to pre-fill dates.
                </p>
              </div>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>💼 Overall Net Worth</strong>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
                  Your complete worth: computed as `Bank Balances + Outstanding Lent out receivables + Investments - Borrowed debt`.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* PORTFOLIO VISUAL ANALYTICS CARD */}
        <section className="card" style={{ marginBottom: '32px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div className="pattern-bg"></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '-0.03em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📊</span> {selectedContactFilter ? `Financial Allocation: ${selectedContactFilter}` : 'Overall Portfolio Allocation'}
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
                      Add assets, investments, or record transactions to unlock live visual reporting charts.
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

        {/* INTERACTIVE DUES CALENDAR CARD */}
        <section className="card" style={{ marginBottom: '32px', padding: '24px', position: 'relative', overflow: 'hidden' }}>
          <div className="pattern-bg"></div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Calendar Header with Controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '900', letterSpacing: '-0.03em', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>📅</span> Interactive Dues Calendar
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Monitor receivables (Lent Out) and payables (Borrowed) schedules dynamically across dates.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-secondary)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <button 
                    onClick={handlePrevMonth}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', padding: '0 4px' }}
                    title="Previous Month"
                  >
                    ←
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)', minWidth: '110px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                    {monthNames[calendarMonth]} {calendarYear}
                  </span>
                  <button 
                    onClick={handleNextMonth}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)', padding: '0 4px' }}
                    title="Next Month"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* Grid Layout: Calendar on Left/Top, Detailed day list on Right/Bottom */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px' }}>
                
                {/* 1. Month Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {/* Weekday headers */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', textAlign: 'center' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <span key={day} style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        {day}
                      </span>
                    ))}
                  </div>

                  {/* Days grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                    {calendarDays.map((date, idx) => {
                      if (!date) {
                        return <div key={`empty-${idx}`} style={{ aspectRatio: '1', backgroundColor: 'transparent' }} />;
                      }

                      const { lends, borrows } = getDuesForDate(date);
                      const isSelected = activeCalendarDay && 
                        activeCalendarDay.getDate() === date.getDate() && 
                        activeCalendarDay.getMonth() === date.getMonth() && 
                        activeCalendarDay.getFullYear() === date.getFullYear();

                      const isToday = new Date().toDateString() === date.toDateString();

                      const hasLends = lends.length > 0;
                      const hasBorrows = borrows.length > 0;

                      return (
                        <div
                          key={`day-${date.getDate()}`}
                          onClick={() => handleSelectCalendarDay(date)}
                          style={{
                            aspectRatio: '1',
                            borderRadius: '6px',
                            border: isSelected 
                              ? '2px solid var(--accent)' 
                              : isToday 
                                ? '1px solid var(--text-muted)' 
                                : '1px solid var(--border)',
                            backgroundColor: isSelected 
                              ? 'var(--accent-light)' 
                              : isToday 
                                ? 'var(--bg-secondary)' 
                                : 'var(--bg-primary)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'var(--transition)'
                          }}
                          title={`Click to view dues for ${date.toLocaleDateString()}`}
                        >
                          <span style={{ fontSize: '12px', fontWeight: isToday || isSelected ? '800' : '500', color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>
                            {date.getDate()}
                          </span>

                          {/* Visual Dues Indicators */}
                          <div style={{ display: 'flex', gap: '2px', width: '100%', justifyContent: 'center' }}>
                            {hasLends && (
                              <span 
                                style={{ 
                                  width: '5px', 
                                  height: '5px', 
                                  borderRadius: '50%', 
                                  backgroundColor: 'var(--success)' 
                                }} 
                                title={`${lends.length} Lent out item(s)`}
                              />
                            )}
                            {hasBorrows && (
                              <span 
                                style={{ 
                                  width: '5px', 
                                  height: '5px', 
                                  borderRadius: '50%', 
                                  backgroundColor: 'var(--danger)' 
                                }} 
                                title={`${borrows.length} Borrowed item(s)`}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Detailed Dues breakdown panel for Selected Day */}
                <div 
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)', 
                    padding: '16px', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '200px'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '13px', fontWeight: '800', borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '12px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                      {activeCalendarDay 
                        ? `Dues: ${activeCalendarDay.toLocaleDateString('en-IN', { dateStyle: 'medium' })}` 
                        : 'Select a date on calendar'}
                    </h4>

                    {activeCalendarDay ? (
                      (() => {
                        const { lends, borrows } = getDuesForDate(activeCalendarDay);
                        if (lends.length === 0 && borrows.length === 0) {
                          return (
                            <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
                              No dues scheduled on this date.
                            </p>
                          );
                        }

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                            {/* Receivables List */}
                            {lends.map(l => (
                              <div key={l.id} style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', borderLeft: '3px solid var(--success)', fontSize: '12px' }}>
                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{l.contact_name}</span>
                                <span style={{ fontWeight: '800', color: 'var(--success)' }}>+₹{parseFloat(l.outstanding_amount).toLocaleString('en-IN')}</span>
                              </div>
                            ))}

                            {/* Payables List */}
                            {borrows.map(b => (
                              <div key={b.id} style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', borderLeft: '3px solid var(--danger)', fontSize: '12px' }}>
                                <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{b.contact_name}</span>
                                <span style={{ fontWeight: '800', color: 'var(--danger)' }}>-₹{parseFloat(b.outstanding_amount).toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', padding: '40px 0' }}>
                        Click on any day in the monthly calendar to explore recorded split balances or schedule alerts.
                      </p>
                    )}
                  </div>

                  {activeCalendarDay && (
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '12px' }}>
                      <button
                        onClick={() => {
                          const y = activeCalendarDay.getFullYear();
                          const m = String(activeCalendarDay.getMonth() + 1).padStart(2, '0');
                          const d = String(activeCalendarDay.getDate()).padStart(2, '0');
                          const dateStr = `${y}-${m}-${d}`;
                          
                          setLoanDueDate(dateStr);
                          
                          // Scroll to create form smoothly
                          const createSec = document.getElementById('create-record-section');
                          if (createSec) createSec.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="btn btn-secondary btn-sm btn-full"
                        style={{ padding: '6px', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        📅 Select Date for New Entry
                      </button>
                    </div>
                  )}
                </div>

              </div>

            </div>
          </div>
        </section>

        {/* SYSTEM CONTROL QUICK ACTION BUTTONS */}
        <section className="card" style={{ marginBottom: '32px', padding: '18px 24px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Email & Export Control Panel</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Instantly trigger summary emails, download CSV spreadsheets, or run auto check rules.</p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              <button onClick={handleExportCSV} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
                📂 Export to CSV
              </button>
              <button onClick={triggerSendReport} disabled={emailStatus.loading} className="btn btn-secondary btn-sm">
                Send Full Email Report
              </button>
              <button onClick={triggerCheckDues} disabled={emailStatus.loading} className="btn btn-primary btn-sm">
                Check & Email Today Dues
              </button>
            </div>
          </div>
        </section>

        {/* CREATE LOAN FORM - FULL WIDTH AND EXPANDED */}
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

                  {/* Contact Input / Split Bill Mode Toggle */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontWeight: '700', margin: 0 }}>
                        {splitMode 
                          ? 'Split Between Contacts' 
                          : (loanType === 'lend' ? 'Lent To (Debtor)' : 'Borrowed From (Creditor)')}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSplitMode(!splitMode);
                          setSplitContacts('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: splitMode ? 'var(--accent)' : 'var(--text-secondary)',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: 0
                        }}
                        title="Split an expense equally between multiple friends in one click."
                      >
                        {splitMode ? '📐 Normal Mode' : '📐 Split Bill Mode ℹ️'}
                      </button>
                    </div>

                    {splitMode ? (
                      <input
                        type="text"
                        id="loan-contact-input"
                        className="form-input"
                        placeholder="Names separated by commas (e.g. Alex, Bob, Charlie)"
                        value={splitContacts}
                        onChange={(e) => setSplitContacts(e.target.value)}
                        required
                        style={{ width: '100%' }}
                      />
                    ) : (
                      <>
                        <input
                          type="text"
                          id="loan-contact-input"
                          className="form-input"
                          placeholder="Enter or select person's name"
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          list="existing-contacts-list"
                          required
                          style={{ width: '100%' }}
                        />
                        <datalist id="existing-contacts-list">
                          {uniqueContacts.map(c => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </div>

                  {/* Amount */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontWeight: '700', margin: 0 }}>Amount (₹)</label>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>Quick Tap Presets</span>
                    </div>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      required
                      step="0.01"
                      min="0.01"
                      style={{ width: '100%', marginBottom: '8px' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {[100, 500, 1000, 2000, 5000, 10000].map(val => (
                        <button
                          key={`preset-${val}`}
                          type="button"
                          onClick={() => setLoanAmount(val.toString())}
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.color = 'var(--accent)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }}
                        >
                          ₹{val.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
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
                    <label className="form-label" style={{ fontWeight: '700' }}>
                      Auto-adjust Linked Bank <span style={{ color: 'var(--accent)', cursor: 'help', fontSize: '12px' }} title="If selected, we will automatically deduct/deposit this amount from the bank balance.">ℹ️</span>
                    </label>
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

                  {splitMode && (
                    <div style={{ gridColumn: '1 / -1', backgroundColor: 'var(--bg-secondary)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input 
                            type="checkbox" 
                            id="include-self-split"
                            checked={includeSelfInSplit}
                            onChange={(e) => setIncludeSelfInSplit(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor="include-self-split" style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', cursor: 'pointer', margin: 0 }}>
                            Include myself in split (divide equally including me)
                          </label>
                        </div>
                        
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {loanAmount && !isNaN(parseFloat(loanAmount)) ? (
                            (() => {
                              const namesList = splitContacts.split(',').map(n => n.trim()).filter(Boolean);
                              const divisor = namesList.length + (includeSelfInSplit ? 1 : 0);
                              const share = parseFloat(loanAmount) / (divisor || 1);
                              return `Total share: ₹${share.toLocaleString('en-IN', { minimumFractionDigits: 2 })} per person`;
                            })()
                          ) : 'Enter total amount to calculate shares'}
                        </div>
                      </div>
                      
                      {/* Live splits preview */}
                      {splitContacts.trim() && loanAmount && !isNaN(parseFloat(loanAmount)) && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Splits Preview:</span>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                            {(() => {
                              const namesList = splitContacts.split(',').map(n => n.trim()).filter(Boolean);
                              const divisor = namesList.length + (includeSelfInSplit ? 1 : 0);
                              const share = parseFloat(loanAmount) / (divisor || 1);
                              
                              const badges = namesList.map(name => (
                                <span key={name} className="badge" style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                  {name}: ₹{share.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                </span>
                              ));

                              if (includeSelfInSplit) {
                                badges.unshift(
                                  <span key="myself" className="badge" style={{ backgroundColor: 'var(--border)', color: 'var(--text-secondary)', border: '1px solid var(--text-muted)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                    Myself (My share): ₹{share.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                                  </span>
                                );
                              }
                              return badges;
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>

                <div style={{ marginTop: '16px' }}>
                  <button 
                    type="submit" 
                    className={`btn btn-full ${loanType === 'lend' ? 'btn-success' : 'btn-danger'}`}
                    style={{ fontWeight: 'bold', padding: '14px 32px', fontSize: '14px' }}
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
                      id="investment-name-input"
                      className="form-input"
                      placeholder="e.g., HDFC Share, Gold Bond, SBI Mutual Fund"
                      value={newInvName}
                      onChange={(e) => setNewInvName(e.target.value)}
                      required
                      style={{ width: '100%' }}
                    />
                  </div>

                  {/* Asset Class */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>
                      Asset Class <span style={{ color: 'var(--accent)', cursor: 'help', fontSize: '12px' }} title="Category of your investment (e.g. Gold, Stocks). Helps organize your portfolio.">ℹ️</span>
                    </label>
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
                    <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontWeight: '700', margin: 0 }}>Amount Invested (₹)</label>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>Quick Tap Presets</span>
                    </div>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="0.00"
                      value={newInvAmount}
                      onChange={(e) => setNewInvAmount(e.target.value)}
                      required
                      step="0.01"
                      min="0.01"
                      style={{ width: '100%', marginBottom: '8px' }}
                    />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {[1000, 5000, 10000, 25000, 50000, 100000].map(val => (
                        <button
                          key={`inv-preset-${val}`}
                          type="button"
                          onClick={() => {
                            setNewInvAmount(val.toString());
                            if (!newInvValue) setNewInvValue(val.toString());
                          }}
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontWeight: '700',
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.color = 'var(--accent)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'var(--border)';
                            e.currentTarget.style.color = 'var(--text-primary)';
                          }}
                        >
                          ₹{val.toLocaleString('en-IN')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Current Market Value */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: '700' }}>
                      Current Market Value (₹) <span style={{ color: 'var(--accent)', cursor: 'help', fontSize: '12px' }} title="Current valuation of this asset. If empty, we default to the amount invested.">ℹ️</span>
                    </label>
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
                    <label className="form-label" style={{ fontWeight: '700' }}>
                      Deduct principal from Bank <span style={{ color: 'var(--accent)', cursor: 'help', fontSize: '12px' }} title="If selected, we will automatically deduct the invested principal from the bank balance.">ℹ️</span>
                    </label>
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
                      placeholder="Buy details, share counts, folio numbers"
                      value={newInvNotes}
                      onChange={(e) => setNewInvNotes(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                </div>

                <div style={{ marginTop: '16px' }}>
                  <button 
                    type="submit" 
                    className="btn btn-primary btn-full"
                    style={{ fontWeight: 'bold', padding: '14px 32px', fontSize: '14px', backgroundColor: '#6366f1', borderColor: '#4f46e5' }}
                  >
                    Add Investment Record
                  </button>
                </div>
              </form>
            )}

          </div>
        </section>

        {/* DASHBOARD CORE GRID LAYOUT */}
        <div className="dashboard-grid">
          
          {/* LEFT PANEL: LOANS & INVESTMENTS TRACKING LIST */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div className="card" style={{ padding: '20px' }}>
              
              {/* EMOJI-FREE TAB CONTROLS (Updated for Investments integration) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <div className="tabs-scroll">
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

              {/* Filtration bar with Person and Date selectors */}
              {activeTab !== 'investments' && (
                <div className="filter-bar">
                  
                  {/* A. Person Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Filter by Person:</label>
                    <select
                      className="form-input"
                      value={selectedContactFilter}
                      onChange={(e) => setSelectedContactFilter(e.target.value)}
                      style={{ maxWidth: '160px', padding: '4px 8px', fontSize: '13px', cursor: 'pointer', margin: 0 }}
                    >
                      <option value="">All Contacts</option>
                      {uniqueContacts.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* B. Date Filter */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>Filter by Date:</label>
                    <input
                      type="date"
                      className="form-input"
                      value={selectedDateFilter}
                      onChange={(e) => setSelectedDateFilter(e.target.value)}
                      style={{ maxWidth: '140px', padding: '4px 8px', fontSize: '13px', margin: 0, cursor: 'pointer' }}
                    />
                  </div>

                  {/* C. Actions & Clears */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {(selectedContactFilter || selectedDateFilter) && (
                      <button
                        onClick={() => {
                          setSelectedContactFilter('');
                          setSelectedDateFilter('');
                        }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 'bold', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      >
                        ✕ Clear Filters
                      </button>
                    )}

                    {selectedContactFilter && (
                      <>
                        <button
                          onClick={() => {
                            setContactName(selectedContactFilter);
                            setLoanType('lend');
                            setActiveCreationTab('loan');
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
                          Email Statement
                        </button>
                      </>
                    )}
                  </div>

                </div>
              )}

              {/* Dynamic list rendering based on selected Tab */}
              <div key={activeTab} style={{ display: 'flex', flexDirection: 'column', gap: '16px', animation: 'fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                
                {activeTab === 'investments' ? (
                  /* I. INVESTMENTS LISTING TAB */
                  investments.length === 0 ? (
                    <div style={{
                      padding: '30px 20px',
                      borderRadius: '8px',
                      border: '2px dashed var(--border)',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <span style={{ fontSize: '32px', opacity: 0.8 }}>📂</span>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px', color: 'var(--text-primary)' }}>No Investments Tracked</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.4', maxWidth: '320px', margin: '0 auto' }}>
                          Add your gold, mutual funds, stock market assets, or real estate here to view real-time valuation and ROI.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCreationTab('investment');
                          setTimeout(() => {
                            const input = document.getElementById('investment-name-input');
                            if (input) {
                              input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              input.focus();
                            }
                          }, 100);
                        }}
                        style={{
                          padding: '8px 16px',
                          fontSize: '12px',
                          fontWeight: '700',
                          backgroundColor: 'var(--accent)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'var(--transition)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                      >
                        💼 Track Your First Investment
                      </button>
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

                          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            {editingInvId === inv.id ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', width: '100%', animation: 'fadeIn 0.2s ease-out' }}>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)' }}>New Value: ₹</span>
                                <input
                                  type="number"
                                  className="form-input"
                                  value={editingInvValue}
                                  onChange={(e) => setEditingInvValue(e.target.value)}
                                  style={{ padding: '6px 10px', fontSize: '13px', maxWidth: '120px', minHeight: '36px' }}
                                  step="0.01"
                                  min="0"
                                  autoFocus
                                />
                                <button onClick={() => handleSaveInvestmentValue(inv.id)} className="btn btn-success btn-sm" style={{ padding: '6px 12px' }}>✓ Save</button>
                                <button onClick={() => { setEditingInvId(null); setEditingInvValue(''); }} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px' }}>×</button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStartEditInvestment(inv)}
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
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  /* II. LOANS LISTING TAB */
                  filteredLoans.length === 0 ? (
                    <div style={{
                      padding: '30px 20px',
                      borderRadius: '8px',
                      border: '2px dashed var(--border)',
                      backgroundColor: 'rgba(255,255,255,0.01)',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <span style={{ fontSize: '32px', opacity: 0.8 }}>📂</span>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px', color: 'var(--text-primary)' }}>No Active Loans or Debts</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.4', maxWidth: '320px', margin: '0 auto' }}>
                          Record who owes you money or who you owe money to. Keep track of dues, split bills, and settle payments.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCreationTab('loan');
                          setTimeout(() => {
                            const input = document.getElementById('loan-contact-input');
                            if (input) {
                              input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              input.focus();
                            }
                          }, 100);
                        }}
                        style={{
                          padding: '8px 16px',
                          fontSize: '12px',
                          fontWeight: '700',
                          backgroundColor: 'var(--accent)',
                          color: '#000',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'var(--transition)'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                      >
                        ➕ Record First Loan Entry
                      </button>
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
                              ) : settleLoanId === loan.id ? (
                                <div className="settle-panel">
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-primary)' }}>
                                    Settle ₹{parseFloat(loan.outstanding_amount).toLocaleString('en-IN')} — Select bank account:
                                  </span>
                                  <div
                                    className={`settle-option ${settleAccountId === '' ? 'selected' : ''}`}
                                    onClick={() => setSettleAccountId('')}
                                  >
                                    <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--text-muted)', backgroundColor: settleAccountId === '' ? 'var(--accent)' : 'transparent', flexShrink: 0 }} />
                                    <span>No bank adjustment</span>
                                  </div>
                                  {accounts.map(a => (
                                    <div
                                      key={a.id}
                                      className={`settle-option ${settleAccountId === a.id ? 'selected' : ''}`}
                                      onClick={() => setSettleAccountId(a.id)}
                                    >
                                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid var(--text-muted)', backgroundColor: settleAccountId === a.id ? 'var(--accent)' : 'transparent', flexShrink: 0 }} />
                                      <span>{loan.type === 'lend' ? 'Receive into' : 'Pay from'} {a.name} <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>(₹{parseFloat(a.balance).toLocaleString('en-IN')})</span></span>
                                    </div>
                                  ))}
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                    <button onClick={() => handleConfirmSettle(loan.id, loan.outstanding_amount)} className="btn btn-success btn-sm" style={{ flex: 1, fontWeight: 'bold' }}>✓ Confirm Settle</button>
                                    <button onClick={() => setSettleLoanId(null)} className="btn btn-secondary btn-sm">Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
                                      onClick={() => handleStartSettle(loan.id)}
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
                  <div style={{
                    padding: '24px 16px',
                    borderRadius: '8px',
                    border: '2px dashed var(--border)',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    margin: '10px 0'
                  }}>
                    <span style={{ fontSize: '28px', opacity: 0.8 }}>🏦</span>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px', color: 'var(--text-primary)' }}>No Bank Accounts Linked</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.4' }}>
                        Connect bank balances to auto-deduct loan payments and track investments seamlessly.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('bank-name-input');
                        if (input) {
                          input.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          input.focus();
                        }
                      }}
                      style={{
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '700',
                        backgroundColor: 'var(--accent)',
                        color: '#000',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        transition: 'var(--transition)'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
                    >
                      🏦 Add Your First Bank Account
                    </button>
                  </div>
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
                    id="bank-name-input"
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

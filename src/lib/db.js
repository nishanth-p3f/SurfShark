import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Initialize Supabase if keys are provided
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Initialize Supabase Admin for backend operations (like background daily email cron tasks)
export const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

// Mock database initial state
const MOCK_INITIAL_ACCOUNTS = [
  { id: 'acc-1', name: 'HDFC Bank Checking', balance: 54200.50, currency: 'INR' },
  { id: 'acc-2', name: 'SBI Savings', balance: 120000.00, currency: 'INR' },
  { id: 'acc-3', name: 'Physical Cash', balance: 3500.00, currency: 'INR' }
];

const MOCK_INITIAL_LOANS = [
  { 
    id: 'loan-1', 
    type: 'lend', 
    contact_name: 'Alex Johnson', 
    amount: 500, 
    outstanding_amount: 500, 
    due_date: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0], // 2 days from now
    status: 'active', 
    notes: 'For concert tickets, said will pay back soon',
    created_at: new Date().toISOString()
  },
  { 
    id: 'loan-2', 
    type: 'borrow', 
    contact_name: 'Sarah Miller', 
    amount: 1200, 
    outstanding_amount: 800, 
    due_date: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0], // 1 day ago (overdue!)
    status: 'active', 
    notes: 'Rent help, already paid back $400',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString()
  },
  { 
    id: 'loan-3', 
    type: 'lend', 
    contact_name: 'David Lee', 
    amount: 150, 
    outstanding_amount: 0, 
    due_date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0], 
    status: 'repaid', 
    notes: 'Dinner bill split, paid back in cash',
    created_at: new Date(Date.now() - 86400000 * 6).toISOString()
  }
];

// Helper to get local data
const getLocalData = (key, defaultValue) => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error reading localStorage key', key, error);
    return defaultValue;
  }
};

// Helper to save local data
const saveLocalData = (key, data) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Error writing localStorage key', key, error);
  }
};

// Main Data Client
export const db = {
  isMock: () => !supabase,

  // --- AUTH OPERATIONS (EMAIL & PASSWORD) ---
  async signUpWithPassword(emailAddress, password, username) {
    if (!supabase) {
      // Offline Simulation Mode
      const user = {
        id: `usr-${Date.now()}`,
        email: emailAddress.trim().toLowerCase(),
        user_metadata: {
          display_name: username.trim() || emailAddress.split('@')[0],
          username: username.trim() || emailAddress.split('@')[0]
        }
      };
      // Save user to mock users table in localStorage
      if (typeof window !== 'undefined') {
        const users = JSON.parse(localStorage.getItem('loan_share_mock_users') || '[]');
        if (users.some(u => u.email === user.email)) {
          return { data: null, error: { message: 'An account with this email already exists.' } };
        }
        users.push({ ...user, password });
        localStorage.setItem('loan_share_mock_users', JSON.stringify(users));
        localStorage.setItem('loan_share_user_session', JSON.stringify(user));
      }
      return { data: { user }, error: null };
    }

    const { data, error } = await supabase.auth.signUp({
      email: emailAddress.trim().toLowerCase(),
      password: password,
      options: {
        data: {
          display_name: username.trim() || emailAddress.split('@')[0],
          username: username.trim() || emailAddress.split('@')[0]
        }
      }
    });
    return { data, error };
  },

  async signInWithPassword(emailAddress, password) {
    if (!supabase) {
      // Offline Simulation Mode
      if (typeof window !== 'undefined') {
        const users = JSON.parse(localStorage.getItem('loan_share_mock_users') || '[]');
        const found = users.find(u => u.email === emailAddress.trim().toLowerCase() && u.password === password);
        if (found) {
          const user = { id: found.id, email: found.email, user_metadata: found.user_metadata };
          localStorage.setItem('loan_share_user_session', JSON.stringify(user));
          return { data: { user }, error: null };
        } else {
          return { data: null, error: { message: 'Invalid email or password.' } };
        }
      }
      return { data: null, error: { message: 'Browser session unavailable.' } };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailAddress.trim().toLowerCase(),
      password: password
    });
    return { data, error };
  },

  async updateUserPassword(newPassword) {
    if (!supabase) {
      // Offline Simulation Mode
      if (typeof window !== 'undefined') {
        const session = JSON.parse(localStorage.getItem('loan_share_user_session') || '{}');
        const users = JSON.parse(localStorage.getItem('loan_share_mock_users') || '[]');
        const idx = users.findIndex(u => u.email === session.email);
        if (idx !== -1) {
          users[idx].password = newPassword;
          localStorage.setItem('loan_share_mock_users', JSON.stringify(users));
        }
      }
      return { success: true, error: null };
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    });
    return { data, error };
  },

  async getCurrentUser() {
    if (!supabase) {
      if (typeof window === 'undefined') return null;
      const sess = localStorage.getItem('loan_share_user_session');
      return sess ? JSON.parse(sess) : null;
    }
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  },

  async signOut() {
    if (!supabase) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('loan_share_user_session');
      }
      return { error: null };
    }
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async updateUserProfile(newEmail, metadata) {
    if (await this.useSupabase()) {
      const updates = {};
      
      // 1. Update user metadata (display name / username)
      if (metadata) {
        updates.data = metadata;
      }
      
      // 2. Update email address if it changed
      const currentUser = await this.getCurrentUser();
      if (newEmail && newEmail.trim().toLowerCase() !== currentUser.email.toLowerCase()) {
        updates.email = newEmail.trim().toLowerCase();
      }

      if (Object.keys(updates).length === 0) return { success: true };

      const { data, error } = await supabase.auth.updateUser(updates);
      if (error) throw error;
      return { success: true, data };
    } else {
      // Offline LocalStorage Simulation Mode
      const sess = JSON.parse(localStorage.getItem('loan_share_user_session') || '{}');
      if (newEmail) {
        sess.email = newEmail.trim().toLowerCase();
      }
      if (metadata) {
        sess.user_metadata = { ...(sess.user_metadata || {}), ...metadata };
      }
      localStorage.setItem('loan_share_user_session', JSON.stringify(sess));
      return { success: true, user: sess };
    }
  },

  // --- PRIVATE DATA MODE SWITCHER ---
  async useSupabase() {
    if (!supabase) return false;
    const user = await this.getCurrentUser();
    return !!user;
  },

  // --- ACCOUNTS ---
  async getAccounts() {
    if (await this.useSupabase()) {
      const user = await this.getCurrentUser();
      if (!user) return [];
      
      const { data, error } = await supabase.from('bank_accounts').select('*').eq('user_id', user.id).order('name', { ascending: true });
      if (error) {
        // Fallback: If user_id column does not exist yet, query unscoped to prevent dashboard crash!
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('user_id')) {
          console.warn('⚠️ Column "user_id" does not exist in public.bank_accounts yet. Falling back to unscoped selection.');
          const { data: fallbackData, error: fallbackError } = await supabase.from('bank_accounts').select('*').order('name', { ascending: true });
          if (fallbackError) throw fallbackError;
          return fallbackData;
        }
        throw error;
      }
      return data;
    } else {
      let accounts = getLocalData('loan_share_accounts', null);
      if (!accounts) {
        accounts = MOCK_INITIAL_ACCOUNTS;
        saveLocalData('loan_share_accounts', accounts);
      }
      return accounts;
    }
  },

  async addAccount(account) {
    if (await this.useSupabase()) {
      const user = await this.getCurrentUser();
      const newAcc = { ...account, user_id: user.id };
      const { data, error } = await supabase.from('bank_accounts').insert([newAcc]).select();
      if (error) {
        // Fallback: If insert fails due to missing user_id column, retry without user scoping
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('user_id')) {
          console.warn('Column "user_id" does not exist in public.bank_accounts yet. Retrying insert without scoping.');
          const { data: fallbackData, error: fallbackError } = await supabase.from('bank_accounts').insert([account]).select();
          if (fallbackError) throw fallbackError;
          return fallbackData[0];
        }
        throw error;
      }
      return data[0];
    } else {
      const accounts = await this.getAccounts();
      const newAccount = {
        id: `acc-${Date.now()}`,
        ...account,
        balance: parseFloat(account.balance) || 0
      };
      accounts.push(newAccount);
      saveLocalData('loan_share_accounts', accounts);
      return newAccount;
    }
  },

  async updateAccountBalance(id, newBalance) {
    if (await this.useSupabase()) {
      const { data, error } = await supabase.from('bank_accounts').update({ balance: newBalance, updated_at: new Date() }).eq('id', id).select();
      if (error) throw error;
      return data[0];
    } else {
      const accounts = await this.getAccounts();
      const index = accounts.findIndex(a => a.id === id);
      if (index !== -1) {
        accounts[index].balance = parseFloat(newBalance);
        saveLocalData('loan_share_accounts', accounts);
        return accounts[index];
      }
      throw new Error('Account not found');
    }
  },

  async deleteAccount(id) {
    if (await this.useSupabase()) {
      const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
      if (error) throw error;
      return true;
    } else {
      const accounts = await this.getAccounts();
      const filtered = accounts.filter(a => a.id !== id);
      saveLocalData('loan_share_accounts', filtered);
      return true;
    }
  },

  // --- LOANS (Borrows & Lends) ---
  async getLoans() {
    if (await this.useSupabase()) {
      const user = await this.getCurrentUser();
      if (!user) return [];
      
      const { data, error } = await supabase.from('loans').select('*').eq('user_id', user.id).order('due_date', { ascending: true });
      if (error) {
        // Fallback: If user_id column does not exist yet, query unscoped to prevent dashboard crash!
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('user_id')) {
          console.warn('⚠️ Column "user_id" does not exist in public.loans yet. Falling back to unscoped selection.');
          const { data: fallbackData, error: fallbackError } = await supabase.from('loans').select('*').order('due_date', { ascending: true });
          if (fallbackError) throw fallbackError;
          return fallbackData;
        }
        throw error;
      }
      return data;
    } else {
      let loans = getLocalData('loan_share_loans', null);
      if (!loans) {
        loans = MOCK_INITIAL_LOANS;
        saveLocalData('loan_share_loans', loans);
      }
      return loans;
    }
  },

  async addLoan(loan) {
    if (await this.useSupabase()) {
      const user = await this.getCurrentUser();
      const newLoan = { 
        ...loan, 
        user_id: user.id,
        user_email: user.email,
        outstanding_amount: parseFloat(loan.amount),
        amount: parseFloat(loan.amount),
        status: 'active'
      };
      const { data, error } = await supabase.from('loans').insert([newLoan]).select();
      if (error) {
        // Fallback: If insert fails due to missing user columns, retry without user scoping
        if (error.code === '42703' || error.message?.includes('column') || error.message?.includes('user_')) {
          console.warn('Columns "user_id"/"user_email" do not exist in public.loans yet. Retrying insert without scoping.');
          const cleanLoan = {
            type: loan.type,
            contact_name: loan.contact_name,
            amount: parseFloat(loan.amount),
            outstanding_amount: parseFloat(loan.amount),
            due_date: loan.due_date,
            notes: loan.notes,
            status: 'active'
          };
          const { data: fallbackData, error: fallbackError } = await supabase.from('loans').insert([cleanLoan]).select();
          if (fallbackError) throw fallbackError;
          return fallbackData[0];
        }
        throw error;
      }
      return data[0];
    } else {
      const loans = await this.getLoans();
      const user = await this.getCurrentUser();
      const newLoan = {
        id: `loan-${Date.now()}`,
        created_at: new Date().toISOString(),
        status: 'active',
        outstanding_amount: parseFloat(loan.amount),
        user_id: user ? user.id : 'mock-user-uuid',
        user_email: user ? user.email : 'mock@example.com',
        ...loan,
        amount: parseFloat(loan.amount)
      };
      loans.push(newLoan);
      saveLocalData('loan_share_loans', loans);
      return newLoan;
    }
  },

  async markLoanAsCollected(id, bankAccountId = null) {
    if (await this.useSupabase()) {
      const { data: loan, error: getErr } = await supabase.from('loans').select('*').eq('id', id).single();
      if (getErr) throw getErr;

      const { data: updatedLoan, error: updateErr } = await supabase.from('loans').update({
        status: 'repaid',
        outstanding_amount: 0
      }).eq('id', id).select().single();
      if (updateErr) throw updateErr;

      if (bankAccountId && loan.outstanding_amount > 0) {
        const { data: account, error: accErr } = await supabase.from('bank_accounts').select('*').eq('id', bankAccountId).single();
        if (!accErr && account) {
          const change = loan.type === 'lend' ? loan.outstanding_amount : -loan.outstanding_amount;
          const newBal = parseFloat(account.balance) + change;
          await supabase.from('bank_accounts').update({ balance: newBal, updated_at: new Date() }).eq('id', bankAccountId);
        }
      }
      return updatedLoan;
    } else {
      const loans = await this.getLoans();
      const loanIndex = loans.findIndex(l => l.id === id);
      if (loanIndex === -1) throw new Error('Loan not found');

      const loan = loans[loanIndex];
      const previousOutstanding = loan.outstanding_amount;
      
      loan.status = 'repaid';
      loan.outstanding_amount = 0;
      
      saveLocalData('loan_share_loans', loans);

      if (bankAccountId && previousOutstanding > 0) {
        const accounts = await this.getAccounts();
        const accIndex = accounts.findIndex(a => a.id === bankAccountId);
        if (accIndex !== -1) {
          const account = accounts[accIndex];
          const change = loan.type === 'lend' ? previousOutstanding : -previousOutstanding;
          account.balance = parseFloat(account.balance) + change;
          saveLocalData('loan_share_accounts', accounts);
        }
      }
      
      return loan;
    }
  },

  async settleFullLoan(id, bankAccountId = null, outstandingAmount = 0) {
    return this.markLoanAsCollected(id, bankAccountId);
  },

  async updateLoanOutstanding(id, newOutstanding, bankAccountId = null, paymentAmount = 0) {
    if (await this.useSupabase()) {
      const { data, error } = await supabase.from('loans').update({
        outstanding_amount: newOutstanding,
        status: newOutstanding <= 0 ? 'repaid' : 'active'
      }).eq('id', id).select().single();
      if (error) throw error;

      if (bankAccountId && paymentAmount > 0) {
        const { data: loan } = await supabase.from('loans').select('type').eq('id', id).single();
        const { data: account } = await supabase.from('bank_accounts').select('balance').eq('id', bankAccountId).single();
        if (account && loan) {
          const change = loan.type === 'lend' ? paymentAmount : -paymentAmount;
          const newBal = parseFloat(account.balance) + change;
          await supabase.from('bank_accounts').update({ balance: newBal, updated_at: new Date() }).eq('id', bankAccountId);
        }
      }

      return data;
    } else {
      const loans = await this.getLoans();
      const index = loans.findIndex(l => l.id === id);
      if (index === -1) throw new Error('Loan not found');

      const loan = loans[index];
      loan.outstanding_amount = parseFloat(newOutstanding);
      if (loan.outstanding_amount <= 0) {
        loan.status = 'repaid';
      }

      saveLocalData('loan_share_loans', loans);

      if (bankAccountId && paymentAmount > 0) {
        const accounts = await this.getAccounts();
        const accIndex = accounts.findIndex(a => a.id === bankAccountId);
        if (accIndex !== -1) {
          const account = accounts[accIndex];
          const change = loan.type === 'lend' ? parseFloat(paymentAmount) : -parseFloat(paymentAmount);
          account.balance = parseFloat(account.balance) + change;
          saveLocalData('loan_share_accounts', accounts);
        }
      }

      return loan;
    }
  },

  async deleteLoan(id) {
    if (await this.useSupabase()) {
      const { error } = await supabase.from('loans').delete().eq('id', id);
      if (error) throw error;
      return true;
    } else {
      const loans = await this.getLoans();
      const filtered = loans.filter(l => l.id !== id);
      saveLocalData('loan_share_loans', filtered);
      return true;
    }
  },

  // --- SNOOZE REMINDERS ---
  async getReminders() {
    if (await this.useSupabase()) {
      const { data, error } = await supabase.from('snooze_reminders').select('*').eq('active', true);
      if (error) throw error;
      return data;
    } else {
      return getLocalData('loan_share_reminders', []);
    }
  },

  async snoozeLoan(id, hours) {
    const remindAt = new Date(Date.now() + hours * 3600000).toISOString();
    if (await this.useSupabase()) {
      const { data, error } = await supabase.from('snooze_reminders').upsert({
        loan_id: id,
        remind_at: remindAt,
        active: true
      }, { onConflict: 'loan_id' }).select();
      if (error) throw error;
      return data[0];
    } else {
      const reminders = await this.getReminders();
      const index = reminders.findIndex(r => r.loan_id === id);
      const reminder = {
        id: index !== -1 ? reminders[index].id : `rem-${Date.now()}`,
        loan_id: id,
        remind_at: remindAt,
        snooze_count: index !== -1 ? (reminders[index].snooze_count + 1) : 1,
        active: true
      };
      if (index !== -1) {
        reminders[index] = reminder;
      } else {
        reminders.push(reminder);
      }
      saveLocalData('loan_share_reminders', reminders);
      return reminder;
    }
  },

  async cancelReminder(loanId) {
    if (await this.useSupabase()) {
      const { error } = await supabase.from('snooze_reminders').update({ active: false }).eq('loan_id', loanId);
      if (error) throw error;
      return true;
    } else {
      const reminders = await this.getReminders();
      const filtered = reminders.filter(r => r.loan_id !== loanId);
      saveLocalData('loan_share_reminders', filtered);
      return true;
    }
  },

  // --- INVESTMENTS OPERATIONS ---
  async getInvestments() {
    if (await this.useSupabase()) {
      try {
        const { data, error } = await supabase.from('investments').select('*').order('created_at', { ascending: false });
        if (error) {
          // Self-healing check if investments table doesn't exist in Supabase (42P01 error code)
          if (error.code === '42P01') {
            console.warn('⚠️ investments table does not exist in Supabase yet. Falling back to local storage.');
            return getLocalData('loan_share_investments', []);
          }
          throw error;
        }
        return data || [];
      } catch (err) {
        console.error('getInvestments failed, falling back to local storage:', err);
        return getLocalData('loan_share_investments', []);
      }
    } else {
      return getLocalData('loan_share_investments', []);
    }
  },

  async addInvestment(inv) {
    const user = await this.getCurrentUser();
    const newInv = {
      ...inv,
      id: inv.id || (await this.useSupabase() ? undefined : `inv-${Date.now()}`),
      user_email: user ? user.email : '',
      currency: 'INR',
      created_at: new Date().toISOString()
    };

    if (await this.useSupabase()) {
      try {
        const { data, error } = await supabase.from('investments').insert(newInv).select();
        if (error) throw error;
        return data[0];
      } catch (err) {
        console.error('addInvestment failed, writing to local storage fallback:', err);
        const local = await this.getInvestments();
        newInv.id = `inv-${Date.now()}`;
        local.unshift(newInv);
        saveLocalData('loan_share_investments', local);
        return newInv;
      }
    } else {
      const local = await this.getInvestments();
      local.unshift(newInv);
      saveLocalData('loan_share_investments', local);
      return newInv;
    }
  },

  async updateInvestmentValue(id, newValue) {
    if (await this.useSupabase()) {
      try {
        const { data, error } = await supabase.from('investments').update({
          current_value: newValue,
          updated_at: new Date().toISOString()
        }).eq('id', id).select();
        if (error) throw error;
        return data[0];
      } catch (err) {
        console.error('updateInvestmentValue failed, writing to local storage fallback:', err);
        const local = await this.getInvestments();
        const index = local.findIndex(i => i.id === id);
        if (index !== -1) {
          local[index].current_value = newValue;
          local[index].updated_at = new Date().toISOString();
          saveLocalData('loan_share_investments', local);
          return local[index];
        }
        throw err;
      }
    } else {
      const local = await this.getInvestments();
      const index = local.findIndex(i => i.id === id);
      if (index !== -1) {
        local[index].current_value = newValue;
        local[index].updated_at = new Date().toISOString();
        saveLocalData('loan_share_investments', local);
        return local[index];
      }
      return null;
    }
  },

  async deleteInvestment(id) {
    if (await this.useSupabase()) {
      try {
        const { error } = await supabase.from('investments').delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.error('deleteInvestment failed, editing local storage fallback:', err);
        const local = await this.getInvestments();
        const filtered = local.filter(i => i.id !== id);
        saveLocalData('loan_share_investments', filtered);
        return true;
      }
    } else {
      const local = await this.getInvestments();
      const filtered = local.filter(i => i.id !== id);
      saveLocalData('loan_share_investments', filtered);
      return true;
    }
  },

  // --- CRON ADMIN OPERATIONS (RLS Bypassing) ---
  async getAllLoansForCron() {
    if (supabaseAdmin) {
      console.log('Using Supabase Admin client for cron job...');
      const { data, error } = await supabaseAdmin.from('loans').select('*').eq('status', 'active');
      if (error) throw error;
      return data;
    } else if (supabase) {
      console.log('Using Supabase Anon client for cron job (fallback)...');
      const { data, error } = await supabase.from('loans').select('*').eq('status', 'active');
      if (error) throw error;
      return data;
    } else {
      return getLocalData('loan_share_loans', MOCK_INITIAL_LOANS).filter(l => l.status === 'active');
    }
  },

  async getAllRemindersForCron() {
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.from('snooze_reminders').select('*').eq('active', true);
      if (error) throw error;
      return data;
    } else if (supabase) {
      const { data, error } = await supabase.from('snooze_reminders').select('*').eq('active', true);
      if (error) throw error;
      return data;
    } else {
      return getLocalData('loan_share_reminders', []).filter(r => r.active === true);
    }
  },

  async cancelReminderForCron(loanId) {
    if (supabaseAdmin) {
      const { error } = await supabaseAdmin.from('snooze_reminders').update({ active: false }).eq('loan_id', loanId);
      if (error) throw error;
      return true;
    } else if (supabase) {
      const { error } = await supabase.from('snooze_reminders').update({ active: false }).eq('loan_id', loanId);
      if (error) throw error;
      return true;
    } else {
      const reminders = await this.getReminders();
      const filtered = reminders.filter(r => r.loan_id !== loanId);
      saveLocalData('loan_share_reminders', filtered);
      return true;
    }
  }
};

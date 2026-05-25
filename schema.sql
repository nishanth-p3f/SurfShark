-- ====================================================================
-- LOANSHARE DATABASE INITIALIZATION SCHEMA & UPGRADE SCRIPT
-- Copy and paste this directly into the Supabase SQL Editor to set up!
-- ====================================================================

-- --------------------------------------------------------------------
-- OPTION A: MIGRATION SCRIPT (RUN THIS IF YOU ALREADY CREATED TABLES)
-- This adds the necessary user columns and scopes for secure multi-user alerts.
-- --------------------------------------------------------------------
-- ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
-- ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS user_email TEXT;
-- ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
-- ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS user_email TEXT;
--
-- -- Backfill user email and ID for existing records (if any)
-- UPDATE public.loans SET user_id = auth.uid() WHERE user_id IS NULL;
-- UPDATE public.bank_accounts SET user_id = auth.uid() WHERE user_id IS NULL;
--
-- -- Enable and secure Row Level Security (RLS) policies
-- ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "Allow anonymous read access" ON public.bank_accounts;
-- DROP POLICY IF EXISTS "Allow anonymous write access" ON public.bank_accounts;
-- CREATE POLICY "Allow users full access to their own bank accounts" 
-- ON public.bank_accounts FOR ALL TO authenticated 
-- USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
--
-- DROP POLICY IF EXISTS "Allow anonymous read access" ON public.loans;
-- DROP POLICY IF EXISTS "Allow anonymous write access" ON public.loans;
-- CREATE POLICY "Allow users full access to their own loans" 
-- ON public.loans FOR ALL TO authenticated 
-- USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- --------------------------------------------------------------------
-- OPTION B: FULL SCHEMA INITIALIZATION (FOR FRESH SETUPS)
-- --------------------------------------------------------------------

-- 1. Create BANK ACCOUNTS table
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    user_email TEXT,
    name TEXT NOT NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency TEXT NOT NULL DEFAULT 'INR',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable secure Row Level Security
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users full access to their own bank accounts" ON public.bank_accounts;
CREATE POLICY "Allow users full access to their own bank accounts" 
ON public.bank_accounts FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 2. Create LOANS table
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    user_email TEXT,
    type TEXT NOT NULL CHECK (type IN ('lend', 'borrow')),
    contact_name TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    outstanding_amount NUMERIC(15, 2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'repaid')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable secure Row Level Security
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users full access to their own loans" ON public.loans;
CREATE POLICY "Allow users full access to their own loans" 
ON public.loans FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 3. Create SNOOZE REMINDERS table
CREATE TABLE IF NOT EXISTS public.snooze_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
    remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    snooze_count INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT unique_loan_snooze UNIQUE (loan_id)
);

-- Enable Row Level Security (RLS) protected by foreign key cascade
ALTER TABLE public.snooze_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users full access to their own snooze reminders" ON public.snooze_reminders;
CREATE POLICY "Allow users full access to their own snooze reminders" 
ON public.snooze_reminders FOR ALL TO authenticated 
USING (true) 
WITH CHECK (true);

-- ==========================================
-- Lawyer Business Management System - Supabase Schema
-- ==========================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Profiles Table (Extends Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    mobile_number TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    mobile_verified BOOLEAN DEFAULT FALSE,
    otp_code TEXT,
    otp_expires_at TIMESTAMPTZ,
    subscription_start_date TIMESTAMPTZ,
    subscription_end_date TIMESTAMPTZ,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    lawyer_id UUID REFERENCES public.profiles(id),
    permissions JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_info TEXT,
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Cases Table
CREATE TABLE IF NOT EXISTS public.cases (
    id TEXT PRIMARY KEY,
    subject TEXT,
    client_id TEXT REFERENCES public.clients(id) ON DELETE CASCADE,
    opponent_name TEXT,
    fee_agreement TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'on_hold')),
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Stages Table
CREATE TABLE IF NOT EXISTS public.stages (
    id TEXT PRIMARY KEY,
    case_id TEXT REFERENCES public.cases(id) ON DELETE CASCADE,
    court TEXT,
    case_number TEXT,
    first_session_date TIMESTAMPTZ,
    decision_date TIMESTAMPTZ,
    decision_number TEXT,
    decision_summary TEXT,
    decision_notes TEXT,
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Sessions Table
CREATE TABLE IF NOT EXISTS public.sessions (
    id TEXT PRIMARY KEY,
    stage_id TEXT REFERENCES public.stages(id) ON DELETE CASCADE,
    court TEXT,
    case_number TEXT,
    date TIMESTAMPTZ NOT NULL,
    client_name TEXT,
    opponent_name TEXT,
    postponement_reason TEXT,
    next_postponement_reason TEXT,
    is_postponed BOOLEAN DEFAULT FALSE,
    next_session_date TIMESTAMPTZ,
    assignee TEXT,
    stage_decision_date TIMESTAMPTZ,
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Admin Tasks Table
CREATE TABLE IF NOT EXISTS public.admin_tasks (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL,
    due_date TIMESTAMPTZ,
    completed BOOLEAN DEFAULT FALSE,
    importance TEXT DEFAULT 'normal' CHECK (importance IN ('normal', 'important', 'urgent')),
    assignee TEXT,
    location TEXT,
    order_index INTEGER DEFAULT 0,
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    time TEXT,
    date TIMESTAMPTZ NOT NULL,
    importance TEXT DEFAULT 'normal' CHECK (importance IN ('normal', 'important', 'urgent')),
    completed BOOLEAN DEFAULT FALSE,
    notified BOOLEAN DEFAULT FALSE,
    reminder_time_in_minutes INTEGER DEFAULT 15,
    assignee TEXT,
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Accounting Entries Table
CREATE TABLE IF NOT EXISTS public.accounting_entries (
    id TEXT PRIMARY KEY,
    type TEXT CHECK (type IN ('income', 'expense')),
    amount DECIMAL(12, 2) NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    description TEXT,
    client_id TEXT,
    case_id TEXT,
    client_name TEXT,
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    client_name TEXT,
    case_id TEXT,
    case_subject TEXT,
    issue_date TIMESTAMPTZ DEFAULT NOW(),
    due_date TIMESTAMPTZ,
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    discount DECIMAL(12, 2) DEFAULT 0,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
    notes TEXT,
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Invoice Items Table
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT,
    amount DECIMAL(12, 2) NOT NULL,
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Documents Table
CREATE TABLE IF NOT EXISTS public.documents (
    id TEXT PRIMARY KEY,
    case_id TEXT,
    user_id UUID REFERENCES auth.users NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    size INTEGER,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    storage_path TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Assistants List
CREATE TABLE IF NOT EXISTS public.assistants (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Site Finances
CREATE TABLE IF NOT EXISTS public.site_finances (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users,
    type TEXT CHECK (type IN ('income', 'expense')),
    payment_date TEXT,
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,
    payment_method TEXT,
    category TEXT,
    profile_full_name TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Sync Deletions
CREATE TABLE IF NOT EXISTS public.sync_deletions (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Helper function to get the effective owner ID (Lawyer ID)
CREATE OR REPLACE FUNCTION public.get_effective_owner_id()
RETURNS UUID AS $$
  SELECT COALESCE((SELECT lawyer_id FROM public.profiles WHERE id = auth.uid()), auth.uid());
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- Helper function to get the lawyer ID without recursion
CREATE OR REPLACE FUNCTION public.get_auth_lawyer_id()
RETURNS UUID AS $$
  SELECT lawyer_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- RLS POLICIES
DO $$ 
DECLARE 
    t TEXT;
    tables TEXT[] := ARRAY['clients', 'cases', 'stages', 'sessions', 'admin_tasks', 'appointments', 'accounting_entries', 'invoices', 'invoice_items', 'documents', 'assistants', 'sync_deletions'];
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Users can access their office data" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Users can access their office data" ON public.%I 
                        FOR ALL USING (user_id = public.get_effective_owner_id())
                        WITH CHECK (user_id = public.get_effective_owner_id())', t);
    END LOOP;
END $$;

-- Special Policy for Profiles (Non-recursive)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Profiles access policy" ON public.profiles
    FOR SELECT USING (
        id = auth.uid() OR 
        lawyer_id = auth.uid() OR 
        id = public.get_auth_lawyer_id() OR
        lawyer_id = public.get_auth_lawyer_id()
    );

CREATE POLICY "Profiles update policy" ON public.profiles
    FOR UPDATE USING (id = auth.uid());

-- Deletion Triggers
CREATE OR REPLACE FUNCTION public.log_sync_deletion()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.sync_deletions (table_name, record_id, user_id)
    VALUES (TG_TABLE_NAME, OLD.id::text, OLD.user_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$ 
DECLARE 
    t TEXT;
    tables TEXT[] := ARRAY['clients', 'cases', 'stages', 'sessions', 'admin_tasks', 'appointments', 'accounting_entries', 'invoices', 'documents'];
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I_deletion_trigger ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER %I_deletion_trigger BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_sync_deletion()', t, t);
    END LOOP;
END $$;

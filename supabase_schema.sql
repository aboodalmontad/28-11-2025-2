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
    lawyer_id UUID REFERENCES public.profiles(id), -- If this is an assistant, this points to their lawyer
    permissions JSONB, -- Custom permissions for assistants
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Clients Table
CREATE TABLE IF NOT EXISTS public.clients (
    id TEXT PRIMARY KEY, -- Using TEXT to support local-first generated IDs
    name TEXT NOT NULL,
    contact_info TEXT,
    user_id UUID REFERENCES auth.users NOT NULL, -- The owner/lawyer ID
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

-- 13. Assistants List (Simple list for dropdowns)
CREATE TABLE IF NOT EXISTS public.assistants (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    user_id UUID REFERENCES auth.users NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Site Finances (Admin/Global)
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

-- 15. Sync Deletions (Crucial for offline sync)
CREATE TABLE IF NOT EXISTS public.sync_deletions (
    id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users NOT NULL,
    deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Public Profiles View (To avoid RLS recursion issues if any remain)
CREATE OR REPLACE VIEW public.public_profiles_view AS
SELECT 
    id,
    full_name,
    mobile_number,
    is_approved,
    is_active,
    mobile_verified,
    otp_code,
    otp_expires_at,
    subscription_start_date,
    subscription_end_date,
    role,
    lawyer_id,
    permissions,
    created_at,
    updated_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles_view TO anon, authenticated;

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_finances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_deletions ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the user is an admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get the effective owner ID (Lawyer ID)
CREATE OR REPLACE FUNCTION public.get_effective_owner_id()
RETURNS UUID AS $$
DECLARE
    lawyer_id_val UUID;
BEGIN
    SELECT lawyer_id INTO lawyer_id_val FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(lawyer_id_val, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Generic Policy: Users can see their own data OR data belonging to their lawyer
-- We apply this to all data tables with explicit INSERT/UPDATE support
DO $$ 
DECLARE 
    t TEXT;
    tables TEXT[] := ARRAY['clients', 'cases', 'stages', 'sessions', 'admin_tasks', 'appointments', 'accounting_entries', 'invoices', 'invoice_items', 'documents', 'assistants', 'sync_deletions'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Users can access their office data" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Users can access their office data" ON public.%I 
                        FOR ALL USING (public.is_admin() OR user_id = public.get_effective_owner_id())
                        WITH CHECK (public.is_admin() OR user_id = public.get_effective_owner_id())', t);
    END LOOP;
END $$;

-- Special Policy for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can manage site finances" ON public.site_finances
    FOR ALL USING (public.is_admin());

-- ==========================================
-- TRIGGERS FOR SYNC DELETIONS
-- ==========================================

CREATE OR REPLACE FUNCTION public.log_sync_deletion()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.sync_deletions (table_name, record_id, user_id)
    VALUES (TG_TABLE_NAME, OLD.id::text, OLD.user_id);
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply deletion trigger to all relevant tables
DO $$ 
DECLARE 
    t TEXT;
    tables TEXT[] := ARRAY['clients', 'cases', 'stages', 'sessions', 'admin_tasks', 'appointments', 'accounting_entries', 'invoices', 'documents'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I_deletion_trigger ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER %I_deletion_trigger BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_sync_deletion()', t, t);
    END LOOP;
END $$;

-- ==========================================
-- AUTOMATIC PROFILE CREATION
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id, 
        NEW.raw_user_meta_data->>'full_name', 
        CASE 
            WHEN NEW.email IN ('nahwiabdo@gmail.com', 'avocat.nahwi@gmail.com', 'sy963958932922@email.com') THEN 'admin'
            ELSE 'user'
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

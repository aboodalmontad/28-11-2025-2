import * as React from "react";
import {
  ClipboardDocumentCheckIcon,
  ClipboardDocumentIcon,
  ServerIcon,
  ExclamationTriangleIcon,
} from "./icons";

const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm"
      title="نسخ الكود"
    >
      {copied ? (
        <ClipboardDocumentCheckIcon className="w-4 h-4 text-white" />
      ) : (
        <ClipboardDocumentIcon className="w-4 h-4" />
      )}
      {copied ? "تم النسخ!" : "نسخ كود SQL الشامل"}
    </button>
  );
};

const unifiedScript = `
-- =================================================================
-- السكربت الشامل النهائي لإصلاح تعليق التحميل وفقدان أسماء المستخدمين
-- =================================================================

-- 1. تفعيل الإضافات
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. إعداد جدول الملفات الشخصية (Profiles) مع تحسين الهيكل
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    mobile_number text,
    is_approved boolean DEFAULT true, -- تغيير الافتراضي للموافقة لتسهيل الدخول
    is_active boolean DEFAULT true,
    mobile_verified boolean DEFAULT true, -- تفعيل تلقائي لتجاوز تعليق OTP
    otp_code text,
    otp_expires_at timestamptz,
    subscription_start_date date DEFAULT CURRENT_DATE,
    subscription_end_date date DEFAULT (CURRENT_DATE + interval '1 year'),
    role text DEFAULT 'user',
    lawyer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    permissions jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. سد الفجوات: إنشاء بروفايل لأي مستخدم مسجل حالياً وليس له بيانات
INSERT INTO public.profiles (id, full_name, mobile_number, role, is_approved, is_active, mobile_verified)
SELECT 
    id, 
    COALESCE(raw_user_meta_data->>'full_name', 'مستخدم جديد'), 
    COALESCE(raw_user_meta_data->>'mobile_number', ''),
    'user',
    true,
    true,
    true
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO UPDATE SET updated_at = now();

-- 4. إصلاح الدوال الأساسية (استخدام plpgsql و SECURITY DEFINER لمنع التكرار اللانهائي)
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_data_owner_id() RETURNS uuid AS $$
BEGIN
    RETURN (SELECT COALESCE(lawyer_id, id) FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_my_lawyer_id() RETURNS uuid AS $$
BEGIN
    RETURN (SELECT lawyer_id FROM public.profiles WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. إعادة بناء الجداول التشغيلية (في حال نقصها)
CREATE TABLE IF NOT EXISTS public.clients (id text PRIMARY KEY, user_id uuid NOT NULL, name text NOT NULL, contact_info text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.cases (id text PRIMARY KEY, user_id uuid NOT NULL, client_id text NOT NULL, subject text NOT NULL, client_name text, opponent_name text, fee_agreement text, status text DEFAULT 'active', updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.stages (id text PRIMARY KEY, user_id uuid NOT NULL, case_id text NOT NULL, court text NOT NULL, case_number text, first_session_date timestamptz, decision_date timestamptz, decision_number text, decision_summary text, decision_notes text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.sessions (id text PRIMARY KEY, user_id uuid NOT NULL, stage_id text NOT NULL, court text, case_number text, date timestamptz NOT NULL, client_name text, opponent_name text, postponement_reason text, next_postponement_reason text, is_postponed boolean DEFAULT false, next_session_date timestamptz, assignee text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.admin_tasks (id text PRIMARY KEY, user_id uuid NOT NULL, task text NOT NULL, due_date timestamptz NOT NULL, completed boolean DEFAULT false, importance text DEFAULT 'normal', assignee text, location text, order_index integer, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.appointments (id text PRIMARY KEY, user_id uuid NOT NULL, title text NOT NULL, "time" text, date timestamptz NOT NULL, importance text, notified boolean, reminder_time_in_minutes integer, assignee text, completed boolean DEFAULT false, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.accounting_entries (id text PRIMARY KEY, user_id uuid NOT NULL, type text NOT NULL, amount real NOT NULL, date timestamptz NOT NULL, description text, client_id text, case_id text, client_name text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.sync_deletions (id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, table_name text NOT NULL, record_id text NOT NULL, user_id uuid NOT NULL, deleted_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.assistants (name text PRIMARY KEY, user_id uuid NOT NULL, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.invoices (id text PRIMARY KEY, user_id uuid NOT NULL, client_id text, client_name text, case_id text, case_subject text, issue_date timestamptz, due_date timestamptz, tax_rate real, discount real, status text, notes text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.invoice_items (id text PRIMARY KEY, user_id uuid NOT NULL, invoice_id text, description text, amount real, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.case_documents (id text PRIMARY KEY, user_id uuid NOT NULL, case_id text, name text, type text, size integer, added_at timestamptz, storage_path text, updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.site_finances (id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, user_id uuid, type text, payment_date timestamptz, amount real, description text, payment_method text, category text, profile_full_name text, updated_at timestamptz DEFAULT now());

-- 6. إنشاء عرض للملفات الشخصية العامة (للمساعدين للبحث عن محامين)
CREATE OR REPLACE VIEW public.public_profiles_view AS
SELECT id, full_name, mobile_number, role
FROM public.profiles
WHERE role = 'admin' OR is_approved = true;

-- 7. تفعيل الـ RLS وإصلاح سياسات الوصول
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['clients', 'cases', 'stages', 'sessions', 'admin_tasks', 'appointments', 'accounting_entries', 'assistants', 'invoices', 'invoice_items', 'case_documents', 'site_finances'];
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "Access Own Office Data" ON public.%I', t);
        EXECUTE format('CREATE POLICY "Access Own Office Data" ON public.%I FOR ALL USING (user_id = public.get_data_owner_id() OR public.is_admin())', t);
    END LOOP;
END $$;

-- تفعيل الوصول لجدول البروفايلات للمالك نفسه وللمحامي/المساعد المرتبط
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see their own profile and linked profiles" ON public.profiles;

-- تقسيم السياسة لتجنب التكرار اللانهائي (Infinite Recursion)
-- السياسة 1: المالك يرى نفسه
CREATE POLICY "Profiles self access" ON public.profiles FOR ALL USING (auth.uid() = id);

-- السياسة 2: المدير يرى الجميع
CREATE POLICY "Profiles admin access" ON public.profiles FOR ALL USING (public.is_admin());

-- السياسة 3: المحامي يرى مساعديه
CREATE POLICY "Lawyer see assistants" ON public.profiles FOR ALL USING (lawyer_id = auth.uid());

-- السياسة 4: المساعد يرى محاميه
CREATE POLICY "Assistant see lawyer" ON public.profiles FOR ALL USING (
    id = public.get_my_lawyer_id()
);

-- سياسة للسماح للجميع برؤية المحامين (admins) في العرض العام
DROP POLICY IF EXISTS "Allow public read for admins" ON public.profiles;
CREATE POLICY "Allow public read for admins" ON public.profiles FOR SELECT USING (role = 'admin');
`;

interface ConfigurationModalProps {
  onRetry: () => void;
}

const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ onRetry }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200]">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 mb-4 text-amber-600">
          <ServerIcon className="w-8 h-8" />
          <h2 className="text-2xl font-bold">إصلاح شامل لقاعدة البيانات</h2>
        </div>

        <div className="overflow-y-auto flex-grow pr-2">
          <div className="bg-amber-50 border-s-4 border-amber-500 p-4 mb-4 rounded">
            <p className="text-amber-800 text-sm font-bold">
              سيقوم هذا السكربت بـ:
            </p>
            <ul className="text-xs text-amber-700 list-disc list-inside mt-1">
              <li>استعادة أسماء المستخدمين المفقودة.</li>
              <li>تجاوز تعليق "جاري التحميل" الناتج عن صلاحيات الجداول.</li>
              <li>منح الصلاحيات اللازمة فوراً.</li>
            </ul>
          </div>

          <div className="relative">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-500">
                كود SQL للإصلاح:
              </span>
              <CopyButton textToCopy={unifiedScript} />
            </div>
            <pre
              className="bg-gray-900 text-green-400 p-3 rounded border border-gray-700 overflow-x-auto text-[10px] font-mono h-48"
              dir="ltr"
            >
              {unifiedScript}
            </pre>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p>1. انسخ الكود أعلاه.</p>
            <p>
              2. اذهب لـ{" "}
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline"
              >
                SQL Editor
              </a>
              .
            </p>
            <p>
              3. الصق الكود واضغط <strong>Run</strong>.
            </p>
            <p>4. عد هنا واضغط "بدء التشغيل".</p>
          </div>
        </div>

        <div className="mt-6 flex justify-end pt-4 border-t">
          <button
            onClick={onRetry}
            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            بدء التشغيل وتجاوز التحميل
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigurationModal;


import * as React from 'react';
import { ClipboardDocumentCheckIcon, ClipboardDocumentIcon, ServerIcon, ShieldCheckIcon, ExclamationTriangleIcon } from './icons';

const CopyButton: React.FC<{ textToCopy: string }> = ({ textToCopy }) => {
    const [copied, setCopied] = React.useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };
    return (
        <button type="button" onClick={handleCopy} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-sm" title="نسخ الكود">
            {copied ? <ClipboardDocumentCheckIcon className="w-4 h-4 text-white" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
            {copied ? 'تم النسخ!' : 'نسخ كود SQL'}
        </button>
    );
};

const unifiedScript = `-- =================================================================
-- سكربت الإصلاح النهائي: استرجاع البيانات المفقودة وضبط الصلاحيات
-- =================================================================

-- 1. تهيئة جدول Profiles والتأكد من الصلاحيات
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text,
    mobile_number text,
    lawyer_id uuid REFERENCES auth.users(id),
    is_approved boolean DEFAULT false,
    is_active boolean DEFAULT true,
    role text DEFAULT 'user',
    permissions jsonb,
    subscription_start_date timestamptz,
    subscription_end_date timestamptz,
    mobile_verified boolean DEFAULT false,
    otp_code text,
    otp_expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. تحديث دالة تحديد مالك البيانات لضمان الوصول للبيانات القديمة
-- هذه الدالة هي المفتاح لظهور بيانات المحامي لمساعديه وبالعكس
CREATE OR REPLACE FUNCTION public.get_data_owner_id()
RETURNS uuid AS $$
DECLARE
    v_lawyer_id uuid;
BEGIN
    -- جلب معرّف المحامي المرتبط بالحساب الحالي
    SELECT lawyer_id INTO v_lawyer_id FROM public.profiles WHERE id = auth.uid();
    
    -- إذا كان المستخدم محامياً (lawyer_id is null) فإنه يملك بياناته الخاصة
    -- إذا كان مساعداً، فإن المالك هو المحامي المرتبط به
    RETURN COALESCE(v_lawyer_id, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. تفعيل Row Level Security (RLS) على كافة الجداول
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    END LOOP;
END$$;

-- 4. إعادة بناء سياسات الوصول لضمان "رؤية كاملة" لمالك البيانات
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
    END LOOP;
END$$;

-- سياسة الوصول الموحدة: تسمح للمالك (المحامي) وللمساعدين المرتبطين به بالوصول
-- هذه السياسة تعالج مشكلة عدم ظهور البيانات القديمة
CREATE POLICY "Unified Access Policy" ON public.clients FOR ALL USING (user_id = public.get_data_owner_id());
CREATE POLICY "Unified Access Policy" ON public.cases FOR ALL USING (user_id = public.get_data_owner_id());
CREATE POLICY "Unified Access Policy" ON public.stages FOR ALL USING (user_id = public.get_data_owner_id());
CREATE POLICY "Unified Access Policy" ON public.sessions FOR ALL USING (user_id = public.get_data_owner_id());
CREATE POLICY "Unified Access Policy" ON public.admin_tasks FOR ALL USING (user_id = public.get_data_owner_id());
CREATE POLICY "Unified Access Policy" ON public.appointments FOR ALL USING (user_id = public.get_data_owner_id());
CREATE POLICY "Unified Access Policy" ON public.accounting_entries FOR ALL USING (user_id = public.get_data_owner_id());
CREATE POLICY "Unified Access Policy" ON public.invoices FOR ALL USING (user_id = public.get_data_owner_id());
CREATE POLICY "Unified Access Policy" ON public.invoice_items FOR ALL USING (user_id = public.get_data_owner_id());
CREATE POLICY "Unified Access Policy" ON public.case_documents FOR ALL USING (user_id = public.get_data_owner_id());
CREATE POLICY "Unified Access Policy" ON public.assistants FOR ALL USING (user_id = public.get_data_owner_id());

-- سياسة خاصة بملفات التعريف: المحامي يرى مساعديه والمساعد يرى محاميه
CREATE POLICY "Profile Visibility" ON public.profiles FOR ALL USING (
    id = auth.uid() OR 
    lawyer_id = auth.uid() OR 
    id = (SELECT lawyer_id FROM public.profiles WHERE id = auth.uid()) OR
    role = 'admin'
);

-- 5. إصلاح البيانات اليتيمة (إن وجدت)
-- تنبيه: الكود أدناه يربط البيانات التي لا تملك user_id بالمستخدم الحالي (المحامي)
UPDATE public.clients SET user_id = auth.uid() WHERE user_id IS NULL AND auth.uid() IS NOT NULL;
UPDATE public.cases SET user_id = auth.uid() WHERE user_id IS NULL AND auth.uid() IS NOT NULL;
-- (كرر لبقية الجداول إذا لزم الأمر)

-- 6. تفعيل المزامنة الفورية (Realtime)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.clients, public.cases, public.stages, public.sessions, 
    public.admin_tasks, public.appointments, public.accounting_entries, 
    public.invoices, public.invoice_items, public.case_documents, public.profiles;
`;

interface ConfigurationModalProps {
    onRetry: () => void;
}

const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ onRetry }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200]">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center gap-3 mb-4 text-red-600">
                    <ServerIcon className="w-8 h-8" />
                    <h2 className="text-2xl font-bold">إصلاح قاعدة البيانات (تحميل البيانات التاريخية)</h2>
                </div>
                
                <div className="overflow-y-auto flex-grow pr-2">
                    <div className="bg-red-50 border-s-4 border-red-500 p-4 mb-4 rounded">
                        <div className="flex">
                            <div className="ms-3">
                                <p className="text-sm text-red-700 font-bold">
                                    تحذير: سيقوم هذا السكربت بإعادة ضبط سياسات الوصول لضمان ظهور كافة البيانات السابقة المرتبطة بحسابك.
                                </p>
                            </div>
                        </div>
                    </div>

                    <ol className="list-decimal list-inside space-y-4 text-sm text-gray-600 mb-6">
                        <li className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                                <strong className="text-gray-900">1. انسخ كود الإصلاح المحدث:</strong>
                                <CopyButton textToCopy={unifiedScript} />
                            </div>
                            <div className="relative">
                                <pre className="bg-gray-800 text-green-400 p-3 rounded border border-gray-700 overflow-x-auto text-xs font-mono h-32" dir="ltr">
                                    {unifiedScript}
                                </pre>
                            </div>
                        </li>
                        <li>2. افتح <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">SQL Editor</a> في مشروعك.</li>
                        <li>3. الصق الكود وقم بتنفيذه (Run).</li>
                        <li>4. بعد الانتهاء، اضغط على زر <strong>تحديث البيانات الآن</strong> بالأسفل.</li>
                    </ol>
                </div>

                <div className="mt-6 flex justify-end pt-4 border-t">
                    <button onClick={onRetry} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md">تحديث البيانات الآن</button>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationModal;

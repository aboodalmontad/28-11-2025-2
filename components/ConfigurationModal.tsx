
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
-- السكربت المحدث لحل مشكلة التكرار اللانهائي (Infinite Recursion Fix)
-- =================================================================

-- 1. حذف السياسات القديمة لتجنب التعارض
DO $$ 
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || r.tablename;
    END LOOP;
END $$;

-- 2. دالة جلب معرف المالك (المحامي الرئيسي)
-- نستخدم SECURITY DEFINER لتجاوز RLS عند الاستعلام الداخلي
CREATE OR REPLACE FUNCTION public.get_data_owner_id()
RETURNS uuid AS $$
DECLARE
    found_lawyer_id uuid;
BEGIN
    SELECT lawyer_id INTO found_lawyer_id FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(found_lawyer_id, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. سياسات جدول Profiles (حل مشكلة التكرار)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- سياسة المشاهدة: يمكن للمستخدم رؤية نفسه، ويمكن للمحامي رؤية مساعديه
CREATE POLICY "view_profiles" ON public.profiles FOR SELECT 
USING (
    auth.uid() = id 
    OR lawyer_id = auth.uid() 
    OR (auth.jwt() ->> 'role' = 'service_role')
);

-- سياسة التحديث: يمكن للمستخدم تحديث بياناته الخاصة
CREATE POLICY "update_own_profile" ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- 4. سياسات البيانات العامة (الجلسات، الموكلين، إلخ)
-- نطبق قاعدة واحدة: صاحب البيانات أو المساعد المرتبط به له حق الوصول الكامل
DO $$ 
DECLARE
    t text;
    tables text[] := ARRAY[
        'clients', 'cases', 'stages', 'sessions', 'admin_tasks', 
        'appointments', 'accounting_entries', 'assistants', 
        'invoices', 'invoice_items', 'case_documents', 'sync_deletions'
    ];
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('CREATE POLICY "access_own_data" ON public.%I FOR ALL USING (user_id = public.get_data_owner_id())', t);
    END LOOP;
END $$;

-- 5. المالية الخاصة بالموقع (للمديرين فقط)
ALTER TABLE public.site_finances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_access_finances" ON public.site_finances FOR ALL 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 6. تفعيل Realtime للجداول
DO $$
DECLARE
    t text;
    target_tables text[] := ARRAY[
        'public.profiles', 'public.clients', 'public.cases', 
        'public.stages', 'public.sessions', 'public.admin_tasks', 
        'public.appointments', 'public.accounting_entries', 
        'public.assistants', 'public.invoices', 'public.invoice_items', 
        'public.site_finances', 'public.case_documents', 'public.sync_deletions'
    ];
BEGIN
    FOR t IN SELECT unnest(target_tables) LOOP
        BEGIN EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE ' || t; EXCEPTION WHEN duplicate_object THEN NULL; END;
    END LOOP;
END $$;
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
                    <h2 className="text-2xl font-bold">إصلاح أخطاء المزامنة والوصول</h2>
                </div>
                
                <div className="overflow-y-auto flex-grow pr-2">
                    <div className="bg-red-50 border-s-4 border-red-500 p-4 mb-4 rounded">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                            </div>
                            <div className="ms-3">
                                <p className="text-sm text-red-700">
                                    تم اكتشاف خطأ في سياسات الأمان (Infinite Recursion). يرجى تنفيذ السكربت أدناه لإصلاح الوصول وتفعيل زر المحاسبة والبيانات.
                                </p>
                            </div>
                        </div>
                    </div>

                    <ol className="list-decimal list-inside space-y-4 text-sm text-gray-600 mb-6 text-right" dir="rtl">
                        <li className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                                <strong className="text-gray-900">1. انسخ كود الإصلاح:</strong>
                                <CopyButton textToCopy={unifiedScript} />
                            </div>
                            <div className="relative">
                                <pre className="bg-gray-800 text-green-400 p-3 rounded border border-gray-700 overflow-x-auto text-xs font-mono h-32" dir="ltr">
                                    {unifiedScript}
                                </pre>
                            </div>
                        </li>
                        <li>2. اذهب إلى <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">SQL Editor في Supabase</a>.</li>
                        <li>3. الصق الكود واضغط <strong>Run</strong>.</li>
                        <li>4. بعد الانتهاء، اضغط "إعادة المحاولة" في هذه النافذة.</li>
                    </ol>
                </div>

                <div className="mt-6 flex justify-end pt-4 border-t">
                    <button onClick={onRetry} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md">إعادة المحاولة والمزامنة</button>
                </div>
            </div>
        </div>
    );
};

export default ConfigurationModal;

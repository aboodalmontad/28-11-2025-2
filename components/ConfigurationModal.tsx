
import * as React from 'react';
import { ClipboardDocumentCheckIcon, ClipboardDocumentIcon, ServerIcon, ShieldCheckIcon, ExclamationTriangleIcon } from './icons';

// Helper component for copying text (Internal)
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
            {copied ? 'تم النسخ!' : 'نسخ كود SQL المطوّر (V6)'}
        </button>
    );
};

const unifiedScript = `
-- =================================================================
-- سكربت الإصلاح الشامل V6: معالجة أخطاء Realtime و RLS
-- =================================================================

-- 1. تحديث دالة تحديد مالك البيانات
CREATE OR REPLACE FUNCTION public.get_data_owner_id()
RETURNS uuid AS $$
DECLARE
    found_lawyer_id uuid;
BEGIN
    SELECT lawyer_id INTO found_lawyer_id FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(found_lawyer_id, auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. تصفير السياسات القديمة
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (SELECT 'DROP POLICY IF EXISTS "' || policyname || '" ON public.' || tablename || ';' as statement FROM pg_policies WHERE schemaname = 'public') LOOP
        EXECUTE r.statement;
    END LOOP;
END$$;

-- 3. تفعيل RLS وبناء سياسات شاملة
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['clients', 'cases', 'stages', 'sessions', 'admin_tasks', 'appointments', 'accounting_entries', 'invoices', 'invoice_items', 'case_documents', 'assistants'];
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
        EXECUTE format('CREATE POLICY "Access_Policy" ON public.%I FOR ALL USING (user_id = public.get_data_owner_id());', t);
        EXECUTE format('CREATE POLICY "Insert_Policy" ON public.%I FOR INSERT WITH CHECK (user_id = public.get_data_owner_id());', t);
    END LOOP;
END$$;

-- 4. سياسات خاصة بجدول Profiles
CREATE POLICY "Profiles_Read_All" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Profiles_Update_Own" ON public.profiles FOR UPDATE USING (auth.uid() = id OR lawyer_id = auth.uid());
CREATE POLICY "Profiles_Admin" ON public.profiles FOR ALL USING (role = 'admin');

-- 5. تفعيل Realtime (إصلاح خطأ FOR ALL TABLES)
DO $$
DECLARE
    realtime_exists boolean;
    is_all_tables boolean;
BEGIN
    -- التحقق من وجود الـ Publication
    SELECT true, puballtables INTO realtime_exists, is_all_tables FROM pg_publication WHERE pubname = 'supabase_realtime';
    
    IF realtime_exists IS NULL THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;

    -- إذا لم تكن الـ Publication تشمل كل الجداول تلقائياً، نقوم بإضافتها يدوياً
    IF is_all_tables IS NOT TRUE THEN
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.clients; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cases; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.stages; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_tasks; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.accounting_entries; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.assistants; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_items; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.site_finances; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.case_documents; EXCEPTION WHEN OTHERS THEN NULL; END;
        BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.sync_deletions; EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;
END $$;

-- 6. تفعيل التتبع لجدول الحذف
ALTER TABLE public.sync_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deletions_Policy" ON public.sync_deletions FOR ALL USING (user_id = public.get_data_owner_id());
`;

interface ConfigurationModalProps {
    onRetry: () => void;
}

const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ onRetry }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[200]">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center gap-3 mb-4 text-blue-600">
                    <ShieldCheckIcon className="w-8 h-8" />
                    <h2 className="text-2xl font-bold">إعداد قاعدة البيانات (V6)</h2>
                </div>
                
                <div className="overflow-y-auto flex-grow pr-2 text-right" dir="rtl">
                    <div className="bg-amber-50 border-s-4 border-amber-500 p-4 mb-4 rounded">
                        <p className="text-sm text-amber-700 font-bold">
                            تنبيه: تم تحسين هذا السكربت لتجاوز أخطاء الصلاحيات والـ Realtime في النسخ الجديدة من Supabase.
                        </p>
                    </div>

                    <ol className="list-decimal list-inside space-y-4 text-sm text-gray-600 mb-6">
                        <li className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="flex justify-between items-center mb-2">
                                <strong className="text-gray-900">انسخ كود SQL المطور:</strong>
                                <CopyButton textToCopy={unifiedScript} />
                            </div>
                            <div className="relative">
                                <pre className="bg-gray-800 text-green-400 p-3 rounded border border-gray-700 overflow-x-auto text-xs font-mono h-32" dir="ltr">
                                    {unifiedScript}
                                </pre>
                            </div>
                        </li>
                        <li>اذهب إلى <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-bold">SQL Editor</a>.</li>
                        <li>الصق الكود واضغط <strong>Run</strong>.</li>
                        <li>بعد النجاح، عد هنا واضغط "تحديث البيانات الآن".</li>
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

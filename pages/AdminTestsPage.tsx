import * as React from 'react';
import { get_supabase_client } from '../supabaseClient';
import { fetch_data_from_supabase, transform_remote_to_local } from '../hooks/useOnlineData';
import { get_db, DATA_STORE_NAME } from '../utils/db';
import { get_app_data_key } from '../hooks/useSupabaseData';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { normalize_mobile_for_db, normalize_mobile_to_e164 } from '../utils/mobileUtils';

const AdminTestsPage: React.FC = () => {
    const supabase = get_supabase_client();
    const is_online = useOnlineStatus();
    const [error, set_error] = React.useState<React.ReactNode | null>(null);
    const [message, set_message] = React.useState<string | null>(null);
    const [diagnostic_loading, set_diagnostic_loading] = React.useState(false);
    const [diagnostic_clients_loading, set_diagnostic_clients_loading] = React.useState(false);
    const [diagnostic_profiles_loading, set_diagnostic_profiles_loading] = React.useState(false);
    const [mobile, set_mobile] = React.useState('');

    const fetch_lawyers = async () => {
        if (!supabase) return;
        const { data, error: err } = await supabase.from('public_profiles_view').select('full_name');
        if (data) {
            set_message(`عدد المحامين: ${data.length}`);
        } else if (err) {
            console.error("Error fetching lawyers:", err);
            set_error("تعذر جلب قائمة المحامين.");
        }
    };

    const run_full_data_diagnostics = async () => {
        if (!supabase) return;
        set_error(null);
        set_message("جاري التشخيص الشامل للبيانات...");
        try {
            const tables = ['profiles', 'clients', 'cases', 'stages', 'sessions', 'admin_tasks', 'appointments', 'accounting_entries', 'invoices', 'invoice_items', 'case_documents'];
            let results = [];
            
            for (const table of tables) {
                const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
                if (error) {
                    results.push(`جدول ${table}: خطأ (${error.message})`);
                } else {
                    results.push(`جدول ${table}: ${count} سجل`);
                }
            }
            
            set_message(`نتائج التشخيص:\n${results.join('\n')}`);
        } catch (err: any) {
            set_error("فشل التشخيص: " + err.message);
        }
    };

    const fetch_diagnostic_tasks = async () => {
        if (!supabase) return;
        set_diagnostic_loading(true);
        try {
            const { data, error: err } = await supabase.from('admin_tasks').select('*').limit(10);
            if (err) throw err;
            set_message(`تم جلب ${data?.length || 0} مهام.`);
        } catch (err: any) {
            set_error("فشل جلب المهام: " + err.message);
        } finally {
            set_diagnostic_loading(false);
        }
    };

    const fetch_diagnostic_clients = async () => {
        if (!supabase) return;
        set_diagnostic_clients_loading(true);
        try {
            const { data, error: err } = await supabase.from('clients').select('*').limit(10);
            if (err) throw err;
            set_message(`تم جلب ${data?.length || 0} موكلين.`);
        } catch (err: any) {
            set_error("فشل جلب الموكلين: " + err.message);
        } finally {
            set_diagnostic_clients_loading(false);
        }
    };

    const fetch_diagnostic_profiles = async () => {
        if (!supabase) return;
        set_diagnostic_profiles_loading(true);
        try {
            const { data, error: err } = await supabase.from('profiles').select('*').limit(10);
            if (err) throw err;
            set_message(`تم جلب ${data?.length || 0} مستخدمين.`);
        } catch (err: any) {
            set_error("فشل جلب المستخدمين: " + err.message);
        } finally {
            set_diagnostic_profiles_loading(false);
        }
    };

    const run_auth_diagnostic = async () => {
        if (!supabase) return;
        set_error(null);
        set_message("جاري تشخيص مشكلة الدخول...");
        try {
            // 1. Check if profile exists
            const normalized_mobile = normalize_mobile_for_db(mobile);
            const { data: profile, error: p_error } = await supabase
                .from('profiles')
                .select('id, email')
                .eq('mobile_number', normalized_mobile || mobile)
                .maybeSingle();
            
            if (p_error) throw new Error("فشل فحص الملف الشخصي: " + p_error.message);
            if (!profile) throw new Error("لم يتم العثور على ملف شخصي لهذا الرقم.");

            // 2. Check if user exists in Auth
            const { error: auth_error } = await supabase.auth.signInWithPassword({
                email: profile.email || '',
                password: 'dummy-password-for-test'
            });

            if (auth_error) {
                if (auth_error.message.includes('Invalid login credentials')) {
                    set_message("الحساب موجود في نظام المصادقة ولكن كلمة المرور غير صحيحة.");
                } else if (auth_error.message.includes('Email not confirmed')) {
                    set_message("الحساب موجود ولكن البريد الإلكتروني غير مؤكد.");
                } else {
                    set_message("نظام المصادقة لم يتعرف على هذا البريد: " + auth_error.message);
                }
            } else {
                set_message("تم تسجيل الدخول بنجاح (هذا غير متوقع مع كلمة مرور وهمية).");
            }
        } catch (err: any) {
            set_error("فشل التشخيص: " + err.message);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-6">اختبارات الإدارة</h2>
            
            <input 
                type="text" 
                placeholder="رقم الهاتف للتشخيص" 
                value={mobile} 
                onChange={(e) => set_mobile(e.target.value)}
                className="w-full p-2 mb-4 border rounded"
            />

            {error && <div className="mb-4 p-4 text-sm text-red-800 bg-red-100 rounded-lg whitespace-pre-wrap">{error}</div>}
            {message && <div className="mb-4 p-4 text-sm text-green-800 bg-green-100 rounded-lg whitespace-pre-wrap">{message}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={fetch_lawyers} className="py-3 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold rounded-md transition-colors">
                    عرض قائمة المحامين المسجلين
                </button>
                <button onClick={run_full_data_diagnostics} className="py-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-bold rounded-md transition-colors">
                    تشخيص البيانات الشامل
                </button>
                <button onClick={fetch_diagnostic_tasks} className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-md transition-colors">
                    {diagnostic_loading ? 'جاري الجلب...' : 'اختبار جلب المهام (التشخيص)'}
                </button>
                <button onClick={fetch_diagnostic_clients} className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-md transition-colors">
                    {diagnostic_clients_loading ? 'جاري الجلب...' : 'اختبار جلب الموكلين (التشخيص)'}
                </button>
                <button onClick={fetch_diagnostic_profiles} className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-md transition-colors">
                    {diagnostic_profiles_loading ? 'جاري الجلب...' : 'إختبار جلب المستخدمين (التشخيص)'}
                </button>
                <button onClick={run_auth_diagnostic} className="py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-md transition-colors">
                    تشخيص مشكلة الدخول
                </button>
            </div>
        </div>
    );
};

export default AdminTestsPage;

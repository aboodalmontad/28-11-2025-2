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
    const [force_sync_loading, set_force_sync_loading] = React.useState(false);
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

    const run_full_data_cleanup = async () => {
        if (!supabase) return;
        set_error(null);
        set_message("جاري التنظيف...");
        try {
            const db = await get_db();
            await db.clear(DATA_STORE_NAME);
            set_message("تم تنظيف البيانات المحلية بنجاح. يرجى إعادة تحميل الصفحة.");
        } catch (err: any) {
            set_error("فشل التنظيف: " + err.message);
        }
    };

    const run_full_data_diagnostics = async () => {
        if (!supabase) return;
        set_error(null);
        set_message("جاري التشخيص...");
        try {
            // Placeholder for full diagnostic logic
            set_message("تم التشخيص بنجاح (لم يتم تنفيذ فحص فعلي بعد).");
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

    const sync_user_cloud_data_to_local = async (user_id: string) => {
        if (!supabase) return;
        try {
            // Fetch data from Supabase
            const remote_data = await fetch_data_from_supabase(user_id);
            // Transform to local format
            const local_data = transform_remote_to_local(remote_data);
            // Save to IndexedDB
            const db = await get_db();
            const storage_key = get_app_data_key(user_id);
            await db.put(DATA_STORE_NAME, local_data, storage_key);
            console.log(`Initial cloud-to-local sync complete for key: ${storage_key}`);
        } catch (err) {
            console.error("Failed to sync user cloud data to local:", err);
            throw err;
        }
    };

    const handle_force_sync = async () => {
        if (!supabase) return;
        set_force_sync_loading(true);
        set_error(null);
        set_message(null);
        try {
            console.log("Starting forced cloud-to-local sync...");
            
            // 1. Find user ID by mobile first to ensure we only fetch THEIR data
            const normalized_mobile = normalize_mobile_for_db(mobile);
            const raw_mobile = mobile;
            
            let profile = null;
            let p_error = null;
            
            // Try normalized first
            if (normalized_mobile) {
                const res = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('mobile_number', normalized_mobile)
                    .maybeSingle();
                profile = res.data;
                p_error = res.error;
            }
            
            // If not found, try raw
            if (!profile && !p_error) {
                const res = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('mobile_number', raw_mobile)
                    .maybeSingle();
                profile = res.data;
                p_error = res.error;
            }
            
            // If still not found, try E164
            if (!profile && !p_error) {
                const e164_mobile = normalize_mobile_to_e164(raw_mobile);
                if (e164_mobile) {
                    const res = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('mobile_number', e164_mobile)
                        .maybeSingle();
                    profile = res.data;
                    p_error = res.error;
                }
            }
            
            if (p_error) throw new Error("فشل العثور على الملف الشخصي: " + p_error.message);
            if (!profile) throw new Error("لم يتم العثور على ملف شخصي لهذا الرقم. يرجى التأكد من الرقم أو إنشاء حساب جديد.");

            const user_id = profile.id;
            
            // Force delete local cache first to ensure a fresh pull
            const db = await get_db();
            const storage_key = get_app_data_key(user_id);
            await db.delete(DATA_STORE_NAME, storage_key);
            
            await sync_user_cloud_data_to_local(user_id);
            
            set_message("تم جلب كافة البيانات من السحابة وحفظها محلياً بنجاح.");
        } catch (err: any) {
            console.error("Forced sync failed:", err);
            set_error("فشل جلب البيانات: " + err.message);
        } finally {
            set_force_sync_loading(false);
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

            {error && <div className="mb-4 p-4 text-sm text-red-800 bg-red-100 rounded-lg">{error}</div>}
            {message && <div className="mb-4 p-4 text-sm text-green-800 bg-green-100 rounded-lg">{message}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={fetch_lawyers} className="py-3 bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold rounded-md transition-colors">
                    عرض قائمة المحامين المسجلين
                </button>
                <button onClick={run_full_data_cleanup} className="py-3 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-md transition-colors">
                    تنظيف شامل للبيانات (حل مشكلة المزامنة)
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
                <button onClick={handle_force_sync} className="py-3 bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold rounded-md transition-colors">
                    {force_sync_loading ? 'جاري المزامنة...' : 'مزامنة السحابة إلى المحلية (إجباري)'}
                </button>
            </div>
        </div>
    );
};

export default AdminTestsPage;

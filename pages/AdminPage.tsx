
import * as React from 'react';
import { get_supabase_client } from '../supabaseClient';
import { Profile } from '../types';
import { format_date, to_input_date_string, safe_revive_date } from '../utils/dateUtils';
import { CheckCircleIcon, NoSymbolIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon, PhoneIcon, ShareIcon, ArrowPathIcon, ClipboardDocumentIcon, UserIcon, UserGroupIcon } from '../components/icons';
import { useData } from '../context/DataContext';
import UserDetailsModal from '../components/UserDetailsModal';

const formatSubscriptionDateRange = (user: Profile): string => {
    const { subscription_start_date, subscription_end_date } = user;
    if (!subscription_start_date || !subscription_end_date) return 'لا يوجد';
    const startDate = safe_revive_date(subscription_start_date);
    const endDate = safe_revive_date(subscription_end_date);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return 'تاريخ غير صالح';
    return `${format_date(startDate)} - ${format_date(endDate)}`;
};

const getDisplayPhoneNumber = (mobile: string | null | undefined): string => {
    if (!mobile) return '-';
    const digits = mobile.replace(/\D/g, '');
    if (digits.length >= 9) {
        const lastNine = digits.slice(-9);
        if (lastNine.startsWith('9')) return '0' + lastNine;
    }
    return mobile;
};

interface UserRowProps {
    user: Profile;
    lawyer?: Profile; // The parent lawyer if this user is an assistant
    on_view: (user: Profile) => void;
    on_edit: (user: Profile) => void;
    on_delete: (user: Profile) => void;
    on_toggle_approval: (user: Profile) => void;
    on_toggle_active: (user: Profile) => void;
    on_generate_otp: (user: Profile) => void;
    generating_otp_for: string | null;
    current_admin_id: string | undefined;
}

const UserRow: React.FC<UserRowProps> = ({ user, lawyer, on_view, on_edit, on_delete, on_toggle_approval, on_toggle_active, on_generate_otp, generating_otp_for, current_admin_id }) => {
    const [copied_otp_id, set_copied_otp_id] = React.useState<string | null>(null);
    
    const copy_to_clipboard = (text: string, id: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            set_copied_otp_id(id);
            setTimeout(() => set_copied_otp_id(null), 2000);
        });
    };

    const send_otp_to_user = (otpCode: string, mobile: string) => {
        if (!otpCode || !mobile) return;
        const cleanMobile = mobile.replace(/\D/g, '');
        const waNumber = cleanMobile.startsWith('0') ? '963' + cleanMobile.substring(1) : cleanMobile;
        const messageText = `مرحباً ${user.full_name}، كود التحقق الخاص بك هو: *${otpCode}*`;
        const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`;
        window.open(url, '_blank');
    };

    const is_assistant = !!lawyer;
    
    // Check parent status: Active, Approved, and Subscription Valid
    const is_parent_subscription_valid = lawyer ? (!lawyer.subscription_end_date || safe_revive_date(lawyer.subscription_end_date) >= new Date()) : true;
    const is_parent_active = lawyer ? (lawyer.is_active && lawyer.is_approved && is_parent_subscription_valid) : true;

    return (
        <tr className={`border-b ${!user.is_approved ? 'bg-yellow-50' : is_assistant ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100 transition-colors`}>
            <td className="px-6 py-4">
                <div className={`flex items-center ${is_assistant ? 'ms-8 border-r-2 border-gray-300 pr-3' : ''}`}>
                    {is_assistant && <div className="w-2 h-2 bg-gray-300 rounded-full absolute -ms-4"></div>}
                    <div className="flex flex-col">
                        <button onClick={() => on_view(user)} className="text-blue-600 hover:underline font-medium text-right flex items-center gap-2">
                            {is_assistant ? <UserIcon className="w-4 h-4 text-gray-500"/> : (user.role === 'admin' ? <UserGroupIcon className="w-5 h-5 text-purple-600"/> : <UserIcon className="w-5 h-5 text-blue-600"/>)}
                            {user.full_name}
                        </button>
                        {user.role === 'admin' && <span className="text-xs font-semibold text-purple-600 mt-1 me-6">(مدير)</span>}
                        
                        {/* Dependency Status Indicator */}
                        {is_assistant && !is_parent_active && (
                            <span className="text-xs text-red-500 mt-1 me-6 flex items-center gap-1" title="صلاحية هذا الحساب معطلة لأن حساب المحامي الرئيسي غير نشط أو منتهي الصلاحية">
                                <ExclamationTriangleIcon className="w-3 h-3"/>
                                حساب المحامي غير نشط
                            </span>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-sm" dir="ltr">{getDisplayPhoneNumber(user.mobile_number)}</td>
            <td className="px-6 py-4 text-sm text-gray-500">{user.created_at ? format_date(user.created_at) : '-'}</td>
            <td className="px-6 py-4 text-xs font-medium text-gray-600">{formatSubscriptionDateRange(user)}</td>
            <td className="px-6 py-4">
                <div className="flex flex-col gap-2">
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                        {user.mobile_verified ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 text-green-800 border border-green-200">
                                مؤكد
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-800 border border-red-200">
                                غير مؤكد
                            </span>
                        )}
                        {/* Manual Generate Button for Admin */}
                        {user.role !== 'admin' && (
                            <button 
                                onClick={() => on_generate_otp(user)}
                                disabled={generating_otp_for === user.id}
                                className="text-blue-600 hover:text-blue-800 disabled:opacity-50 p-1 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
                                title="توليد كود جديد (تحقق أو استعادة)"
                            >
                                {generating_otp_for === user.id ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin"/> : <ArrowPathIcon className="w-3.5 h-3.5" />}
                            </button>
                        )}
                    </div>

                    {/* Active Code Display (Essential for password resets) */}
                    {user.otp_code ? (
                        <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-blue-600 font-bold uppercase">كود نشط (تحقق/استعادة):</span>
                            <div className="flex items-center gap-1">
                                <div 
                                    className="flex-grow flex items-center justify-between gap-2 text-xs font-bold border border-blue-300 bg-blue-50 rounded-md px-2 py-1.5 cursor-pointer hover:bg-blue-100 transition-all"
                                    title="نسخ الكود"
                                    onClick={() => copy_to_clipboard(user.otp_code!, user.id)}
                                >
                                    <span className="font-mono text-sm tracking-widest">{user.otp_code}</span>
                                    <ClipboardDocumentIcon className="w-3.5 h-3.5 text-blue-500" />
                                </div>
                                <button 
                                    onClick={() => send_otp_to_user(user.otp_code!, user.mobile_number)}
                                    className="p-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors shadow-sm"
                                    title="إرسال الكود للمستخدم عبر واتساب"
                                >
                                    <ShareIcon className="w-4 h-4" />
                                </button>
                            </div>
                            {copied_otp_id === user.id && <span className="text-[9px] text-green-600 text-center font-bold">تم النسخ!</span>}
                        </div>
                    ) : (
                        <span className="text-[10px] text-gray-400 font-mono">- - - - - -</span>
                    )}
                </div>
            </td>
            <td className="px-6 py-4">
                <button onClick={() => on_toggle_approval(user)} disabled={user.role === 'admin'} className="disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-110" title={user.is_approved ? 'تعطيل' : 'تفعيل'}>
                    {user.is_approved ? <CheckCircleIcon className="w-6 h-6 text-green-500" /> : <NoSymbolIcon className="w-6 h-6 text-gray-400" />}
                </button>
            </td>
            <td className="px-6 py-4">
                 <button onClick={() => on_toggle_active(user)} disabled={user.role === 'admin'} className="disabled:opacity-50 disabled:cursor-not-allowed transition-transform hover:scale-110" title={user.is_active ? 'تجميد الحساب' : 'تنشيط الحساب'}>
                    {user.is_active ? <CheckCircleIcon className="w-6 h-6 text-green-500" /> : <NoSymbolIcon className="w-6 h-6 text-red-500" />}
                </button>
            </td>
            <td className="px-6 py-4">
                {user.role !== 'admin' && user.id !== current_admin_id ? (
                    <div className="flex items-center gap-2">
                        <button onClick={() => on_edit(user)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors" title="تعديل"><PencilIcon className="w-4 h-4" /></button>
                        <button onClick={() => on_delete(user)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="حذف"><TrashIcon className="w-4 h-4" /></button>
                    </div>
                ) : (
                    <span className="text-xs text-gray-400 select-none">محمي</span>
                )}
            </td>
        </tr>
    );
};

const AdminPage: React.FC = () => {
    const { profiles: users, set_profiles: setUsers, is_data_loading: loading, user_id, fetch_and_refresh } = useData();
    const [error, setError] = React.useState<string | null>(null);
    const [editing_user, set_editing_user] = React.useState<Profile | null>(null);
    const [user_to_delete, set_user_to_delete] = React.useState<Profile | null>(null);
    const [viewing_user, set_viewing_user] = React.useState<Profile | null>(null);
    const [generating_otp_for, set_generating_otp_for] = React.useState<string | null>(null);
    const [all_assistants, set_all_assistants] = React.useState<{ name: string; user_id: string; lawyer_name?: string }[]>([]);
    const [assistants_loading, set_assistants_loading] = React.useState(false);
    
    const supabase = get_supabase_client();

    const fetch_all_assistants = React.useCallback(async () => {
        if (!supabase) return;
        set_assistants_loading(true);
        try {
            const { data, error } = await supabase
                .from('assistants')
                .select('name, user_id');
            
            if (error) throw error;
            
            // Map lawyer names
            const mapped = (data || []).map(a => {
                const lawyer = users.find(u => u.id === a.user_id);
                return {
                    ...a,
                    lawyer_name: lawyer ? lawyer.full_name : 'غير معروف'
                };
            });
            
            set_all_assistants(mapped);
        } catch (err) {
            console.error("Failed to fetch all assistants:", err);
        } finally {
            set_assistants_loading(false);
        }
    }, [supabase, users]);

    React.useEffect(() => {
        fetch_all_assistants();
    }, [fetch_all_assistants]);

    const handle_delete_assistant_name = async (name: string, user_id: string) => {
        if (!supabase || !window.confirm(`هل أنت متأكد من حذف المساعد "${name}"؟`)) return;
        try {
            const { error } = await supabase
                .from('assistants')
                .delete()
                .eq('name', name)
                .eq('user_id', user_id);
            
            if (error) throw error;
            fetch_all_assistants();
        } catch (err: any) {
            alert("فشل حذف المساعد: " + err.message);
        }
    };

    const handle_update_user = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editing_user) return;
        
        // Optimistic update
        setUsers(prevUsers => prevUsers.map(u => 
            u.id === editing_user.id ? { ...editing_user, updated_at: new Date().toISOString() } : u
        ));

        // If using real backend, you would make the API call here
        if (supabase) {
             try {
                 const { error } = await supabase.from('profiles').update({
                     full_name: editing_user.full_name,
                     mobile_number: editing_user.mobile_number,
                     subscription_start_date: editing_user.subscription_start_date,
                     subscription_end_date: editing_user.subscription_end_date,
                     is_approved: editing_user.is_approved,
                     is_active: editing_user.is_active,
                     mobile_verified: editing_user.mobile_verified
                 }).eq('id', editing_user.id);
                 if (error) throw error;
                 
                 // Refresh data to confirm changes from server
                 fetch_and_refresh(); 
             } catch (err: any) {
                 console.error("Failed to update user in DB:", err);
                 alert("فشل تحديث البيانات في قاعدة البيانات: " + err.message);
                 // Revert optimistic update by refreshing
                 fetch_and_refresh();
             }
        }

        set_editing_user(null);
    };

    const handle_confirm_delete = async () => {
        if (!supabase || !user_to_delete) return;
        const userToDeleteId = user_to_delete.id;
    
        try {
            const { error: rpcError } = await supabase.rpc('delete_user', {
                user_id_to_delete: userToDeleteId
            });
    
            if (rpcError) throw rpcError;
            setUsers(prevUsers => prevUsers.filter(u => u.id !== userToDeleteId));
            
        } catch (err: any) {
            setError("فشل حذف المستخدم: " + err.message);
        } finally {
            set_user_to_delete(null);
        }
    };
    
    const toggle_user_approval = async (user: Profile) => {
         if (!supabase || user.role === 'admin') return;
         const updatedUser = { ...user, is_approved: !user.is_approved, updated_at: new Date().toISOString() };
         setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
         
         try {
            const { error } = await supabase.from('profiles').update({ is_approved: updatedUser.is_approved }).eq('id', user.id);
            if (error) throw error;
            fetch_and_refresh();
         } catch(err: any) {
             console.error("Failed to toggle approval:", err);
             fetch_and_refresh();
         }
    }
    
    const toggle_user_active_status = async (user: Profile) => {
         if (!supabase || user.role === 'admin') return;
         const updatedUser = { ...user, is_active: !user.is_active, updated_at: new Date().toISOString() };
         setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
         
         try {
            const { error } = await supabase.from('profiles').update({ is_active: updatedUser.is_active }).eq('id', user.id);
            if (error) throw error;
            fetch_and_refresh();
         } catch(err: any) {
             console.error("Failed to toggle active status:", err);
             fetch_and_refresh();
         }
    }

    const handle_generate_and_send_otp = async (user: Profile) => {
        if (!supabase) return;
        set_generating_otp_for(user.id);
        try {
            const { data: code, error } = await supabase.rpc('generate_mobile_otp', {
                target_user_id: user.id
            });

            if (error) throw error;

            if (code) {
                // Update local state to show code immediately without refresh
                setUsers(prev => prev.map(u => u.id === user.id ? { ...u, otp_code: code } : u));
                alert(`تم توليد الكود بنجاح: ${code}`);
            }
        } catch (err: any) {
            console.error("Error generating OTP:", err);
            alert("فشل توليد كود التحقق: " + err.message);
        } finally {
            set_generating_otp_for(null);
        }
    };
    
    // Organize users into hierarchy: Lawyers (and admins) at top, their assistants nested
    const grouped_users = React.useMemo(() => {
        // 1. Find all users who are NOT assistants (Lawyers/Admins)
        const lawyers = users.filter(u => !u.lawyer_id); 
        
        // 2. Create a map of lawyer_id -> [assistants]
        const assistantMap = new Map<string, Profile[]>();
        users.filter(u => u.lawyer_id).forEach(assistant => {
            const lawyerId = assistant.lawyer_id!;
            if (!assistantMap.has(lawyerId)) {
                assistantMap.set(lawyerId, []);
            }
            assistantMap.get(lawyerId)!.push(assistant);
        });

        // 3. Sort lawyers: Admins first, then by newest
        const sortedLawyers = [...lawyers].sort((a, b) => {
             if (a.role === 'admin' && b.role !== 'admin') return -1;
             if (a.role !== 'admin' && b.role === 'admin') return 1;
             const dateA = a.created_at ? safe_revive_date(a.created_at).getTime() : 0;
             const dateB = b.created_at ? safe_revive_date(b.created_at).getTime() : 0;
             return dateB - dateA;
        });

        // 4. Return structure for rendering
        return sortedLawyers.map(lawyer => ({
            lawyer,
            assistants: assistantMap.get(lawyer.id) || []
        }));
    }, [users]);


    if (loading) {
        return <div className="text-center p-8">جاري تحميل المستخدمين...</div>;
    }

    if (error) {
        return <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">إدارة المستخدمين</h1>
            
            <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm text-right text-gray-600 border-collapse">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                        <tr>
                            <th className="px-6 py-3 rounded-tr-lg">المستخدم (المحامي / المساعد)</th>
                            <th className="px-6 py-3">رقم الجوال</th>
                            <th className="px-6 py-3">تاريخ التسجيل</th>
                            <th className="px-6 py-3">فترة الاشتراك</th>
                            <th className="px-6 py-3">التحقق والكود</th>
                            <th className="px-6 py-3">موافق عليه</th>
                            <th className="px-6 py-3">الحساب نشط</th>
                            <th className="px-6 py-3 rounded-tl-lg">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {grouped_users.map(({ lawyer, assistants }) => (
                            <React.Fragment key={lawyer.id}>
                                {/* Lawyer Row */}
                                <UserRow 
                                    user={lawyer}
                                    on_view={() => set_viewing_user(lawyer)}
                                    on_edit={() => set_editing_user(lawyer)}
                                    on_delete={() => set_user_to_delete(lawyer)}
                                    on_toggle_approval={() => toggle_user_approval(lawyer)}
                                    on_toggle_active={() => toggle_user_active_status(lawyer)}
                                    on_generate_otp={() => handle_generate_and_send_otp(lawyer)}
                                    generating_otp_for={generating_otp_for}
                                    current_admin_id={user_id}
                                />
                                {/* Assistants Rows */}
                                {assistants.length > 0 && assistants.map(assistant => (
                                    <UserRow 
                                        key={assistant.id}
                                        user={assistant}
                                        lawyer={lawyer} // Pass the parent lawyer to check dependency
                                        on_view={() => set_viewing_user(assistant)}
                                        on_edit={() => set_editing_user(assistant)}
                                        on_delete={() => set_user_to_delete(assistant)}
                                        on_toggle_approval={() => toggle_user_approval(assistant)}
                                        on_toggle_active={() => toggle_user_active_status(assistant)}
                                        on_generate_otp={() => handle_generate_and_send_otp(assistant)}
                                        generating_otp_for={generating_otp_for}
                                        current_admin_id={user_id}
                                    />
                                ))}
                            </React.Fragment>
                        ))}
                        {grouped_users.length === 0 && (
                             <tr><td colSpan={7} className="text-center p-8 text-gray-500">لا يوجد مستخدمين مسجلين.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {editing_user && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={() => set_editing_user(null)}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">تعديل المستخدم: {editing_user.full_name}</h2>
                        <form onSubmit={handle_update_user} className="space-y-4">
                            <div><label className="block text-sm font-medium text-gray-700">الاسم الكامل</label><input type="text" value={editing_user.full_name} onChange={e => set_editing_user({ ...editing_user, full_name: e.target.value })} className="w-full p-2 border rounded" /></div>
                            <div><label className="block text-sm font-medium text-gray-700">رقم الجوال</label><input type="text" value={editing_user.mobile_number} onChange={e => set_editing_user({ ...editing_user, mobile_number: e.target.value })} className="w-full p-2 border rounded" dir="ltr" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium text-gray-700">تاريخ بدء الاشتراك</label><input type="date" value={to_input_date_string(editing_user.subscription_start_date)} onChange={e => set_editing_user({ ...editing_user, subscription_start_date: e.target.value })} className="w-full p-2 border rounded" /></div>
                                <div><label className="block text-sm font-medium text-gray-700">تاريخ انتهاء الاشتراك</label><input type="date" value={to_input_date_string(editing_user.subscription_end_date)} onChange={e => set_editing_user({ ...editing_user, subscription_end_date: e.target.value })} className="w-full p-2 border rounded" /></div>
                            </div>
                            <div className="flex items-center gap-6 pt-2 flex-wrap">
                                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editing_user.is_approved} onChange={e => set_editing_user({ ...editing_user, is_approved: e.target.checked })} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" /> موافق عليه</label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editing_user.is_active} onChange={e => set_editing_user({ ...editing_user, is_active: e.target.checked })} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" /> الحساب نشط</label>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editing_user.mobile_verified} onChange={e => set_editing_user({ ...editing_user, mobile_verified: e.target.checked })} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" /> تم التحقق من الجوال</label>
                            </div>
                            <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={() => set_editing_user(null)} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">إلغاء</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">حفظ التغييرات</button></div>
                        </form>
                    </div>
                </div>
            )}
            
             {user_to_delete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => set_user_to_delete(null)}>
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                         <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div>
                            <h3 className="text-2xl font-bold text-gray-900">تأكيد حذف المستخدم</h3>
                            <p className="text-gray-600 my-4">هل أنت متأكد من حذف المستخدم "{user_to_delete.full_name}"؟ سيتم حذف جميع بياناته بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.</p>
                        </div>
                        <div className="mt-6 flex justify-center gap-4">
                            <button type="button" className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => set_user_to_delete(null)}>إلغاء</button>
                            <button type="button" className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handle_confirm_delete}>نعم، قم بالحذف</button>
                        </div>
                    </div>
                </div>
            )}

            {viewing_user && (
                <UserDetailsModal 
                    user={viewing_user} 
                    onClose={() => set_viewing_user(null)}
                    onEdit={() => set_editing_user(viewing_user)}
                />
            )}

            {/* Global Assistant Names Management */}
            <div className="bg-white p-6 rounded-lg shadow mt-8">
                <h2 className="text-xl font-bold text-gray-800 border-b pb-3 mb-4 flex items-center gap-2">
                    <UserGroupIcon className="w-6 h-6 text-blue-600" />
                    إدارة قائمة المساعدين (للقوائم المنسدلة)
                </h2>
                <div className="space-y-4">
                    <p className="text-sm text-gray-500">هذه القائمة تظهر لجميع المحامين في القوائم المنسدلة لتخصيص المهام والجلسات.</p>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-right">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2">الاسم</th>
                                        <th className="px-4 py-2">المحامي</th>
                                        <th className="px-4 py-2">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assistants_loading ? (
                                        <tr><td colSpan={3} className="text-center p-4">جاري التحميل...</td></tr>
                                    ) : all_assistants.length > 0 ? (
                                        all_assistants.map((a, idx) => (
                                            <tr key={`${a.user_id}-${a.name}-${idx}`} className="border-t hover:bg-gray-50">
                                                <td className="px-4 py-2 font-medium">{a.name}</td>
                                                <td className="px-4 py-2 text-gray-500">{a.lawyer_name}</td>
                                                <td className="px-4 py-2">
                                                    <button 
                                                        onClick={() => handle_delete_assistant_name(a.name, a.user_id)}
                                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                                        title="حذف"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={3} className="text-center p-4 text-gray-400">لا يوجد مساعدين مسجلين.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;

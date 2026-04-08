import * as React from 'react';
import { Profile, SiteFinancialEntry } from '../types';
import { useData } from '../context/DataContext';
import { format_date, safe_revive_date, is_before_today } from '../utils/dateUtils';
import { XMarkIcon, PhoneIcon, UserGroupIcon, FolderIcon, CalendarDaysIcon, DocumentTextIcon, CheckCircleIcon, NoSymbolIcon, PencilIcon, ExclamationTriangleIcon } from './icons';

interface UserDetailsModalProps {
    user: Profile | null;
    onClose: () => void;
    onEdit: (user: Profile) => void;
    onToggleVerification: (user: Profile) => void;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; }> = ({ title, value, icon }) => (
    <div className="bg-gray-100 p-4 rounded-lg flex items-center gap-4">
        <div className="bg-blue-100 text-blue-600 p-3 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const getDisplayPhoneNumber = (mobile: string | null | undefined): string => {
    if (!mobile) return '-';
    const digits = mobile.replace(/\D/g, '');
    if (digits.length >= 9) {
        const lastNine = digits.slice(-9);
        if (lastNine.startsWith('9')) {
            return '0' + lastNine;
        }
    }
    return mobile;
};

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, onClose, onEdit, onToggleVerification }) => {
    const data = useData();
    const { clients, site_finances, documents, all_sessions } = data;

    const user_stats = React.useMemo(() => {
        if (!user) return null;

        const user_clients = clients.filter(c => c.user_id === user.id);
        const user_cases = user_clients.flatMap(c => c.cases);
        const user_sessions = all_sessions.filter(s => s.user_id === user.id);
        const user_documents = documents.filter(d => d.user_id === user.id);
        const user_financials = site_finances.filter(sf => sf.user_id === user.id && sf.type === 'income');

        return {
            total_clients: user_clients.length,
            active_cases: user_cases.filter(c => c.status === 'active').length,
            total_sessions: user_sessions.length,
            total_documents: user_documents.length,
            financial_history: user_financials.sort((a,b) => safe_revive_date(b.payment_date).getTime() - safe_revive_date(a.payment_date).getTime()),
            total_paid: user_financials.reduce((sum, entry) => sum + entry.amount, 0),
        };
    }, [user, clients, all_sessions, documents, site_finances]);

    if (!user || !user_stats) return null;

    const getStatusInfo = () => {
        if (!user.is_approved) return { text: 'بانتظار الموافقة', color: 'bg-yellow-100 text-yellow-800' };
        if (!user.is_active) return { text: 'حساب غير نشط', color: 'bg-red-100 text-red-800' };
        
        const end_date = user.subscription_end_date ? safe_revive_date(user.subscription_end_date) : null;
        if (user.subscription_end_date && is_before_today(user.subscription_end_date)) {
            return { text: 'اشتراك منتهي', color: 'bg-red-100 text-red-800' };
        }
        
        return { text: 'نشط', color: 'bg-green-100 text-green-800' };
    };

    const status = getStatusInfo();
    const start_date = user.subscription_start_date ? safe_revive_date(user.subscription_start_date) : null;
    const end_date = user.subscription_end_date ? safe_revive_date(user.subscription_end_date) : null;
    
    let days_remaining = 0;
    let progress = 0;
    if (start_date && end_date) {
        const total_duration = end_date.getTime() - start_date.getTime();
        const now = new Date();
        const today_start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const elapsed = today_start.getTime() - start_date.getTime();
        days_remaining = Math.max(0, Math.ceil((end_date.getTime() - today_start.getTime()) / (1000 * 60 * 60 * 24)));
        progress = Math.max(0, Math.min(100, (elapsed / total_duration) * 100));
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl my-8" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-start p-6 border-b rounded-t-lg bg-gray-50">
                    <div>
                        <h2 className="text-3xl font-bold text-gray-900">{user.full_name}</h2>
                        <div className="flex items-center gap-4 mt-2">
                            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${status.color}`}>
                                {status.text}
                            </span>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <PhoneIcon className="w-4 h-4" />
                                <span>{getDisplayPhoneNumber(user.mobile_number)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {user.mobile_verified ? (
                                    <button 
                                        onClick={() => onToggleVerification(user)}
                                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
                                    >
                                        <CheckCircleIcon className="w-3 h-3 ml-1" />
                                        تم التحقق
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => onToggleVerification(user)}
                                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-colors"
                                    >
                                        بانتظار التحقق
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-200 rounded-full"><XMarkIcon className="w-6 h-6" /></button>
                </div>
                
                {/* Body */}
                <div className="p-6 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard title="إجمالي الموكلين" value={user_stats.total_clients} icon={<UserGroupIcon className="w-6 h-6"/>} />
                        <StatCard title="القضايا النشطة" value={user_stats.active_cases} icon={<FolderIcon className="w-6 h-6"/>} />
                        <StatCard title="الجلسات المسجلة" value={user_stats.total_sessions} icon={<CalendarDaysIcon className="w-6 h-6"/>} />
                        <StatCard title="الوثائق المرفوعة" value={user_stats.total_documents} icon={<DocumentTextIcon className="w-6 h-6"/>} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Subscription Info */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">معلومات الاشتراك</h3>
                             <div className="p-4 bg-white border rounded-lg">
                                {start_date && end_date ? (
                                    <>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>{format_date(start_date)}</span>
                                            <span>{format_date(end_date)}</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                                        </div>
                                        <div className="text-center mt-2">
                                            <p className="font-semibold text-gray-700">{days_remaining} يوم متبقي</p>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-gray-500">لا يوجد اشتراك مفعل.</p>
                                )}
                            </div>
                            <div className="text-sm space-y-2">
                                <p><strong className="font-medium text-gray-600">تاريخ التسجيل:</strong> {user.created_at ? format_date(user.created_at) : '-'}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => { onEdit(user); onClose(); }} className="flex items-center gap-2 text-sm px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200">
                                    <PencilIcon className="w-4 h-4" />
                                    <span>تعديل الاشتراك</span>
                                </button>
                                <button 
                                    onClick={() => { 
                                        data.set_admin_viewing_user_id(user.id); 
                                        onClose(); 
                                    }} 
                                    className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200"
                                >
                                    <FolderIcon className="w-4 h-4" />
                                    <span>عرض مكتب المستخدم</span>
                                </button>
                            </div>
                        </div>

                        {/* Financial History */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">السجل المالي للاشتراكات</h3>
                            {user_stats.financial_history.length > 0 ? (
                                <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                                <table className="w-full text-sm text-right">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="px-4 py-2">التاريخ</th>
                                            <th className="px-4 py-2">البيان</th>
                                            <th className="px-4 py-2">المبلغ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {user_stats.financial_history.map(entry => (
                                            <tr key={entry.id} className="border-t">
                                                <td className="px-4 py-2">{format_date(entry.payment_date)}</td>
                                                <td className="px-4 py-2">{entry.description}</td>
                                                <td className="px-4 py-2 font-semibold text-green-600">{entry.amount.toLocaleString()} ل.س</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 bg-gray-50 font-bold">
                                            <td colSpan={2} className="px-4 py-2 text-left">الإجمالي المدفوع</td>
                                            <td className="px-4 py-2">{user_stats.total_paid.toLocaleString()} ل.س</td>
                                        </tr>
                                    </tfoot>
                                </table>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm">لا توجد حركات مالية مسجلة لهذا المستخدم.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserDetailsModal;
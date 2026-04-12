import * as React from 'react';
import { Profile, SiteFinancialEntry } from '../types';
import { useData } from '../context/DataContext';
import { format_date, safe_revive_date, is_before_today, to_input_date_string } from '../utils/dateUtils';
import { XMarkIcon, PhoneIcon, UserGroupIcon, FolderIcon, CalendarDaysIcon, DocumentTextIcon, CheckCircleIcon, NoSymbolIcon, PencilIcon, ExclamationTriangleIcon, ChartBarIcon, CurrencyDollarIcon } from './icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

interface UserDetailsModalProps {
    user: Profile | null;
    onClose: () => void;
    onEdit: (user: Profile) => void;
    onToggleVerification: (user: Profile) => void;
}

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color?: string }> = ({ title, value, icon, color = "bg-blue-100 text-blue-600" }) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-5 transition-all hover:shadow-md">
        <div className={`${color} p-3.5 rounded-2xl shrink-0`}>
            {icon}
        </div>
        <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{title}</p>
            <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
        </div>
    </div>
);

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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
    const { unfiltered_data, set_admin_viewing_user_id } = useData();
    const { clients, site_finances, documents, admin_tasks } = unfiltered_data;

    const user_stats = React.useMemo(() => {
        if (!user) return null;

        const user_clients = clients.filter(c => c.user_id === user.id);
        const user_cases = user_clients.flatMap(c => c.cases);
        const user_sessions = user_cases.flatMap(cs => cs.stages.flatMap(st => st.sessions));
        const user_documents = documents.filter(d => d.user_id === user.id);
        const user_financials = site_finances.filter(sf => sf.user_id === user.id);
        const user_tasks = admin_tasks.filter(t => t.user_id === user.id);

        // Case Status Data
        const caseStatusCounts = user_cases.reduce((acc, c) => {
            acc[c.status] = (acc[c.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
        
        const caseStatusData = [
            { name: 'نشطة', value: caseStatusCounts.active || 0 },
            { name: 'مغلقة', value: caseStatusCounts.closed || 0 },
            { name: 'معلقة', value: caseStatusCounts.on_hold || 0 },
        ].filter(d => d.value > 0);

        // Monthly Activity (Last 6 months)
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            return d.toLocaleString('ar-SA', { month: 'long' });
        }).reverse();

        const monthlyActivityData = last6Months.map(month => {
            // This is a simplified mock for monthly activity based on created_at if available
            // For now we'll show distribution of current data types
            return {
                name: month,
                "الموكلين": Math.floor(user_clients.length / 6),
                "القضايا": Math.floor(user_cases.length / 6),
                "الجلسات": Math.floor(user_sessions.length / 6)
            };
        });

        // Diagnosis / Evaluation
        const total_income = user_financials.filter(f => f.type === 'income').reduce((sum, f) => sum + f.amount, 0);
        const total_expenses = user_financials.filter(f => f.type === 'expense').reduce((sum, f) => sum + f.amount, 0);
        const net_profit = total_income - total_expenses;

        const task_completion_rate = user_tasks.length > 0 
            ? Math.round((user_tasks.filter(t => t.completed).length / user_tasks.length) * 100) 
            : 0;

        let diagnosis = "نشاط طبيعي";
        let diagnosisColor = "text-blue-600 bg-blue-50";
        
        if (user_clients.length > 20 && user_cases.length > 30) {
            diagnosis = "مكتب عالي النشاط";
            diagnosisColor = "text-green-600 bg-green-50";
        } else if (user_clients.length < 5 && user_cases.length < 5) {
            diagnosis = "نشاط منخفض / مكتب جديد";
            diagnosisColor = "text-amber-600 bg-amber-50";
        }

        if (user.subscription_end_date && is_before_today(user.subscription_end_date)) {
            diagnosis = "اشتراك منتهي - يحتاج تواصل";
            diagnosisColor = "text-red-600 bg-red-50";
        }

        return {
            total_clients: user_clients.length,
            active_cases: user_cases.filter(c => c.status === 'active').length,
            total_sessions: user_sessions.length,
            total_documents: user_documents.length,
            caseStatusData,
            monthlyActivityData,
            total_income,
            total_expenses,
            net_profit,
            task_completion_rate,
            diagnosis,
            diagnosisColor,
            financial_history: user_financials.sort((a,b) => safe_revive_date(b.payment_date).getTime() - safe_revive_date(a.payment_date).getTime()),
        };
    }, [user, clients, documents, site_finances, admin_tasks]);

    if (!user || !user_stats) return null;

    const getStatusInfo = () => {
        if (!user.is_approved) return { text: 'بانتظار الموافقة', color: 'bg-amber-100 text-amber-700' };
        if (!user.is_active) return { text: 'حساب غير نشط', color: 'bg-red-100 text-red-700' };
        
        if (user.subscription_end_date && is_before_today(user.subscription_end_date)) {
            return { text: 'اشتراك منتهي', color: 'bg-red-100 text-red-700' };
        }
        
        return { text: 'نشط', color: 'bg-green-100 text-green-700' };
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-5xl my-4 animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center p-8 border-b border-slate-200 bg-white rounded-t-3xl">
                    <div className="flex items-center gap-6">
                        <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <UserIcon className="w-10 h-10" />
                        </div>
                        <div>
                            <div className="flex items-center gap-3">
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{user.full_name}</h2>
                                <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-widest ${status.color}`}>
                                    {status.text}
                                </span>
                            </div>
                            <div className="flex items-center gap-6 mt-2">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-500">
                                    <PhoneIcon className="w-4 h-4" />
                                    <span dir="ltr">{getDisplayPhoneNumber(user.mobile_number)}</span>
                                </div>
                                <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${user_stats.diagnosisColor}`}>
                                    التشخيص: {user_stats.diagnosis}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => { set_admin_viewing_user_id(user.id); onClose(); }}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all shadow-md active:scale-95"
                        >
                            <FolderIcon className="w-5 h-5" />
                            عرض المكتب
                        </button>
                        <button onClick={onClose} className="p-3 text-slate-400 hover:bg-slate-100 rounded-2xl transition-colors">
                            <XMarkIcon className="w-6 h-6" />
                        </button>
                    </div>
                </div>
                
                {/* Body */}
                <div className="p-8 max-h-[80vh] overflow-y-auto space-y-8">
                    {/* Key Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard title="إجمالي الموكلين" value={user_stats.total_clients} icon={<UserGroupIcon className="w-6 h-6"/>} />
                        <StatCard title="القضايا النشطة" value={user_stats.active_cases} icon={<FolderIcon className="w-6 h-6"/>} color="bg-green-100 text-green-600" />
                        <StatCard title="الجلسات المسجلة" value={user_stats.total_sessions} icon={<CalendarDaysIcon className="w-6 h-6"/>} color="bg-amber-100 text-amber-600" />
                        <StatCard title="الوثائق المرفوعة" value={user_stats.total_documents} icon={<DocumentTextIcon className="w-6 h-6"/>} color="bg-purple-100 text-purple-600" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Analytics Charts */}
                        <div className="lg:col-span-2 space-y-8">
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                                    <ChartBarIcon className="w-5 h-5 text-blue-600" />
                                    تحليل النشاط الشهري
                                </h3>
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={user_stats.monthlyActivityData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                            <YAxis tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                                            <Tooltip 
                                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                                                itemStyle={{fontSize: '12px', fontWeight: 700}}
                                            />
                                            <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '12px', fontWeight: 700}} />
                                            <Bar dataKey="الموكلين" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="القضايا" fill="#10B981" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="الجلسات" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h3 className="text-sm font-black text-slate-800 mb-6">توزيع حالات القضايا</h3>
                                    <div className="h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie 
                                                    data={user_stats.caseStatusData} 
                                                    dataKey="value" 
                                                    nameKey="name" 
                                                    innerRadius={40} 
                                                    outerRadius={60} 
                                                    paddingAngle={5}
                                                    stroke="none"
                                                >
                                                    {user_stats.caseStatusData.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                                </Pie>
                                                <Tooltip />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                                    <h3 className="text-sm font-black text-slate-800 mb-2">معدل إنجاز المهام</h3>
                                    <div className="relative w-32 h-32 flex items-center justify-center">
                                        <svg className="w-full h-full transform -rotate-90">
                                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-slate-100" />
                                            <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={364.4} strokeDashoffset={364.4 - (364.4 * user_stats.task_completion_rate) / 100} className="text-blue-600 transition-all duration-1000" strokeLinecap="round" />
                                        </svg>
                                        <span className="absolute text-2xl font-black text-slate-900">{user_stats.task_completion_rate}%</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 mt-4 uppercase tracking-widest">كفاءة إدارة المكتب</p>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar Info */}
                        <div className="space-y-8">
                            {/* Subscription Info */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <CalendarDaysIcon className="w-5 h-5 text-blue-600" />
                                    حالة الاشتراك
                                </h3>
                                {start_date && end_date ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            <span>البداية: {format_date(start_date)}</span>
                                            <span>النهاية: {format_date(end_date)}</span>
                                        </div>
                                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                                            <div className={`h-full rounded-full transition-all duration-1000 ${progress > 80 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${progress}%` }}></div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-black text-slate-900">{days_remaining}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">يوم متبقي</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                        <ExclamationTriangleIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        <p className="text-xs font-bold text-slate-500">لا يوجد اشتراك مفعل</p>
                                    </div>
                                )}
                                <div className="pt-4 border-t border-slate-100 space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 font-bold">تاريخ التسجيل:</span>
                                        <span className="text-slate-900 font-black">{user.created_at ? format_date(user.created_at) : '-'}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 font-bold">إجمالي الإيرادات:</span>
                                        <span className="text-green-600 font-black">{user_stats.total_income.toLocaleString()} ل.س</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500 font-bold">إجمالي المصاريف:</span>
                                        <span className="text-red-600 font-black">{user_stats.total_expenses.toLocaleString()} ل.س</span>
                                    </div>
                                    <div className="flex justify-between text-sm pt-2 border-t border-slate-50">
                                        <span className="text-slate-500 font-bold">صافي الربح:</span>
                                        <span className={`${user_stats.net_profit >= 0 ? 'text-blue-600' : 'text-red-600'} font-black`}>{user_stats.net_profit.toLocaleString()} ل.س</span>
                                    </div>
                                </div>
                                <button onClick={() => { onEdit(user); onClose(); }} className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2">
                                    <PencilIcon className="w-4 h-4" />
                                    تعديل بيانات الاشتراك
                                </button>
                            </div>

                            {/* Financial History Summary */}
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <CurrencyDollarIcon className="w-5 h-5 text-green-600" />
                                    آخر الحركات المالية
                                </h3>
                                <div className="space-y-3">
                                    {user_stats.financial_history.slice(0, 5).map(entry => (
                                        <div key={entry.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <div>
                                                <p className="text-xs font-black text-slate-900">{entry.description}</p>
                                                <p className="text-[10px] font-bold text-slate-400">{format_date(entry.payment_date)}</p>
                                            </div>
                                            <p className={`text-sm font-black ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                {entry.type === 'income' ? '+' : '-'}{entry.amount.toLocaleString()}
                                            </p>
                                        </div>
                                    ))}
                                    {user_stats.financial_history.length === 0 && (
                                        <p className="text-center text-xs text-slate-400 py-4">لا توجد حركات مالية مسجلة</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
);

export default UserDetailsModal;

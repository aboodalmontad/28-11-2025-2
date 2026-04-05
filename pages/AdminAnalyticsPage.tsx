import * as React from 'react';
import { useData } from '../context/DataContext';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UserGroupIcon, ChartBarIcon, ClockIcon } from '../components/icons';
import { safe_revive_date, to_input_date_string } from '../utils/dateUtils';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6 transition-all hover:shadow-md hover:-translate-y-1">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
            {icon}
        </div>
        <div className="flex flex-col">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
            <p className="text-3xl font-black text-slate-900 tracking-tight">{value}</p>
        </div>
    </div>
);

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900 text-white p-4 shadow-2xl rounded-xl text-xs border border-slate-700 backdrop-blur-md bg-opacity-90">
                <p className="font-black mb-2 border-b border-slate-700 pb-2">{label}</p>
                {payload.map((pld: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-4 mt-1">
                        <span className="font-medium opacity-70">{pld.name}:</span>
                        <span className="font-black" style={{ color: pld.color }}>
                            {formatter ? formatter(pld.value) : pld.value}
                        </span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const AdminAnalyticsPage: React.FC = () => {
    const { profiles, clients, admin_tasks, is_data_loading: loading } = useData();
    const [stats, setStats] = React.useState<any>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (loading) return;

        try {
            const today = new Date();
            const activeSubscriptions = profiles.filter(p => p.subscription_end_date && safe_revive_date(p.subscription_end_date) >= today).length;
            const pendingApprovals = profiles.filter(p => !p.is_approved).length;

            const allCases = clients.flatMap(c => c.cases);
            const caseStatusCounts = allCases.reduce((acc, c) => {
                acc[c.status] = (acc[c.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            const caseStatusData = [
                { name: 'نشطة', value: caseStatusCounts.active || 0 },
                { name: 'مغلقة', value: caseStatusCounts.closed || 0 },
                { name: 'معلقة', value: caseStatusCounts.on_hold || 0 },
            ];
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            const userSignups = profiles
                .filter(p => p.created_at && safe_revive_date(p.created_at) >= thirtyDaysAgo)
                .reduce((acc, p) => {
                    const dateStr = to_input_date_string(safe_revive_date(p.created_at!)); // YYYY-MM-DD
                    acc[dateStr] = (acc[dateStr] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

            const userSignupsData = Object.entries(userSignups)
                .map(([date, count]) => ({ date, "مستخدمين جدد": count }))
                .sort((a,b) => safe_revive_date(a.date).getTime() - safe_revive_date(b.date).getTime());

            const activityByUser = profiles.map(p => {
                const clientCount = clients.filter(c => (c as any).user_id === p.id).length;
                const caseCount = allCases.filter(c => (c as any).user_id === p.id).length;
                const taskCount = admin_tasks.filter(t => (t as any).user_id === p.id).length;
                return { name: p.full_name, "عدد الإدخالات": clientCount + caseCount + taskCount };
            }).sort((a, b) => b["عدد الإدخالات"] - a["عدد الإدخالات"]).slice(0, 10);

            setStats({
                totalUsers: profiles.length,
                activeSubscriptions,
                pendingApprovals,
                caseStatusData,
                userSignupsData,
                activityByUser
            });

        } catch (err: any) {
            setError(err.message);
        }
    }, [loading, profiles, clients, admin_tasks]);

    if (loading) return <div className="text-center p-8">جاري تحميل التحليلات...</div>;
    if (error) return <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>;
    if (!stats) return <div className="text-center p-8">لا توجد بيانات كافية لعرض التحليلات.</div>;

    const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B'];
    
    return (
        <div className="space-y-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight">التحليلات والإحصائيات</h1>
                    <p className="text-slate-500 mt-1">نظرة شاملة على أداء النظام ونمو المستخدمين.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl border border-slate-200 font-bold text-sm">
                        آخر تحديث: {new Date().toLocaleTimeString('ar-SA')}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="إجمالي المستخدمين" value={stats.totalUsers} icon={<UserGroupIcon className="w-7 h-7" />} color="bg-blue-100 text-blue-600" />
                <StatCard title="الاشتراكات النشطة" value={stats.activeSubscriptions} icon={<ChartBarIcon className="w-7 h-7" />} color="bg-green-100 text-green-600" />
                <StatCard title="الطلبات المعلقة" value={stats.pendingApprovals} icon={<ClockIcon className="w-7 h-7" />} color="bg-amber-100 text-amber-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-black mb-8 text-slate-800 flex items-center gap-2">
                        <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                        نمو المستخدمين (آخر 30 يوم)
                    </h3>
                    <ResponsiveContainer width="100%" height={350}>
                        <LineChart data={stats.userSignupsData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', fontWeight: 700 }} />
                            <Line type="monotone" dataKey="مستخدمين جدد" stroke="#3B82F6" strokeWidth={4} dot={{ r: 6, fill: '#3B82F6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8, strokeWidth: 0 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                 <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                    <h3 className="font-black mb-8 text-slate-800 flex items-center gap-2">
                        <div className="w-2 h-6 bg-green-500 rounded-full"></div>
                        توزيع حالات القضايا
                    </h3>
                    <ResponsiveContainer width="100%" height={350}>
                         <PieChart>
                            <Pie 
                                data={stats.caseStatusData} 
                                dataKey="value" 
                                nameKey="name" 
                                cx="50%" cy="50%" 
                                innerRadius={80}
                                outerRadius={120} 
                                paddingAngle={5}
                                stroke="none"
                            >
                                {stats.caseStatusData.map((_entry: any, index: number) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 700 }} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

             <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                <h3 className="font-black mb-8 text-slate-800 flex items-center gap-2">
                    <div className="w-2 h-6 bg-purple-600 rounded-full"></div>
                    أكثر المستخدمين نشاطاً (حسب عدد الإدخالات)
                </h3>
                 <ResponsiveContainer width="100%" height={450}>
                    <BarChart data={stats.activityByUser} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="عدد الإدخالات" fill="#6366f1" radius={[0, 10, 10, 0]} barSize={24} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AdminAnalyticsPage;
import * as React from 'react';
import { useData } from '../context/DataContext.tsx';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UserGroupIcon, ChartBarIcon, ClockIcon } from '../components/icons.tsx';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-white p-6 rounded-lg shadow flex items-center gap-4">
        <div className="bg-blue-100 text-blue-600 p-3 rounded-full">{icon}</div>
        <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const AdminAnalyticsPage: React.FC = () => {
    const { profiles, clients, allSessions, siteFinances } = useData();
    const stats = React.useMemo(() => {
        const totalUsers = profiles.length;
        const totalRevenue = siteFinances.filter(f => f.type === 'income').reduce((sum, item) => sum + item.amount, 0);
        return { totalUsers, totalClients: clients.length, totalSessions: allSessions.length, totalRevenue };
    }, [profiles, clients, allSessions, siteFinances]);

    const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];
    const chartData = [
        { name: 'المستخدمين', count: stats.totalUsers },
        { name: 'الموكلين', count: stats.totalClients },
        { name: 'الجلسات', count: stats.totalSessions },
    ];

    return (
        <div className="space-y-8 animate-fade-in" dir="rtl">
            <h1 className="text-3xl font-bold text-gray-800">تحليلات النظام</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="إجمالي المستخدمين" value={stats.totalUsers} icon={<UserGroupIcon className="w-6 h-6" />} />
                <StatCard title="إجمالي الموكلين" value={stats.totalClients} icon={<ChartBarIcon className="w-6 h-6" />} />
                <StatCard title="إجمالي الجلسات" value={stats.totalSessions} icon={<ClockIcon className="w-6 h-6" />} />
                <StatCard title="إجمالي الإيرادات" value={`${stats.totalRevenue.toLocaleString()} ل.س`} icon={<ChartBarIcon className="w-6 h-6" />} />
            </div>
            <div className="bg-white p-6 rounded-lg shadow h-[400px]">
                <h3 className="text-lg font-semibold mb-6 border-b pb-2">نظرة عامة على البيانات</h3>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6">
                            {chartData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AdminAnalyticsPage;


import * as React from 'react';
import AdminPage from './AdminPage';
import { PowerIcon, UserGroupIcon, ChartPieIcon, Bars3Icon, XMarkIcon, CurrencyDollarIcon, Cog6ToothIcon, ExclamationTriangleIcon } from '../components/icons';
import { useData } from '../context/DataContext';
import AdminAnalyticsPage from './AdminAnalyticsPage';
import SiteFinancesPage from './SiteFinancesPage';
import AdminTestsPage from './AdminTestsPage';
import AdminSettingsPage from './AdminSettingsPage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface AdminDashboardProps {
    on_logout: () => void;
    on_open_config: () => void;
}

type AdminView = 'analytics' | 'users' | 'finances' | 'settings' | 'tests';

const NavLink: React.FC<{
    label: string;
    icon: React.ReactNode;
    is_active: boolean;
    on_click: () => void;
    badge_count?: number;
}> = ({ label, icon, is_active, on_click, badge_count }) => (
    <button
        onClick={on_click}
        className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
            is_active
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-200'
        }`}
    >
        <div className="flex items-center gap-3">
            {icon}
            <span className="font-semibold">{label}</span>
        </div>
        {badge_count && badge_count > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white animate-pulse">
                {badge_count}
            </span>
        )}
    </button>
);


const AdminDashboard: React.FC<AdminDashboardProps> = ({ on_logout, on_open_config }) => {
    const { profiles, is_data_loading: loading } = useData();
    const [view, set_view] = React.useState<AdminView>('users');
    const [is_mobile_menu_open, set_is_mobile_menu_open] = React.useState(false);
    const is_online = useOnlineStatus();

    const pending_users_count = React.useMemo(() => {
        return profiles.filter(p => !p.is_approved && p.role !== 'admin').length;
    }, [profiles]);

    // Automatically unlock audio and vibration on component mount.
    React.useEffect(() => {
        const unlock_audio_and_vibration = () => {
            const silent_audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
            const try_vibrate = () => {
                if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
                    navigator.vibrate(0);
                }
            };
            const attempt_play = () => silent_audio.play();
            attempt_play().then(() => {
                try_vibrate();
            }).catch(() => {
                const enable_on_interaction = () => {
                    attempt_play().catch(() => {});
                    try_vibrate();
                };
                window.addEventListener('click', enable_on_interaction, { once: true });
                window.addEventListener('touchend', enable_on_interaction, { once: true });
            }); 
        };
        unlock_audio_and_vibration();
    }, []);

    const render_view = () => {
        switch (view) {
            case 'analytics': return <AdminAnalyticsPage />;
            case 'users': return <AdminPage />;
            case 'finances': return <SiteFinancesPage />;
            case 'settings': return <AdminSettingsPage on_open_config={on_open_config} />;
            case 'tests': return <AdminTestsPage />;
            default: return <AdminPage />;
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-screen">جاري تحميل...</div>
    }

    const nav_items = [
        { id: 'users', label: 'المستخدمين', icon: <UserGroupIcon className="w-5 h-5" />, badge: pending_users_count },
        { id: 'analytics', label: 'التحليلات', icon: <ChartPieIcon className="w-5 h-5" /> },
        { id: 'finances', label: 'المالية', icon: <CurrencyDollarIcon className="w-5 h-5" /> },
        { id: 'tests', label: 'الاختبارات', icon: <ExclamationTriangleIcon className="w-5 h-5" /> },
        { id: 'settings', label: 'الإعدادات', icon: <Cog6ToothIcon className="w-5 h-5" /> },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
            {/* Fixed Top Navigation */}
            <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm no-print">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
                    <div className="flex justify-between items-center h-16">
                        {/* Logo & Title */}
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
                                <Cog6ToothIcon className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-slate-800 hidden md:block">لوحة الإدارة</span>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-1">
                            {nav_items.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => set_view(item.id as AdminView)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all relative ${
                                        view === item.id 
                                            ? 'bg-blue-50 text-blue-600' 
                                            : 'text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    {item.icon}
                                    <span>{item.label}</span>
                                    {item.badge && item.badge > 0 && (
                                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </nav>

                        {/* User Actions */}
                        <div className="flex items-center gap-2">
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-50 text-green-700 rounded-full border border-green-100 text-xs font-bold">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                متصل
                            </div>
                            <button
                                onClick={on_logout}
                                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="تسجيل الخروج"
                            >
                                <PowerIcon className="w-5 h-5" />
                            </button>
                            
                            {/* Mobile Menu Toggle */}
                            <button 
                                onClick={() => set_is_mobile_menu_open(!is_mobile_menu_open)}
                                className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                {is_mobile_menu_open ? <XMarkIcon className="w-6 h-6"/> : <Bars3Icon className="w-6 h-6"/>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Dropdown */}
                {is_mobile_menu_open && (
                    <div className="md:hidden bg-white border-t border-slate-100 p-2 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-200">
                        {nav_items.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    set_view(item.id as AdminView);
                                    set_is_mobile_menu_open(false);
                                }}
                                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
                                    view === item.id
                                        ? 'bg-blue-600 text-white'
                                        : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {item.icon}
                                    <span className="font-bold">{item.label}</span>
                                </div>
                                {item.badge && item.badge > 0 && (
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </header>

            {/* Main Content Area */}
            <main className="flex-grow p-4 md:p-6 lg:p-10 max-w-[1600px] mx-auto w-full">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">
                        {view === 'users' && 'إدارة المستخدمين'}
                        {view === 'analytics' && 'التحليلات والإحصائيات'}
                        {view === 'finances' && 'المحاسبة المالية'}
                        {view === 'tests' && 'اختبارات النظام'}
                        {view === 'settings' && 'إعدادات الإدارة'}
                    </h1>
                </div>
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {render_view()}
                </div>
            </main>

            {/* Footer / Info */}
            <footer className="bg-white border-t border-slate-200 py-3 px-6 text-center no-print">
                <p className="text-[10px] text-slate-400 font-medium">نظام إدارة المحاماة - الإصدار: 27-12-2025-3</p>
            </footer>
        </div>
    );
};

export default AdminDashboard;
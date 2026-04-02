
import * as React from 'react';
import AdminPage from './AdminPage';
import { PowerIcon, UserGroupIcon, ChartPieIcon, Bars3Icon, XMarkIcon, CurrencyDollarIcon, Cog6ToothIcon, ExclamationTriangleIcon } from '../components/icons';
import { useData } from '../context/DataContext';
import AdminAnalyticsPage from './AdminAnalyticsPage';
import SiteFinancesPage from './SiteFinancesPage';
import AdminSettingsPage from './AdminSettingsPage';
import AdminTestsPage from './AdminTestsPage';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { SyncLogEntry } from '../hooks/useSync';

interface AdminDashboardProps {
    on_logout: () => void;
    on_open_config: () => void;
    sync_log?: SyncLogEntry[];
    on_clear_log?: () => void;
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


const AdminDashboard: React.FC<AdminDashboardProps> = ({ on_logout, on_open_config, sync_log = [], on_clear_log = () => {} }) => {
    const { profiles, is_data_loading: loading, sync_status, last_sync_error, is_dirty, manual_sync, is_auto_sync_enabled } = useData();
    // Changed default view from 'analytics' to 'users'
    const [view, set_view] = React.useState<AdminView>('users');
    const [is_sidebar_open, set_is_sidebar_open] = React.useState(false);
    const is_online = useOnlineStatus();

    const pending_users_count = React.useMemo(() => {
        return profiles.filter(p => !p.is_approved && p.role !== 'admin').length;
    }, [profiles]);

    // Automatically unlock audio and vibration on component mount.
    // This is required by modern browsers which restrict autoplay until a user interaction.
    React.useEffect(() => {
        const unlock_audio_and_vibration = () => {
            // A minimal, silent audio file to unlock the AudioContext.
            const silent_audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
            
            const try_vibrate = () => {
                if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
                    // A minimal vibration to "wake up" the vibration API.
                    navigator.vibrate(0);
                }
            };
            
            const attempt_play = () => silent_audio.play();
            
            attempt_play().then(() => {
                console.log('Audio and Vibration APIs unlocked on mount.');
                try_vibrate();
            }).catch(() => {
                console.warn('Audio autoplay was blocked. It will be enabled after the first user interaction.');
                const enable_on_interaction = () => {
                    attempt_play().catch(() => {}); // Try again, ignore further errors.
                    try_vibrate();
                    // Fix: The event listeners are added with the `once: true` option, which automatically
                    // removes them after they are invoked. Manually calling `removeEventListener` is not
                    // necessary and was causing an error because it was passed an invalid options object.
                    console.log('Audio and Vibration APIs unlocked after user interaction.');
                };
                // Set up listeners for the first interaction.
                window.addEventListener('click', enable_on_interaction, { once: true });
                window.addEventListener('touchend', enable_on_interaction, { once: true });
            }); 
        };

        unlock_audio_and_vibration();
    }, []); // Empty dependency array ensures this runs only once on mount.


    const render_view = () => {
        switch (view) {
            case 'analytics':
                return <AdminAnalyticsPage />;
            case 'users':
                return <AdminPage />;
            case 'finances':
                return <SiteFinancesPage />;
            case 'settings':
                return <AdminSettingsPage on_open_config={on_open_config} />;
            case 'tests':
                return <AdminTestsPage />;
            default:
                return <AdminPage />;
        }
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-screen">جاري تحميل...</div>
    }

    const sidebar_content = (
        <>
            <div className="text-center py-4 mb-4 border-b">
                <h1 className="text-2xl font-bold text-gray-800">لوحة تحكم المدير</h1>
            </div>
            <nav className="flex-grow space-y-2">
                <NavLink
                    label="إدارة المستخدمين"
                    icon={<UserGroupIcon className="w-6 h-6" />}
                    is_active={view === 'users'}
                    on_click={() => { set_view('users'); set_is_sidebar_open(false); }}
                    badge_count={pending_users_count}
                />
                 <NavLink
                    label="التحليلات"
                    icon={<ChartPieIcon className="w-6 h-6" />}
                    is_active={view === 'analytics'}
                    on_click={() => { set_view('analytics'); set_is_sidebar_open(false); }}
                />
                 <NavLink
                    label="المحاسبة المالية"
                    icon={<CurrencyDollarIcon className="w-6 h-6" />}
                    is_active={view === 'finances'}
                    on_click={() => { set_view('finances'); set_is_sidebar_open(false); }}
                />
                <NavLink
                    label="اختبارات الإدارة"
                    icon={<ExclamationTriangleIcon className="w-6 h-6" />}
                    is_active={view === 'tests'}
                    on_click={() => { set_view('tests'); set_is_sidebar_open(false); }}
                />
                <NavLink
                    label="الإعدادات"
                    icon={<Cog6ToothIcon className="w-6 h-6" />}
                    is_active={view === 'settings'}
                    on_click={() => { set_view('settings'); set_is_sidebar_open(false); }}
                />
            </nav>
            {/* Sync Indicator in Sidebar for Desktop */}
            <div className="mt-auto border-t pt-4 space-y-3">
                <div className="hidden lg:block px-2">
                    <SyncStatusIndicator 
                        status={sync_status} 
                        last_error={last_sync_error} 
                        is_dirty={is_dirty} 
                        is_online={is_online}
                        on_manual_sync={manual_sync}
                        is_auto_sync_enabled={is_auto_sync_enabled}
                        sync_log={sync_log}
                        on_clear_log={on_clear_log}
                        className="w-full justify-center bg-gray-100"
                    />
                </div>
                <p className="mb-2 text-center text-xs text-gray-400">الإصدار: 27-12-2025-3</p>
                <button
                    onClick={on_logout}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-red-100 hover:text-red-700 transition-colors"
                >
                    <PowerIcon className="w-6 h-6" />
                    <span className="font-semibold">تسجيل الخروج</span>
                </button>
            </div>
        </>
    );

    return (
        <div className="min-h-screen bg-gray-100" dir="rtl">
            {/* Overlay for mobile */}
            <div className={`fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden transition-opacity ${is_sidebar_open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => set_is_sidebar_open(false)}></div>
            
            {/* Sidebar */}
            <aside className={`fixed lg:relative inset-y-0 right-0 z-40 w-64 bg-white shadow-md flex flex-col p-4 transition-transform duration-300 ease-in-out lg:translate-x-0 ${is_sidebar_open ? 'translate-x-0' : 'translate-x-full'}`}>
                <button onClick={() => set_is_sidebar_open(false)} className="lg:hidden self-start p-2 mb-2 text-gray-500 hover:bg-gray-100 rounded-full">
                    <XMarkIcon className="w-6 h-6" />
                </button>
                {sidebar_content}
            </aside>
            
            {/* Main content */}
            <div className="lg:mr-64">
                <header className="sticky top-0 bg-white/75 backdrop-blur-sm p-4 flex justify-between items-center shadow-sm z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => set_is_sidebar_open(true)} className="p-2 lg:hidden">
                            <Bars3Icon className="w-6 h-6"/>
                        </button>
                        <h1 className="text-xl font-bold lg:hidden">لوحة التحكم</h1>
                    </div>
                    {/* Sync Indicator in Header for Mobile/Tablet */}
                    <div className="lg:hidden">
                        <SyncStatusIndicator 
                            status={sync_status} 
                            last_error={last_sync_error} 
                            is_dirty={is_dirty} 
                            is_online={is_online}
                            on_manual_sync={manual_sync}
                            is_auto_sync_enabled={is_auto_sync_enabled}
                            sync_log={sync_log}
                            on_clear_log={on_clear_log}
                        />
                    </div>
                </header>
                <main className="p-4 sm:p-8">
                    {render_view()}
                </main>
            </div>
        </div>
    );
};

export default AdminDashboard;
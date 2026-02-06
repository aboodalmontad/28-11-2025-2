
import * as React from 'react';
import type { Session as AuthSession, User } from '@supabase/supabase-js';

// Lazy import ALL page components
const ClientsPage = React.lazy(() => import('./pages/ClientsPage'));
const HomePage = React.lazy(() => import('./pages/HomePage'));
const AccountingPage = React.lazy(() => import('./pages/AccountingPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));

import ConfigurationModal from './components/ConfigurationModal';
import { useSupabaseData, SyncStatus } from './hooks/useSupabaseData';
import { UserIcon, CalculatorIcon, Cog6ToothIcon, NoSymbolIcon, PowerIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, ArrowPathIcon } from './components/icons';
import ContextMenu, { MenuItem } from './components/ContextMenu';
import AdminTaskModal from './components/AdminTaskModal';
import { Profile, Permissions } from './types';
import { getSupabaseClient } from './supabaseClient';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import UnpostponedSessionsModal from './components/UnpostponedSessionsModal';
import NotificationCenter from './components/RealtimeNotifier';
import { DataProvider } from './context/DataContext';
import SyncStatusIndicator from './components/SyncStatusIndicator';

type Page = 'home' | 'admin-tasks' | 'clients' | 'accounting' | 'settings';

interface AppProps {
    onRefresh: () => void;
}

const Navbar: React.FC<{
    currentPage: Page;
    onNavigate: (page: Page) => void;
    onLogout: () => void;
    syncStatus: SyncStatus;
    lastSyncError: string | null;
    isDirty: boolean;
    isOnline: boolean;
    onManualSync: () => void;
    profile: Profile | null;
    permissions: Permissions;
}> = ({ currentPage, onNavigate, onLogout, syncStatus, lastSyncError, isDirty, isOnline, onManualSync, profile, permissions }) => {
    
    const allNavItems = [
        { id: 'home', label: 'المفكرة', icon: CalendarDaysIcon, visible: permissions?.can_view_agenda },
        { id: 'admin-tasks', label: 'المهام الإدارية', icon: ClipboardDocumentCheckIcon, visible: permissions?.can_view_admin_tasks },
        { id: 'clients', label: 'الموكلين', icon: UserIcon, visible: permissions?.can_view_clients || permissions?.can_view_cases },
        { id: 'accounting', label: 'المحاسبة', icon: CalculatorIcon, visible: permissions?.can_view_finance },
    ];

    const navItems = allNavItems.filter(item => item.visible);
    
    return (
        <header className="bg-white shadow-md p-2 sm:p-4 flex justify-between items-center no-print sticky top-0 z-30">
            <nav className="flex items-center gap-1 sm:gap-4 flex-wrap">
                <button onClick={() => permissions?.can_view_agenda && onNavigate('home')} className="flex items-center" aria-label="العودة إلى الصفحة الرئيسية" disabled={!permissions?.can_view_agenda}>
                    <div className="flex flex-col items-start sm:flex-row sm:items-baseline gap-0 sm:gap-2">
                        <h1 className="text-xl font-bold text-gray-800">مكتب المحامي</h1>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <span>الإصدار: 30-12-2025</span>
                            {profile && (
                                <>
                                    <span className="mx-1 text-gray-300">|</span>
                                    <span className="font-semibold text-blue-600 truncate max-w-[150px]">{profile.full_name}</span>
                                </>
                            )}
                        </div>
                    </div>
                </button>
                 <div className="hidden sm:flex items-center gap-1 sm:gap-2">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id as Page)}
                            title={item.label}
                            className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPage === item.id ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <item.icon className="w-5 h-5" />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            </nav>
            <div className="flex items-center gap-2 sm:gap-4">
                <SyncStatusIndicator 
                    status={syncStatus} 
                    lastError={lastSyncError} 
                    isDirty={isDirty} 
                    isOnline={isOnline}
                    onManualSync={onManualSync}
                    isAutoSyncEnabled={true}
                />
                <button 
                    onClick={() => onNavigate('settings')} 
                    className={`p-2 rounded-full transition-colors ${currentPage === 'settings' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`} 
                    title="الإعدادات"
                >
                    <Cog6ToothIcon className="w-5 h-5" />
                </button>
                <button onClick={onLogout} className="p-2 text-gray-500 hover:bg-red-100 hover:text-red-600 rounded-full transition-colors" title="تسجيل الخروج">
                    <PowerIcon className="w-5 h-5" />
                </button>
            </div>
        </header>
    );
};

const MobileNavbar: React.FC<{
    currentPage: Page;
    onNavigate: (page: Page) => void;
    permissions: Permissions;
}> = ({ currentPage, onNavigate, permissions }) => {
    const allNavItems = [
        { id: 'home', label: 'المفكرة', icon: CalendarDaysIcon, visible: permissions?.can_view_agenda },
        { id: 'admin-tasks', label: 'المهام', icon: ClipboardDocumentCheckIcon, visible: permissions?.can_view_admin_tasks },
        { id: 'clients', label: 'الموكلين', icon: UserIcon, visible: permissions?.can_view_clients || permissions?.can_view_cases },
        { id: 'accounting', label: 'المحاسبة', icon: CalculatorIcon, visible: permissions?.can_view_finance },
    ];

    const navItems = allNavItems.filter(item => item.visible);

    return (
        <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-1 px-2 flex justify-around items-center z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] h-[70px]">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => onNavigate(item.id as Page)}
                    className={`flex flex-col items-center justify-center w-full h-full rounded-lg transition-colors ${
                        currentPage === item.id 
                        ? 'text-blue-600' 
                        : 'text-gray-500 active:bg-gray-50'
                    }`}
                >
                    <item.icon className={`w-7 h-7 mb-1 ${currentPage === item.id ? 'text-blue-600 fill-current' : ''}`} />
                    <span className="text-[10px] font-bold">{item.label}</span>
                </button>
            ))}
        </nav>
    );
};

const LAST_USER_CACHE_KEY = 'lawyerAppLastUser';

const App: React.FC<AppProps> = ({ onRefresh }) => {
    const cachedSession = React.useMemo(() => {
        try {
            const lastUserRaw = localStorage.getItem(LAST_USER_CACHE_KEY);
            if (lastUserRaw) {
                return { user: JSON.parse(lastUserRaw) } as AuthSession;
            }
        } catch (e) { console.error(e); }
        return null;
    }, []);

    const [session, setSession] = React.useState<AuthSession | null>(cachedSession);
    const [isAuthLoading, setIsAuthLoading] = React.useState(!cachedSession);
    const [profile, setProfile] = React.useState<Profile | null>(null);
    const [showConfigModal, setShowConfigModal] = React.useState(false);
    const [currentPage, setCurrentPage] = React.useState<Page>('home');
    const [isAdminTaskModalOpen, setIsAdminTaskModalOpen] = React.useState(false);
    const [contextMenu, setContextMenu] = React.useState<{ isOpen: boolean; position: { x: number; y: number }; menuItems: MenuItem[] }>({ isOpen: false, position: { x: 0, y: 0 }, menuItems: [] });
    const [selectedDate, setSelectedDate] = React.useState(new Date());

    const supabase = getSupabaseClient();
    const isOnline = useOnlineStatus();
    const data = useSupabaseData(session?.user ?? null, isAuthLoading);

    React.useEffect(() => {
        const syncAuth = async () => {
            if (isOnline && supabase) {
                try {
                    const { data: { session: serverSession } } = await supabase.auth.getSession();
                    if (serverSession) {
                        setSession(serverSession);
                        localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(serverSession.user));
                    }
                } catch (e) { console.error(e); }
            }
            setIsAuthLoading(false);
        };
        syncAuth();

        if (supabase) {
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
                if (newSession) {
                    setSession(newSession);
                    localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(newSession.user));
                }
            });
            return () => subscription.unsubscribe();
        }
    }, [isOnline, supabase]);

    React.useEffect(() => {
        if (session?.user && data.profiles) {
            const userProfile = data.profiles.find(p => p.id === session.user.id);
            if (userProfile) setProfile(userProfile);
        }
    }, [session, data.profiles]);

    const handleLogout = async () => {
        localStorage.removeItem(LAST_USER_CACHE_KEY);
        setSession(null);
        if (supabase) await supabase.auth.signOut();
        onRefresh();
    };

    if (isAuthLoading && !session) {
        return (
            <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-50">
                <ArrowPathIcon className="w-12 h-12 animate-spin text-blue-600 mb-4"/>
                <p className="text-gray-500 font-medium">جاري التحقق من الجلسة...</p>
            </div>
        );
    }

    if (!session && !isAuthLoading) {
        return <LoginPage onForceSetup={() => setShowConfigModal(true)} onLoginSuccess={(u) => { setSession({ user: u } as any); localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(u)); }} />;
    }
    
    // Admin Dashboard Check
    if (profile?.role === 'admin') {
        return <DataProvider value={data}><AdminDashboard onLogout={handleLogout} onOpenConfig={() => setShowConfigModal(true)} /></DataProvider>;
    }

    if (showConfigModal || data.syncStatus === 'unconfigured') {
        return <ConfigurationModal onRetry={() => { data.manualSync(); setShowConfigModal(false); }} />;
    }

    return (
        <DataProvider value={data}>
            <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
                <Navbar
                    currentPage={currentPage}
                    onNavigate={setCurrentPage}
                    onLogout={handleLogout}
                    syncStatus={data.syncStatus}
                    lastSyncError={data.lastSyncError}
                    isDirty={data.isDirty}
                    isOnline={isOnline}
                    onManualSync={data.manualSync}
                    profile={profile}
                    permissions={data.permissions}
                />
                
                {data.isDataLoading && (
                    <div className="bg-blue-600 text-white text-center py-1 text-xs font-bold animate-pulse">جاري تحميل البيانات المحلية...</div>
                )}

                <main className="flex-grow p-4 sm:p-6 overflow-y-auto pb-24 sm:pb-6">
                    <React.Suspense fallback={<div className="flex justify-center p-12"><ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600"/></div>}>
                        {currentPage === 'home' && <HomePage onOpenAdminTaskModal={setIsAdminTaskModalOpen as any} showContextMenu={(e, items) => setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, menuItems: items })} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
                        {currentPage === 'admin-tasks' && <HomePage onOpenAdminTaskModal={setIsAdminTaskModalOpen as any} showContextMenu={(e, items) => setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, menuItems: items })} mainView="adminTasks" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
                        {currentPage === 'clients' && <ClientsPage showContextMenu={(e, items) => setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, menuItems: items })} onOpenAdminTaskModal={setIsAdminTaskModalOpen as any} onCreateInvoice={(cid, csid) => { setCurrentPage('accounting'); }} />}
                        {currentPage === 'accounting' && <AccountingPage clearInitialInvoiceData={() => {}} />}
                        {currentPage === 'settings' && <SettingsPage />}
                    </React.Suspense>
                </main>
                
                <MobileNavbar currentPage={currentPage} onNavigate={setCurrentPage} permissions={data.permissions} />
                <AdminTaskModal isOpen={isAdminTaskModalOpen} onClose={() => setIsAdminTaskModalOpen(false)} onSubmit={(t) => data.setAdminTasks(p => [...p, {...t, id: `task-${Date.now()}`, completed: false}])} assistants={data.assistants} />
                <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} menuItems={contextMenu.menuItems} onClose={() => setContextMenu(p => ({ ...p, isOpen: false }))} />
                <UnpostponedSessionsModal isOpen={data.showUnpostponedSessionsModal} onClose={() => data.setShowUnpostponedSessionsModal(false)} sessions={data.unpostponedSessions} onPostpone={data.postponeSession} assistants={data.assistants} />
                <NotificationCenter appointmentAlerts={data.triggeredAlerts} realtimeAlerts={data.realtimeAlerts} userApprovalAlerts={data.userApprovalAlerts} dismissAppointmentAlert={data.dismissAlert} dismissRealtimeAlert={data.dismissRealtimeAlert} dismissUserApprovalAlert={data.dismissUserApprovalAlert} />
            </div>
        </DataProvider>
    );
};

export default App;

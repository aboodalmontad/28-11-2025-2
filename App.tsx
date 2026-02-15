
import * as React from 'react';
// Fix: Use `import type` for Session and User as they are used as types, not values. This resolves module resolution errors in some environments.
import type { Session as AuthSession, User } from '@supabase/supabase-js';

// Lazy import ALL page components for code splitting.
const ClientsPage = React.lazy(() => import('./pages/ClientsPage'));
const HomePage = React.lazy(() => import('./pages/HomePage'));
const AccountingPage = React.lazy(() => import('./pages/AccountingPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const PendingApprovalPage = React.lazy(() => import('./pages/PendingApprovalPage'));
const SubscriptionExpiredPage = React.lazy(() => import('./pages/SubscriptionExpiredPage'));


import ConfigurationModal from './components/ConfigurationModal';
import { useSupabaseData, SyncStatus } from './hooks/useSupabaseData';
import { UserIcon, CalculatorIcon, Cog6ToothIcon, NoSymbolIcon, PowerIcon, PrintIcon, ShareIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, ExclamationCircleIcon, ArrowPathIcon, CloudArrowDownIcon } from './components/icons';
import ContextMenu, { MenuItem } from './components/ContextMenu';
import AdminTaskModal from './components/AdminTaskModal';
import { AdminTask, Profile, Client, Appointment, AccountingEntry, Invoice, CaseDocument, AppData, SiteFinancialEntry, Permissions } from './types';
import { getSupabaseClient } from './supabaseClient';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import UnpostponedSessionsModal from './components/UnpostponedSessionsModal';
import NotificationCenter, { RealtimeAlert } from './components/RealtimeNotifier';
import { IDataContext, DataProvider } from './context/DataContext';
import PrintableReport from './components/PrintableReport';
import { printElement } from './utils/printUtils';
import { formatDate, isSameDay } from './utils/dateUtils';
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
    isAutoSyncEnabled: boolean;
    homePageActions?: React.ReactNode;
    permissions: Permissions;
}> = ({ currentPage, onNavigate, onLogout, syncStatus, lastSyncError, isDirty, isOnline, onManualSync, profile, isAutoSyncEnabled, homePageActions, permissions }) => {
    
    const allNavItems = [
        { id: 'home', label: 'المفكرة', icon: CalendarDaysIcon, visible: permissions.can_view_agenda },
        { id: 'admin-tasks', label: 'المهام الإدارية', icon: ClipboardDocumentCheckIcon, visible: permissions.can_view_admin_tasks },
        { id: 'clients', label: 'الموكلين', icon: UserIcon, visible: permissions.can_view_clients || permissions.can_view_cases },
        { id: 'accounting', label: 'المحاسبة', icon: CalculatorIcon, visible: permissions.can_view_finance },
    ];

    const navItems = allNavItems.filter(item => item.visible);
    
    return (
        <header className="bg-white shadow-md p-2 sm:p-4 flex justify-between items-center no-print sticky top-0 z-30">
            <nav className="flex items-center gap-1 sm:gap-4 flex-wrap">
                <button onClick={() => permissions.can_view_agenda && onNavigate('home')} className="flex items-center" aria-label="العودة إلى الصفحة الرئيسية" disabled={!permissions.can_view_agenda}>
                    <div className="flex flex-col items-start sm:flex-row sm:items-baseline gap-0 sm:gap-2">
                        <h1 className="text-xl font-bold text-gray-800">مكتب المحامي</h1>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                            <span>الإصدار: 15-12-2025</span>
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
                {currentPage === 'home' && homePageActions}
            </nav>
            <div className="flex items-center gap-2 sm:gap-4">
                <SyncStatusIndicator 
                    status={syncStatus} 
                    lastError={lastSyncError} 
                    isDirty={isDirty} 
                    isOnline={isOnline}
                    onManualSync={onManualSync}
                    isAutoSyncEnabled={isAutoSyncEnabled}
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
        { id: 'home', label: 'المفكرة', icon: CalendarDaysIcon, visible: permissions.can_view_agenda },
        { id: 'admin-tasks', label: 'المهام', icon: ClipboardDocumentCheckIcon, visible: permissions.can_view_admin_tasks },
        { id: 'clients', label: 'الموكلين', icon: UserIcon, visible: permissions.can_view_clients || permissions.can_view_cases },
        { id: 'accounting', label: 'المحاسبة', icon: CalculatorIcon, visible: permissions.can_view_finance },
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

const OfflineBanner: React.FC = () => {
    const isOnline = useOnlineStatus();
    const [isVisible, setIsVisible] = React.useState(!isOnline);
    const [isRendered, setIsRendered] = React.useState(!isOnline);

    React.useEffect(() => {
        if (!isOnline) {
            setIsRendered(true);
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => {
                setIsRendered(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOnline]);
    
    if (!isRendered) return null;

    return (
        <div className={`no-print w-full bg-yellow-100 text-yellow-800 p-3 text-center text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`} role="status" aria-live="polite">
            <NoSymbolIcon className="w-5 h-5" />
            <span>أنت غير متصل بالإنترنت. التغييرات محفوظة محلياً وستتم مزامنتها تلقائياً عند عودة الاتصال.</span>
        </div>
    );
};


const LAST_USER_CACHE_KEY = 'lawyerAppLastUser';
const LAST_USER_CREDENTIALS_CACHE_KEY = 'lawyerAppLastUserCredentials';
const UNPOSTPONED_MODAL_SHOWN_KEY = 'lawyerAppUnpostponedModalShown';

const FullScreenLoader: React.FC<{ text?: string; onAbort?: () => void }> = ({ text = 'جاري التحميل...', onAbort }) => (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]">
      <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
      <p className="mt-4 text-gray-600 font-bold">{text}</p>
      {onAbort && (
          <button onClick={onAbort} className="mt-8 text-sm text-red-600 hover:underline">إلغاء وتسجيل الخروج</button>
      )}
    </div>
);

const App: React.FC<AppProps> = ({ onRefresh }) => {
    const [session, setSession] = React.useState<AuthSession | null>(() => {
        if (typeof window !== 'undefined') {
            try {
                const lastUserRaw = localStorage.getItem(LAST_USER_CACHE_KEY);
                if (lastUserRaw) {
                    const user = JSON.parse(lastUserRaw) as User;
                    return { access_token: "optimistic_access_token", refresh_token: "optimistic_refresh_token", expires_in: 86400, token_type: "bearer", user } as AuthSession;
                }
            } catch (e) {}
        }
        return null;
    });

    const [isAuthLoading, setIsAuthLoading] = React.useState(!session);
    const [profile, setProfile] = React.useState<Profile | null>(null);
    const [showConfigModal, setShowConfigModal] = React.useState(false);

    const [currentPage, setCurrentPage] = React.useState<Page>('home');
    const [isAdminTaskModalOpen, setIsAdminTaskModalOpen] = React.useState(false);
    const [initialAdminTaskData, setInitialAdminTaskData] = React.useState<any>(null);
    const [contextMenu, setContextMenu] = React.useState<{ isOpen: boolean; position: { x: number; y: number }; menuItems: MenuItem[] }>({ isOpen: false, position: { x: 0, y: 0 }, menuItems: [] });
    const [initialInvoiceData, setInitialInvoiceData] = React.useState<{ clientId: string; caseId?: string } | undefined>();
    
    const [isPrintModalOpen, setIsPrintModalOpen] = React.useState(false);
    const [isPrintAssigneeModalOpen, setIsPrintAssigneeModalOpen] = React.useState(false);
    const [isShareAssigneeModalOpen, setIsShareAssigneeModalOpen] = React.useState(false);
    const [printableReportData, setPrintableReportData] = React.useState<any | null>(null);
    const [isActionsMenuOpen, setIsActionsMenuOpen] = React.useState(false);
    const [selectedDate, setSelectedDate] = React.useState(new Date());

    const printReportRef = React.useRef<HTMLDivElement>(null);
    const actionsMenuRef = React.useRef<HTMLDivElement>(null);

    const supabase = getSupabaseClient();
    const isOnline = useOnlineStatus();
    const data = useSupabaseData(session?.user ?? null, isAuthLoading);

    React.useEffect(() => {
        const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, newSession) => {
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setIsAuthLoading(false);
                localStorage.removeItem(LAST_USER_CACHE_KEY);
                localStorage.removeItem(LAST_USER_CREDENTIALS_CACHE_KEY);
            } else if (newSession) {
                setSession(newSession);
                setIsAuthLoading(false);
                localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(newSession.user));
            } else {
                setIsAuthLoading(false);
            }
        });
        
        const checkSession = async () => {
             if (!isOnline) { setIsAuthLoading(false); return; }
             try {
                const { data: { session: serverSession }, error } = await supabase!.auth.getSession();
                if (error) {
                    const errorMessage = error.message.toLowerCase();
                    if (errorMessage.includes("refresh token") || errorMessage.includes("not found")) await handleLogout();
                } else if (serverSession) {
                    setSession(serverSession);
                    localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(serverSession.user));
                }
             } catch (err: any) {
                 const errorMsg = String(err?.message || '').toLowerCase();
                 if (errorMsg.includes('refresh token') || errorMsg.includes('not found')) await handleLogout();
             } finally {
                 setIsAuthLoading(false);
             }
        };

        checkSession();
        return () => subscription.unsubscribe();
    }, [supabase, isOnline]);
    
    React.useEffect(() => {
        if (data.syncStatus === 'auth_error') handleLogout();
    }, [data.syncStatus]);

    React.useEffect(() => {
        if (session && data.profiles) {
            const userProfile = data.profiles.find(p => p.id === session.user.id);
            if (userProfile) setProfile(userProfile);
        } else { setProfile(null); }
        
        const modalShown = sessionStorage.getItem(UNPOSTPONED_MODAL_SHOWN_KEY);
        if (session && data.unpostponedSessions.length > 0 && !modalShown) {
            data.setShowUnpostponedSessionsModal(true);
            sessionStorage.setItem(UNPOSTPONED_MODAL_SHOWN_KEY, 'true');
        }
    }, [session, data.profiles, data.unpostponedSessions, data.setShowUnpostponedSessionsModal]);

    React.useEffect(() => {
        if (session) {
            import('./pages/ClientsPage');
            import('./pages/AccountingPage');
            import('./pages/SettingsPage');
            import('./pages/AdminDashboard');
            import('./pages/PendingApprovalPage');
            import('./pages/SubscriptionExpiredPage');
        }
    }, [session]);

    const handleLogout = async () => {
        try {
            localStorage.removeItem(LAST_USER_CACHE_KEY);
            localStorage.removeItem(LAST_USER_CREDENTIALS_CACHE_KEY);
            Object.keys(localStorage).forEach(key => { if (key.startsWith('sb-')) localStorage.removeItem(key); });
            setSession(null);
            setProfile(null);
            setIsAuthLoading(false);
            if (isOnline && supabase) await supabase.auth.signOut().catch(() => {});
        } catch (error) {} finally { onRefresh(); }
    };
    
    const handleLoginSuccess = (user: User, isOfflineLogin: boolean = false) => {
        if (!isOfflineLogin) localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(user));
        if (isOfflineLogin) {
             const offlineSession = { access_token: "offline_access_token", refresh_token: "offline_refresh_token", expires_in: 3600 * 24 * 7, token_type: "bearer", user } as AuthSession;
             setSession(offlineSession);
        }
    };

    if (showConfigModal) return <ConfigurationModal onRetry={() => { data.manualSync(); setShowConfigModal(false); }} />;
    if (data.syncStatus === 'unconfigured' || data.syncStatus === 'uninitialized') return <ConfigurationModal onRetry={data.manualSync} />;
    
    if (isAuthLoading && !session) return <FullScreenLoader text="جاري التحقق من الجلسة..." />;
    if (data.isDataLoading && session) return <FullScreenLoader text="جاري تحميل البيانات المحلية..." onAbort={handleLogout} />;
    
    if (!session) return (
        <React.Suspense fallback={<FullScreenLoader />}>
            <LoginPage onForceSetup={() => setShowConfigModal(true)} onLoginSuccess={handleLoginSuccess}/>
        </React.Suspense>
    );
    
    const effectiveProfile = profile || data.profiles.find(p => p.id === session.user.id);
    
    // First time login state: No profile locally but session exists
    if (!effectiveProfile) {
         if (isOnline) {
             return (
                 <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                    <CloudArrowDownIcon className="w-20 h-20 text-blue-500 mb-6 animate-bounce" />
                    <h2 className="text-2xl font-bold mb-3 text-gray-800">مرحباً بك في أول دخول لك!</h2>
                    <p className="text-gray-600 mb-8 max-w-sm">نحن بحاجة لمزامنة ملفك الشخصي وبياناتك من السحابة للبدء بالعمل محلياً.</p>
                    <div className="flex flex-col gap-3 w-full max-w-xs">
                        <button 
                            onClick={() => data.manualSync()} 
                            disabled={data.syncStatus === 'syncing'}
                            className="flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {data.syncStatus === 'syncing' ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <ArrowPathIcon className="w-5 h-5" />}
                            <span>بدء المزامنة الآن</span>
                        </button>
                        <button onClick={handleLogout} className="px-6 py-3 bg-gray-100 text-gray-600 font-semibold rounded-xl hover:bg-gray-200 transition-all">تسجيل الخروج</button>
                    </div>
                    {data.syncStatus === 'error' && <p className="mt-4 text-red-600 text-sm font-bold flex items-center gap-2"><ExclamationCircleIcon className="w-4 h-4"/> فشل الاتصال بالسحابة: {data.lastSyncError}</p>}
                 </div>
             );
         }
         return <FullScreenLoader text="بانتظار توفر ملفك الشخصي..." onAbort={handleLogout} />;
    }

    if (effectiveProfile && !effectiveProfile.mobile_verified && effectiveProfile.role !== 'admin') {
         return (
            <React.Suspense fallback={<FullScreenLoader />}>
                <LoginPage onForceSetup={() => setShowConfigModal(true)} onLoginSuccess={handleLoginSuccess} initialMode="otp" currentUser={session.user} currentMobile={effectiveProfile.mobile_number} onLogout={handleLogout} onVerificationSuccess={data.fetchAndRefresh} />
            </React.Suspense>
         );
    }

    if (effectiveProfile && !effectiveProfile.is_approved) {
        return (
            <React.Suspense fallback={<FullScreenLoader />}>
                <PendingApprovalPage onLogout={handleLogout} />
            </React.Suspense>
        );
    }

    if (effectiveProfile && (!effectiveProfile.is_active || (effectiveProfile.subscription_end_date && new Date(effectiveProfile.subscription_end_date) < new Date()))) {
        return (
            <React.Suspense fallback={<FullScreenLoader />}>
                <SubscriptionExpiredPage onLogout={handleLogout} />
            </React.Suspense>
        );
    }
    
    if (effectiveProfile && effectiveProfile.role === 'admin') {
         return (
            <DataProvider value={data}>
                <React.Suspense fallback={<FullScreenLoader />}>
                    <AdminDashboard onLogout={handleLogout} onOpenConfig={() => setShowConfigModal(true)} />
                </React.Suspense>
                <NotificationCenter appointmentAlerts={data.triggeredAlerts} realtimeAlerts={data.realtimeAlerts} userApprovalAlerts={data.userApprovalAlerts} dismissAppointmentAlert={data.dismissAlert} dismissRealtimeAlert={data.dismissRealtimeAlert} dismissUserApprovalAlert={data.dismissUserApprovalAlert} />
            </DataProvider>
        );
    }

    const renderPage = () => {
        const checkPermission = (allowed: boolean) => allowed;
        switch (currentPage) {
            case 'clients':
                if (!checkPermission(data.permissions.can_view_clients || data.permissions.can_view_cases)) return <HomePage onOpenAdminTaskModal={setIsAdminTaskModalOpen as any} showContextMenu={setContextMenu as any} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
                return <ClientsPage showContextMenu={setContextMenu as any} onOpenAdminTaskModal={setIsAdminTaskModalOpen as any} onCreateInvoice={setInitialInvoiceData as any} />;
            case 'accounting':
                if (!checkPermission(data.permissions.can_view_finance)) return <HomePage onOpenAdminTaskModal={setIsAdminTaskModalOpen as any} showContextMenu={setContextMenu as any} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
                return <AccountingPage initialInvoiceData={initialInvoiceData} clearInitialInvoiceData={() => setInitialInvoiceData(undefined)} />;
            case 'settings': return <SettingsPage />;
            case 'admin-tasks':
                if (!checkPermission(data.permissions.can_view_admin_tasks)) return <HomePage onOpenAdminTaskModal={setIsAdminTaskModalOpen as any} showContextMenu={setContextMenu as any} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
                return <HomePage onOpenAdminTaskModal={setIsAdminTaskModalOpen as any} showContextMenu={setContextMenu as any} mainView="adminTasks" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
            case 'home':
            default:
                if (!checkPermission(data.permissions.can_view_agenda)) return <div className="flex flex-col items-center justify-center h-full text-center text-gray-500"><ExclamationCircleIcon className="w-16 h-16 text-gray-300 mb-4" /><p className="text-lg font-semibold">ليس لديك صلاحية لعرض المفكرة.</p></div>;
                return <HomePage onOpenAdminTaskModal={setIsAdminTaskModalOpen as any} showContextMenu={setContextMenu as any} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
        }
    };
    
    const homePageActions = (
        <div ref={actionsMenuRef} className="relative">
            <button onClick={() => setIsActionsMenuOpen(prev => !prev)} className="p-2 text-gray-600 rounded-full hover:bg-gray-100 transition-colors" aria-label="إجراءات جدول الأعمال" aria-haspopup="true" aria-expanded={isActionsMenuOpen}><PrintIcon className="w-5 h-5" /></button>
            {isActionsMenuOpen && (
                <div className="absolute left-0 mt-2 w-56 origin-top-left bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-20">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        <button onClick={() => { setIsPrintAssigneeModalOpen(true); setIsActionsMenuOpen(false); }} className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem"><PrintIcon className="w-5 h-5 text-gray-500" /><span>طباعة جدول الأعمال</span></button>
                        <button onClick={() => { setIsShareAssigneeModalOpen(true); setIsActionsMenuOpen(false); }} className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100" role="menuitem"><ShareIcon className="w-5 h-5 text-gray-500" /><span>إرسال عبر واتساب</span></button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <DataProvider value={data}>
            <div className="flex flex-col h-screen bg-gray-50">
                <Navbar currentPage={currentPage} onNavigate={setCurrentPage as any} onLogout={handleLogout} syncStatus={data.syncStatus} lastSyncError={data.lastSyncError} isDirty={data.isDirty} isOnline={isOnline} onManualSync={data.manualSync} profile={effectiveProfile} isAutoSyncEnabled={data.isAutoSyncEnabled} homePageActions={homePageActions} permissions={data.permissions} />
                <OfflineBanner />
                <main className="flex-grow p-4 sm:p-6 overflow-y-auto pb-20 sm:pb-6">
                    <React.Suspense fallback={<FullScreenLoader />}>
                        {renderPage()}
                    </React.Suspense>
                </main>
                <MobileNavbar currentPage={currentPage} onNavigate={setCurrentPage as any} permissions={data.permissions} />
                <AdminTaskModal isOpen={isAdminTaskModalOpen} onClose={() => setIsAdminTaskModalOpen(false)} onSubmit={() => {}} initialData={initialAdminTaskData} assistants={data.assistants} />
                <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} menuItems={contextMenu.menuItems} onClose={() => setContextMenu({ ...contextMenu, isOpen: false })} />
                <UnpostponedSessionsModal isOpen={data.showUnpostponedSessionsModal} onClose={() => data.setShowUnpostponedSessionsModal(false)} sessions={data.unpostponedSessions} onPostpone={data.postponeSession} assistants={data.assistants} />
                <NotificationCenter appointmentAlerts={data.triggeredAlerts} realtimeAlerts={data.realtimeAlerts} userApprovalAlerts={data.userApprovalAlerts} dismissAppointmentAlert={data.dismissAlert} dismissRealtimeAlert={data.dismissRealtimeAlert} dismissUserApprovalAlert={data.dismissUserApprovalAlert} />
            </div>
        </DataProvider>
    );
};

export default App;

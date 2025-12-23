
import * as React from 'react';
import type { Session as AuthSession, User } from '@supabase/supabase-js';

import ConfigurationModal from './components/ConfigurationModal';
import { useSupabaseData, SyncStatus } from './hooks/useSupabaseData';
import { UserIcon, CalculatorIcon, Cog6ToothIcon, NoSymbolIcon, PowerIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, ExclamationTriangleIcon, ArrowPathIcon } from './components/icons';
import ContextMenu, { MenuItem } from './components/ContextMenu';
import AdminTaskModal from './components/AdminTaskModal';
import { AdminTask, Profile, Permissions } from './types';
import { getSupabaseClient } from './supabaseClient';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import NotificationCenter from './components/RealtimeNotifier';
import { DataProvider } from './context/DataContext';
import SyncStatusIndicator from './components/SyncStatusIndicator';

// Helper for lazy loading with enhanced retry logic to fix "Failed to fetch dynamically imported module"
function lazyWithRetry(componentImport: () => Promise<any>, retries = 5) {
  return React.lazy(async () => {
    for (let i = 0; i < retries; i++) {
      try {
        return await componentImport();
      } catch (error) {
        if (i === retries - 1) throw error;
        console.warn(`Chunk load failed (attempt ${i + 1}/${retries}), retrying in 2s...`, error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    return await componentImport();
  });
}

const ClientsPage = lazyWithRetry(() => import('./pages/ClientsPage'));
const HomePage = lazyWithRetry(() => import('./pages/HomePage'));
const AccountingPage = lazyWithRetry(() => import('./pages/AccountingPage'));
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage'));
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const AdminDashboard = lazyWithRetry(() => import('./pages/AdminDashboard'));
const PendingApprovalPage = lazyWithRetry(() => import('./pages/PendingApprovalPage'));
const SubscriptionExpiredPage = lazyWithRetry(() => import('./pages/SubscriptionExpiredPage'));

// Explicitly defined Props and State interfaces for ErrorBoundary
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// ErrorBoundary class to catch render and chunk-load errors
// Fix: Ensured inheritance from React.Component with explicit generic types to resolve "Property 'props' does not exist" error.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any, errorInfo: any) { console.error("ErrorBoundary caught an error", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 text-center">
            <div className="bg-white p-8 rounded-lg shadow-lg border border-red-100 max-w-md">
                <ExclamationTriangleIcon className="w-16 h-16 text-red-600 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-800 mb-4">عذراً، حدث خطأ غير متوقع</h1>
                <p className="text-gray-600 mb-8">قد يكون هذا بسبب ضعف في الاتصال بالإنترنت أو خطأ مؤقت في تحميل أحد مكونات النظام.</p>
                <button onClick={() => window.location.reload()} className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold shadow-md">تحديث الصفحة</button>
            </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
                            <span>الإصدار: 29-12-2025</span>
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
                    className={`p-2 rounded-full transition-colors ${currentPage === 'settings' ? 'bg-200 text-gray-800' : 'text-gray-500 hover:bg-gray-100'}`} 
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
        <div 
            className={`no-print w-full bg-yellow-100 text-yellow-800 p-3 text-center text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}
            role="status"
            aria-live="polite"
        >
            <NoSymbolIcon className="w-5 h-5" />
            <span>أنت غير متصل بالإنترنت. التغييرات محفوظة محلياً وستتم مزامنتها تلقائياً عند عودة الاتصال.</span>
        </div>
    );
};

const LAST_USER_CACHE_KEY = 'lawyerAppLastUser';

const FullScreenLoader: React.FC<{ text?: string }> = ({ text = 'جاري التحميل...' }) => (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]">
      <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
      <p className="mt-4 text-gray-600 font-bold">{text}</p>
    </div>
);

const App: React.FC<AppProps> = ({ onRefresh }) => {
    const [session, setSession] = React.useState<AuthSession | null>(() => {
        if (typeof window !== 'undefined') {
            try {
                const lastUserRaw = localStorage.getItem(LAST_USER_CACHE_KEY);
                if (lastUserRaw) {
                    const user = JSON.parse(lastUserRaw) as User;
                    return { access_token: "local", user } as AuthSession;
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
    const [selectedDate, setSelectedDate] = React.useState(new Date());

    const supabase = getSupabaseClient();
    const isOnline = useOnlineStatus();
    const data = useSupabaseData(session?.user ?? null, isAuthLoading);

    React.useEffect(() => {
        const checkAuth = async () => {
            // Early return if offline and we have a cached session to avoid hanging on getSession
            if (!isOnline && session?.user) {
                setIsAuthLoading(false);
                return;
            }

            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Auth Timeout")), 5000)
            );

            try {
                const sessionPromise = supabase!.auth.getSession();
                const raceResult = await Promise.race([sessionPromise, timeoutPromise]);
                const currentSession = (raceResult as any)?.data?.session;

                if (currentSession) {
                    setSession(currentSession);
                    localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(currentSession.user));
                } else if (!session?.user) {
                    setIsAuthLoading(false);
                }
            } catch (err) {
                console.warn("Auth check timed out or failed, using local session if available.", err);
            } finally {
                setIsAuthLoading(false);
            }
        };
        
        checkAuth();

        const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, newSession) => {
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setIsAuthLoading(false);
                localStorage.removeItem(LAST_USER_CACHE_KEY);
                localStorage.removeItem('lawyerAppLastUserCredentials');
            } else if (newSession) {
                setSession(newSession);
                setIsAuthLoading(false);
                localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(newSession.user));
            }
        });
        
        return () => subscription.unsubscribe();
    }, [supabase, isOnline]);

    React.useEffect(() => {
        if (session && data.profiles.length > 0) {
            const userProfile = data.profiles.find(p => p.id === session.user.id);
            setProfile(userProfile || null);
        }
    }, [session, data.profiles]);

    const handleLogout = async () => {
        localStorage.removeItem(LAST_USER_CACHE_KEY);
        localStorage.removeItem('lawyerAppLastUserCredentials');
        setSession(null);
        if (isOnline) await supabase!.auth.signOut();
        onRefresh();
    };

    const handleLoginSuccess = (user: User, isOffline = false) => {
        const newSession = { user, access_token: isOffline ? 'local' : 'active' } as AuthSession;
        setSession(newSession);
        localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(user));
    };

    if (!session && isAuthLoading) return <FullScreenLoader text="جاري التحقق من الهوية..." />;
    
    if (!session) {
        return (
            <ErrorBoundary>
                <React.Suspense fallback={<FullScreenLoader />}>
                    <LoginPage onForceSetup={() => setShowConfigModal(true)} onLoginSuccess={handleLoginSuccess}/>
                </React.Suspense>
            </ErrorBoundary>
        );
    }

    if (showConfigModal) return <ConfigurationModal onRetry={() => setShowConfigModal(false)} />;
    
    const effectiveProfile = profile || data.profiles.find(p => p.id === session.user.id);
    
    if (effectiveProfile && effectiveProfile.role === 'admin') {
         return (
            <DataProvider value={data}>
                <ErrorBoundary>
                    <React.Suspense fallback={<FullScreenLoader />}>
                        <AdminDashboard onLogout={handleLogout} onOpenConfig={() => setShowConfigModal(true)} />
                    </React.Suspense>
                </ErrorBoundary>
            </DataProvider>
        );
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'clients': return <ClientsPage showContextMenu={(e, items) => setContextMenu({isOpen: true, position: {x: e.clientX, y: e.clientY}, menuItems: items})} onOpenAdminTaskModal={(d) => {setInitialAdminTaskData(d); setIsAdminTaskModalOpen(true);}} onCreateInvoice={(c, cs) => {setInitialInvoiceData({clientId: c, caseId: cs}); setCurrentPage('accounting');}} />;
            case 'accounting': return <AccountingPage initialInvoiceData={initialInvoiceData} clearInitialInvoiceData={() => setInitialInvoiceData(undefined)} />;
            case 'settings': return <SettingsPage />;
            case 'admin-tasks': return <HomePage onOpenAdminTaskModal={(d) => {setInitialAdminTaskData(d); setIsAdminTaskModalOpen(true);}} showContextMenu={(e, items) => setContextMenu({isOpen: true, position: {x: e.clientX, y: e.clientY}, menuItems: items})} mainView="adminTasks" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
            case 'home':
            default: return <HomePage onOpenAdminTaskModal={(d) => {setInitialAdminTaskData(d); setIsAdminTaskModalOpen(true);}} showContextMenu={(e, items) => setContextMenu({isOpen: true, position: {x: e.clientX, y: e.clientY}, menuItems: items})} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
        }
    };

    return (
        <DataProvider value={data}>
            <ErrorBoundary>
                <div className="flex flex-col h-screen bg-gray-50">
                    <Navbar currentPage={currentPage} onNavigate={setCurrentPage} onLogout={handleLogout} syncStatus={data.syncStatus} lastSyncError={data.lastSyncError} isDirty={data.isDirty} isOnline={isOnline} onManualSync={data.manualSync} profile={effectiveProfile || null} isAutoSyncEnabled={data.isAutoSyncEnabled} permissions={data.permissions} />
                    <OfflineBanner />
                    <main className="flex-grow p-4 sm:p-6 overflow-y-auto pb-20 sm:pb-6">
                        <React.Suspense fallback={<FullScreenLoader />}>
                            {renderPage()}
                        </React.Suspense>
                    </main>
                    <MobileNavbar currentPage={currentPage} onNavigate={setCurrentPage} permissions={data.permissions} />
                    <AdminTaskModal isOpen={isAdminTaskModalOpen} onClose={() => setIsAdminTaskModalOpen(false)} onSubmit={(t) => { data.setAdminTasks(prev => [...prev, {...t, id: t.id || `t-${Date.now()}`, completed: false} as AdminTask]); setIsAdminTaskModalOpen(false); }} initialData={initialAdminTaskData} assistants={data.assistants} />
                    <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} menuItems={contextMenu.menuItems} onClose={() => setContextMenu({...contextMenu, isOpen: false})} />
                    <NotificationCenter appointmentAlerts={data.triggeredAlerts} realtimeAlerts={data.realtimeAlerts} userApprovalAlerts={data.userApprovalAlerts} dismissAppointmentAlert={data.dismissAlert} dismissRealtimeAlert={data.dismissRealtimeAlert} dismissUserApprovalAlert={data.dismissUserApprovalAlert} />
                </div>
            </ErrorBoundary>
        </DataProvider>
    );
};

export default App;

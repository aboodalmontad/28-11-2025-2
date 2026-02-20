
import * as React from 'react';
import type { Session as AuthSession, User } from '@supabase/supabase-js';

// Static imports with extensions to fix ESM resolution errors in the browser.
import ClientsPage from './pages/ClientsPage.tsx';
import HomePage from './pages/HomePage.tsx';
import AccountingPage from './pages/AccountingPage.tsx';
import SettingsPage from './pages/SettingsPage.tsx';
import LoginPage from './pages/LoginPage.tsx';
import AdminDashboard from './pages/AdminDashboard.tsx';
import PendingApprovalPage from './pages/PendingApprovalPage.tsx';
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage.tsx';

import ConfigurationModal from './components/ConfigurationModal.tsx';
import { useSupabaseData, SyncStatus } from './hooks/useSupabaseData.ts';
import { UserIcon, CalculatorIcon, Cog6ToothIcon, NoSymbolIcon, PowerIcon, PrintIcon, ShareIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, ExclamationCircleIcon, ArrowPathIcon } from './components/icons.tsx';
import ContextMenu, { MenuItem } from './components/ContextMenu.tsx';
import AdminTaskModal from './components/AdminTaskModal.tsx';
import { AdminTask, Profile, Client, Appointment, AccountingEntry, Invoice, CaseDocument, AppData, SiteFinancialEntry, Permissions } from './types.ts';
import { getSupabaseClient } from './supabaseClient.ts';
import { useOnlineStatus } from './hooks/useOnlineStatus.ts';
import UnpostponedSessionsModal from './components/UnpostponedSessionsModal.tsx';
import NotificationCenter, { RealtimeAlert } from './components/RealtimeNotifier.tsx';
import { DataProvider } from './context/DataContext.tsx';
import PrintableReport from './components/PrintableReport.tsx';
import { printElement } from './utils/printUtils.ts';
import { formatDate, isSameDay } from './utils/dateUtils.ts';
import SyncStatusIndicator from './components/SyncStatusIndicator.tsx';

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
                            <span>الإصدار: 20-02-2026</span>
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
const LAST_USER_CREDENTIALS_CACHE_KEY = 'lawyerAppLastUserCredentials';
const UNPOSTPONED_MODAL_SHOWN_KEY = 'lawyerAppUnpostponedModalShown';

const FullScreenLoader: React.FC<{ text?: string; subtext?: string; children?: React.ReactNode; isError?: boolean }> = ({ text = 'جاري التحميل...', subtext, children, isError }) => (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100] p-6 text-center">
      {isError ? (
        <ExclamationCircleIcon className="w-12 h-12 text-red-500 mb-4" />
      ) : (
        <ArrowPathIcon className="w-12 h-12 text-blue-600 animate-spin mb-4" />
      )}
      <h2 className={`text-xl font-bold ${isError ? 'text-red-700' : 'text-gray-800'}`}>{text}</h2>
      {subtext && <p className="mt-2 text-gray-500 text-sm max-w-xs mx-auto">{subtext}</p>}
      <div className="mt-8">{children}</div>
    </div>
);

const App: React.FC<AppProps> = ({ onRefresh }) => {
    const [session, setSession] = React.useState<AuthSession | null>(() => {
        if (typeof window !== 'undefined') {
            try {
                const lastUserRaw = localStorage.getItem(LAST_USER_CACHE_KEY);
                if (lastUserRaw) {
                    const user = JSON.parse(lastUserRaw) as User;
                    return {
                        access_token: "optimistic_access_token",
                        refresh_token: "optimistic_refresh_token",
                        expires_in: 86400,
                        token_type: "bearer",
                        user: user
                    } as AuthSession;
                }
            } catch (e) {
                console.error("Failed to parse cached user session:", e);
            }
        }
        return null;
    });

    const [isAuthLoading, setIsAuthLoading] = React.useState(!session);
    const [profile, setProfile] = React.useState<Profile | null>(null);
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
    const [showTroubleshooting, setShowTroubleshooting] = React.useState(false);

    const printReportRef = React.useRef<HTMLDivElement>(null);
    const actionsMenuRef = React.useRef<HTMLDivElement>(null);

    const supabase = getSupabaseClient();
    const isOnline = useOnlineStatus();

    const data = useSupabaseData(session?.user ?? null, isAuthLoading);

    React.useEffect(() => {
        if (!supabase) {
            console.error("Supabase client is null. Cannot subscribe to auth changes.");
            return;
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (event === 'SIGNED_OUT') {
                // Only clear session if we are sure it's a deliberate sign out or permanent failure.
                // If we are currently syncing or have a local session, we might want to be more cautious.
                
                // Check if this was an explicit logout from this tab or another tab
                const isExplicitLogout = localStorage.getItem('lawyerAppLoggedOut') === 'true';
                
                if (!isExplicitLogout) {
                    // If not explicit, it might be a transient network error triggering SIGNED_OUT.
                    // We verify by checking the session again.
                    
                    // If we are offline, we definitely don't trust a SIGNED_OUT event from Supabase
                    if (!navigator.onLine) {
                        console.warn("Received SIGNED_OUT while offline. Ignoring to preserve local session.");
                        return;
                    }

                    supabase.auth.getSession().then(({ data: { session: verifiedSession }, error }) => {
                        if (error) {
                            const errMsg = error.message.toLowerCase();
                            // If it's a network error, ignore the SIGNED_OUT event
                            if (errMsg.includes("fetch") || errMsg.includes("network") || errMsg.includes("connection")) {
                                console.warn("Session verification failed with network error, keeping local session.");
                                return;
                            }
                        }

                        if (!verifiedSession) {
                            console.warn("Session truly lost after verification, logging out.");
                            setSession(null);
                            setIsAuthLoading(false);
                            localStorage.removeItem(LAST_USER_CACHE_KEY);
                            localStorage.removeItem(LAST_USER_CREDENTIALS_CACHE_KEY);
                            localStorage.setItem('lawyerAppLoggedOut', 'true');
                        } else {
                            console.log("SIGNED_OUT event was a false alarm, session still exists.");
                            setSession(verifiedSession);
                        }
                    }).catch((err) => {
                        console.warn("Error during session verification:", err);
                        // On unexpected error, we stay logged in if we have a session
                    });
                    return;
                }

                setSession(null);
                setIsAuthLoading(false);
                localStorage.removeItem(LAST_USER_CACHE_KEY);
                localStorage.removeItem(LAST_USER_CREDENTIALS_CACHE_KEY);
                localStorage.setItem('lawyerAppLoggedOut', 'true');
            } else if (newSession) {
                setSession(newSession);
                setIsAuthLoading(false);
                localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(newSession.user));
                localStorage.removeItem('lawyerAppLoggedOut');
            } else {
                setIsAuthLoading(false);
            }
        });
        
        const checkSession = async () => {
             if (!isOnline || !supabase) {
                 setIsAuthLoading(false);
                 return;
             }

             try {
                const { data: { session: serverSession }, error } = await supabase.auth.getSession();
                
                if (error) {
                    const errorMessage = error.message.toLowerCase();
                    // Only log out for explicit, permanent auth errors
                    if (errorMessage.includes("refresh token") || errorMessage.includes("not found") || errorMessage.includes("invalid claim")) {
                        console.warn("Session invalid, logging out:", errorMessage);
                        localStorage.removeItem(LAST_USER_CACHE_KEY);
                        localStorage.removeItem(LAST_USER_CREDENTIALS_CACHE_KEY);
                        Object.keys(localStorage).forEach(key => {
                            if (key.startsWith('sb-')) localStorage.removeItem(key);
                        });
                        await supabase!.auth.signOut().catch(() => {}); 
                        setSession(null);
                        onRefresh(); 
                    } else {
                         // For network errors or other temporary issues, DO NOT log out.
                         console.warn("Session check failed with non-critical error, keeping local session:", errorMessage);
                    }
                } else if (serverSession) {
                    setSession(serverSession);
                    localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(serverSession.user));
                } else {
                    // If serverSession is null, it might be a transient issue during sync or refresh.
                    // We DON'T log out here immediately if we already have a session state.
                    // Instead, we let the data requests fail with 401 if the session is truly gone.
                    if (session) {
                        console.warn("serverSession is null but local session exists. Keeping local session for now.");
                    }
                }
             } catch (err) {
                 console.warn("Unexpected error during session check:", err);
             } finally {
                 setIsAuthLoading(false);
             }
        };

        checkSession();
        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [supabase, onRefresh, isOnline]);

    React.useEffect(() => {
        if (session && data.profiles) {
            const userProfile = data.profiles.find(p => p.id === session.user.id);
            setProfile(userProfile || null);
        } else {
            setProfile(null);
        }
        
        const modalShown = sessionStorage.getItem(UNPOSTPONED_MODAL_SHOWN_KEY);
        if (session && data.unpostponedSessions.length > 0 && !modalShown) {
            data.setShowUnpostponedSessionsModal(true);
            sessionStorage.setItem(UNPOSTPONED_MODAL_SHOWN_KEY, 'true');
        }
    }, [session, data.profiles, data.unpostponedSessions, data.setShowUnpostponedSessionsModal]);

    React.useEffect(() => {
        const justUpdated = localStorage.getItem('lawyerAppUpdated');
        if (justUpdated === 'true') {
            data.addRealtimeAlert('تم تحديث التطبيق إلى آخر إصدار بنجاح', 'sync');
            localStorage.removeItem('lawyerAppUpdated');
        }
    }, [data.addRealtimeAlert]);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
                setIsActionsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Timer to show troubleshooting if profile loading hangs
    React.useEffect(() => {
        let timer: number | undefined;
        // Show troubleshooting if loading for more than 5 seconds or if sync error exists
        if (session && !profile && (!data.isDataLoading || data.syncStatus === 'error')) {
             timer = window.setTimeout(() => {
                setShowTroubleshooting(true);
             }, data.syncStatus === 'error' ? 0 : 5000);
        } else if (profile) {
            setShowTroubleshooting(false);
        }
        return () => clearTimeout(timer);
    }, [session, profile, data.isDataLoading, data.syncStatus]);
    
    const handleLogout = async () => {
        try {
            localStorage.setItem('lawyerAppLoggedOut', 'true');
            localStorage.removeItem(LAST_USER_CACHE_KEY);
            localStorage.removeItem(LAST_USER_CREDENTIALS_CACHE_KEY);
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) localStorage.removeItem(key);
            });
            setSession(null);
            setProfile(null);
            setIsAuthLoading(false);
            await supabase!.auth.signOut();
        } catch (error) {
            console.warn("Logout network failed, state cleared anyway:", error);
        } finally {
            onRefresh();
        }
    };
    
    const handleNavigation = (page: Page) => setCurrentPage(page);
    const handleOpenAdminTaskModal = (initialData: any = null) => {
        setInitialAdminTaskData(initialData);
        setIsAdminTaskModalOpen(true);
    };

    const handleSaveAdminTask = (taskData: Omit<AdminTask, 'completed'> & { id?: string }) => {
        if (taskData.id) {
            data.setAdminTasks(prev => prev.map(t => t.id === taskData.id ? { ...t, ...taskData, updated_at: new Date() } : t));
        } else {
            const { id, ...restOfTaskData } = taskData;
            const newLocation = restOfTaskData.location || 'غير محدد';
            const maxOrderIndex = data.adminTasks
                .filter(t => (t.location || 'غير محدد') === newLocation)
                .reduce((max, t) => Math.max(max, t.orderIndex || 0), -1);

            const newTask: AdminTask = {
                id: `task-${Date.now()}`,
                ...restOfTaskData,
                completed: false,
                orderIndex: maxOrderIndex + 1,
                updated_at: new Date(),
            };
            data.setAdminTasks(prev => [...prev, newTask]);
        }
        setIsAdminTaskModalOpen(false);
    };

    const showContextMenu = (event: React.MouseEvent, menuItems: MenuItem[]) => {
        event.preventDefault();
        setContextMenu({ isOpen: true, position: { x: event.clientX, y: event.clientY }, menuItems });
    };

    const handleCreateInvoice = (clientId: string, caseId?: string) => {
        setInitialInvoiceData({ clientId, caseId });
        setCurrentPage('accounting');
    };

    const handleGenerateAssigneeReport = (assignee: string | null) => {
        const dailyAppointments = data.appointments
            .filter(a => isSameDay(a.date, selectedDate))
            .sort((a, b) => a.time.localeCompare(b.time));
    
        const dailySessions = data.allSessions.filter(s => isSameDay(s.date, selectedDate));
        const allUncompletedTasks = data.adminTasks.filter(t => !t.completed);
        const filteredForAssigneeTasks = assignee ? allUncompletedTasks.filter(t => t.assignee === assignee) : allUncompletedTasks;
        const groupedAndSortedTasks = filteredForAssigneeTasks.reduce((acc, task) => {
            const location = task.location || 'غير محدد';
            if (!acc[location]) acc[location] = [];
            acc[location].push(task);
            return acc;
        }, {} as Record<string, AdminTask[]>);
    
        const importanceOrder = { 'urgent': 3, 'important': 2, 'normal': 1 };
        for (const location in groupedAndSortedTasks) {
            groupedAndSortedTasks[location].sort((a, b) => {
                const importanceA = importanceOrder[a.importance];
                const importanceB = importanceOrder[b.importance];
                if (importanceA !== importanceB) return importanceB - importanceA;
                return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
            });
        }
    
        setPrintableReportData({
            assignee: assignee || 'جدول الأعمال العام',
            date: selectedDate,
            appointments: assignee ? dailyAppointments.filter(a => a.assignee === assignee) : dailyAppointments,
            sessions: assignee ? dailySessions.filter(s => s.assignee === assignee) : dailySessions,
            adminTasks: groupedAndSortedTasks,
        });
        setIsPrintAssigneeModalOpen(false);
        setIsPrintModalOpen(true);
    };

    const handleShareAssigneeReport = (assignee: string | null) => {
        const dailyAppointments = data.appointments.filter(a => isSameDay(a.date, selectedDate)).sort((a, b) => a.time.localeCompare(b.time));
        const dailySessions = data.allSessions.filter(s => isSameDay(s.date, selectedDate));
        const allUncompletedTasks = data.adminTasks.filter(t => !t.completed);
        const filteredForAssigneeTasks = assignee ? allUncompletedTasks.filter(t => t.assignee === assignee) : allUncompletedTasks;
        const groupedAndSortedTasks = filteredForAssigneeTasks.reduce((acc, task) => {
            const location = task.location || 'غير محدد';
            if (!acc[location]) acc[location] = [];
            acc[location].push(task);
            return acc;
        }, {} as Record<string, AdminTask[]>);
        
        let message = `*جدول أعمال مكتب المحامي*\n*التاريخ:* ${formatDate(selectedDate)}\n*لـِ:* ${assignee || 'الجميع'}\n\n`;
        const filteredSessions = assignee ? dailySessions.filter(s => s.assignee === assignee) : dailySessions;
        if (filteredSessions.length > 0) {
            message += `*القسم الأول: الجلسات (${filteredSessions.length})*\n`;
            filteredSessions.forEach(s => { message += `- (${s.court}) قضية ${s.clientName} ضد ${s.opponentName} (أساس: ${s.caseNumber}).\n`; });
            message += `\n`;
        }
        
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
        setIsShareAssigneeModalOpen(false);
    };

    if (isAuthLoading && !session) return <FullScreenLoader text="جاري التحقق من الهوية..." />;
    if (data.isDataLoading && session && !data.lastSyncError) return <FullScreenLoader text="جاري جلب بيانات المكتب..." />;

    const handleLoginSuccess = (user: User, isOfflineLogin: boolean = false) => {
        localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(user));
        if (isOfflineLogin) {
             setSession({ 
                 access_token: "offline_access_token", 
                 refresh_token: "offline_refresh_token", 
                 expires_in: 86400, 
                 token_type: "bearer", 
                 user 
             } as AuthSession);
             setIsAuthLoading(false);
        }
        // For online login, onAuthStateChange will handle setSession
    };

    if (data.syncStatus === 'unconfigured' || data.syncStatus === 'uninitialized') return <ConfigurationModal onRetry={data.manualSync} />;
    if (!session) return <LoginPage onForceSetup={() => onRefresh()} onLoginSuccess={handleLoginSuccess}/>;
    
    const effectiveProfile = profile || data.profiles.find(p => p.id === session.user.id);
    
    if (!effectiveProfile) {
        return (
            <FullScreenLoader 
                text={data.syncStatus === 'error' ? "حدث خطأ في الاتصال" : (data.syncStatus === 'syncing' ? "جاري مزامنة بيانات الحساب..." : "جاري تحميل الملف الشخصي...")}
                subtext={data.lastSyncError || "إذا كنت تسجل الدخول لأول مرة، قد يستغرق الأمر لحظات لتحميل بياناتك."}
                isError={data.syncStatus === 'error'}
            >
                {showTroubleshooting && (
                    <div className="flex flex-col gap-3 animate-fade-in">
                        <p className="text-sm text-red-600 font-bold mb-2">
                           {data.syncStatus === 'error' ? 'فشل الاتصال بخادم قاعدة البيانات.' : 'يبدو أن التحميل يستغرق وقتاً أطول من المعتاد.'}
                        </p>
                        <div className="flex gap-4 justify-center">
                            <button onClick={() => { setShowTroubleshooting(false); data.manualSync(); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 shadow-sm">
                                <ArrowPathIcon className="w-4 h-4" /> <span>إعادة المحاولة</span>
                            </button>
                            <button onClick={handleLogout} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 shadow-sm">
                                <PowerIcon className="w-4 h-4" /> <span>تسجيل الخروج</span>
                            </button>
                        </div>
                    </div>
                )}
            </FullScreenLoader>
        );
    }

    if (!effectiveProfile.mobile_verified && effectiveProfile.role !== 'admin') {
         return <LoginPage onForceSetup={() => onRefresh()} onLoginSuccess={handleLoginSuccess} initialMode="otp" currentUser={session.user} currentMobile={effectiveProfile.mobile_number} onLogout={handleLogout} onVerificationSuccess={data.fetchAndRefresh} />;
    }
    if (!effectiveProfile.is_approved) return <PendingApprovalPage onLogout={handleLogout} />;
    if (!effectiveProfile.is_active || (effectiveProfile.subscription_end_date && new Date(effectiveProfile.subscription_end_date) < new Date())) return <SubscriptionExpiredPage onLogout={handleLogout} />;
    
    if (effectiveProfile.role === 'admin') {
         return (
            <DataProvider value={data}>
                <AdminDashboard onLogout={handleLogout} onOpenConfig={() => onRefresh()} />
                <NotificationCenter appointmentAlerts={data.triggeredAlerts} realtimeAlerts={data.realtimeAlerts} userApprovalAlerts={data.userApprovalAlerts} dismissAppointmentAlert={data.dismissAlert} dismissRealtimeAlert={data.dismissRealtimeAlert} dismissUserApprovalAlert={data.dismissUserApprovalAlert} />
            </DataProvider>
        );
    }

    const renderPage = () => {
        switch (currentPage) {
            case 'clients':
                if (!(data.permissions.can_view_clients || data.permissions.can_view_cases)) return <HomePage onOpenAdminTaskModal={handleOpenAdminTaskModal} showContextMenu={showContextMenu} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
                return <ClientsPage showContextMenu={showContextMenu} onOpenAdminTaskModal={handleOpenAdminTaskModal} onCreateInvoice={handleCreateInvoice} />;
            case 'accounting':
                if (!data.permissions.can_view_finance) return <HomePage onOpenAdminTaskModal={handleOpenAdminTaskModal} showContextMenu={showContextMenu} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
                return <AccountingPage initialInvoiceData={initialInvoiceData} clearInitialInvoiceData={() => setInitialInvoiceData(undefined)} />;
            case 'settings': return <SettingsPage />;
            case 'admin-tasks':
                if (!data.permissions.can_view_admin_tasks) return <HomePage onOpenAdminTaskModal={handleOpenAdminTaskModal} showContextMenu={showContextMenu} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
                return <HomePage onOpenAdminTaskModal={handleOpenAdminTaskModal} showContextMenu={showContextMenu} mainView="adminTasks" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
            default:
                if (!data.permissions.can_view_agenda) return <div className="flex flex-col items-center justify-center h-full text-center text-gray-500"><ExclamationCircleIcon className="w-16 h-16 text-gray-300 mb-4" /><p className="text-lg font-semibold">ليس لديك صلاحية لعرض المفكرة.</p></div>;
                return <HomePage onOpenAdminTaskModal={handleOpenAdminTaskModal} showContextMenu={showContextMenu} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />;
        }
    };
    
    const homePageActions = (
        <div ref={actionsMenuRef} className="relative">
            <button onClick={() => setIsActionsMenuOpen(prev => !prev)} className="p-2 text-gray-600 rounded-full hover:bg-gray-100 transition-colors"><PrintIcon className="w-5 h-5" /></button>
            {isActionsMenuOpen && (
                <div className="absolute left-0 mt-2 w-56 origin-top-left bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-20">
                    <div className="py-1">
                        <button onClick={() => { setIsPrintAssigneeModalOpen(true); setIsActionsMenuOpen(false); }} className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><PrintIcon className="w-5 h-5 text-gray-500" /><span>طباعة جدول الأعمال</span></button>
                        <button onClick={() => { setIsShareAssigneeModalOpen(true); setIsActionsMenuOpen(false); }} className="w-full text-right flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><ShareIcon className="w-5 h-5 text-gray-500" /><span>إرسال عبر واتساب</span></button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <DataProvider value={data}>
            <div className="flex flex-col h-screen bg-gray-50">
                <Navbar currentPage={currentPage} onNavigate={handleNavigation} onLogout={handleLogout} syncStatus={data.syncStatus} lastSyncError={data.lastSyncError} isDirty={data.isDirty} isOnline={isOnline} onManualSync={data.manualSync} profile={effectiveProfile} isAutoSyncEnabled={data.isAutoSyncEnabled} homePageActions={homePageActions} permissions={data.permissions} />
                <OfflineBanner />
                <main className="flex-grow p-4 sm:p-6 overflow-y-auto pb-20 sm:pb-6">{renderPage()}</main>
                <MobileNavbar currentPage={currentPage} onNavigate={handleNavigation} permissions={data.permissions} />
                <AdminTaskModal isOpen={isAdminTaskModalOpen} onClose={() => setIsAdminTaskModalOpen(false)} onSubmit={handleSaveAdminTask} initialData={initialAdminTaskData} assistants={data.assistants} />
                <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} menuItems={contextMenu.menuItems} onClose={() => setContextMenu({ ...contextMenu, isOpen: false })} />
                <UnpostponedSessionsModal isOpen={data.showUnpostponedSessionsModal} onClose={() => data.setShowUnpostponedSessionsModal(false)} sessions={data.unpostponedSessions} onPostpone={data.postponeSession} assistants={data.assistants} />
                <NotificationCenter appointmentAlerts={data.triggeredAlerts} realtimeAlerts={data.realtimeAlerts} userApprovalAlerts={data.userApprovalAlerts} dismissAppointmentAlert={data.dismissAlert} dismissRealtimeAlert={data.dismissRealtimeAlert} dismissUserApprovalAlert={data.dismissUserApprovalAlert} />
                {isPrintAssigneeModalOpen && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={() => setIsPrintAssigneeModalOpen(false)}><div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}><h2 className="text-xl font-bold mb-4 border-b pb-3">اختر الشخص لطباعة جدول الأعمال</h2><div className="space-y-3"><button onClick={() => handleGenerateAssigneeReport(null)} className="w-full text-right px-4 py-3 bg-blue-50 text-blue-800 font-semibold rounded-lg hover:bg-blue-100">طباعة جدول الأعمال العام</button>{data.assistants.map(name => <button key={name} onClick={() => handleGenerateAssigneeReport(name)} className="w-full text-right block px-4 py-2 bg-gray-50 text-gray-800 rounded-md hover:bg-gray-100">{name}</button>)}</div></div></div>}
                {isShareAssigneeModalOpen && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={() => setIsShareAssigneeModalOpen(false)}><div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}><h2 className="text-xl font-bold mb-4 border-b pb-3">اختر الشخص لإرسال جدول أعماله عبر واتساب</h2><div className="space-y-3"><button onClick={() => handleShareAssigneeReport(null)} className="w-full text-right px-4 py-3 bg-green-50 text-green-800 font-semibold rounded-lg hover:bg-green-100">إرسال جدول الأعمال العام</button>{data.assistants.map(name => <button key={name} onClick={() => handleShareAssigneeReport(name)} className="w-full text-right block px-4 py-2 bg-gray-50 text-gray-800 rounded-md hover:bg-gray-100">{name}</button>)}</div></div></div>}
                {isPrintModalOpen && <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setIsPrintModalOpen(false)}><div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}><div className="overflow-y-auto" ref={printReportRef}><PrintableReport reportData={printableReportData} /></div><div className="mt-6 flex justify-end gap-4 border-t pt-4 no-print"><button className="px-6 py-2 bg-gray-200 rounded-lg hover:bg-gray-300" onClick={() => setIsPrintModalOpen(false)}>إغلاق</button><button className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700" onClick={() => printElement(printReportRef.current)}><PrintIcon className="w-5 h-5" /><span>طباعة</span></button></div></div></div>}
            </div>
        </DataProvider>
    );
};

export default App;

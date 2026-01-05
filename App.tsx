
import * as React from 'react';
import type { Session as AuthSession, User } from '@supabase/supabase-js';

// 1. Lazy loaded components
const ClientsPage = React.lazy(() => import('./pages/ClientsPage'));
const HomePage = React.lazy(() => import('./pages/HomePage'));
const AccountingPage = React.lazy(() => import('./pages/AccountingPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const PendingApprovalPage = React.lazy(() => import('./pages/PendingApprovalPage'));
const SubscriptionExpiredPage = React.lazy(() => import('./pages/SubscriptionExpiredPage'));

// 2. Regular imports
import ConfigurationModal from './components/ConfigurationModal';
import { useSupabaseData } from './hooks/useSupabaseData';
import { UserIcon, CalculatorIcon, Cog6ToothIcon, NoSymbolIcon, PowerIcon, CalendarDaysIcon, ClipboardDocumentCheckIcon, ArrowPathIcon } from './components/icons';
import ContextMenu, { MenuItem } from './components/ContextMenu';
import AdminTaskModal from './components/AdminTaskModal';
import { Profile, SyncStatus, AdminTask } from './types';
import { getSupabaseClient } from './supabaseClient';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import UnpostponedSessionsModal from './components/UnpostponedSessionsModal';
import NotificationCenter from './components/RealtimeNotifier';
import { DataProvider } from './context/DataContext';
import SyncStatusIndicator from './components/SyncStatusIndicator';

// 3. Types and Constants
type Page = 'home' | 'admin-tasks' | 'clients' | 'accounting' | 'settings';

interface AppProps {
    onRefresh: () => void;
    key?: React.Key;
}

const LAST_USER_CACHE_KEY = 'lawyerAppLastUser';

// 4. Helper Components
const FullScreenLoader: React.FC<{ text?: string }> = ({ text = 'جاري التحميل...' }) => (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[100]">
      <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
      <p className="mt-4 text-gray-600 font-bold">{text}</p>
    </div>
);

const OfflineBanner: React.FC = () => {
    const isOnline = useOnlineStatus();
    if (isOnline) return null;
    return (
        <div className="bg-yellow-100 text-yellow-800 text-center p-2 text-xs font-bold border-b border-yellow-200 no-print">
            أنت غير متصل بالإنترنت. التغييرات ستحفظ محلياً وتتم مزامنتها عند العودة.
        </div>
    );
};

export default function App({ onRefresh }: AppProps) {
    const [session, setSession] = React.useState<AuthSession | null>(null);
    const [isAuthLoading, setIsAuthLoading] = React.useState(true);
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

    React.useEffect(() => {
        if (!supabase) {
            setIsAuthLoading(false);
            return;
        }

        const checkSession = async () => {
            try {
                // المحاولة الحقيقية لجلب الجلسة
                const { data: { session: currentSession }, error } = await supabase.auth.getSession();
                
                if (error) throw error;

                setSession(currentSession);
                if (currentSession) {
                    localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(currentSession.user));
                }
            } catch (e: any) {
                console.warn("Auth check failed, checking offline fallback:", e);
                // إذا فشل الجلب بسبب الشبكة (Failed to fetch)، نتحقق من وجود مستخدم مخزن محلياً
                const message = String(e?.message || '').toLowerCase();
                if (message.includes('fetch') || message.includes('network') || !navigator.onLine) {
                    const lastUserRaw = localStorage.getItem(LAST_USER_CACHE_KEY);
                    if (lastUserRaw) {
                        try {
                            const user = JSON.parse(lastUserRaw) as User;
                            // إنشاء جلسة وهمية للسماح بالدخول الأوفلاين
                            setSession({ user, access_token: 'offline', refresh_token: 'offline', expires_in: 3600 } as any);
                        } catch (parseErr) { console.error("Cache parse error", parseErr); }
                    }
                }
            } finally {
                setIsAuthLoading(false);
            }
        };

        checkSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            // نحدث الجلسة فقط إذا لم نكن في وضع الأوفلاين أو إذا كانت الجلسة الجديدة صالحة
            if (newSession || event === 'SIGNED_OUT') {
                setSession(newSession);
                if (newSession) {
                    localStorage.setItem(LAST_USER_CACHE_KEY, JSON.stringify(newSession.user));
                } else if (event === 'SIGNED_OUT') {
                    localStorage.removeItem(LAST_USER_CACHE_KEY);
                }
            }
            setIsAuthLoading(false);
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [supabase]);

    const data = useSupabaseData(session?.user ?? null, isAuthLoading);

    React.useEffect(() => {
        if (session && data.profiles.length > 0) {
            const userProfile = data.profiles.find(p => p.id === session.user.id);
            setProfile(userProfile || null);
        }
    }, [session, data.profiles]);

    const handleLogout = async () => {
        try {
            // تنفيذ الخروج محلياً أولاً لضمان سرعة الاستجابة
            localStorage.removeItem(LAST_USER_CACHE_KEY);
            setSession(null);
            
            // محاولة إبلاغ السيرفر بالخروج وتجاهل أي خطأ (مثل Failed to fetch)
            if (supabase && isOnline) {
                await supabase.auth.signOut().catch(err => console.warn("Network logout failed, but local logout succeeded.", err));
            }
            onRefresh();
        } catch (err) {
            console.error("Logout error:", err);
            onRefresh();
        }
    };

    const handleTaskSubmit = (taskData: Omit<AdminTask, 'id' | 'completed'> & { id?: string }) => {
        const now = new Date();
        if (taskData.id) {
            data.setAdminTasks((prev: AdminTask[]) => 
                prev.map(t => t.id === taskData.id ? { ...t, ...taskData, updated_at: now } : t)
            );
        } else {
            const newTask: AdminTask = {
                ...taskData,
                id: `task-${Date.now()}`,
                completed: false,
                updated_at: now,
                orderIndex: data.adminTasks.length
            };
            data.setAdminTasks((prev: AdminTask[]) => [...prev, newTask]);
        }
        setIsAdminTaskModalOpen(false);
    };

    if (isAuthLoading) return <FullScreenLoader text="جاري التحقق من الهوية..." />;
    
    if (!session) return <LoginPage onForceSetup={() => setShowConfigModal(true)} onLoginSuccess={(u) => setSession({ user: u } as any)}/>;
    
    if (data.isDataLoading && data.clients.length === 0) {
         return <FullScreenLoader text="جاري استعادة البيانات المحلية..." />;
    }

    if (showConfigModal || data.syncStatus === 'unconfigured' || data.syncStatus === 'uninitialized') {
        return <ConfigurationModal onRetry={() => { data.manualSync(); setShowConfigModal(false); }} />;
    }
    
    const effectiveProfile = profile || data.profiles.find(p => p.id === session.user.id);

    if (effectiveProfile) {
        if (!effectiveProfile.mobile_verified && effectiveProfile.role !== 'admin' && session.access_token !== 'offline') {
             return <LoginPage onForceSetup={() => setShowConfigModal(true)} onLoginSuccess={() => {}} initialMode="otp" currentUser={session.user} currentMobile={effectiveProfile.mobile_number} onLogout={handleLogout} onVerificationSuccess={data.fetchAndRefresh} />;
        }
        if (!effectiveProfile.is_approved && session.access_token !== 'offline') return <PendingApprovalPage onLogout={handleLogout} />;
        if ((!effectiveProfile.is_active || (effectiveProfile.subscription_end_date && new Date(effectiveProfile.subscription_end_date) < new Date())) && session.access_token !== 'offline') {
            return <SubscriptionExpiredPage onLogout={handleLogout} />;
        }
        if (effectiveProfile.role === 'admin') {
            return (
                <DataProvider value={data}>
                    <AdminDashboard onLogout={handleLogout} onOpenConfig={() => setShowConfigModal(true)} />
                </DataProvider>
            );
        }
    }

    return (
        <DataProvider value={data}>
            <div className="flex flex-col h-screen bg-gray-50">
                <header className="bg-white shadow-md p-4 flex justify-between items-center z-30 no-print">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-bold text-gray-800">مكتب المحامي {session.access_token === 'offline' && <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">(وضع الأوفلاين)</span>}</h1>
                        <SyncStatusIndicator status={data.syncStatus} lastError={data.lastSyncError} isDirty={data.isDirty} isOnline={isOnline} onManualSync={data.manualSync} isAutoSyncEnabled={data.isAutoSyncEnabled} />
                    </div>
                    <div className="flex items-center gap-4">
                        {effectiveProfile && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-full shadow-sm hover:bg-gray-100 transition-colors">
                                <div className="bg-blue-100 p-1 rounded-full">
                                    <UserIcon className="w-4 h-4 text-blue-600" />
                                </div>
                                <span className="text-sm font-bold text-gray-700 truncate max-w-[120px] sm:max-w-[200px]">
                                    {effectiveProfile.full_name}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-1">
                            <button onClick={() => setCurrentPage('settings')} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors" title="الإعدادات">
                                <Cog6ToothIcon className="w-5 h-5"/>
                            </button>
                            <button onClick={handleLogout} className="p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-full transition-colors" title="تسجيل الخروج">
                                <PowerIcon className="w-5 h-5"/>
                            </button>
                        </div>
                    </div>
                </header>
                <OfflineBanner />
                <main className="flex-grow p-4 overflow-y-auto pb-24 sm:pb-6">
                    <React.Suspense fallback={<FullScreenLoader />}>
                        {/* Fix: Replaced 'number' type identifiers with actual event coordinate values in showContextMenu callbacks */}
                        {currentPage === 'home' && <HomePage onOpenAdminTaskModal={(d) => { setInitialAdminTaskData(d); setIsAdminTaskModalOpen(true); }} showContextMenu={(e, items) => setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, menuItems: items })} mainView="agenda" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
                        {currentPage === 'clients' && <ClientsPage showContextMenu={(e, items) => setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, menuItems: items })} onOpenAdminTaskModal={(d) => { setInitialAdminTaskData(d); setIsAdminTaskModalOpen(true); }} onCreateInvoice={(cid, csid) => { setInitialInvoiceData({ clientId: cid, caseId: csid }); setCurrentPage('accounting'); }} />}
                        {currentPage === 'accounting' && <AccountingPage initialInvoiceData={initialInvoiceData} clearInitialInvoiceData={() => setInitialInvoiceData(undefined)} />}
                        {currentPage === 'settings' && <SettingsPage />}
                        {currentPage === 'admin-tasks' && <HomePage onOpenAdminTaskModal={(d) => { setInitialAdminTaskData(d); setIsAdminTaskModalOpen(true); }} showContextMenu={(e, items) => setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY }, menuItems: items })} mainView="adminTasks" selectedDate={selectedDate} setSelectedDate={setSelectedDate} />}
                    </React.Suspense>
                </main>
                <nav className="fixed bottom-0 inset-x-0 bg-white border-t flex justify-around p-2 z-40 no-print">
                    <button onClick={() => setCurrentPage('home')} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${currentPage === 'home' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}><CalendarDaysIcon className="w-6 h-6"/><span className="text-[10px] font-bold">الأجندة</span></button>
                    <button onClick={() => setCurrentPage('admin-tasks')} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${currentPage === 'admin-tasks' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}><ClipboardDocumentCheckIcon className="w-6 h-6"/><span className="text-[10px] font-bold">المهام</span></button>
                    <button onClick={() => setCurrentPage('clients')} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${currentPage === 'clients' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}><UserIcon className="w-6 h-6"/><span className="text-[10px] font-bold">الموكلين</span></button>
                    <button onClick={() => setCurrentPage('accounting')} className={`flex flex-col items-center p-2 rounded-lg transition-colors ${currentPage === 'accounting' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}><CalculatorIcon className="w-6 h-6"/><span className="text-[10px] font-bold">المحاسبة</span></button>
                </nav>
                <AdminTaskModal isOpen={isAdminTaskModalOpen} onClose={() => setIsAdminTaskModalOpen(false)} onSubmit={handleTaskSubmit} initialData={initialAdminTaskData} assistants={data.assistants} />
                <ContextMenu isOpen={contextMenu.isOpen} position={contextMenu.position} menuItems={contextMenu.menuItems} onClose={() => setContextMenu({ ...contextMenu, isOpen: false })} />
                <UnpostponedSessionsModal isOpen={data.showUnpostponedSessionsModal} onClose={() => data.setShowUnpostponedSessionsModal(false)} sessions={data.unpostponedSessions} onPostpone={data.postponeSession} assistants={data.assistants} />
                <NotificationCenter appointmentAlerts={data.triggeredAlerts} realtimeAlerts={data.realtimeAlerts} userApprovalAlerts={data.userApprovalAlerts} dismissAppointmentAlert={data.dismissAlert} dismissRealtimeAlert={data.dismissRealtimeAlert} dismissUserApprovalAlert={data.dismissUserApprovalAlert} />
            </div>
        </DataProvider>
    );
}

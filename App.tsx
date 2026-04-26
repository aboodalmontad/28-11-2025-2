import { useState, useEffect } from "react";
import type { Session as AuthSession, User } from "@supabase/supabase-js";

import ClientsPage from "./pages/ClientsPage";
import HomePage from "./pages/HomePage";
import AccountingPage from "./pages/AccountingPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import AdminDashboard from "./pages/AdminDashboard";
import PendingApprovalPage from "./pages/PendingApprovalPage";
import SubscriptionExpiredPage from "./pages/SubscriptionExpiredPage";

import ConfigurationModal from "./components/ConfigurationModal";
import { useSupabaseData, SyncStatus } from "./hooks/useSupabaseData";
import {
  UserIcon,
  CalculatorIcon,
  Cog6ToothIcon,
  PowerIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  PrintIcon,
  ShareIcon,
  DatabaseIcon,
  XMarkIcon,
} from "./components/icons";
import ContextMenu, { MenuItem } from "./components/ContextMenu";
import AdminTaskModal from "./components/AdminTaskModal";
import { get_supabase_client } from "./supabaseClient";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { DataProvider } from "./context/DataContext";
import {
  safe_revive_date,
  format_date,
  format_time,
  is_same_day,
  is_before_today,
} from "./utils/dateUtils";
import { printElement } from "./utils/printUtils";
import SyncStatusIndicator from "./components/SyncStatusIndicator";
import NotificationCenter from "./components/RealtimeNotifier";
import { AdminTask } from "./types";

type Page = "home" | "admin-tasks" | "clients" | "accounting" | "settings";

interface NavbarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  sync_status: SyncStatus;
  last_sync_error: string | null;
  is_dirty: boolean;
  is_online: boolean;
  on_manual_sync: () => void;
  on_generate_agenda: (e: React.MouseEvent) => void;
  userName: string;
  is_auto_sync_enabled: boolean;
  permissions: any;
  sync_log?: any[];
  on_clear_log?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  onLogout,
  sync_status,
  last_sync_error,
  is_dirty,
  is_online,
  on_manual_sync,
  on_generate_agenda,
  userName,
  is_auto_sync_enabled,
  permissions,
  sync_log,
  on_clear_log,
}) => {
  const navItems = [
    {
      id: "home",
      label: "المفكرة",
      icon: CalendarDaysIcon,
      visible: permissions.can_view_agenda,
    },
    {
      id: "admin-tasks",
      label: "المهام",
      icon: ClipboardDocumentCheckIcon,
      visible: permissions.can_view_admin_tasks,
    },
    {
      id: "clients",
      label: "الموكلين",
      icon: UserIcon,
      visible: permissions.can_view_clients,
    },
    {
      id: "accounting",
      label: "المحاسبة",
      icon: CalculatorIcon,
      visible: permissions.can_view_finance,
    },
  ].filter((i) => i.visible);

  return (
    <header className="bg-white shadow-md p-2 sm:p-4 flex justify-between items-center no-print sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-bold text-gray-800 hidden sm:block">
          مكتب المحامي
        </h1>
        <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full border border-blue-100">
          <UserIcon className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold text-blue-800 truncate max-w-[120px]">
            {userName}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Page)}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentPage === item.id ? "bg-blue-100 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={on_generate_agenda}
          className="p-2 rounded-full text-indigo-600 hover:bg-indigo-50"
          title="جدول الأعمال"
        >
          <ClipboardDocumentCheckIcon className="w-5 h-5" />
        </button>
        <SyncStatusIndicator
          status={sync_status}
          last_error={last_sync_error}
          is_dirty={is_dirty}
          is_online={is_online}
          on_manual_sync={on_manual_sync}
          is_auto_sync_enabled={is_auto_sync_enabled}
          sync_log={sync_log}
          on_clear_log={on_clear_log}
        />
        <button
          onClick={() => onNavigate("settings")}
          className="p-2 rounded-full text-gray-500 hover:bg-gray-100"
        >
          <Cog6ToothIcon className="w-5 h-5" />
        </button>
        <button
          onClick={onLogout}
          className="p-2 text-red-500 hover:bg-red-50 rounded-full"
        >
          <PowerIcon className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

interface BottomNavProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  permissions: any;
}

const BottomNav: React.FC<BottomNavProps> = ({
  currentPage,
  onNavigate,
  permissions,
}) => {
  const navItems = [
    {
      id: "home",
      label: "المفكرة",
      icon: CalendarDaysIcon,
      visible: permissions.can_view_agenda,
    },
    {
      id: "admin-tasks",
      label: "المهام",
      icon: ClipboardDocumentCheckIcon,
      visible: permissions.can_view_admin_tasks,
    },
    {
      id: "clients",
      label: "الموكلين",
      icon: UserIcon,
      visible: permissions.can_view_clients,
    },
    {
      id: "accounting",
      label: "المحاسبة",
      icon: CalculatorIcon,
      visible: permissions.can_view_finance,
    },
  ].filter((i) => i.visible);

  if (navItems.length === 0) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center z-40 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] no-print">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id as Page)}
            className={`flex flex-col items-center justify-center w-full py-2 space-y-1 transition-colors ${isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"}`}
          >
            <Icon
              className={`w-6 h-6 ${isActive ? "text-blue-600" : "text-gray-500"}`}
            />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

const App: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [session, setSession] = useState<AuthSession | null>(() => {
    try {
      const cached = localStorage.getItem("lawyerAppLastUser");
      if (cached) return { user: JSON.parse(cached) } as any;
    } catch (e) {}
    return null;
  });

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>("home");
  const [isAdminTaskModalOpen, setIsAdminTaskModalOpen] = useState(false);
  const [adminTaskInitialData, setAdminTaskInitialData] =
    useState<any>(undefined);
  const [contextMenu, setContextMenu] = useState<any>({
    isOpen: false,
    position: { x: 0, y: 0 },
    menuItems: [],
  });
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handle_generate_agenda = (event: React.MouseEvent) => {
    const pending_tasks = data.admin_tasks.filter((t) => !t.completed);
    const grouped_pending: Record<string, AdminTask[]> = pending_tasks.reduce(
      (acc, task) => {
        const location = task.location || "غير محدد";
        if (!acc[location]) acc[location] = [];
        acc[location].push(task);
        return acc;
      },
      {} as Record<string, AdminTask[]>,
    );

    const sessions = data.all_sessions.filter((s) =>
      is_same_day(safe_revive_date(s.date), selectedDate),
    );
    const appts = data.appointments.filter((a) =>
      is_same_day(safe_revive_date(a.date), selectedDate),
    );

    const menuItems: MenuItem[] = [
      {
        label: "مشاركة عبر واتساب",
        icon: <ShareIcon className="w-4 h-4" />,
        onClick: () => {
          let text = `*جدول أعمال يوم: ${format_date(selectedDate)}*\n\n`;

          if (sessions.length > 0) {
            text += `*--- الجلسات ---*\n`;
            sessions.forEach((s) => {
              text += `• ${s.client_name} ضد ${s.opponent_name}\n`;
              text += `  (${s.court} - ${s.case_number})\n`;
              if (s.assignee) text += `  المكلف: ${s.assignee}\n`;
            });
            text += `\n`;
          }

          if (appts.length > 0) {
            text += `*--- المواعيد ---*\n`;
            appts.forEach((a) => {
              text += `• ${a.title} (${format_time(a.time)})\n`;
              if (a.assignee) text += `  المسؤول: ${a.assignee}\n`;
            });
            text += `\n`;
          }

          const locations = Object.keys(grouped_pending);
          if (locations.length > 0) {
            text += `*--- الأعمال الإدارية المعلقة ---*\n`;
            locations.forEach((loc) => {
              text += `*📍 ${loc}:*\n`;
              grouped_pending[loc].forEach((t) => {
                text += `  - ${t.task}\n`;
                if (t.assignee) text += `    المسؤول: ${t.assignee}\n`;
              });
            });
          }

          const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
          window.open(whatsappUrl, "_blank");
        },
      },
      {
        label: "طباعة جدول الأعمال",
        icon: <PrintIcon className="w-4 h-4" />,
        onClick: () => {
          const printWindow = window.open("", "_blank");
          if (!printWindow) return;

          const html = `
                        <html dir="rtl">
                        <head>
                            <title>جدول أعمال - ${format_date(selectedDate)}</title>
                            <style>
                                body { font-family: 'Inter', sans-serif; padding: 40px; color: #333; }
                                h1 { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
                                h2 { color: #2563eb; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 30px; }
                                h3 { color: #4b5563; margin-bottom: 5px; }
                                .section { margin-bottom: 20px; }
                                .item { margin-bottom: 10px; padding: 10px; background: #f9fafb; border-radius: 5px; }
                                .location-group { margin-bottom: 20px; }
                                .location-title { font-weight: bold; background: #e5e7eb; padding: 5px 10px; border-radius: 4px; margin-bottom: 10px; }
                                .meta { font-size: 0.9em; color: #666; }
                                .no-print-btn { 
                                    display: block; 
                                    width: 200px; 
                                    margin: 20px auto; 
                                    padding: 10px; 
                                    background: #2563eb; 
                                    color: white; 
                                    text-align: center; 
                                    text-decoration: none; 
                                    border-radius: 5px; 
                                    cursor: pointer;
                                    border: none;
                                    font-size: 16px;
                                    font-weight: bold;
                                }
                                @media print {
                                    .no-print-btn { display: none; }
                                }
                            </style>
                        </head>
                        <body>
                            <button class="no-print-btn" onclick="window.print()">طباعة التقرير</button>
                            <h1>جدول أعمال يوم: ${format_date(selectedDate)}</h1>
                            
                            ${
                              sessions.length > 0
                                ? `
                                <div class="section">
                                    <h2>الجلسات</h2>
                                    ${sessions
                                      .map(
                                        (s) => `
                                        <div class="item">
                                            <strong>${s.client_name} ضد ${s.opponent_name}</strong><br/>
                                            <span class="meta">${s.court} - ${s.case_number}</span>
                                            ${s.assignee ? `<br/><span class="meta">المكلف: ${s.assignee}</span>` : ""}
                                        </div>
                                    `,
                                      )
                                      .join("")}
                                </div>
                            `
                                : ""
                            }

                            ${
                              appts.length > 0
                                ? `
                                <div class="section">
                                    <h2>المواعيد</h2>
                                    ${appts
                                      .map(
                                        (a) => `
                                        <div class="item">
                                            <strong>${a.title}</strong> - ${format_time(a.time)}
                                            ${a.assignee ? `<br/><span class="meta">المسؤول: ${a.assignee}</span>` : ""}
                                        </div>
                                    `,
                                      )
                                      .join("")}
                                </div>
                            `
                                : ""
                            }

                            ${
                              Object.keys(grouped_pending).length > 0
                                ? `
                                <div class="section">
                                    <h2>الأعمال الإدارية المعلقة</h2>
                                    ${Object.keys(grouped_pending)
                                      .map(
                                        (loc) => `
                                        <div class="location-group">
                                            <div class="location-title">${loc}</div>
                                            ${grouped_pending[loc]
                                              .map(
                                                (t) => `
                                                <div class="item">
                                                    ${t.task}
                                                    ${t.assignee ? `<br/><span class="meta">المسؤول: ${t.assignee}</span>` : ""}
                                                </div>
                                            `,
                                              )
                                              .join("")}
                                        </div>
                                    `,
                                      )
                                      .join("")}
                                </div>
                            `
                                : ""
                            }
                        </body>
                        </html>
                    `;
          printWindow.document.write(html);
          printWindow.document.close();
        },
      },
    ];
    setContextMenu({
      isOpen: true,
      position: { x: event.clientX, y: event.clientY },
      menuItems: menuItems,
    });
  };

  const supabase = get_supabase_client();
  const data = useSupabaseData(session?.user ?? null, isAuthLoading);
  const { sync_log: syncLog, clear_sync_log: clearSyncLog } = data;
  const isOnline = data.is_online; // Use isOnline from data instead of calling useOnlineStatus again

  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [showReadyMessage, setShowReadyMessage] = useState(false);
  const [messageWasShown, setMessageWasShown] = useState(false);

  // Show "Ready for Offline Use" message after first successful sync of the session
  useEffect(() => {
    if (
      data.sync_status === "synced" &&
      !messageWasShown &&
      session &&
      !data.is_data_loading
    ) {
      setShowReadyMessage(true);
      setMessageWasShown(true); // Mark it as shown so it never reappears
    }
  }, [data.sync_status, session, data.is_data_loading, messageWasShown]);

  // Auto-hide the "Database Ready" message after 5 seconds
  useEffect(() => {
    if (showReadyMessage) {
      const timer = setTimeout(() => {
        setShowReadyMessage(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showReadyMessage]);

  const createMissingProfile = async () => {
    if (!session?.user || !supabase) return;
    setIsCreatingProfile(true);
    try {
      const { user } = session;
      console.log("Attempting to create missing profile for:", user.id);

      const is_admin =
        user.email === "nahwiabdo@gmail.com" ||
        user.email === "avocat.nahwi@gmail.com" ||
        user.email === "sy963958932922@email.com";
      const newProfile = {
        id: user.id,
        full_name: user.user_metadata?.full_name || "مستخدم جديد",
        mobile_number: user.user_metadata?.mobile_number || "",
        role: is_admin ? "admin" : user.user_metadata?.role || "user",
        is_approved: is_admin,
        is_active: true,
        mobile_verified: is_admin,
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: new Date(
          new Date().getFullYear() + 1,
          new Date().getMonth(),
          new Date().getDate(),
        ).toISOString(),
      };

      const { error } = await supabase.from("profiles").upsert([newProfile]);
      if (error) throw error;

      console.log("Profile created successfully");
      // Refresh data to pick up the new profile
      await data.fetch_and_refresh();
    } catch (err: any) {
      console.error("Failed to create profile:", err);
    } finally {
      setIsCreatingProfile(false);
    }
  };

  // Global Auth Watchdog: Don't let Auth hang more than 4s
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthLoading) {
        console.warn("Auth check timed out.");
        setIsAuthLoading(false);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [isAuthLoading]);

  useEffect(() => {
    if (!supabase) {
      setIsAuthLoading(false);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("Auth state changed:", event, newSession?.user?.id);
      if (newSession) {
        setSession(newSession);
        localStorage.setItem(
          "lawyerAppLastUser",
          JSON.stringify(newSession.user),
        );
      } else {
        setSession(null);
        localStorage.removeItem("lawyerAppLastUser");
      }
      setIsAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Effective Display Name Logic
  const profile = session
    ? data.profiles.find((p) => p.id === session.user.id)
    : null;

  // Admin Role Sync Watchdog: Ensure designated emails always have admin role in DB
  useEffect(() => {
    const syncAdminRole = async () => {
      if (!session?.user || !supabase || !profile) return;
      const adminEmails = [
        "nahwiabdo@gmail.com",
        "avocat.nahwi@gmail.com",
        "sy963958932922@email.com",
      ];
      if (
        adminEmails.includes(session.user.email || "") &&
        profile.role !== "admin"
      ) {
        console.log("Upgrading user to admin role based on email...");
        const { error } = await supabase
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", session.user.id);

        if (!error) {
          console.log("Admin role upgraded successfully");
          await data.fetch_and_refresh();
        } else {
          console.error("Failed to upgrade admin role:", error);
        }
      }
    };
    syncAdminRole();
  }, [session?.user?.id, profile?.role]);

  useEffect(() => {
    if (session) {
      console.log("Current Session User ID:", session.user.id);
      console.log("Available Profiles:", data.profiles);
      if (!profile) {
        console.warn("Profile not found for user ID:", session.user.id);
      }
    }
  }, [session, data.profiles, profile]);

  const userName =
    profile?.full_name || session?.user.user_metadata?.full_name || "مستخدم";

  const handleLogout = async () => {
    localStorage.removeItem("lawyerAppLastUser");
    setSession(null);
    if (supabase) await supabase.auth.signOut();
    onRefresh();
  };

  if (isAuthLoading && !session)
    return (
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
      </div>
    );
  if (showConfigModal)
    return (
      <ConfigurationModal
        onRetry={() => {
          setShowConfigModal(false);
          data.manual_sync({ force: true });
        }}
      />
    );
  if (
    data.sync_status === "unconfigured" ||
    data.sync_status === "uninitialized"
  )
    return (
      <ConfigurationModal onRetry={() => data.manual_sync({ force: true })} />
    );

  const is_admin_email =
    session?.user?.email &&
    [
      "nahwiabdo@gmail.com",
      "avocat.nahwi@gmail.com",
      "sy963958932922@email.com",
    ].includes(session.user.email);
  const has_metadata_mobile = session?.user?.user_metadata?.mobile_number;

  if (!session)
    return (
      <LoginPage
        key="auth-login"
        on_force_setup={() => setShowConfigModal(true)}
        on_login_success={(u) => setSession({ user: u } as any)}
        sync_log={syncLog}
        on_clear_log={clearSyncLog}
        is_local_empty={data.is_local_empty}
        is_update_available={data.is_update_available}
      />
    );

  if (
    (data.is_data_loading ||
      data.sync_status === "syncing" ||
      data.sync_status === "loading" ||
      isCreatingProfile) &&
    !profile
  ) {
    // If we have a session and it's not a known admin, and we have mobile metadata, show OTP screen instead of loading
    if (session && !is_admin_email && has_metadata_mobile) {
      // Continue to OTP check below
    } else {
      return (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center p-6 text-center">
          <div className="relative">
            <ArrowPathIcon className="w-16 h-16 animate-spin text-blue-600 mb-6" />
            <div className="absolute inset-0 flex items-center justify-center">
               <DatabaseIcon className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">جاري إعداد المكتب الرقمي</h2>
          <p className="text-slate-500 max-w-sm">
            يتم الآن تحميل وتحضير قاعدة البيانات للعمل بسرعة فائقة ولدعم الاستخدام بدون إنترنت...
          </p>
          <div className="mt-8 w-full max-w-xs bg-slate-100 h-1.5 rounded-full overflow-hidden">
             <div className="bg-blue-600 h-full w-2/3 animate-[shimmer_2s_infinite_linear] rounded-full" style={{
                backgroundImage: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                backgroundSize: '200% 100%'
             }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-4 uppercase tracking-widest font-bold">
            {data.sync_status === 'syncing' ? 'مزامنة السحاب...' : 'تحضير الذاكرة المحلية...'}
          </p>
        </div>
      );
    }
  }

  if (
    !profile &&
    !data.is_data_loading &&
    data.sync_status !== "syncing" &&
    data.sync_status !== "loading" &&
    isOnline
  ) {
    // Automatically try to open config if profile is missing in the cloud
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-6"
        dir="rtl"
      >
        <ArrowPathIcon className="w-16 h-16 text-blue-600 animate-spin mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          جاري تحميل بيانات مكتبك الرجاء الانتظار
        </h2>
        <p className="text-gray-500 mt-2">
          يتم الآن تهيئة ومزامنة التخزين المحلي السحابي...
        </p>

        <details className="mt-8 text-right bg-white p-4 rounded-lg border shadow-sm max-w-md w-full opacity-50 hover:opacity-100 transition-opacity">
          <summary className="text-sm font-bold text-gray-500 cursor-pointer outline-none">
            إظهار الدعم الفني وأدوات الإصلاح (في حال طال الانتظار)
          </summary>
          <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm max-w-md w-full text-right">
            <div className="bg-slate-50 rounded p-3 mb-4 text-xs font-mono overflow-auto text-left">
              <div className="text-slate-500 mb-1">معلومات التشخيص:</div>
              <div className="text-slate-700">User ID: {session.user.id}</div>
              <div className="text-slate-700">
                Sync Status: {data.sync_status}
              </div>
              <div className="text-slate-700">
                Profiles Count: {data.profiles.length}
              </div>
              {data.last_sync_error && (
                <div className="text-red-500 mt-2">
                  Error: {data.last_sync_error}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => data.manual_sync({ force: true })}
                disabled={(data.sync_status as string) === "syncing"}
                className="w-full py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {(data.sync_status as string) === "syncing" ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : null}
                {(data.sync_status as string) === "syncing"
                  ? "جاري المزامنة..."
                  : "إعادة محاولة المزامنة"}
              </button>
              <button
                onClick={() => setShowConfigModal(true)}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                إصلاح قاعدة البيانات
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-2 w-full max-w-md">
            <p className="text-xs text-gray-400">
              إذا كنت متأكداً من وجود بياناتك، يرجى التحقق من أنك سجلت الدخول
              بالحساب الصحيح.
            </p>
            <button
              onClick={createMissingProfile}
              disabled={isCreatingProfile}
              className="px-6 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
            >
              {isCreatingProfile
                ? "جاري الإنشاء..."
                : "إنشاء ملف شخصي جديد (إجباري)"}
            </button>
            <button
              onClick={handleLogout}
              className="px-6 py-2 text-red-600 hover:bg-red-50 rounded-lg"
            >
              تسجيل الخروج
            </button>
          </div>
        </details>
      </div>
    );
  }

  if (session && !profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
        <ArrowPathIcon className="w-12 h-12 text-blue-600 animate-spin mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          جاري تحميل بيانات مكتبك الرجاء الانتظار
        </h2>
        <div className="mt-8 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-red-500"
          >
            مشكلة بالتحميل؟ تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  if (profile && profile.role === "admin" && !data.admin_viewing_user_id) {
    return (
      <DataProvider value={data}>
        <AdminDashboard
          on_logout={handleLogout}
          on_open_config={() => setShowConfigModal(true)}
        />
        <NotificationCenter
          appointmentAlerts={data.triggered_alerts}
          realtimeAlerts={data.realtime_alerts}
          userApprovalAlerts={data.user_approval_alerts}
          dismissAppointmentAlert={data.dismiss_alert}
          dismissRealtimeAlert={data.dismiss_realtime_alert}
          dismissUserApprovalAlert={data.dismiss_user_approval_alert}
        />
      </DataProvider>
    );
  }

  if (
    session &&
    !is_admin_email &&
    ((profile && !profile.mobile_verified && profile.role !== "admin") ||
      (!profile && has_metadata_mobile))
  ) {
    return (
      <LoginPage
        key="auth-otp"
        on_force_setup={() => setShowConfigModal(true)}
        on_login_success={(u) => setSession({ user: u } as any)}
        initial_mode="otp"
        current_user={session?.user}
        current_mobile={
          profile?.mobile_number || session.user.user_metadata?.mobile_number
        }
        on_logout={handleLogout}
        sync_log={syncLog}
        on_clear_log={clearSyncLog}
        is_local_empty={data.is_local_empty}
      />
    );
  }

  if (
    profile &&
    profile.role !== "admin" &&
    (!profile.is_approved || !profile.is_active)
  )
    return <PendingApprovalPage onLogout={handleLogout} />;
  if (
    profile &&
    profile.subscription_end_date &&
    is_before_today(profile.subscription_end_date)
  )
    return <SubscriptionExpiredPage onLogout={handleLogout} />;

  return (
    <DataProvider value={data}>
      <div className="flex flex-col h-screen print:h-auto bg-gray-50 print:bg-white">
        {data.admin_viewing_user_id && (
          <div className="bg-red-600 text-white p-2 text-center text-sm font-bold flex justify-center items-center gap-4">
            <span>أنت الآن تتصفح مكتب مستخدم آخر كمسؤول</span>
            <button
              onClick={() => data.set_admin_viewing_user_id(null)}
              className="bg-white text-red-600 px-3 py-1 rounded-md text-xs hover:bg-red-50 transition-colors"
            >
              العودة للوحة الإدارة
            </button>
          </div>
        )}
        <Navbar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onLogout={handleLogout}
          sync_status={data.sync_status}
          last_sync_error={data.last_sync_error}
          is_dirty={data.is_dirty}
          is_online={isOnline}
          on_manual_sync={() => data.manual_sync({ force: true })}
          on_generate_agenda={handle_generate_agenda}
          userName={userName}
          is_auto_sync_enabled={true}
          permissions={data.permissions}
          sync_log={syncLog}
          on_clear_log={clearSyncLog}
        />
        <main className="flex-grow p-4 overflow-y-auto print:overflow-visible print:p-0 pb-24 md:pb-4 print:pb-0">
          {data.is_data_loading && (
            <div className="p-4 text-center text-gray-500 flex items-center justify-center gap-2">
              <ArrowPathIcon className="w-4 h-4 animate-spin" /> جاري جلب آخر
              التحديثات...
            </div>
          )}
          {currentPage === "home" && (
            <HomePage
              on_open_admin_task_modal={(initialData) => {
                setAdminTaskInitialData(initialData);
                setIsAdminTaskModalOpen(true);
              }}
              show_context_menu={(e, m) =>
                setContextMenu({
                  isOpen: true,
                  position: { x: e.clientX, y: e.clientY },
                  menuItems: m,
                })
              }
              main_view="agenda"
              selected_date={selectedDate}
              set_selected_date={setSelectedDate}
            />
          )}
          {currentPage === "clients" && (
            <ClientsPage
              on_open_admin_task_modal={(initialData) => {
                setAdminTaskInitialData(initialData);
                setIsAdminTaskModalOpen(true);
              }}
              show_context_menu={(e, m) =>
                setContextMenu({
                  isOpen: true,
                  position: { x: e.clientX, y: e.clientY },
                  menuItems: m,
                })
              }
              on_create_invoice={() => {}}
            />
          )}
          {currentPage === "accounting" && (
            <AccountingPage clear_initial_invoice_data={() => {}} />
          )}
          {currentPage === "settings" && <SettingsPage />}
          {currentPage === "admin-tasks" && (
            <HomePage
              on_open_admin_task_modal={(initialData) => {
                setAdminTaskInitialData(initialData);
                setIsAdminTaskModalOpen(true);
              }}
              show_context_menu={(e, m) =>
                setContextMenu({
                  isOpen: true,
                  position: { x: e.clientX, y: e.clientY },
                  menuItems: m,
                })
              }
              main_view="admin_tasks"
              selected_date={selectedDate}
              set_selected_date={setSelectedDate}
            />
          )}
        </main>
        <AdminTaskModal
          isOpen={isAdminTaskModalOpen}
          onClose={() => setIsAdminTaskModalOpen(false)}
          initialData={adminTaskInitialData}
          onSubmit={(taskData) => {
            if (taskData.id) {
              data.set_admin_tasks((prev: any[]) =>
                prev.map((t) =>
                  t.id === taskData.id
                    ? {
                        ...t,
                        ...taskData,
                        user_id: data.effective_user_id,
                        updated_at: new Date().toISOString(),
                      }
                    : t,
                ),
              );
            } else {
              data.set_admin_tasks((prev: any[]) => [
                ...prev,
                {
                  ...taskData,
                  id: `task-${Date.now()}`,
                  completed: false,
                  user_id: data.effective_user_id,
                  updated_at: new Date().toISOString(),
                },
              ]);
            }
            setIsAdminTaskModalOpen(false);
          }}
          assistants={data.assistants.map((a) =>
            typeof a === "string" ? a : a.name,
          )}
        />
        <ContextMenu
          isOpen={contextMenu.isOpen}
          position={contextMenu.position}
          menuItems={contextMenu.menuItems}
          onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
        />
        <NotificationCenter
          appointmentAlerts={data.triggered_alerts}
          realtimeAlerts={data.realtime_alerts}
          userApprovalAlerts={data.user_approval_alerts}
          dismissAppointmentAlert={data.dismiss_alert}
          dismissRealtimeAlert={data.dismiss_realtime_alert}
          dismissUserApprovalAlert={data.dismiss_user_approval_alert}
        />
        <BottomNav
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          permissions={data.permissions}
        />

        {showReadyMessage && (
          <div className="fixed bottom-24 md:bottom-10 left-6 right-6 md:left-auto md:w-80 bg-slate-900 border border-slate-700 text-white p-4 rounded-2xl shadow-2xl z-[100] animate-fade-in flex items-center gap-4">
             <div className="bg-green-500/20 p-2 rounded-xl">
                <DatabaseIcon className="w-6 h-6 text-green-400" />
             </div>
             <div>
                <h4 className="text-sm font-bold">قاعدة البيانات جاهزة</h4>
                <p className="text-[10px] text-slate-400">التطبيق يعمل الآن محلياً بالكامل وسيوفر لك سرعة فائقة حتى بدون إنترنت.</p>
             </div>
             <button 
                onClick={() => setShowReadyMessage(false)}
                className="ms-auto text-slate-500 hover:text-white transition-colors"
             >
                <XMarkIcon className="w-4 h-4" />
             </button>
          </div>
        )}
      </div>
    </DataProvider>
  );
};

export default App;

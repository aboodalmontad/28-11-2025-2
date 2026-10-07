import { useState, useEffect, lazy, Suspense } from "react";
import type { Session as AuthSession, User } from "@supabase/supabase-js";

import ClientsPage from "./pages/ClientsPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";

const AccountingPage = lazy(() => import("./pages/AccountingPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const ActivityLogsPage = lazy(() => import("./pages/ActivityLogsPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const PendingApprovalPage = lazy(() => import("./pages/PendingApprovalPage"));
const SubscriptionExpiredPage = lazy(
  () => import("./pages/SubscriptionExpiredPage"),
);
const ConfigurationModal = lazy(
  () => import("./components/ConfigurationModal"),
);
import Logo from "./components/Logo";
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
  ShieldCheckIcon,
} from "./components/icons";
import ContextMenu, { MenuItem } from "./components/ContextMenu";
import AdminTaskModal from "./components/AdminTaskModal";
import { WhatsAppChooserModal } from "./components/WhatsAppChooserModal";
import { get_supabase_client } from "./supabaseClient";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { DataProvider } from "./context/DataContext";
import {
  safe_revive_date,
  format_date,
  format_time,
  is_same_day,
  is_before_today,
  to_input_date_string,
} from "./utils/dateUtils";
import { printElement } from "./utils/printUtils";
import {
  is_admin_account,
  is_designated_admin_identifier,
  get_possible_db_mobiles,
} from "./utils/mobileUtils";
import SyncStatusIndicator from "./components/SyncStatusIndicator";
import NotificationCenter from "./components/RealtimeNotifier";
import { AdminTask, Profile } from "./types";

type Page = "home" | "admin-tasks" | "clients" | "accounting" | "settings" | "logs";

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
  pending_assistants_count?: number;
  is_admin?: boolean;
  on_go_to_admin?: () => void;
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
  pending_assistants_count = 0,
  is_admin = false,
  on_go_to_admin,
}) => {
  const can_view_accounting =
    is_admin ||
    permissions?.can_view_finance === true ||
    !permissions ||
    permissions.can_view_finance === undefined;

  const navItems = [
    {
      id: "home",
      label: "المفكرة",
      icon: CalendarDaysIcon,
      visible: is_admin || permissions?.can_view_agenda !== false,
    },
    {
      id: "admin-tasks",
      label: "المهام",
      icon: ClipboardDocumentCheckIcon,
      visible: is_admin || permissions?.can_view_admin_tasks !== false,
    },
    {
      id: "clients",
      label: "الموكلين والقضايا",
      icon: UserIcon,
      visible: is_admin || permissions?.can_view_clients !== false,
    },
    {
      id: "accounting",
      label: "المحاسبة",
      icon: CalculatorIcon,
      visible: can_view_accounting,
    },
  ].filter((i) => i.visible);

  return (
    <header className="bg-white shadow-md p-2 sm:p-4 flex justify-between items-center no-print sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate("home")}>
          <Logo size="sm" className="h-9 w-9" />
          <h1 className="text-lg font-bold text-gray-800">
            مكتب المحامي
          </h1>
        </div>
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
        {on_go_to_admin && (
          <button
            onClick={on_go_to_admin}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 transition-colors"
            title="الانتقال إلى لوحة إدارة المنصة"
          >
            <ShieldCheckIcon className="w-4 h-4 text-purple-600" />
            <span className="hidden sm:inline">لوحة الإدارة</span>
          </button>
        )}
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
          className="p-2 rounded-full text-gray-500 hover:bg-gray-100 relative"
          title={
            pending_assistants_count > 0
              ? `الإعدادات (يوجد ${pending_assistants_count} طلب انضمام بانتظار الموافقة)`
              : "الإعدادات"
          }
        >
          <Cog6ToothIcon className="w-5 h-5" />
          {pending_assistants_count > 0 && (
            <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
          )}
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
  is_admin?: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({
  currentPage,
  onNavigate,
  permissions,
  is_admin = false,
}) => {
  const can_view_accounting =
    is_admin ||
    permissions?.can_view_finance === true ||
    !permissions ||
    permissions.can_view_finance === undefined;

  const navItems = [
    {
      id: "home",
      label: "المفكرة",
      icon: CalendarDaysIcon,
      visible: is_admin || permissions?.can_view_agenda !== false,
    },
    {
      id: "admin-tasks",
      label: "المهام",
      icon: ClipboardDocumentCheckIcon,
      visible: is_admin || permissions?.can_view_admin_tasks !== false,
    },
    {
      id: "clients",
      label: "الموكلين والقضايا",
      icon: UserIcon,
      visible: is_admin || permissions?.can_view_clients !== false,
    },
    {
      id: "accounting",
      label: "المحاسبة",
      icon: CalculatorIcon,
      visible: can_view_accounting,
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
  const [adminViewMode, setAdminViewMode] = useState<"dashboard" | "office">("dashboard");
  const [isAdminTaskModalOpen, setIsAdminTaskModalOpen] = useState(false);
  const [adminTaskInitialData, setAdminTaskInitialData] =
    useState<any>(undefined);
  const [contextMenu, setContextMenu] = useState<any>({
    isOpen: false,
    position: { x: 0, y: 0 },
    menuItems: [],
  });
  const [selectedDate, setSelectedDate] = useState(new Date());

  const supabase = get_supabase_client();
  const data = useSupabaseData(session?.user ?? null, isAuthLoading);

  const handle_generate_agenda = (event: React.MouseEvent) => {
    const pending_tasks = data.admin_tasks.filter((t) => !t.completed && (t.task_type || "admin") === "admin");
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

          data.share_via_whatsapp(text);
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
                                            <div class="location-title" style="${grouped_pending[loc].some((t) => t.importance === "urgent") ? "background-color: #fee2e2; color: #991b1b; border-right: 4px solid #ef4444;" : ""}">${loc}${grouped_pending[loc].some((t) => t.importance === "urgent") ? ' <span style="font-size:0.8em; font-weight:normal; color:#b91c1c;">(⚠️ عاجل)</span>' : ""}</div>
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

  const { sync_log: syncLog, clear_sync_log: clearSyncLog } = data;
  const isOnline = data.is_online; // Use isOnline from data instead of calling useOnlineStatus again

  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [liveUserProfile, setLiveUserProfile] = useState<Profile | null>(() => {
    try {
      const cachedUserStr = localStorage.getItem("lawyerAppLastUser");
      if (cachedUserStr) {
        const cachedUser = JSON.parse(cachedUserStr);
        if (cachedUser?.id) {
          const cachedProf = localStorage.getItem(
            `lawyerAppUserProfile_${cachedUser.id}`,
          );
          if (cachedProf) return JSON.parse(cachedProf);
        }
      }
    } catch (e) {}
    return null;
  });
  const [isProfileResolving, setIsProfileResolving] = useState(false);

  const createMissingProfile = async () => {
    if (!session?.user || !supabase) return;
    setIsCreatingProfile(true);
    try {
      const { user } = session;
      console.log("Attempting to create missing profile for:", user.id);

      const is_admin = is_admin_account(user, liveUserProfile);
      const now = new Date();
      const fortyFiveDaysLater = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 45
      );
      const oneYearLater = new Date(
        now.getFullYear() + 1,
        now.getMonth(),
        now.getDate()
      );

      const newProfile = {
        id: user.id,
        full_name: user.user_metadata?.full_name || "مستخدم جديد",
        mobile_number: user.user_metadata?.mobile_number || "",
        role: (is_admin ? "admin" : user.user_metadata?.role || "user") as
          | "user"
          | "admin",
        is_approved: is_admin,
        is_active: true,
        mobile_verified: is_admin,
        trial_used: !is_admin,
        subscription_start_date: to_input_date_string(now),
        subscription_end_date: is_admin
          ? to_input_date_string(oneYearLater)
          : to_input_date_string(fortyFiveDaysLater),
      };

      const { error } = await supabase.from("profiles").upsert([newProfile]);
      if (error) throw error;

      setLiveUserProfile(newProfile as Profile);
      localStorage.setItem(
        `lawyerAppUserProfile_${user.id}`,
        JSON.stringify(newProfile),
      );
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
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log("Auth state changed:", event, newSession?.user?.id);
      
      if (event === "SIGNED_IN" && newSession?.user?.id) {
        const sessionKey = "session_login_logged_" + newSession.user.id;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, "true");
          import("./utils/auditLogger").then(({ logActivity }) => {
            logActivity(
              newSession.user.id,
              "LOGIN",
              "auth",
              newSession.user.id,
              "تسجيل دخول للنظام",
              newSession.user.user_metadata?.full_name || newSession.user.email || ""
            );
          });
        }
      }

      if (newSession) {
        let enrichedUser = { ...newSession.user };
        try {
          const cachedProfStr = localStorage.getItem(
            `lawyerAppUserProfile_${newSession.user.id}`,
          );
          const cachedProf = cachedProfStr ? JSON.parse(cachedProfStr) : null;
          const cachedIsAdmin =
            localStorage.getItem(`lawyerAppIsAdmin_${newSession.user.id}`) ===
            "true";
          const isAdminNow =
            cachedIsAdmin ||
            is_admin_account(newSession.user, cachedProf) ||
            cachedProf?.role === "admin";
          if (isAdminNow) {
            enrichedUser = {
              ...enrichedUser,
              role: "admin",
              user_metadata: {
                ...(enrichedUser.user_metadata || {}),
                role: "admin",
              },
            };
          }
          if (cachedProf) {
            setLiveUserProfile(cachedProf);
          }
        } catch (e) {}

        setSession({ ...newSession, user: enrichedUser });
        localStorage.setItem(
          "lawyerAppLastUser",
          JSON.stringify(enrichedUser),
        );
      } else {
        const hasCachedUser = !!localStorage.getItem("lawyerAppLastUser");
        if (hasCachedUser) {
          console.log(
            "Preserving active session to prevent unexpected logout during sync or token refresh.",
          );
          // Keep current session state so the user remains logged in
        } else {
          setSession(null);
          setLiveUserProfile(null);
        }
      }
      setIsAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  // Directly resolve user profile & admin role from Supabase upon session activation
  useEffect(() => {
    let isMounted = true;
    const resolveProfileFromCloud = async () => {
      if (!session?.user?.id) {
        if (isMounted) {
          setLiveUserProfile(null);
          setIsProfileResolving(false);
        }
        return;
      }

      const userId = session.user.id;
      // Load cached profile for this user immediately if available
      try {
        const cachedProfStr = localStorage.getItem(
          `lawyerAppUserProfile_${userId}`,
        );
        if (cachedProfStr && isMounted) {
          const parsed = JSON.parse(cachedProfStr);
          if (parsed?.id === userId) {
            setLiveUserProfile(parsed);
          }
        }
      } catch (e) {}

      if (!supabase || !navigator.onLine) {
        if (isMounted) setIsProfileResolving(false);
        return;
      }

      if (isMounted) setIsProfileResolving(true);
      try {
        let { data: cloudProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (!cloudProfile) {
          const mobileCandidate =
            session.user.user_metadata?.mobile_number ||
            session.user.phone ||
            "";
          const possibleMobiles = get_possible_db_mobiles(mobileCandidate);
          if (possibleMobiles.length > 0) {
            const { data: mobileProf } = await supabase
              .from("profiles")
              .select("*")
              .in("mobile_number", possibleMobiles)
              .maybeSingle();
            if (mobileProf) {
              cloudProfile = mobileProf;
            }
          }
        }

        const isAdminResolved = is_admin_account(session.user, cloudProfile);

        if (cloudProfile) {
          if (
            isAdminResolved &&
            (cloudProfile.role !== "admin" || !cloudProfile.is_approved)
          ) {
            await supabase
              .from("profiles")
              .update({
                role: "admin",
                is_approved: true,
                is_active: true,
                mobile_verified: true,
              })
              .eq("id", cloudProfile.id);
            cloudProfile = {
              ...cloudProfile,
              role: "admin",
              is_approved: true,
              is_active: true,
              mobile_verified: true,
            };
          }

          if (isMounted) {
            setLiveUserProfile(cloudProfile as Profile);
            localStorage.setItem(
              `lawyerAppUserProfile_${userId}`,
              JSON.stringify(cloudProfile),
            );
            localStorage.setItem(
              `lawyerAppIsAdmin_${userId}`,
              cloudProfile.role === "admin" || isAdminResolved
                ? "true"
                : "false",
            );
            if (cloudProfile.role === "admin" || isAdminResolved) {
              setSession((prev) => {
                if (!prev || prev.user.id !== userId) return prev;
                if (
                  prev.user.role === "admin" &&
                  prev.user.user_metadata?.role === "admin"
                ) {
                  return prev;
                }
                const updatedUser = {
                  ...prev.user,
                  role: "admin",
                  user_metadata: {
                    ...(prev.user.user_metadata || {}),
                    role: "admin",
                  },
                };
                localStorage.setItem(
                  "lawyerAppLastUser",
                  JSON.stringify(updatedUser),
                );
                return { ...prev, user: updatedUser };
              });
            }
          }
        } else if (isAdminResolved && isMounted) {
          localStorage.setItem(`lawyerAppIsAdmin_${userId}`, "true");
        }
      } catch (err) {
        console.warn("Error resolving live user profile:", err);
      } finally {
        if (isMounted) setIsProfileResolving(false);
      }
    };

    resolveProfileFromCloud();
    return () => {
      isMounted = false;
    };
  }, [session?.user?.id, supabase]);

  const syncedProfile = session
    ? data.profiles.find((p) => p.id === session.user.id) ||
      (liveUserProfile?.id === session.user.id ? liveUserProfile : null)
    : null;

  const is_admin_email = Boolean(
    session?.user &&
      (is_admin_account(session.user, syncedProfile) ||
        data.is_admin ||
        syncedProfile?.role === "admin"),
  );

  // Effective Profile & Role Logic
  const profile: Profile | null = session
    ? syncedProfile
      ? {
          ...syncedProfile,
          role: (is_admin_email ? "admin" : syncedProfile.role || "user") as
            | "user"
            | "admin",
        }
      : {
          id: session.user.id,
          full_name:
            session.user.user_metadata?.full_name ||
            session.user.email ||
            "مستخدم",
          mobile_number: session.user.user_metadata?.mobile_number || "",
          role: (is_admin_email
            ? "admin"
            : session.user.user_metadata?.role || "user") as "user" | "admin",
          is_approved: true,
          is_active: true,
          mobile_verified: true,
          subscription_start_date: new Date().toISOString(),
          subscription_end_date: new Date(
            Date.now() + 365 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        }
    : null;

  // Ensure that when an admin logs in, they always land on AdminDashboard directly (reset any stale viewing user id)
  useEffect(() => {
    if (session?.user?.id && is_admin_email) {
      const justLoggedInKey = `just_logged_in_user_${session.user.id}`;
      if (sessionStorage.getItem(justLoggedInKey) === "true") {
        sessionStorage.removeItem(justLoggedInKey);
        if (data.admin_viewing_user_id) {
          data.set_admin_viewing_user_id(null);
        }
      }
    }
  }, [session?.user?.id, is_admin_email, data.admin_viewing_user_id]);

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
    const currentUserId = session?.user?.id;
    sessionStorage.clear();
    localStorage.removeItem("lawyerAppLastUser");
    localStorage.removeItem("lawyerAppLastUserData");
    if (currentUserId) {
      localStorage.removeItem(`lawyerAppUserProfile_${currentUserId}`);
      localStorage.removeItem(`lawyerAppIsAdmin_${currentUserId}`);
    }
    data.set_admin_viewing_user_id(null);
    setLiveUserProfile(null);
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
      <Suspense
        fallback={
          <div className="fixed inset-0 bg-white flex items-center justify-center">
            <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        }
      >
        <ConfigurationModal
          onRetry={() => {
            setShowConfigModal(false);
            data.manual_sync({ force: true });
          }}
        />
      </Suspense>
    );
  if (
    (data.sync_status === "unconfigured" ||
      data.sync_status === "uninitialized") &&
    data.is_local_empty
  )
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 bg-white flex items-center justify-center">
            <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        }
      >
        <ConfigurationModal onRetry={() => data.manual_sync({ force: true })} />
      </Suspense>
    );

  const has_metadata_mobile = session?.user?.user_metadata?.mobile_number;

  if (!session)
    return (
      <LoginPage
        key="auth-login"
        on_force_setup={() => setShowConfigModal(true)}
        on_login_success={(u) => {
          sessionStorage.setItem(`just_logged_in_user_${u.id}`, "true");
          data.set_admin_viewing_user_id(null);
          try {
            const cachedProf = localStorage.getItem(
              `lawyerAppUserProfile_${u.id}`,
            );
            if (cachedProf) setLiveUserProfile(JSON.parse(cachedProf));
          } catch (e) {}
          setSession({ user: u } as any);
          setIsAuthLoading(false);
        }}
        sync_log={syncLog}
        on_clear_log={clearSyncLog}
        is_local_empty={data.is_local_empty}
        is_update_available={data.is_update_available}
      />
    );

  // Immediately route platform admin accounts to AdminDashboard without showing the Lawyer Office UI,
  // unless the admin has explicitly chosen to browse a specific user's office from inside AdminDashboard
  // OR the admin has switched to their own main office view.
  if (
    ((profile && profile.role === "admin") || is_admin_email) &&
    !data.admin_viewing_user_id &&
    adminViewMode !== "office"
  ) {
    return (
      <DataProvider value={data}>
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-white flex items-center justify-center">
              <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
            </div>
          }
        >
          <AdminDashboard
            on_logout={handleLogout}
            on_open_config={() => setShowConfigModal(true)}
            on_open_main_office={() => {
              setAdminViewMode("office");
              setCurrentPage("home");
            }}
            on_open_accounting={() => {
              setAdminViewMode("office");
              setCurrentPage("accounting");
            }}
          />
        </Suspense>
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

  // Wait for cloud profile role verification only when local data is empty and profile is not yet cached
  if (isProfileResolving && !syncedProfile && !is_admin_email && data.is_local_empty) {
    return (
      <div
        className="fixed inset-0 bg-white flex flex-col items-center justify-center p-6 text-center"
        dir="rtl"
      >
        <ArrowPathIcon className="w-12 h-12 animate-spin text-blue-600 mb-4" />
        <h2 className="text-lg font-bold text-slate-800">
          جاري التحقق من صلاحيات الحساب...
        </h2>
      </div>
    );
  }

  if (
    (data.is_data_loading ||
      data.sync_status === "syncing" ||
      data.sync_status === "loading" ||
      isCreatingProfile) &&
    !profile &&
    data.is_local_empty // Only show loading screen if local data is empty
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
        on_login_success={(u) => {
          sessionStorage.setItem(`just_logged_in_user_${u.id}`, "true");
          setSession({ user: u } as any);
        }}
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
    !is_admin_email &&
    (!profile.is_approved || !profile.is_active)
  )
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 bg-white flex items-center justify-center">
            <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        }
      >
        <PendingApprovalPage
          onLogout={handleLogout}
          profile={profile}
          profiles={data.profiles}
        />
      </Suspense>
    );
  if (
    profile &&
    profile.role !== "admin" &&
    !is_admin_email &&
    profile.subscription_end_date &&
    is_before_today(profile.subscription_end_date)
  )
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 bg-white flex items-center justify-center">
            <ArrowPathIcon className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        }
      >
        <SubscriptionExpiredPage onLogout={handleLogout} />
      </Suspense>
    );

  const pending_assistants_count = (data.profiles || []).filter(
    (p) => p.lawyer_id === session?.user?.id && !p.is_approved
  ).length;

  return (
    <DataProvider value={data}>
      <div className="flex flex-col h-screen print:h-auto bg-gray-50 print:bg-white">
        {data.admin_viewing_user_id && data.admin_viewing_user_id !== session?.user?.id ? (
          <div className="bg-red-600 text-white p-2 text-center text-sm font-bold flex justify-center items-center gap-4 z-50 sticky top-0 shadow-md">
            <span>
              أنت الآن تتصفح بيانات مكتب:{" "}
              {data.profiles.find((p) => p.id === data.admin_viewing_user_id)?.full_name || "مستخدم آخر"}
            </span>
            <button
              onClick={() => {
                data.set_admin_viewing_user_id(null);
                setAdminViewMode("dashboard");
              }}
              className="bg-white text-red-600 px-3 py-1 rounded-md text-xs hover:bg-red-50 transition-colors shadow-sm font-bold"
            >
              العودة للوحة الإدارة
            </button>
          </div>
        ) : ((profile && profile.role === "admin") || is_admin_email) && (adminViewMode === "office" || data.admin_viewing_user_id === session?.user?.id) ? (
          <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white px-4 py-2 text-center text-xs sm:text-sm font-bold flex flex-wrap justify-between items-center gap-2 z-50 sticky top-0 shadow-md">
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              أنت الآن في: <strong>المكتب الرئيسي (مكتب المحامي)</strong> - كامل الصلاحيات وقسم المحاسبة متاح
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage("accounting")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-colors shadow-sm ${currentPage === "accounting" ? "bg-white text-blue-900 shadow" : "bg-white/20 text-white hover:bg-white/30"}`}
              >
                قسم المحاسبة
              </button>
              <button
                onClick={() => {
                  data.set_admin_viewing_user_id(null);
                  setAdminViewMode("dashboard");
                }}
                className="bg-white text-indigo-900 hover:bg-blue-50 px-3 py-1 rounded-md text-xs font-bold transition-colors shadow-sm"
              >
                العودة للوحة الإدارة
              </button>
            </div>
          </div>
        ) : null}
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
          pending_assistants_count={pending_assistants_count}
          is_admin={is_admin_email || data.is_admin}
          on_go_to_admin={
            is_admin_email || data.is_admin
              ? () => {
                  data.set_admin_viewing_user_id(null);
                  setAdminViewMode("dashboard");
                }
              : undefined
          }
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
          <Suspense
            fallback={
              <div className="p-8 flex items-center justify-center">
                <ArrowPathIcon className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            }
          >
            {currentPage === "accounting" && (
              <AccountingPage clear_initial_invoice_data={() => {}} />
            )}
            {currentPage === "settings" && (
              <SettingsPage
                onNavigate={(page) => setCurrentPage(page as Page)}
                onLogout={handleLogout}
              />
            )}
            {currentPage === "logs" && <ActivityLogsPage />}
          </Suspense>
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
              // Sync with CaseTask if case_id exists
              if ((taskData as any).case_id) {
                data.set_clients((prev: any[]) => prev.map(client => ({
                    ...client,
                    cases: client.cases.map((c: any) => c.id === (taskData as any).case_id ? {
                        ...c,
                        tasks: c.tasks.map((t: any) => t.id === taskData.id ? { ...t, ...taskData } : t)
                    } : c)
                })));
              }
            } else {
              const newTaskId = `task-${Date.now()}`;
              const newTaskObj = {
                ...taskData,
                id: newTaskId,
                completed: false,
                user_id: data.effective_user_id,
                updated_at: new Date().toISOString(),
              };
              data.set_admin_tasks((prev: any[]) => [
                ...prev,
                newTaskObj,
              ]);
              if ((taskData as any).case_id) {
                data.set_clients((prev: any[]) =>
                  prev.map((client) => ({
                    ...client,
                    cases: client.cases.map((c: any) =>
                      c.id === (taskData as any).case_id
                        ? {
                            ...c,
                            tasks: [
                              ...(c.tasks || []),
                              {
                                id: newTaskId,
                                task: taskData.task,
                                due_date: taskData.due_date,
                                completed: false,
                                importance: taskData.importance,
                                assignee: taskData.assignee,
                                image_url: taskData.image_url,
                                updated_at: newTaskObj.updated_at,
                              },
                            ],
                          }
                        : c,
                    ),
                  })),
                );
              }
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
          is_admin={is_admin_email || data.is_admin}
        />
        {data.whatsapp_share_data && (
          <WhatsAppChooserModal
            text={data.whatsapp_share_data.text}
            phone={data.whatsapp_share_data.phone}
            onClose={() => data.set_whatsapp_share_data(null)}
          />
        )}
      </div>
    </DataProvider>
  );
};

export default App;

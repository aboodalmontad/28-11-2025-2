import * as React from "react";
import AdminPage from "./AdminPage";
import {
  PowerIcon,
  UserGroupIcon,
  UserIcon,
  ChartPieIcon,
  Bars3Icon,
  XMarkIcon,
  CurrencyDollarIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  CloudArrowDownIcon,
  ListBulletIcon,
} from "../components/icons";
import { useData } from "../context/DataContext";
import AdminAnalyticsPage from "./AdminAnalyticsPage";
import SiteFinancesPage from "./SiteFinancesPage";
import AdminTestsPage from "./AdminTestsPage";
import AdminSettingsPage from "./AdminSettingsPage";
import AdminActivityLogsPage from "./AdminActivityLogsPage";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { fetch_data_from_supabase } from "../hooks/useOnlineData";
import { useFeedback } from "../context/FeedbackContext";

interface AdminDashboardProps {
  on_logout: () => void;
  on_open_config: () => void;
}

type AdminView =
  | "analytics"
  | "users"
  | "activity_logs"
  | "finances"
  | "settings"
  | "tests";

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
      is_active ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-200"
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

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  on_logout,
  on_open_config,
}) => {
  const {
    profiles,
    is_data_loading: loading,
    admin_viewing_user_id,
    set_admin_viewing_user_id,
    unfiltered_data,
    is_update_available,
    manual_sync,
    sync_status,
  } = useData();
  const { showFeedback, confirm } = useFeedback();
  const [view, set_view] = React.useState<AdminView>("users");
  const [is_mobile_menu_open, set_is_mobile_menu_open] = React.useState(false);
  const [is_backing_up, set_is_backing_up] = React.useState(false);
  const [is_syncing, set_is_syncing] = React.useState(false);
  const is_online = useOnlineStatus();

  const isSyncActive = is_syncing || sync_status === "syncing";

  const handle_admin_sync = async () => {
    if (isSyncActive) return;
    if (!is_online) {
      showFeedback("لا يوجد اتصال بالإنترنت لإجراء المزامنة.", "warning");
      return;
    }
    set_is_syncing(true);
    try {
      showFeedback("جاري مزامنة وتحديث كافة بيانات لوحة التحكم من السحابة...", "info");
      await manual_sync({ force: true });
      showFeedback("تمت مزامنة وتحديث جميع بيانات لوحة التحكم بنجاح.", "success");
    } catch (error: any) {
      console.error("Admin sync failed:", error);
      showFeedback(`فشلت المزامنة: ${error?.message || "تعذر إكمال العملية"}`, "error");
    } finally {
      set_is_syncing(false);
    }
  };

  const viewing_user_stats = React.useMemo(() => {
    if (!admin_viewing_user_id || !unfiltered_data) return null;
    const user_clients = unfiltered_data.clients.filter(
      (c: any) => c.user_id === admin_viewing_user_id,
    );
    const user_cases = user_clients.flatMap((c: any) => c.cases || []);
    const user_sessions = user_cases.flatMap((cs: any) =>
      (cs.stages || []).flatMap((st: any) => st.sessions || []),
    );
    const user_documents = (unfiltered_data.documents || []).filter(
      (d: any) => d.user_id === admin_viewing_user_id,
    );

    return {
      clients: user_clients.length,
      active_cases: user_cases.filter((cs: any) => cs.status === "active")
        .length,
      sessions: user_sessions.length,
      documents: user_documents.length,
    };
  }, [admin_viewing_user_id, unfiltered_data]);

  const pending_users_count = React.useMemo(() => {
    return profiles.filter((p) => !p.is_approved && p.role !== "admin").length;
  }, [profiles]);

  const handle_admin_backup = async () => {
    if (is_backing_up) return;
    set_is_backing_up(true);
    try {
      const fullData = await fetch_data_from_supabase();
      const adminOnlyData = {
        profiles: fullData.profiles || [],
        site_finances: fullData.site_finances || [],
        assistants: fullData.assistants || [],
        sync_deletions: fullData.sync_deletions || [],
      };
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `lawyer_admin_only_backup_${timestamp}.json`;
      const jsonString = JSON.stringify(adminOnlyData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showFeedback("تم تحميل نسخة بيانات لوحة التحكم بنجاح.", "success");
    } catch (error: any) {
      console.error("Admin backup failed:", error);
      showFeedback(`فشل النسخ الاحتياطي: ${error.message}`, "error");
    } finally {
      set_is_backing_up(false);
    }
  };

  const handle_hard_refresh = () => {
    confirm({
      title: "تحديث النظام",
      message:
        "هل تريد مسح الذاكرة المؤقتة وتحديث النظام؟ سيتم إعادة تحميل الصفحة.",
      confirmText: "تحديث ومسح الكاش",
      cancelText: "إلغاء",
      variant: "danger",
      onConfirm: async () => {
        try {
          if ("serviceWorker" in navigator) {
            const registrations =
              await navigator.serviceWorker.getRegistrations();
            for (let registration of registrations) {
              await registration.unregister();
            }
          }
          if ("caches" in window) {
            const cacheNames = await caches.keys();
            for (let name of cacheNames) {
              await caches.delete(name);
            }
          }
          localStorage.setItem("app_version", "30-04-2026");
          window.location.reload();
        } catch (error) {
          console.error("Error clearing cache:", error);
          window.location.reload();
        }
      },
    });
  };

  // Automatically unlock audio and vibration on component mount.
  React.useEffect(() => {
    const unlock_audio_and_vibration = () => {
      const silent_audio = new Audio(
        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
      );
      const try_vibrate = () => {
        if ("vibrate" in navigator && typeof navigator.vibrate === "function") {
          navigator.vibrate(0);
        }
      };
      const attempt_play = () => silent_audio.play();
      attempt_play()
        .then(() => {
          try_vibrate();
        })
        .catch(() => {
          const enable_on_interaction = () => {
            attempt_play().catch(() => {});
            try_vibrate();
          };
          window.addEventListener("click", enable_on_interaction, {
            once: true,
          });
          window.addEventListener("touchend", enable_on_interaction, {
            once: true,
          });
        });
    };
    unlock_audio_and_vibration();
  }, []);

  const render_view = () => {
    switch (view) {
      case "analytics":
        return <AdminAnalyticsPage />;
      case "users":
        return <AdminPage />;
      case "activity_logs":
        return <AdminActivityLogsPage />;
      case "finances":
        return <SiteFinancesPage />;
      case "settings":
        return <AdminSettingsPage on_open_config={on_open_config} />;
      case "tests":
        return <AdminTestsPage />;
      default:
        return <AdminPage />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        جاري تحميل...
      </div>
    );
  }

  const nav_items = [
    {
      id: "users",
      label: "المستخدمين",
      icon: <UserGroupIcon className="w-5 h-5" />,
      badge: pending_users_count,
    },
    {
      id: "activity_logs",
      label: "سجل النشاطات",
      icon: <ListBulletIcon className="w-5 h-5" />,
    },
    {
      id: "analytics",
      label: "التحليلات",
      icon: <ChartPieIcon className="w-5 h-5" />,
    },
    {
      id: "finances",
      label: "المالية",
      icon: <CurrencyDollarIcon className="w-5 h-5" />,
    },
    {
      id: "tests",
      label: "الاختبارات",
      icon: <ExclamationTriangleIcon className="w-5 h-5" />,
    },
    {
      id: "settings",
      label: "الإعدادات",
      icon: <Cog6ToothIcon className="w-5 h-5" />,
    },
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
              <span className="font-bold text-slate-800 hidden md:block">
                لوحة الإدارة
              </span>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {nav_items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => set_view(item.id as AdminView)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all relative ${
                    view === item.id
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-600 hover:bg-slate-100"
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
              <button
                onClick={handle_admin_sync}
                disabled={isSyncActive || !is_online}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg sm:rounded-full shadow-sm transition-all disabled:opacity-50"
                title="مزامنة وتحديث كافة بيانات لوحة التحكم من السحابة"
              >
                <ArrowPathIcon
                  className={`w-3.5 h-3.5 ${isSyncActive ? "animate-spin" : ""}`}
                />
                <span className="hidden sm:inline">
                  {isSyncActive ? "جاري المزامنة..." : "مزامنة البيانات"}
                </span>
                <span className="sm:hidden">
                  {isSyncActive ? "مزامنة..." : "مزامنة"}
                </span>
              </button>

              <button
                onClick={handle_admin_backup}
                disabled={is_backing_up}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-[10px] font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-full shadow-sm transition-all active:scale-95 disabled:opacity-50"
                title="تحميل نسخة احتياطية لبيانات لوحة التحكم"
              >
                {is_backing_up ? (
                  <ArrowPathIcon className="w-3 h-3 animate-spin" />
                ) : (
                  <CloudArrowDownIcon className="w-3 h-3" />
                )}
                نسخة الإدارة
              </button>
              {is_update_available && (
                <button
                  onClick={handle_hard_refresh}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-[10px] font-black text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-sm transition-all active:scale-95 animate-pulse"
                  title="تحديث النظام ومسح الكاش"
                >
                  <ArrowPathIcon className="w-3 h-3" />
                  تحديث (18-8-2026)
                </button>
              )}
              <div className={`hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-bold ${is_online ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-700 border-red-100"}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${is_online ? "bg-green-500 animate-pulse" : "bg-red-500"}`}></div>
                {is_online ? "متصل" : "غير متصل"}
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
                {is_mobile_menu_open ? (
                  <XMarkIcon className="w-6 h-6" />
                ) : (
                  <Bars3Icon className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {is_mobile_menu_open && (
          <div className="md:hidden bg-white border-t border-slate-100 p-2 space-y-2 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <button
              onClick={() => {
                handle_admin_sync();
                set_is_mobile_menu_open(false);
              }}
              disabled={isSyncActive || !is_online}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon
                className={`w-4 h-4 ${isSyncActive ? "animate-spin" : ""}`}
              />
              <span>
                {isSyncActive
                  ? "جاري المزامنة والتحديث..."
                  : "مزامنة وتحديث كافة بيانات لوحة التحكم"}
              </span>
            </button>
            <div className="border-t border-slate-100 my-1"></div>
            {nav_items.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  set_view(item.id as AdminView);
                  set_is_mobile_menu_open(false);
                }}
                className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
                  view === item.id
                    ? "bg-blue-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
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
        {admin_viewing_user_id && (
          <div className="mb-6 bg-blue-600 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-100 uppercase tracking-widest">
                  أنت تشاهد حالياً بيانات:
                </p>
                <p className="text-2xl font-black">
                  {profiles.find((p) => p.id === admin_viewing_user_id)
                    ?.full_name || "مستخدم غير معروف"}
                </p>
              </div>
            </div>

            {viewing_user_stats && (
              <div className="flex flex-wrap items-center gap-4 md:gap-8 bg-white/10 p-4 rounded-xl border border-white/10">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-blue-100 uppercase">
                    الموكلين
                  </p>
                  <p className="text-xl font-black">
                    {viewing_user_stats.clients}
                  </p>
                </div>
                <div className="w-px h-8 bg-white/20 hidden sm:block"></div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-blue-100 uppercase">
                    القضايا النشطة
                  </p>
                  <p className="text-xl font-black">
                    {viewing_user_stats.active_cases}
                  </p>
                </div>
                <div className="w-px h-8 bg-white/20 hidden sm:block"></div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-blue-100 uppercase">
                    الجلسات
                  </p>
                  <p className="text-xl font-black">
                    {viewing_user_stats.sessions}
                  </p>
                </div>
                <div className="w-px h-8 bg-white/20 hidden sm:block"></div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-blue-100 uppercase">
                    الوثائق
                  </p>
                  <p className="text-xl font-black">
                    {viewing_user_stats.documents}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => set_admin_viewing_user_id(null)}
              className="px-8 py-3 bg-white text-blue-600 font-bold rounded-xl hover:bg-blue-50 transition-all shadow-md active:scale-95 shrink-0"
            >
              العودة للوحة الإدارة
            </button>
          </div>
        )}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">
            {view === "users" && "إدارة المستخدمين"}
            {view === "analytics" && "التحليلات والإحصائيات"}
            {view === "finances" && "المحاسبة المالية"}
            {view === "tests" && "اختبارات النظام"}
            {view === "settings" && "إعدادات الإدارة"}
          </h1>
        </div>
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {render_view()}
        </div>
      </main>

      {/* Footer / Info */}
      <footer className="bg-white border-t border-slate-200 py-3 px-6 text-center no-print">
        <p className="text-[10px] text-slate-400 font-medium">
          نظام إدارة المحاماة - الإصدار: 18-8-2026
        </p>
      </footer>
    </div>
  );
};

export default AdminDashboard;

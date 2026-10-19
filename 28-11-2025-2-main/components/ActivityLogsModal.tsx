import * as React from "react";
import {
  XMarkIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  ListBulletIcon,
  CalendarIcon,
  UserIcon,
  PrintIcon,
  ArrowDownTrayIcon,
  KeyIcon,
  ShieldCheckIcon,
} from "./icons";
import { get_supabase_client } from "../supabaseClient";
import { useData } from "../context/DataContext";

interface ActivityLogsModalProps {
  onClose: () => void;
}

export const ActivityLogsModal: React.FC<ActivityLogsModalProps> = ({ onClose }) => {
  const { audit_logs = [], profiles = [], current_user_profile, user_id } = useData();
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Main Tab: "activities" (General operations) | "logins" (Login sessions)
  const [activeTab, setActiveTab] = React.useState<"activities" | "logins">("activities");

  // Filters State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedUser, setSelectedUser] = React.useState("all");
  const [selectedDepartment, setSelectedDepartment] = React.useState("all");
  const [selectedAction, setSelectedAction] = React.useState("all");
  const [dateFilterPreset, setDateFilterPreset] = React.useState<string>("all"); // all, today, yesterday, last7, last30, thisMonth, custom
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");

  const effectiveOfficeId = current_user_profile?.lawyer_id || user_id || "";

  const fetchLogs = async () => {
    setLoading(true);
    const profilesMap = new Map();
    profiles.forEach((p: any) => {
      profilesMap.set(p.id, p.full_name || p.mobile_number || "مستخدم");
    });

    let remoteLogs: any[] = [];
    const supabase = get_supabase_client();
    if (supabase) {
      try {
        let query = supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500);

        // If not system admin, filter by office
        if (current_user_profile?.role !== "admin" && effectiveOfficeId) {
          query = query.or(`office_id.eq.${effectiveOfficeId},user_id.eq.${user_id}`);
        }

        const { data: logsData, error } = await query;
        if (!error && logsData) {
          remoteLogs = logsData;
        }
      } catch (e) {
        // Table might not exist yet, fallback gracefully
      }
    }

    let localStoredLogs: any[] = [];
    try {
      const officeKey = effectiveOfficeId ? `local_audit_logs_${effectiveOfficeId}` : "local_audit_logs";
      const storedOffice = localStorage.getItem(officeKey);
      const storedGeneric = localStorage.getItem("local_audit_logs");

      const parsedOffice = storedOffice ? JSON.parse(storedOffice) : [];
      const parsedGeneric = storedGeneric ? JSON.parse(storedGeneric) : [];
      localStoredLogs = [...parsedOffice, ...parsedGeneric];
    } catch (e) {
      // ignore
    }

    // Smart deduplication (by action, entity, user, and close timestamp window)
    const uniqueMap = new Map();
    [...remoteLogs, ...audit_logs, ...localStoredLogs].forEach((log) => {
      if (log && log.action && log.entity_type) {
        const timeKey = Math.floor(new Date(log.created_at || Date.now()).getTime() / 60000);
        const signature = `${log.user_id || ""}_${log.action}_${log.entity_type}_${log.entity_id || ""}_${log.details || ""}_${timeKey}`;

        if (!uniqueMap.has(signature)) {
          uniqueMap.set(signature, log);
        } else {
          const existing = uniqueMap.get(signature);
          // Prefer database remote log over local ID
          if (log.id && typeof log.id === "number" && typeof existing.id !== "number") {
            uniqueMap.set(signature, log);
          }
        }
      }
    });

    const allLogs = Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const enrichedLogs = allLogs.map((log: any) => {
      const resolvedName =
        log.user_name ||
        profilesMap.get(log.user_id) ||
        (log.user_id === user_id ? current_user_profile?.full_name || "أنا" : log.user_id) ||
        "مستخدم";
      return {
        ...log,
        user_name: resolvedName,
      };
    });

    setLogs(enrichedLogs);
    setLoading(false);
  };

  React.useEffect(() => {
    fetchLogs();
  }, [audit_logs, profiles, effectiveOfficeId]);

  // Handle Preset Date changes
  const handleDatePresetChange = (preset: string) => {
    setDateFilterPreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    if (preset === "all") {
      setStartDate("");
      setEndDate("");
    } else if (preset === "today") {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const yStr = yesterday.toISOString().split("T")[0];
      setStartDate(yStr);
      setEndDate(yStr);
    } else if (preset === "last7") {
      const past7 = new Date();
      past7.setDate(now.getDate() - 7);
      setStartDate(past7.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "last30") {
      const past30 = new Date();
      past30.setDate(now.getDate() - 30);
      setStartDate(past30.toISOString().split("T")[0]);
      setEndDate(todayStr);
    } else if (preset === "thisMonth") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().split("T")[0]);
      setEndDate(todayStr);
    }
  };

  // Base classification into Activities vs Logins
  const allActivityLogs = React.useMemo(() => {
    return logs.filter((l) => !(l.action || "").includes("LOGIN") && l.entity_type !== "auth");
  }, [logs]);

  const allLoginLogs = React.useMemo(() => {
    return logs.filter((l) => (l.action || "").includes("LOGIN") || l.entity_type === "auth");
  }, [logs]);

  // Filtered logs calculation based on activeTab and filters
  const filteredLogs = React.useMemo(() => {
    const sourceLogs = activeTab === "activities" ? allActivityLogs : allLoginLogs;

    return sourceLogs.filter((log) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDetails = (log.details || "").toLowerCase().includes(q);
        const matchesUser = (log.user_name || "").toLowerCase().includes(q);
        const matchesAction = (log.action || "").toLowerCase().includes(q);
        const matchesEntity = (log.entity_type || "").toLowerCase().includes(q);
        if (!matchesDetails && !matchesUser && !matchesAction && !matchesEntity) {
          return false;
        }
      }

      // 2. User Filter
      if (selectedUser !== "all") {
        if (log.user_id !== selectedUser && log.user_name !== selectedUser) {
          return false;
        }
      }

      // 3. Department Filter (Only for activities tab)
      if (activeTab === "activities" && selectedDepartment !== "all") {
        if (log.entity_type?.toLowerCase() !== selectedDepartment.toLowerCase()) {
          return false;
        }
      }

      // 4. Action Filter (Only for activities tab)
      if (activeTab === "activities" && selectedAction !== "all") {
        if (selectedAction === "CREATE" && !log.action?.includes("CREATE") && !log.action?.includes("ADD")) {
          return false;
        }
        if (selectedAction === "UPDATE" && !log.action?.includes("UPDATE") && !log.action?.includes("EDIT")) {
          return false;
        }
        if (selectedAction === "DELETE" && !log.action?.includes("DELETE") && !log.action?.includes("REMOVE")) {
          return false;
        }
        if (selectedAction === "POSTPONE" && !log.action?.includes("POSTPONE")) {
          return false;
        }
      }

      // 5. Date Filter
      if (startDate || endDate) {
        const logDate = (log.created_at || "").split("T")[0];
        if (startDate && logDate < startDate) return false;
        if (endDate && logDate > endDate) return false;
      }

      return true;
    });
  }, [
    activeTab,
    allActivityLogs,
    allLoginLogs,
    searchQuery,
    selectedUser,
    selectedDepartment,
    selectedAction,
    startDate,
    endDate,
  ]);

  // Statistics for Current Tab
  const stats = React.useMemo(() => {
    let creates = 0;
    let updates = 0;
    let deletes = 0;
    let postpones = 0;
    const activeUsersSet = new Set<string>();

    filteredLogs.forEach((l) => {
      if (l.user_id) activeUsersSet.add(l.user_id);
      const act = l.action || "";
      if (act.includes("CREATE") || act.includes("ADD")) creates++;
      else if (act.includes("DELETE") || act.includes("REMOVE")) deletes++;
      else if (act.includes("POSTPONE")) postpones++;
      else updates++;
    });

    return {
      total: filteredLogs.length,
      creates,
      updates,
      deletes,
      postpones,
      uniqueUsersCount: activeUsersSet.size,
    };
  }, [filteredLogs]);

  // Labels & Formatters
  const getActionBadge = (action: string) => {
    if (!action) return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">إجراء</span>;
    if (action.includes("LOGIN")) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-fit mx-auto">
          <KeyIcon className="w-3 h-3" />
          تسجيل دخول
        </span>
      );
    }
    if (action.includes("CREATE") || action.includes("ADD")) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          إضافة
        </span>
      );
    }
    if (action.includes("DELETE") || action.includes("REMOVE")) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          حذف
        </span>
      );
    }
    if (action.includes("POSTPONE")) {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          تأجيل جلسة
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        تعديل
      </span>
    );
  };

  const getEntityTypeLabel = (type: string) => {
    if (!type) return "عام";
    const map: Record<string, string> = {
      client: "الموكلين",
      case: "القضايا",
      stage: "المراحل",
      session: "الجلسات",
      appointment: "المواعيد",
      accounting: "المالية والمحاسبة",
      invoice: "الفواتير",
      document: "الوثائق",
      auth: "المصادقة والنظام",
      admin_task: "المهام الإدارية",
    };
    return map[type.toLowerCase()] || type;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("ar-SY", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    try {
      const isLoginTab = activeTab === "logins";
      const headers = isLoginTab
        ? ["التاريخ والوقت", "المستخدم", "النوع", "التفاصيل"]
        : ["التاريخ والوقت", "المستخدم", "الإجراء", "القسم", "التفاصيل"];

      const rows = filteredLogs.map((l) =>
        isLoginTab
          ? [
              `"${formatDate(l.created_at)}"`,
              `"${l.user_name || ""}"`,
              `"تسجيل دخول"`,
              `"${(l.details || "").replace(/"/g, '""')}"`,
            ]
          : [
              `"${formatDate(l.created_at)}"`,
              `"${l.user_name || ""}"`,
              `"${l.action || ""}"`,
              `"${getEntityTypeLabel(l.entity_type)}"`,
              `"${(l.details || "").replace(/"/g, '""')}"`,
            ]
      );

      const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `${isLoginTab ? "login_sessions" : "activity_logs"}_${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Unique list of users for dropdown
  const uniqueUsers = React.useMemo(() => {
    const userMap = new Map<string, string>();
    profiles.forEach((p: any) => {
      userMap.set(p.id, p.full_name || p.mobile_number || "مستخدم");
    });
    logs.forEach((l) => {
      if (l.user_id && l.user_name) {
        userMap.set(l.user_id, l.user_name);
      }
    });
    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [profiles, logs]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-gray-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-gray-200">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between p-4 sm:px-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border-b no-print">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">سجل نشاطات وتدقيق المكتب</h2>
              <span className="text-xs bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30">
                {logs.length} إجمالي السجلات
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              متابعة أنشطة وتعديلات وجلسات دخول مستخدمي المكتب مع إمكانية الرجوع إلى أي تاريخ سابق
            </p>
          </div>

          <div className="flex items-center gap-2 mt-3 sm:mt-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/80 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600"
              title="طباعة السجل"
            >
              <PrintIcon className="w-4 h-4" />
              <span className="hidden sm:inline">طباعة</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-700/80 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-600"
              title="تصدير كملف إكسل / CSV"
            >
              <ArrowDownTrayIcon className="w-4 h-4" />
              <span className="hidden sm:inline">تصدير CSV</span>
            </button>
            <button
              onClick={fetchLogs}
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700/80 rounded-lg transition-colors"
              title="تحديث السجل"
            >
              <ArrowPathIcon className={`w-5 h-5 ${loading ? "animate-spin text-blue-400" : ""}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-rose-600/80 rounded-lg transition-colors"
              title="إغلاق"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Tabs Header (الألسنة والتبويبات) */}
        <div className="flex items-center gap-2 px-4 sm:px-6 pt-3 bg-slate-100 border-b border-gray-200 no-print">
          <button
            onClick={() => {
              setActiveTab("activities");
              setSelectedAction("all");
              setSelectedDepartment("all");
            }}
            className={`flex items-center gap-2 py-2.5 px-4 font-semibold text-sm rounded-t-xl transition-all border-t border-x ${
              activeTab === "activities"
                ? "bg-white text-indigo-700 border-gray-200 border-b-white shadow-xs -mb-px"
                : "bg-slate-200/70 text-slate-600 border-transparent hover:bg-slate-200 hover:text-slate-800"
            }`}
          >
            <ListBulletIcon className="w-4 h-4" />
            <span>سجل العمليات والأنشطة</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "activities" ? "bg-indigo-100 text-indigo-700" : "bg-slate-300/80 text-slate-700"
              }`}
            >
              {allActivityLogs.length}
            </span>
          </button>

          <button
            onClick={() => {
              setActiveTab("logins");
              setSelectedAction("all");
              setSelectedDepartment("all");
            }}
            className={`flex items-center gap-2 py-2.5 px-4 font-semibold text-sm rounded-t-xl transition-all border-t border-x ${
              activeTab === "logins"
                ? "bg-white text-emerald-700 border-gray-200 border-b-white shadow-xs -mb-px"
                : "bg-slate-200/70 text-slate-600 border-transparent hover:bg-slate-200 hover:text-slate-800"
            }`}
          >
            <KeyIcon className="w-4 h-4" />
            <span>سجل تسجيلات الدخول</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                activeTab === "logins" ? "bg-emerald-100 text-emerald-700" : "bg-slate-300/80 text-slate-700"
              }`}
            >
              {allLoginLogs.length}
            </span>
          </button>
        </div>

        {/* Quick KPI Stats Bar (يتغير بحسب التبويب النشط) */}
        {activeTab === "activities" ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-3 sm:px-6 bg-slate-50 border-b border-gray-200 text-center no-print">
            <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
              <div className="text-xs text-gray-500 font-medium">إجمالي العمليات</div>
              <div className="text-lg font-bold text-gray-800">{stats.total}</div>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-xs">
              <div className="text-xs text-blue-600 font-medium">عمليات الإضافة</div>
              <div className="text-lg font-bold text-blue-700">{stats.creates}</div>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-amber-100 shadow-xs">
              <div className="text-xs text-amber-600 font-medium">عمليات التعديل</div>
              <div className="text-lg font-bold text-amber-700">{stats.updates}</div>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-rose-100 shadow-xs">
              <div className="text-xs text-rose-600 font-medium">عمليات الحذف</div>
              <div className="text-lg font-bold text-rose-700">{stats.deletes}</div>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-white p-2.5 rounded-xl border border-purple-100 shadow-xs">
              <div className="text-xs text-purple-600 font-medium">تأجيل الجلسات</div>
              <div className="text-lg font-bold text-purple-700">{stats.postpones}</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 sm:px-6 bg-emerald-50/40 border-b border-emerald-100 text-center no-print">
            <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between px-4">
              <div className="text-right">
                <div className="text-xs text-gray-500 font-medium">إجمالي جلسات الدخول</div>
                <div className="text-lg font-bold text-emerald-800">{stats.total}</div>
              </div>
              <KeyIcon className="w-7 h-7 text-emerald-500 opacity-75" />
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between px-4">
              <div className="text-right">
                <div className="text-xs text-gray-500 font-medium">المستخدمون النشطون في الفترة</div>
                <div className="text-lg font-bold text-emerald-800">{stats.uniqueUsersCount}</div>
              </div>
              <UserIcon className="w-7 h-7 text-emerald-500 opacity-75" />
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between px-4">
              <div className="text-right">
                <div className="text-xs text-gray-500 font-medium">حالة التوثيق والأمان</div>
                <div className="text-sm font-bold text-emerald-700">جلسات موثقة ومؤمنة</div>
              </div>
              <ShieldCheckIcon className="w-7 h-7 text-emerald-500 opacity-75" />
            </div>
          </div>
        )}

        {/* Advanced Filters & Search Bar */}
        <div className="p-4 sm:px-6 bg-white border-b border-gray-200 space-y-3 no-print">
          {/* Row 1: Search & Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className={activeTab === "activities" ? "sm:col-span-5 relative" : "sm:col-span-8 relative"}>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <MagnifyingGlassIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === "activities"
                    ? "ابحث في التفاصيل، اسم الموكل، المهمة، أو المستخدم..."
                    : "ابحث في سجل الدخول، اسم المستخدم، أو التفاصيل..."
                }
                className="w-full pr-9 pl-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter by User */}
            <div className={activeTab === "activities" ? "sm:col-span-3" : "sm:col-span-4"}>
              <div className="relative">
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full py-2 pr-8 pl-3 text-sm border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
                >
                  <option value="all">👤 جميع المستخدمين ({uniqueUsers.length})</option>
                  {uniqueUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-gray-400">
                  <UserIcon className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Activities-Specific Dropdowns */}
            {activeTab === "activities" && (
              <>
                {/* Filter by Department */}
                <div className="sm:col-span-2">
                  <select
                    value={selectedDepartment}
                    onChange={(e) => setSelectedDepartment(e.target.value)}
                    className="w-full py-2 px-3 text-sm border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">📁 كل الأقسام</option>
                    <option value="client">الموكلين</option>
                    <option value="case">القضايا</option>
                    <option value="session">الجلسات</option>
                    <option value="admin_task">المهام</option>
                    <option value="appointment">المواعيد</option>
                    <option value="accounting">المحاسبة والمالية</option>
                    <option value="invoice">الفواتير</option>
                    <option value="document">المستندات</option>
                  </select>
                </div>

                {/* Filter by Action */}
                <div className="sm:col-span-2">
                  <select
                    value={selectedAction}
                    onChange={(e) => setSelectedAction(e.target.value)}
                    className="w-full py-2 px-3 text-sm border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="all">⚡ كل الإجراءات</option>
                    <option value="CREATE">➕ إضافة</option>
                    <option value="UPDATE">✏️ تعديل</option>
                    <option value="DELETE">🗑️ حذف</option>
                    <option value="POSTPONE">⏱️ تأجيل جلسة</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Row 2: Date Selector & Quick Presets */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-gray-500 ml-1 flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5" />
                الفترة:
              </span>
              {[
                { id: "all", label: "كل التواريخ" },
                { id: "today", label: "اليوم" },
                { id: "yesterday", label: "أمس" },
                { id: "last7", label: "آخر 7 أيام" },
                { id: "last30", label: "آخر 30 يوماً" },
                { id: "thisMonth", label: "هذا الشهر" },
                { id: "custom", label: "مخصص / رجوع لتاريخ" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleDatePresetChange(p.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                    dateFilterPreset === p.id
                      ? activeTab === "activities"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-emerald-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Date Pickers (From / To) */}
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-200">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 whitespace-nowrap">من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDateFilterPreset("custom");
                  }}
                  className="text-xs p-1 border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-500 whitespace-nowrap">إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDateFilterPreset("custom");
                  }}
                  className="text-xs p-1 border border-gray-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                    setDateFilterPreset("all");
                  }}
                  className="text-xs text-gray-400 hover:text-rose-600 px-1 font-bold"
                  title="إلغاء تصفية التاريخ"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Logs Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/60">
          {loading && filteredLogs.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-20 gap-3">
              <ArrowPathIcon className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-sm text-gray-500">جاري تحميل سجل النشاطات من السحابة والذاكرة المحلية...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300 p-8">
              <ListBulletIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-700">
                {activeTab === "activities" ? "لا توجد نشاطات مطابقة للبحث" : "لا توجد تسجيلات دخول مطابقة للبحث"}
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
                جرب تغيير خيارات التصفية أو اختيار نطاق زمني مختلف أو تفريغ حقل البحث لعرض المزيد من السجلات.
              </p>
              {(searchQuery ||
                selectedUser !== "all" ||
                selectedDepartment !== "all" ||
                selectedAction !== "all" ||
                startDate ||
                endDate) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedUser("all");
                    setSelectedDepartment("all");
                    setSelectedAction("all");
                    setStartDate("");
                    setEndDate("");
                    setDateFilterPreset("all");
                  }}
                  className="mt-4 px-4 py-2 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                >
                  إعادة ضبط كل الفلاتر
                </button>
              )}
            </div>
          ) : activeTab === "activities" ? (
            /* Table for General Activities */
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-xs">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-100/80 text-slate-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-xs w-48">التاريخ والوقت</th>
                    <th className="px-4 py-3 text-xs w-44">المستخدم</th>
                    <th className="px-4 py-3 text-xs w-28 text-center">الإجراء</th>
                    <th className="px-4 py-3 text-xs w-32">القسم</th>
                    <th className="px-4 py-3 text-xs">التفاصيل والبيانات المعدلة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap" dir="ltr">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                            {(log.user_name || "م").substring(0, 1)}
                          </div>
                          <span
                            className="font-medium text-slate-900 text-xs truncate max-w-[130px]"
                            title={log.user_name}
                          >
                            {log.user_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">{getActionBadge(log.action)}</td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap">
                        <span className="px-2 py-1 bg-slate-100 rounded-md text-slate-600">
                          {getEntityTypeLabel(log.entity_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs">
                        <div className="font-normal text-slate-800 leading-relaxed break-words" title={log.details}>
                          {log.details}
                        </div>
                        {log.entity_id && (
                          <div className="text-[10px] font-mono text-slate-400 mt-0.5" dir="ltr">
                            ID: {log.entity_id}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Table for Login Sessions (تبويب تسجيلات الدخول) */
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-xs">
              <table className="w-full text-sm text-right">
                <thead className="bg-emerald-50/80 text-emerald-900 font-semibold border-b border-emerald-100">
                  <tr>
                    <th className="px-4 py-3 text-xs w-48">تاريخ ووقت الدخول</th>
                    <th className="px-4 py-3 text-xs w-52">المستخدم</th>
                    <th className="px-4 py-3 text-xs w-36 text-center">نوع الجلسة</th>
                    <th className="px-4 py-3 text-xs">التفاصيل والبيانات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50/60">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 whitespace-nowrap" dir="ltr">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold border border-emerald-200">
                            {(log.user_name || "م").substring(0, 1)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">{log.user_name}</div>
                            {log.user_id && (
                              <div className="text-[10px] font-mono text-slate-400" dir="ltr">
                                {log.user_id.substring(0, 8)}...
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <KeyIcon className="w-3.5 h-3.5" />
                          تسجيل دخول للنظام
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs">
                        <div className="font-medium text-slate-800">{log.details || "تم تسجيل الدخول بنجاح"}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="p-3 px-6 bg-slate-100 border-t border-gray-200 flex items-center justify-between text-xs text-slate-500 no-print">
          <div>
            يتم تخزين الأنشطة محلياً وسحابياً وتخصيصها لمكتبك تلقائياً لضمان الخصوصية والتدقيق الشامل.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded-lg border border-gray-300 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogsModal;

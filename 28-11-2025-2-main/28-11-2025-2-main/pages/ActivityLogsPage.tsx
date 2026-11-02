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
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
} from "../components/icons";
import { get_supabase_client } from "../supabaseClient";
import { useData } from "../context/DataContext";

interface ActivityLogsPageProps {}

const ActivityLogsPage: React.FC<ActivityLogsPageProps> = () => {
  const { audit_logs = [], profiles = [], current_user_profile, user_id } = useData();
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Main Tab: "activities" (General operations) | "logins" (Login sessions)
  const [activeTab, setActiveTab] = React.useState<"activities" | "logins">("activities");

  // Filter Collapse Toggle
  const [showFilters, setShowFilters] = React.useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedUser, setSelectedUser] = React.useState("all");
  const [selectedDepartment, setSelectedDepartment] = React.useState("all");
  const [selectedAction, setSelectedAction] = React.useState("all");
  const [dateFilterPreset, setDateFilterPreset] = React.useState<string>("all"); // all, today, yesterday, last7, last30, thisMonth, custom
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");

  // Pagination State
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  // Scroll Container Ref for Jump Buttons
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

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
          .limit(1000);

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

  // Reset pagination when active tab or filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, selectedUser, selectedDepartment, selectedAction, startDate, endDate, pageSize]);

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

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = React.useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredLogs.slice(startIdx, startIdx + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

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

  const handlePrint = () => {
    window.print();
  };

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
    <div className="space-y-6">
<h1 className="text-3xl font-bold text-gray-800">سجل نشاطات النظام</h1>
<div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-[70vh]">
        
        {/* Modal Header */}
        <div className="shrink-0 flex items-center justify-between p-3 sm:px-6 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white border-b border-slate-700 no-print">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
              <ShieldCheckIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-lg font-bold text-white">سجل نشاطات وتدقيق المكتب</h2>
                <span className="text-[10px] sm:text-[11px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full border border-indigo-400/30 font-medium">
                  {logs.length} سجل
                </span>
              </div>
              <p className="text-[10px] text-slate-300 hidden sm:block">
                متابعة وتدقيق العمليات والتعديلات وجلسات الدخول الخاّصة بالمكتب
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-1 px-2 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-indigo-200 rounded-lg border border-slate-700"
              title={showFilters ? "إخفاء الفلاتر لتكبير الجدول" : "إظهار الفلاتر"}
            >
              <Bars3Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{showFilters ? "إخفاء الفلاتر" : "عرض الفلاتر"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-lg border border-slate-600"
              title="طباعة"
            >
              <PrintIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">طباعة</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1 px-2 sm:px-3 py-1 text-xs font-medium bg-slate-700 hover:bg-slate-600 text-white rounded-lg border border-slate-600"
              title="تصدير CSV"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">CSV</span>
            </button>
            <button
              onClick={fetchLogs}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="تحديث"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin text-blue-400" : ""}`} />
            </button>
            
          </div>
        </div>

        {/* Main Tabs Header */}
        <div className="shrink-0 flex items-center justify-between px-3 sm:px-6 pt-2 bg-slate-100 border-b border-gray-200 no-print">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab("activities");
                setSelectedAction("all");
                setSelectedDepartment("all");
              }}
              className={`flex items-center gap-1.5 py-1.5 sm:py-2 px-3 sm:px-4 font-semibold text-xs sm:text-sm rounded-t-xl transition-all border-t border-x ${
                activeTab === "activities"
                  ? "bg-white text-indigo-700 border-gray-200 border-b-white shadow-xs -mb-px"
                  : "bg-slate-200/70 text-slate-600 border-transparent hover:bg-slate-200 hover:text-slate-800"
              }`}
            >
              <ListBulletIcon className="w-3.5 h-3.5" />
              <span>سجل العمليات والأنشطة</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
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
              className={`flex items-center gap-1.5 py-1.5 sm:py-2 px-3 sm:px-4 font-semibold text-xs sm:text-sm rounded-t-xl transition-all border-t border-x ${
                activeTab === "logins"
                  ? "bg-white text-emerald-700 border-gray-200 border-b-white shadow-xs -mb-px"
                  : "bg-slate-200/70 text-slate-600 border-transparent hover:bg-slate-200 hover:text-slate-800"
              }`}
            >
              <KeyIcon className="w-3.5 h-3.5" />
              <span>سجل تسجيلات الدخول</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === "logins" ? "bg-emerald-100 text-emerald-700" : "bg-slate-300/80 text-slate-700"
                }`}
              >
                {allLoginLogs.length}
              </span>
            </button>
          </div>

          {/* Quick jump actions */}
          <div className="hidden sm:flex items-center gap-1 text-[11px]">
            <button
              onClick={scrollToBottom}
              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-600 rounded border border-gray-300 shadow-2xs font-medium"
              title="القفز لأسفل القائمة"
            >
              ⬇️ لأسفل
            </button>
            <button
              onClick={scrollToTop}
              className="px-2 py-1 bg-white hover:bg-slate-50 text-slate-600 rounded border border-gray-300 shadow-2xs font-medium"
              title="القفز لأعلى القائمة"
            >
              ⬆️ لأعلى
            </button>
          </div>
        </div>

        {/* Collapsible Filters & Stats Section */}
        {showFilters && (
          <div className="shrink-0 bg-white border-b border-gray-200 no-print transition-all">
            {/* Quick KPI Stats Bar */}
            {activeTab === "activities" ? (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-2 sm:px-6 bg-slate-50/80 border-b border-gray-200 text-center text-xs">
                <div className="bg-white p-1.5 rounded-lg border border-gray-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-medium">العمليات: </span>
                  <span className="font-bold text-gray-800">{stats.total}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-blue-100 shadow-2xs">
                  <span className="text-[10px] text-blue-600 font-medium">إضافة: </span>
                  <span className="font-bold text-blue-700">{stats.creates}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-amber-100 shadow-2xs">
                  <span className="text-[10px] text-amber-600 font-medium">تعديل: </span>
                  <span className="font-bold text-amber-700">{stats.updates}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-rose-100 shadow-2xs">
                  <span className="text-[10px] text-rose-600 font-medium">حذف: </span>
                  <span className="font-bold text-rose-700">{stats.deletes}</span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-white p-1.5 rounded-lg border border-purple-100 shadow-2xs">
                  <span className="text-[10px] text-purple-600 font-medium">تأجيل: </span>
                  <span className="font-bold text-purple-700">{stats.postpones}</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2 sm:px-6 bg-emerald-50/40 border-b border-emerald-100 text-center text-xs">
                <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-medium">جلسات الدخول: </span>
                  <span className="font-bold text-emerald-800">{stats.total}</span>
                </div>
                <div className="bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] text-gray-500 font-medium">المستخدمون: </span>
                  <span className="font-bold text-emerald-800">{stats.uniqueUsersCount}</span>
                </div>
                <div className="col-span-2 sm:col-span-1 bg-white p-1.5 rounded-lg border border-emerald-200 shadow-2xs">
                  <span className="text-[10px] text-emerald-700 font-semibold">تأمين ومصادقة سحابية</span>
                </div>
              </div>
            )}

            {/* Filter Controls Bar */}
            <div className="p-2.5 sm:px-6 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                {/* Search Input */}
                <div className={activeTab === "activities" ? "sm:col-span-5 relative" : "sm:col-span-7 relative"}>
                  <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-gray-400">
                    <MagnifyingGlassIcon className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث..."
                    className="w-full pr-8 pl-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 bg-gray-50 focus:bg-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Filter User */}
                <div className={activeTab === "activities" ? "sm:col-span-3" : "sm:col-span-5"}>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full py-1.5 px-2 text-xs border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="all">👤 جميع المستخدمين ({uniqueUsers.length})</option>
                    {uniqueUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Activities Filters */}
                {activeTab === "activities" && (
                  <>
                    <div className="sm:col-span-2">
                      <select
                        value={selectedDepartment}
                        onChange={(e) => setSelectedDepartment(e.target.value)}
                        className="w-full py-1.5 px-2 text-xs border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="all">📁 كل الأقسام</option>
                        <option value="client">الموكلين</option>
                        <option value="case">القضايا</option>
                        <option value="session">الجلسات</option>
                        <option value="admin_task">المهام</option>
                        <option value="appointment">المواعيد</option>
                        <option value="accounting">المحاسبة</option>
                        <option value="invoice">الفواتير</option>
                        <option value="document">المستندات</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <select
                        value={selectedAction}
                        onChange={(e) => setSelectedAction(e.target.value)}
                        className="w-full py-1.5 px-2 text-xs border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-indigo-500"
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

              {/* Date Presets Row */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-xs">
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[10px] font-semibold text-gray-500 ml-1">الفترة:</span>
                  {[
                    { id: "all", label: "الكل" },
                    { id: "today", label: "اليوم" },
                    { id: "yesterday", label: "أمس" },
                    { id: "last7", label: "آخر 7 أيام" },
                    { id: "last30", label: "آخر 30 يوم" },
                    { id: "thisMonth", label: "هذا الشهر" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleDatePresetChange(p.id)}
                      className={`px-2 py-0.5 text-[10px] rounded font-medium transition-all ${
                        dateFilterPreset === p.id
                          ? "bg-indigo-600 text-white shadow-2xs"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 bg-gray-50 p-0.5 rounded border border-gray-200 text-[10px]">
                  <span>من:</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      setDateFilterPreset("custom");
                    }}
                    className="p-0.5 border border-gray-300 rounded bg-white"
                  />
                  <span>إلى:</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value);
                      setDateFilterPreset("custom");
                    }}
                    className="p-0.5 border border-gray-300 rounded bg-white"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Logs Body Area */}
        <div
          ref={scrollContainerRef}
          className="p-2 sm:p-4 bg-slate-50/60 relative scroll-smooth overflow-x-auto"
        >
          {loading && filteredLogs.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-16 gap-2">
              <ArrowPathIcon className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-xs text-gray-500 font-semibold">جاري تحميل البيانات...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300 p-6">
              <ListBulletIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-gray-700">لا توجد سجلات مطابقة للبحث</h3>
              <p className="text-xs text-gray-500 mt-1">جرب تغيير الفلاتر أو تحديد نطاق زمني مختلف.</p>
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
                className="mt-3 px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
              >
                إعادة ضبط الفلاتر
              </button>
            </div>
          ) : activeTab === "activities" ? (
            /* Activities Table */
            <div className="rounded-xl border border-gray-200 bg-white shadow-xs min-w-[650px]">
              <table className="w-full text-xs text-right">
                <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 font-bold border-b border-gray-200 shadow-2xs">
                  <tr>
                    <th className="px-3 py-2.5 w-44">التاريخ والوقت</th>
                    <th className="px-3 py-2.5 w-36">المستخدم</th>
                    <th className="px-3 py-2.5 w-24 text-center">الإجراء</th>
                    <th className="px-3 py-2.5 w-28">القسم</th>
                    <th className="px-3 py-2.5">التفاصيل والبيانات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap" dir="ltr">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                            {(log.user_name || "م").substring(0, 1)}
                          </div>
                          <span className="font-semibold text-slate-900 text-xs truncate max-w-[120px]" title={log.user_name}>
                            {log.user_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">{getActionBadge(log.action)}</td>
                      <td className="px-3 py-2.5 text-xs font-medium text-slate-700 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600">
                          {getEntityTypeLabel(log.entity_type)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-800 text-xs leading-relaxed">
                        <div>{log.details}</div>
                        {log.entity_id && (
                          <div className="text-[9px] font-mono text-slate-400" dir="ltr">
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
            /* Login Sessions Table */
            <div className="rounded-xl border border-gray-200 bg-white shadow-xs min-w-[550px]">
              <table className="w-full text-xs text-right">
                <thead className="sticky top-0 z-10 bg-emerald-50 text-emerald-900 font-bold border-b border-emerald-100 shadow-2xs">
                  <tr>
                    <th className="px-3 py-2.5 w-44">تاريخ ووقت الدخول</th>
                    <th className="px-3 py-2.5 w-48">المستخدم</th>
                    <th className="px-3 py-2.5 w-32 text-center">النوع</th>
                    <th className="px-3 py-2.5">التفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {paginatedLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600 whitespace-nowrap" dir="ltr">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{log.user_name}</td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          تسجيل دخول
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">{log.details || "تم تسجيل الدخول بنجاح"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pinned Bottom Pagination & Action Footer */}
        <div className="shrink-0 p-2.5 sm:px-6 bg-slate-100 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600 no-print shadow-xs">
          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <div>
              عرض <span className="font-bold text-slate-900">{filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span>-
              <span className="font-bold text-slate-900">{Math.min(currentPage * pageSize, filteredLogs.length)}</span> من أصل{" "}
              <span className="font-bold text-indigo-700">{filteredLogs.length}</span> سجل
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[10px] text-gray-500">العدد:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="py-0.5 px-1.5 text-xs border border-gray-300 rounded bg-white text-gray-800 font-medium"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-between w-full sm:w-auto">
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.max(1, p - 1));
                    scrollToTop();
                  }}
                  disabled={currentPage === 1}
                  className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 font-semibold disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1 text-xs"
                >
                  <ChevronRightIcon className="w-3.5 h-3.5" />
                  <span>السابق</span>
                </button>

                <span className="px-2 font-bold text-slate-800 text-xs">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => {
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                    scrollToTop();
                  }}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 rounded border border-gray-300 bg-white text-gray-700 font-semibold disabled:opacity-40 hover:bg-gray-50 flex items-center gap-1 text-xs"
                >
                  <span>التالي</span>
                  <ChevronLeftIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            
          </div>
        </div>

      </div>
    </div>
  );
};

export default ActivityLogsPage;

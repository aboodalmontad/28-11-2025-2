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
  BuildingLibraryIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Bars3Icon,
} from "../components/icons";
import { get_supabase_client } from "../supabaseClient";
import { useData } from "../context/DataContext";
import { AuditLogEntry } from "../types";

export const AdminActivityLogsPage: React.FC = () => {
  const { profiles = [], audit_logs: contextAuditLogs = [] } = useData();
  const [logs, setLogs] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Main Tabs: "activities" (General operations) vs "logins" (Login sessions)
  const [activeTab, setActiveTab] = React.useState<"activities" | "logins">("activities");

  // Filters Collapsed Toggle
  const [showFilters, setShowFilters] = React.useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedOffice, setSelectedOffice] = React.useState("all");
  const [selectedUser, setSelectedUser] = React.useState("all");
  const [selectedDepartment, setSelectedDepartment] = React.useState("all");
  const [selectedAction, setSelectedAction] = React.useState("all");
  const [dateFilterPreset, setDateFilterPreset] = React.useState<string>("all"); // all, today, yesterday, last7, last30, thisMonth, custom
  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");

  // Pagination State
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  // Scroll Container Ref for smooth jumping
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrollToBottom = () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  // Build profiles map for quick lookup
  const profilesMap = React.useMemo(() => {
    const map = new Map<string, any>();
    profiles.forEach((p: any) => {
      map.set(p.id, p);
    });
    return map;
  }, [profiles]);

  // Extract all distinct offices/lawyers
  const officesList = React.useMemo(() => {
    const offices = profiles.filter(
      (p) => (!p.lawyer_id && p.role !== "admin") || (p.role as string) === "lawyer"
    );
    return offices.map((off) => {
      const assistantsCount = profiles.filter((p) => p.lawyer_id === off.id).length;
      return {
        id: off.id,
        name: off.full_name || off.mobile_number || "مكتب محاماة",
        mobile: off.mobile_number || "",
        email: (off as any).email || "",
        assistantsCount,
        isApproved: off.is_approved,
      };
    });
  }, [profiles]);

  // Fetch all audit logs from Supabase & LocalStorage
  const fetchLogs = async () => {
    setLoading(true);
    let remoteLogs: any[] = [];
    const supabase = get_supabase_client();

    if (supabase) {
      try {
        const { data: logsData, error } = await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000);

        if (!error && logsData) {
          remoteLogs = logsData;
        }
      } catch (e) {
        console.warn("Could not query audit_logs from database:", e);
      }
    }

    let localStoredLogs: any[] = [];
    try {
      const storedGeneric = localStorage.getItem("local_audit_logs");
      if (storedGeneric) {
        localStoredLogs = JSON.parse(storedGeneric);
      }
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("local_audit_logs_") && key !== "local_audit_logs") {
          try {
            const parsed = JSON.parse(localStorage.getItem(key) || "[]");
            if (Array.isArray(parsed)) {
              localStoredLogs.push(...parsed);
            }
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (e) {
      // ignore
    }

    // Merge & Deduplicate
    const uniqueMap = new Map();
    [...remoteLogs, ...contextAuditLogs, ...localStoredLogs].forEach((log: any) => {
      if (log && log.action && log.entity_type) {
        const timeKey = Math.floor(new Date(log.created_at || Date.now()).getTime() / 60000);
        const signature = `${log.office_id || log.user_id || ""}_${log.action}_${log.entity_type}_${log.entity_id || ""}_${log.details || ""}_${timeKey}`;

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

    const combinedLogs = Array.from(uniqueMap.values()).sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Enrich logs with resolved User and Office Names
    const enrichedLogs = combinedLogs.map((log: any) => {
      let resolvedUserName = log.user_name || "مستخدم غير معروف";
      let resolvedOfficeName = log.office_name || "عام / غير محدد";

      if (log.user_id && profilesMap.has(log.user_id)) {
        const u = profilesMap.get(log.user_id);
        resolvedUserName = u.full_name || u.mobile_number || resolvedUserName;
        if (u.lawyer_id && profilesMap.has(u.lawyer_id)) {
          const lawyer = profilesMap.get(u.lawyer_id);
          resolvedOfficeName = lawyer.full_name || lawyer.mobile_number || resolvedOfficeName;
        } else if (!u.lawyer_id && u.role !== "admin") {
          resolvedOfficeName = u.full_name || u.mobile_number || resolvedOfficeName;
        }
      }

      if (log.office_id && profilesMap.has(log.office_id)) {
        const off = profilesMap.get(log.office_id);
        resolvedOfficeName = off.full_name || off.mobile_number || resolvedOfficeName;
      }

      return {
        ...log,
        user_name: resolvedUserName,
        office_name: resolvedOfficeName,
      };
    });

    setLogs(enrichedLogs);
    setLoading(false);
  };

  React.useEffect(() => {
    fetchLogs();
  }, [contextAuditLogs, profiles]);

  // Base classification
  const allActivityLogs = React.useMemo(() => {
    return logs.filter((l: any) => !(l.action || "").includes("LOGIN") && l.entity_type !== "auth");
  }, [logs]);

  const allLoginLogs = React.useMemo(() => {
    return logs.filter((l: any) => (l.action || "").includes("LOGIN") || l.entity_type === "auth");
  }, [logs]);

  // Available users for dropdown filter based on selected office
  const availableUsers = React.useMemo(() => {
    const userMap = new Map<string, string>();

    profiles.forEach((p: any) => {
      if (selectedOffice === "all" || p.id === selectedOffice || p.lawyer_id === selectedOffice) {
        userMap.set(p.id, p.full_name || p.mobile_number || "مستخدم");
      }
    });

    logs.forEach((l: any) => {
      if (
        (selectedOffice === "all" || l.office_id === selectedOffice) &&
        l.user_id &&
        l.user_name
      ) {
        userMap.set(l.user_id, l.user_name);
      }
    });

    return Array.from(userMap.entries()).map(([id, name]) => ({ id, name }));
  }, [profiles, logs, selectedOffice]);

  // Filtered logs calculation
  const filteredLogs = React.useMemo(() => {
    const sourceLogs = activeTab === "activities" ? allActivityLogs : allLoginLogs;

    return sourceLogs.filter((log: any) => {
      // 1. Office Filter
      if (selectedOffice !== "all") {
        if (log.office_id !== selectedOffice && log.user_id !== selectedOffice) {
          return false;
        }
      }

      // 2. User Filter
      if (selectedUser !== "all") {
        if (log.user_id !== selectedUser && log.user_name !== selectedUser) {
          return false;
        }
      }

      // 3. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDetails = (log.details || "").toLowerCase().includes(q);
        const matchesUser = (log.user_name || "").toLowerCase().includes(q);
        const matchesOffice = (log.office_name || "").toLowerCase().includes(q);
        const matchesAction = (log.action || "").toLowerCase().includes(q);
        const matchesEntity = (log.entity_type || "").toLowerCase().includes(q);
        if (!matchesDetails && !matchesUser && !matchesOffice && !matchesAction && !matchesEntity) {
          return false;
        }
      }

      // 4. Department Filter (Activities tab only)
      if (activeTab === "activities" && selectedDepartment !== "all") {
        if (log.entity_type?.toLowerCase() !== selectedDepartment.toLowerCase()) {
          return false;
        }
      }

      // 5. Action Filter (Activities tab only)
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

      // 6. Date Filter
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
    selectedOffice,
    selectedUser,
    searchQuery,
    selectedDepartment,
    selectedAction,
    startDate,
    endDate,
  ]);

  // Selected office detail metadata
  const currentOfficeDetails = React.useMemo(() => {
    if (selectedOffice === "all") return null;
    return officesList.find((o) => o.id === selectedOffice) || null;
  }, [selectedOffice, officesList]);

  // Statistics calculation for the filtered dataset
  const stats = React.useMemo(() => {
    let creates = 0;
    let updates = 0;
    let deletes = 0;
    let postpones = 0;
    const officesSet = new Set<string>();
    const usersSet = new Set<string>();

    filteredLogs.forEach((l: any) => {
      if (l.office_id) officesSet.add(l.office_id);
      if (l.user_id) usersSet.add(l.user_id);

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
      officesCount: officesSet.size,
      usersCount: usersSet.size,
    };
  }, [filteredLogs]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const paginatedLogs = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Handle Date Presets
  const handleDatePresetChange = (preset: string) => {
    setDateFilterPreset(preset);
    setCurrentPage(1);
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

  // Badge Helper
  const getActionBadge = (action: string) => {
    if (!action) return <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">إجراء</span>;
    if (action.includes("LOGIN")) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
          <KeyIcon className="w-3.5 h-3.5" />
          تسجيل دخول
        </span>
      );
    }
    if (action.includes("CREATE") || action.includes("ADD")) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
          إضافة
        </span>
      );
    }
    if (action.includes("DELETE") || action.includes("REMOVE")) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
          حذف
        </span>
      );
    }
    if (action.includes("POSTPONE")) {
      return (
        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
          تأجيل جلسة
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
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

  const handleExportCSV = () => {
    try {
      const isLoginTab = activeTab === "logins";
      const headers = isLoginTab
        ? ["التاريخ والوقت", "المكتب / المحامي", "المستخدم", "نوع الجلسة", "التفاصيل"]
        : ["التاريخ والوقت", "المكتب / المحامي", "المستخدم الفاعل", "نوع الإجراء", "القسم", "تفاصيل العملية"];

      const rows = filteredLogs.map((l: any) =>
        isLoginTab
          ? [
              `"${formatDate(l.created_at)}"`,
              `"${l.office_name || ""}"`,
              `"${l.user_name || ""}"`,
              `"تسجيل دخول للنظام"`,
              `"${(l.details || "").replace(/"/g, '""')}"`,
            ]
          : [
              `"${formatDate(l.created_at)}"`,
              `"${l.office_name || ""}"`,
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
        `admin_audit_${isLoginTab ? "logins" : "activities"}_${new Date().toISOString().split("T")[0]}.csv`
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

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedOffice("all");
    setSelectedUser("all");
    setSelectedDepartment("all");
    setSelectedAction("all");
    setStartDate("");
    setEndDate("");
    setDateFilterPreset("all");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-300 pb-12" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 sm:p-8 rounded-3xl shadow-xl border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 no-print">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheckIcon className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-black tracking-tight">
                لوحة سجل النشاطات والتدقيق العام
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 font-medium">
                متابعة وإشراف على كافة العمليات وجلسات الدخول لجميع مكاتب المحاماة والمساعدين
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-indigo-200 rounded-xl transition-all border border-slate-600 shadow-xs"
          >
            <Bars3Icon className="w-4 h-4" />
            <span>{showFilters ? "إخفاء الفلاتر" : "عرض الفلاتر"}</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all border border-slate-600 shadow-xs"
            title="طباعة"
          >
            <PrintIcon className="w-4 h-4" />
            <span className="hidden sm:inline">طباعة التقرير</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl transition-all border border-emerald-600 shadow-xs"
            title="تصدير Excel"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            <span className="hidden sm:inline">تصدير Excel</span>
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md disabled:opacity-50"
            title="تحديث البيانات"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "جاري التحديث..." : "تحديث"}</span>
          </button>
        </div>
      </div>

      {/* Office Selector Card */}
      {showFilters && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3 no-print">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BuildingLibraryIcon className="w-5 h-5 text-indigo-600" />
              <span className="font-bold text-slate-800 text-xs sm:text-base">
                تحديد المكتب المستهدف:
              </span>
            </div>

            <div className="flex-1 max-w-xl">
              <div className="relative">
                <select
                  value={selectedOffice}
                  onChange={(e) => {
                    setSelectedOffice(e.target.value);
                    setSelectedUser("all");
                    setCurrentPage(1);
                  }}
                  className="w-full py-2 pr-9 pl-3 text-xs sm:text-sm font-bold border border-indigo-200 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-indigo-950"
                >
                  <option value="all">🏢 جميع المكاتب ({officesList.length} مكتب مسجل)</option>
                  {officesList.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.name} {off.mobile ? `(${off.mobile})` : ""} - {off.assistantsCount} مساعد
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-indigo-500">
                  <BuildingLibraryIcon className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {currentOfficeDetails && (
            <div className="p-2.5 bg-indigo-50/80 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="font-bold text-indigo-900 text-xs sm:text-sm">{currentOfficeDetails.name}</span>
                {currentOfficeDetails.mobile && (
                  <span className="text-slate-600 font-mono text-[11px]" dir="ltr">
                    📱 {currentOfficeDetails.mobile}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-indigo-200/70 text-indigo-800 rounded-md font-semibold text-[10px]">
                  {currentOfficeDetails.assistantsCount} مساعدين
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedOffice("all");
                  setSelectedUser("all");
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
              >
                إلغاء التحديد وعرض الكل ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-slate-200 no-print">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setActiveTab("activities");
              setSelectedAction("all");
              setSelectedDepartment("all");
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 py-2.5 px-4 sm:px-6 font-bold text-xs sm:text-sm rounded-t-2xl transition-all border-t border-x ${
              activeTab === "activities"
                ? "bg-white text-indigo-700 border-slate-200 border-b-white shadow-xs -mb-px"
                : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 hover:text-slate-800"
            }`}
          >
            <ListBulletIcon className="w-4 h-4" />
            <span>سجل العمليات والأنشطة</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeTab === "activities" ? "bg-indigo-100 text-indigo-700" : "bg-slate-300 text-slate-700"
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
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 py-2.5 px-4 sm:px-6 font-bold text-xs sm:text-sm rounded-t-2xl transition-all border-t border-x ${
              activeTab === "logins"
                ? "bg-white text-emerald-700 border-slate-200 border-b-white shadow-xs -mb-px"
                : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 hover:text-slate-800"
            }`}
          >
            <KeyIcon className="w-4 h-4" />
            <span>سجل تسجيلات الدخول</span>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                activeTab === "logins" ? "bg-emerald-100 text-emerald-700" : "bg-slate-300 text-slate-700"
              }`}
            >
              {allLoginLogs.length}
            </span>
          </button>
        </div>

        {/* Floating Page Scroll Control */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          <button
            onClick={scrollToBottom}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg shadow-2xs font-bold"
          >
            ⬇️ أسفل الصفحة
          </button>
          <button
            onClick={scrollToTop}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg shadow-2xs font-bold"
          >
            ⬆️ أعلى الصفحة
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      {showFilters && (
        <div className="no-print">
          {activeTab === "activities" ? (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                <div className="text-[11px] font-bold text-slate-400">إجمالي العمليات</div>
                <div className="text-xl font-black text-slate-900 mt-0.5">{stats.total}</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-xs">
                <div className="text-[11px] font-bold text-blue-600">عمليات الإضافة</div>
                <div className="text-xl font-black text-blue-700 mt-0.5">{stats.creates}</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-xs">
                <div className="text-[11px] font-bold text-amber-600">عمليات التعديل</div>
                <div className="text-xl font-black text-amber-700 mt-0.5">{stats.updates}</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-rose-100 shadow-xs">
                <div className="text-[11px] font-bold text-rose-600">عمليات الحذف</div>
                <div className="text-xl font-black text-rose-700 mt-0.5">{stats.deletes}</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-xs">
                <div className="text-[11px] font-bold text-purple-600">تأجيل الجلسات</div>
                <div className="text-xl font-black text-purple-700 mt-0.5">{stats.postpones}</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-indigo-100 shadow-xs">
                <div className="text-[11px] font-bold text-indigo-600">المكاتب الفاعلة</div>
                <div className="text-xl font-black text-indigo-800 mt-0.5">{stats.officesCount}</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-400">إجمالي جلسات الدخول</div>
                  <div className="text-xl font-black text-emerald-800 mt-0.5">{stats.total}</div>
                </div>
                <KeyIcon className="w-7 h-7 text-emerald-500 opacity-80" />
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-400">المستخدمون النشطون</div>
                  <div className="text-xl font-black text-emerald-800 mt-0.5">{stats.usersCount}</div>
                </div>
                <UserIcon className="w-7 h-7 text-emerald-500 opacity-80" />
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-400">المكاتب المسجلة دخولاً</div>
                  <div className="text-xl font-black text-emerald-800 mt-0.5">{stats.officesCount}</div>
                </div>
                <BuildingLibraryIcon className="w-7 h-7 text-emerald-500 opacity-80" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      {showFilters && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 no-print">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-3">
            <div className={activeTab === "activities" ? "sm:col-span-4 relative" : "sm:col-span-7 relative"}>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <MagnifyingGlassIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="ابحث في التفاصيل، اسم الموكل، المهمة..."
                className="w-full pr-9 pl-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className={activeTab === "activities" ? "sm:col-span-3" : "sm:col-span-5"}>
              <select
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-2 px-3 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
              >
                <option value="all">👤 جميع المستخدمين ({availableUsers.length})</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {activeTab === "activities" && (
              <>
                <div className="sm:col-span-3">
                  <select
                    value={selectedDepartment}
                    onChange={(e) => {
                      setSelectedDepartment(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full py-2 px-3 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
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
                    onChange={(e) => {
                      setSelectedAction(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full py-2 px-3 text-xs sm:text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white"
                  >
                    <option value="all">⚡ الإجراءات</option>
                    <option value="CREATE">➕ إضافة</option>
                    <option value="UPDATE">✏️ تعديل</option>
                    <option value="DELETE">🗑️ حذف</option>
                    <option value="POSTPONE">⏱️ تأجيل جلسة</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-500 text-[11px] ml-1">الفترة:</span>
              {[
                { id: "all", label: "الكل" },
                { id: "today", label: "اليوم" },
                { id: "yesterday", label: "أمس" },
                { id: "last7", label: "آخر 7 أيام" },
                { id: "last30", label: "آخر 30 يوماً" },
                { id: "thisMonth", label: "هذا الشهر" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleDatePresetChange(p.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                    dateFilterPreset === p.id
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200 text-xs">
              <span>من:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateFilterPreset("custom");
                  setCurrentPage(1);
                }}
                className="p-1 border border-slate-300 rounded bg-white"
              />
              <span>إلى:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateFilterPreset("custom");
                  setCurrentPage(1);
                }}
                className="p-1 border border-slate-300 rounded bg-white"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Table Container Card with Normal Page Flow */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        
        {/* Top Pagination Control Bar */}
        <div className="p-3 px-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 no-print">
          <div className="flex items-center gap-3">
            <div>
              عرض <span className="font-bold text-slate-900">{filteredLogs.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span>-
              <span className="font-bold text-slate-900">{Math.min(currentPage * pageSize, filteredLogs.length)}</span> من أصل{" "}
              <span className="font-bold text-indigo-700">{filteredLogs.length}</span> سجل
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">العدد:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="py-1 px-2 border border-slate-300 rounded bg-white font-bold text-slate-800"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  scrollToTop();
                }}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
              >
                <ChevronRightIcon className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>
              <span className="px-2 font-bold text-slate-800">
                صفحة {currentPage} من {totalPages}
              </span>
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  scrollToTop();
                }}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
              >
                <span>التالي</span>
                <ChevronLeftIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Full Page Flow Table Container */}
        <div
          ref={tableContainerRef}
          className="overflow-x-auto w-full relative scroll-smooth"
        >
          {loading && filteredLogs.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-20 gap-2">
              <ArrowPathIcon className="w-9 h-9 text-indigo-600 animate-spin" />
              <p className="text-sm text-slate-500 font-bold">جاري تحميل سجل السحابة...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 p-6 space-y-2">
              <ListBulletIcon className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-700">لا توجد سجلات مطابقة للبحث</h3>
              <button
                onClick={resetAllFilters}
                className="mt-2 px-4 py-2 text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl"
              >
                إعادة ضبط جميع الفلاتر
              </button>
            </div>
          ) : activeTab === "activities" ? (
            /* Operations Table */
            <div className="overflow-x-auto min-w-[700px]">
              <table className="w-full text-xs sm:text-sm text-right">
                <thead className="sticky top-0 z-10 bg-slate-100/95 backdrop-blur-xs text-slate-700 font-bold border-b border-slate-200 shadow-2xs">
                  <tr>
                    <th className="px-4 py-3 w-44">التاريخ والوقت</th>
                    <th className="px-4 py-3 w-48">المكتب / المحامي</th>
                    <th className="px-4 py-3 w-40">المستخدم الفاعل</th>
                    <th className="px-4 py-3 w-28 text-center">نوع الإجراء</th>
                    <th className="px-4 py-3 w-32">القسم</th>
                    <th className="px-4 py-3">تفاصيل العملية</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] sm:text-xs text-slate-500 whitespace-nowrap" dir="ltr">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <BuildingLibraryIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[130px]" title={log.office_name}>
                            {log.office_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800 text-xs truncate max-w-[120px]" title={log.user_name}>
                          {log.user_name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
                        <span className="px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                          {getEntityTypeLabel(log.entity_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-800 text-xs leading-relaxed">
                        <div>{log.details}</div>
                        {log.entity_id && (
                          <div className="text-[10px] font-mono text-slate-400" dir="ltr">
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
            <div className="overflow-x-auto min-w-[600px]">
              <table className="w-full text-xs sm:text-sm text-right">
                <thead className="sticky top-0 z-10 bg-emerald-50/95 backdrop-blur-xs text-emerald-950 font-bold border-b border-emerald-100 shadow-2xs">
                  <tr>
                    <th className="px-4 py-3 w-44">تاريخ ووقت الدخول</th>
                    <th className="px-4 py-3 w-48">المكتب التابع له</th>
                    <th className="px-4 py-3 w-48">المستخدم</th>
                    <th className="px-4 py-3 w-32 text-center">نوع الجلسة</th>
                    <th className="px-4 py-3">البيانات والتفاصيل</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50/60">
                  {paginatedLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-emerald-50/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] sm:text-xs text-slate-600 whitespace-nowrap" dir="ltr">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 text-xs">{log.office_name}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 text-xs">{log.user_name}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          تسجيل دخول
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-xs">{log.details || "تم تسجيل الدخول بنجاح"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bottom Pagination Control Bar */}
        <div className="p-3 px-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 no-print">
          <div>
            صفحة <span className="font-bold text-slate-900">{currentPage}</span> من{" "}
            <span className="font-bold text-slate-900">{totalPages}</span> (إجمالي {filteredLogs.length} سجل)
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.max(1, p - 1));
                  scrollToTop();
                }}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
              >
                <ChevronRightIcon className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>
              <button
                onClick={() => {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                  scrollToTop();
                }}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-100 flex items-center gap-1"
              >
                <span>التالي</span>
                <ChevronLeftIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminActivityLogsPage;

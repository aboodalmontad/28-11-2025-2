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
  UserGroupIcon,
  ChevronLeftIcon,
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
  const itemsPerPage = 50;

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
    // A lawyer office is a profile where role !== "admin" and !lawyer_id
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
      // Also inspect all localStorage keys for office-specific logs
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("local_audit_logs_")) {
          try {
            const val = localStorage.getItem(key);
            if (val) {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) {
                localStoredLogs.push(...parsed);
              }
            }
          } catch {}
        }
      }
    } catch (e) {
      // ignore
    }

    // Smart deduplication (by action, entity, user, details, and minute timestamp)
    const uniqueMap = new Map<string, AuditLogEntry>();
    [...remoteLogs, ...contextAuditLogs, ...localStoredLogs].forEach((log) => {
      if (log && log.action && log.entity_type) {
        const timeKey = Math.floor(new Date(log.created_at || Date.now()).getTime() / 60000);
        const signature = `${log.office_id || ""}_${log.user_id || ""}_${log.action}_${log.entity_type}_${log.entity_id || ""}_${log.details || ""}_${timeKey}`;

        if (!uniqueMap.has(signature)) {
          uniqueMap.set(signature, log);
        } else {
          const existing = uniqueMap.get(signature)!;
          if (typeof log.id === "number" && typeof existing.id !== "number") {
            uniqueMap.set(signature, log);
          }
        }
      }
    });

    const allLogs = Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Enrich logs with office name and user name from profile metadata
    const enriched = allLogs.map((log) => {
      const userProf = profilesMap.get(log.user_id);
      const effectiveOfficeId = log.office_id || userProf?.lawyer_id || log.user_id;
      const officeProf = profilesMap.get(effectiveOfficeId);

      const resolvedOfficeName =
        officeProf?.full_name ||
        (effectiveOfficeId === log.user_id ? userProf?.full_name : null) ||
        "مكتب غير محدد";

      const resolvedUserName =
        log.user_name ||
        userProf?.full_name ||
        userProf?.mobile_number ||
        "مستخدم";

      return {
        ...log,
        office_id: effectiveOfficeId,
        office_name: resolvedOfficeName,
        user_name: resolvedUserName,
      };
    });

    setLogs(enriched as any);
    setLoading(false);
  };

  React.useEffect(() => {
    fetchLogs();
  }, [profilesMap, contextAuditLogs]);

  // Handle Preset Date changes
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

  // Base classification into Activities vs Logins
  const allActivityLogs = React.useMemo(() => {
    return logs.filter((l) => !(l.action || "").includes("LOGIN") && l.entity_type !== "auth");
  }, [logs]);

  const allLoginLogs = React.useMemo(() => {
    return logs.filter((l) => (l.action || "").includes("LOGIN") || l.entity_type === "auth");
  }, [logs]);

  // Dynamic user list depending on selected office
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
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage) || 1;
  const paginatedLogs = React.useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredLogs.slice(start, start + itemsPerPage);
  }, [filteredLogs, currentPage, itemsPerPage]);

  // Formatters & Labels
  const getActionBadge = (action: string) => {
    if (!action) return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">إجراء</span>;
    if (action.includes("LOGIN")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
          <KeyIcon className="w-3 h-3" />
          تسجيل دخول
        </span>
      );
    }
    if (action.includes("CREATE") || action.includes("ADD")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          ➕ إضافة
        </span>
      );
    }
    if (action.includes("DELETE") || action.includes("REMOVE")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          🗑️ حذف
        </span>
      );
    }
    if (action.includes("POSTPONE")) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
          ⏱️ تأجيل جلسة
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
        ✏️ تعديل
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

  // CSV Export
  const handleExportCSV = () => {
    try {
      const isLoginTab = activeTab === "logins";
      const headers = isLoginTab
        ? ["التاريخ والوقت", "المكتب / المحامي", "المستخدم", "النوع", "التفاصيل"]
        : ["التاريخ والوقت", "المكتب / المحامي", "المستخدم", "الإجراء", "القسم", "التفاصيل"];

      const rows = filteredLogs.map((l: any) =>
        isLoginTab
          ? [
              `"${formatDate(l.created_at)}"`,
              `"${l.office_name || ""}"`,
              `"${l.user_name || ""}"`,
              `"تسجيل دخول"`,
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
        `admin_${isLoginTab ? "logins" : "activities"}_${selectedOffice !== "all" ? selectedOffice : "all_offices"}_${new Date().toISOString().split("T")[0]}.csv`
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
    <div className="space-y-6 animate-in fade-in duration-300" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-700/50 flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <ShieldCheckIcon className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
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
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-slate-700/80 hover:bg-slate-700 text-white rounded-xl transition-all border border-slate-600 shadow-xs active:scale-95"
            title="طباعة التقرير"
          >
            <PrintIcon className="w-4 h-4" />
            <span>طباعة التقرير</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-700/80 hover:bg-emerald-700 text-white rounded-xl transition-all border border-emerald-600 shadow-xs active:scale-95"
            title="تصدير كملف Excel / CSV"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            <span>تصدير Excel / CSV</span>
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
            title="تحديث البيانات"
          >
            <ArrowPathIcon className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span>{loading ? "جاري التحديث..." : "تحديث السجلات"}</span>
          </button>
        </div>
      </div>

      {/* Office Selector Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 no-print">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BuildingLibraryIcon className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-800 text-sm sm:text-base">
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
                className="w-full py-2.5 pr-10 pl-4 text-sm font-bold border border-indigo-200 rounded-xl bg-indigo-50/50 hover:bg-indigo-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-indigo-950"
              >
                <option value="all">🏢 جميع المكاتب ({officesList.length} مكتب مسجل)</option>
                {officesList.map((off) => (
                  <option key={off.id} value={off.id}>
                    {off.name} {off.mobile ? `(${off.mobile})` : ""} - {off.assistantsCount} مساعد
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-indigo-500">
                <BuildingLibraryIcon className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>

        {/* Selected Office Badge Details */}
        {currentOfficeDetails && (
          <div className="p-3 bg-indigo-50/80 rounded-xl border border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-indigo-900 text-sm">{currentOfficeDetails.name}</span>
              {currentOfficeDetails.mobile && (
                <span className="text-slate-600 font-mono" dir="ltr">
                  📱 {currentOfficeDetails.mobile}
                </span>
              )}
              <span className="px-2 py-0.5 bg-indigo-200/70 text-indigo-800 rounded-md font-semibold">
                {currentOfficeDetails.assistantsCount} مساعدين تابعين
              </span>
            </div>
            <button
              onClick={() => {
                setSelectedOffice("all");
                setSelectedUser("all");
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
            >
              إلغاء التحديد وعرض كل المكاتب ✕
            </button>
          </div>
        )}
      </div>

      {/* Tabs Header (ألسنة منفصلة للأنشطة وتسجيلات الدخول) */}
      <div className="flex items-center gap-2 border-b border-slate-200 no-print">
        <button
          onClick={() => {
            setActiveTab("activities");
            setSelectedAction("all");
            setSelectedDepartment("all");
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2.5 py-3.5 px-6 font-bold text-sm rounded-t-2xl transition-all border-t border-x ${
            activeTab === "activities"
              ? "bg-white text-indigo-700 border-slate-200 border-b-white shadow-xs -mb-px"
              : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70 hover:text-slate-800"
          }`}
        >
          <ListBulletIcon className="w-5 h-5" />
          <span>سجل العمليات والأنشطة</span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
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
          className={`flex items-center gap-2.5 py-3.5 px-6 font-bold text-sm rounded-t-2xl transition-all border-t border-x ${
            activeTab === "logins"
              ? "bg-white text-emerald-700 border-slate-200 border-b-white shadow-xs -mb-px"
              : "bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200/70 hover:text-slate-800"
          }`}
        >
          <KeyIcon className="w-5 h-5" />
          <span>سجل تسجيلات الدخول</span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-black ${
              activeTab === "logins" ? "bg-emerald-100 text-emerald-700" : "bg-slate-300 text-slate-700"
            }`}
          >
            {allLoginLogs.length}
          </span>
        </button>
      </div>

      {/* KPI Stats Bar */}
      {activeTab === "activities" ? (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 no-print">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="text-xs font-bold text-slate-400">إجمالي العمليات</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-blue-100 shadow-xs">
            <div className="text-xs font-bold text-blue-600">عمليات الإضافة</div>
            <div className="text-2xl font-black text-blue-700 mt-1">{stats.creates}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-xs">
            <div className="text-xs font-bold text-amber-600">عمليات التعديل</div>
            <div className="text-2xl font-black text-amber-700 mt-1">{stats.updates}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-rose-100 shadow-xs">
            <div className="text-xs font-bold text-rose-600">عمليات الحذف</div>
            <div className="text-2xl font-black text-rose-700 mt-1">{stats.deletes}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-xs">
            <div className="text-xs font-bold text-purple-600">تأجيل الجلسات</div>
            <div className="text-2xl font-black text-purple-700 mt-1">{stats.postpones}</div>
          </div>
          <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-xs">
            <div className="text-xs font-bold text-indigo-600">المكاتب الفاعلة</div>
            <div className="text-2xl font-black text-indigo-800 mt-1">{stats.officesCount}</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400">إجمالي جلسات الدخول</div>
              <div className="text-2xl font-black text-emerald-800 mt-1">{stats.total}</div>
            </div>
            <KeyIcon className="w-8 h-8 text-emerald-500 opacity-80" />
          </div>
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400">المستخدمون النشطون في الفترة</div>
              <div className="text-2xl font-black text-emerald-800 mt-1">{stats.usersCount}</div>
            </div>
            <UserIcon className="w-8 h-8 text-emerald-500 opacity-80" />
          </div>
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-400">المكاتب المسجلة دخولاً</div>
              <div className="text-2xl font-black text-emerald-800 mt-1">{stats.officesCount}</div>
            </div>
            <BuildingLibraryIcon className="w-8 h-8 text-emerald-500 opacity-80" />
          </div>
        </div>
      )}

      {/* Advanced Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 no-print">
        {/* Row 1: Search, User, Department, Action */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className={activeTab === "activities" ? "sm:col-span-4 relative" : "sm:col-span-7 relative"}>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
              <MagnifyingGlassIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="ابحث في التفاصيل، اسم الموكل، المهمة، أو اسم المكتب..."
              className="w-full pr-10 pl-3 py-2.5 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
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

          {/* User / Assistant Filter */}
          <div className={activeTab === "activities" ? "sm:col-span-3" : "sm:col-span-5"}>
            <div className="relative">
              <select
                value={selectedUser}
                onChange={(e) => {
                  setSelectedUser(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full py-2.5 pr-9 pl-3 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 appearance-none"
              >
                <option value="all">👤 جميع المستخدمين والمساعدين ({availableUsers.length})</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <UserIcon className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Activities Specific Filters */}
          {activeTab === "activities" && (
            <>
              {/* Department Filter */}
              <div className="sm:col-span-3">
                <select
                  value={selectedDepartment}
                  onChange={(e) => {
                    setSelectedDepartment(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full py-2.5 px-3 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">📁 كل الأقسام</option>
                  <option value="client">الموكلين</option>
                  <option value="case">القضايا</option>
                  <option value="session">الجلسات</option>
                  <option value="admin_task">المهام الإدارية</option>
                  <option value="appointment">المواعيد</option>
                  <option value="accounting">المحاسبة والمالية</option>
                  <option value="invoice">الفواتير</option>
                  <option value="document">المستندات والوثائق</option>
                </select>
              </div>

              {/* Action Filter */}
              <div className="sm:col-span-2">
                <select
                  value={selectedAction}
                  onChange={(e) => {
                    setSelectedAction(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full py-2.5 px-3 text-sm border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1">
              <CalendarIcon className="w-3.5 h-3.5" />
              النطاق الزمني:
            </span>
            {[
              { id: "all", label: "كل التواريخ" },
              { id: "today", label: "اليوم" },
              { id: "yesterday", label: "أمس" },
              { id: "last7", label: "آخر 7 أيام" },
              { id: "last30", label: "آخر 30 يوماً" },
              { id: "thisMonth", label: "هذا الشهر" },
              { id: "custom", label: "تاريخ مخصص" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleDatePresetChange(p.id)}
                className={`px-3 py-1.5 text-xs rounded-xl font-bold transition-all ${
                  dateFilterPreset === p.id
                    ? activeTab === "activities"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "bg-emerald-600 text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 whitespace-nowrap">من:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDateFilterPreset("custom");
                  setCurrentPage(1);
                }}
                className="text-xs p-1 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 whitespace-nowrap">إلى:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDateFilterPreset("custom");
                  setCurrentPage(1);
                }}
                className="text-xs p-1 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setDateFilterPreset("all");
                  setCurrentPage(1);
                }}
                className="text-xs text-slate-400 hover:text-rose-600 px-1 font-bold"
                title="إلغاء التصفية بالتاريخ"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && filteredLogs.length === 0 ? (
          <div className="flex flex-col justify-center items-center py-24 gap-3">
            <ArrowPathIcon className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="text-sm text-slate-500 font-bold">
              جاري تحميل سجلات النشاطات من السحابة...
            </p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-20 p-8 space-y-3">
            <ListBulletIcon className="w-14 h-14 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-700">لا توجد سجلات مطابقة لمعايير البحث</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              جرب تغيير المكتب المختار، أو تعديل نطاق التاريخ أو إفراغ حقل البحث لعرض السجلات.
            </p>
            <button
              onClick={resetAllFilters}
              className="mt-2 px-5 py-2.5 text-xs font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-colors"
            >
              إعادة ضبط كل الفلاتر
            </button>
          </div>
        ) : activeTab === "activities" ? (
          /* Operations Table */
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3.5 text-xs w-48">التاريخ والوقت</th>
                  <th className="px-4 py-3.5 text-xs w-48">المكتب / المحامي</th>
                  <th className="px-4 py-3.5 text-xs w-44">المستخدم الفاعل</th>
                  <th className="px-4 py-3.5 text-xs w-32 text-center">نوع الإجراء</th>
                  <th className="px-4 py-3.5 text-xs w-32">القسم</th>
                  <th className="px-4 py-3.5 text-xs">تفاصيل وبيانات العملية</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-500 whitespace-nowrap" dir="ltr">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <BuildingLibraryIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[140px]" title={log.office_name}>
                          {log.office_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(log.user_name || "م").substring(0, 1)}
                        </div>
                        <span className="font-medium text-slate-800 text-xs truncate max-w-[130px]" title={log.user_name}>
                          {log.user_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium whitespace-nowrap">
                      <span className="px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700 font-semibold border border-slate-200">
                        {getEntityTypeLabel(log.entity_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 text-xs">
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
          /* Login Sessions Table */
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead className="bg-emerald-50/80 text-emerald-950 font-bold border-b border-emerald-100">
                <tr>
                  <th className="px-4 py-3.5 text-xs w-48">تاريخ ووقت الدخول</th>
                  <th className="px-4 py-3.5 text-xs w-48">المكتب التابع له</th>
                  <th className="px-4 py-3.5 text-xs w-52">المستخدم</th>
                  <th className="px-4 py-3.5 text-xs w-36 text-center">نوع الجلسة</th>
                  <th className="px-4 py-3.5 text-xs">البيانات والتفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50/50">
                {paginatedLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-emerald-50/30 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 whitespace-nowrap" dir="ltr">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <BuildingLibraryIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="font-bold text-slate-900 text-xs truncate max-w-[140px]" title={log.office_name}>
                          {log.office_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold border border-emerald-200 shrink-0">
                          {(log.user_name || "م").substring(0, 1)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{log.user_name}</div>
                          {log.user_id && (
                            <div className="text-[10px] font-mono text-slate-400" dir="ltr">
                              {log.user_id.substring(0, 8)}...
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <KeyIcon className="w-3.5 h-3.5" />
                        تسجيل دخول للنظام
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700 text-xs">
                      <div className="font-medium text-slate-800">{log.details || "تم تسجيل الدخول بنجاح"}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination & Footer */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 no-print">
          <div>
            عرض <span className="font-bold text-slate-800">{paginatedLogs.length}</span> من أصل{" "}
            <span className="font-bold text-slate-800">{filteredLogs.length}</span> سجل
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-100"
              >
                السابق
              </button>
              <div className="px-3 py-1.5 font-bold text-slate-700">
                صفحة {currentPage} من {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-100"
              >
                التالي
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminActivityLogsPage;

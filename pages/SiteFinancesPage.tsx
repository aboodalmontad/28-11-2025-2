import * as React from "react";
import DatePicker from "../components/DatePicker";
import { get_supabase_client } from "../supabaseClient";
import { SiteFinancialEntry, Profile } from "../types";
import {
  format_date,
  to_input_date_string,
  safe_revive_date,
} from "../utils/dateUtils";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
} from "../components/icons";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useData } from "../context/DataContext";
import { useFeedback } from "../context/FeedbackContext";

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-6 transition-all hover:shadow-md hover:-translate-y-1">
    <div
      className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${color}`}
    >
      {icon}
    </div>
    <div className="flex flex-col">
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
        {title}
      </p>
      <p className="text-2xl font-black text-slate-900 tracking-tight">
        {value}
      </p>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-4 shadow-2xl rounded-xl text-xs border border-slate-700 backdrop-blur-md bg-opacity-90">
        <p className="font-black mb-2 border-b border-slate-700 pb-2">
          {label}
        </p>
        {payload.map((pld: any, index: number) => (
          <div
            key={index}
            className="flex items-center justify-between gap-4 mt-1"
          >
            <span className="font-medium opacity-70">{pld.name}:</span>
            <span className="font-black" style={{ color: pld.color }}>
              {pld.value.toLocaleString()} ل.س
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const SiteFinancesPage: React.FC = () => {
  const {
    unfiltered_data,
    set_site_finances,
    delete_site_finance_entry,
    set_profiles,
    is_data_loading: loading,
  } = useData();
  const { showFeedback } = useFeedback();
  const { site_finances: entries, profiles: users } = unfiltered_data;
  const [error, set_error] = React.useState<string | null>(null);
  const [modal, set_modal] = React.useState<{
    is_open: boolean;
    data?: SiteFinancialEntry;
  }>({ is_open: false });
  const [entry_to_delete, set_entry_to_delete] =
    React.useState<SiteFinancialEntry | null>(null);
  const [active_tab, set_active_tab] = React.useState<"entries" | "reports">(
    "entries",
  );

  const supabase = get_supabase_client();

  const handle_open_modal = (entry?: SiteFinancialEntry) =>
    set_modal({ is_open: true, data: entry });
  const handle_close_modal = () => set_modal({ is_open: false });

  const handle_submit = async (
    form_data: any,
    is_subscription_renewal: boolean,
  ) => {
    if (!supabase) return;

    const {
      new_subscription_start,
      new_subscription_end,
      profile_full_name,
      ...financialData
    } = form_data;

    // Sanitize data for Supabase
    const finalFinancialData: any = {
      type: financialData.type,
      payment_date: financialData.payment_date,
      amount: Number(financialData.amount),
      description: financialData.description || null,
      payment_method: financialData.payment_method || null,
      category: financialData.category || null,
      user_id: financialData.user_id === "none" ? null : financialData.user_id,
      updated_at: new Date().toISOString(),
    };

    try {
      if (modal.data) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from("site_finances")
          .update(finalFinancialData)
          .eq("id", modal.data.id);

        if (updateError) throw updateError;

        set_site_finances((prev) =>
          prev.map((e) =>
            e.id === modal.data!.id ? { ...e, ...finalFinancialData } : e,
          ),
        );
      } else {
        // Insert new entry
        const { data: insertedData, error: insertError } = await supabase
          .from("site_finances")
          .insert([finalFinancialData])
          .select();

        if (insertError) throw insertError;
        if (insertedData && insertedData[0]) {
          set_site_finances((prev) => [...prev, insertedData[0]]);
        }
      }

      // Handle subscription renewal if applicable
      if (
        is_subscription_renewal &&
        form_data.user_id &&
        form_data.new_subscription_start &&
        form_data.new_subscription_end
      ) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            subscription_start_date: form_data.new_subscription_start,
            subscription_end_date: form_data.new_subscription_end,
          })
          .eq("id", form_data.user_id);

        if (profileError) throw profileError;

        // Update local profiles state immediately
        set_profiles((prev) =>
          prev.map((u) =>
            u.id === form_data.user_id
              ? {
                  ...u,
                  subscription_start_date: form_data.new_subscription_start,
                  subscription_end_date: form_data.new_subscription_end,
                  updated_at: new Date().toISOString(),
                }
              : u,
          ),
        );
      }

      handle_close_modal();
    } catch (err: any) {
      console.error("Financial operation failed:", err);
      let errorMessage = "فشل تنفيذ العملية المالية.";
      if (String(err.message).toLowerCase().includes("failed to fetch")) {
        errorMessage += " تعذر الاتصال بالخادم، يرجى التحقق من الإنترنت.";
      } else {
        errorMessage += ` السبب: ${err.message}`;
      }
      set_error(errorMessage);
    }
  };

  const handle_confirm_delete = async () => {
    if (!entry_to_delete) return;

    try {
      delete_site_finance_entry(entry_to_delete.id);
      showFeedback("تم حذف القيد المالي بنجاح", "success");
      set_entry_to_delete(null);
    } catch (err: any) {
      console.error("Delete financial entry failed:", err);
      set_error("فشل حذف القيد المالي: " + err.message);
    }
  };

  const financial_summary = React.useMemo(() => {
    const totalIncome = entries
      .filter((e) => e.type === "income")
      .reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = entries
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + e.amount, 0);
    const subscriptionIncome = entries
      .filter(
        (e) => e.type === "income" && e.description?.includes("تجديد اشتراك"),
      )
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      subscriptionIncome,
    };
  }, [entries]);

  // Report Data Processing
  const reports_data = React.useMemo(() => {
    type MonthlyData = {
      month: string;
      monthDate: Date;
      income: number;
      expense: number;
    };
    const monthlyData = entries.reduce(
      (acc: Record<string, MonthlyData>, entry) => {
        const d = safe_revive_date(entry.payment_date);
        if (isNaN(d.getTime())) {
          console.warn("Skipping financial entry with invalid date:", entry);
          return acc;
        }
        const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
        const monthKey = to_input_date_string(monthStart);

        if (!acc[monthKey]) {
          acc[monthKey] = {
            month: d.toLocaleString("ar-EG", {
              month: "short",
              year: "numeric",
            }),
            monthDate: monthStart,
            income: 0,
            expense: 0,
          };
        }
        if (entry.type === "income") {
          acc[monthKey].income += entry.amount;
        } else {
          acc[monthKey].expense += entry.amount;
        }
        return acc;
      },
      {},
    );

    const incomeBreakdown = entries
      .filter((e) => e.type === "income")
      .reduce(
        (acc, entry) => {
          const key = entry.description?.includes("تجديد اشتراك")
            ? "الاشتراكات"
            : "إيرادات أخرى";
          acc[key] = (acc[key] || 0) + entry.amount;
          return acc;
        },
        {} as Record<string, number>,
      );

    const expenseBreakdown = entries
      .filter((e) => e.type === "expense")
      .reduce(
        (acc, entry) => {
          const key = entry.category || "غير مصنف";
          acc[key] = (acc[key] || 0) + entry.amount;
          return acc;
        },
        {} as Record<string, number>,
      );

    return {
      monthly: Object.values(monthlyData).sort(
        (a: MonthlyData, b: MonthlyData) =>
          safe_revive_date(a.monthDate).getTime() -
          safe_revive_date(b.monthDate).getTime(),
      ),
      income: Object.entries(incomeBreakdown).map(([name, value]) => ({
        name,
        value,
      })),
      expense: Object.entries(expenseBreakdown).map(([name, value]) => ({
        name,
        value,
      })),
    };
  }, [entries]);

  if (loading)
    return (
      <div className="text-center p-8">جاري تحميل البيانات المالية...</div>
    );
  if (error)
    return (
      <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
    );

  const PIE_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            المحاسبة المالية
          </h1>
          <p className="text-slate-500 mt-1">
            إدارة الإيرادات والمصروفات والاشتراكات.
          </p>
        </div>
        <button
          onClick={() => handle_open_modal()}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          <PlusIcon className="w-5 h-5" />
          <span>إضافة قيد مالي</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="إجمالي الإيرادات"
          value={`${financial_summary.totalIncome.toLocaleString()} ل.س`}
          icon={<ChartBarIcon className="w-7 h-7" />}
          color="bg-green-100 text-green-600"
        />
        <StatCard
          title="إجمالي المصروفات"
          value={`${financial_summary.totalExpenses.toLocaleString()} ل.س`}
          icon={<ChartBarIcon className="w-7 h-7" />}
          color="bg-red-100 text-red-600"
        />
        <StatCard
          title="صافي الربح"
          value={`${financial_summary.balance.toLocaleString()} ل.س`}
          icon={<ChartBarIcon className="w-7 h-7" />}
          color="bg-blue-100 text-blue-600"
        />
        <StatCard
          title="إيرادات الاشتراكات"
          value={`${financial_summary.subscriptionIncome.toLocaleString()} ل.س`}
          icon={<ChartBarIcon className="w-7 h-7" />}
          color="bg-purple-100 text-purple-600"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-1">
          <button
            onClick={() => set_active_tab("entries")}
            className={`flex-1 py-3 px-4 text-sm font-bold rounded-xl transition-all ${active_tab === "entries" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            القيود المالية
          </button>
          <button
            onClick={() => set_active_tab("reports")}
            className={`flex-1 py-3 px-4 text-sm font-bold rounded-xl transition-all ${active_tab === "reports" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            التقارير والرسوم البيانية
          </button>
        </div>

        <div className="p-0">
          {active_tab === "entries" && (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                      التاريخ
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                      البيان
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                      الفئة
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                      المستخدم
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center bg-green-50/30">
                      الوارد (+)
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center bg-red-50/30">
                      الصادر (-)
                    </th>
                    <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">
                      إجراءات
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-slate-500">
                        {format_date(entry.payment_date)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">
                        {entry.description}
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold">
                          {entry.category || "عام"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {users.find((u) => u.id === entry.user_id)?.full_name ||
                          "-"}
                      </td>
                      <td className="px-6 py-4 font-black text-sm text-green-600 text-center bg-green-50/10">
                        {entry.type === "income"
                          ? entry.amount.toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-6 py-4 font-black text-sm text-red-600 text-center bg-red-50/10">
                        {entry.type === "expense"
                          ? entry.amount.toLocaleString()
                          : "-"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handle_open_modal(entry)}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => set_entry_to_delete(entry)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900 text-white font-black">
                    <td colSpan={4} className="px-6 py-4 text-left">
                      الرصيد النهائي (صافي الربح)
                    </td>
                    <td
                      colSpan={2}
                      className="px-6 py-4 text-center text-xl tracking-tight"
                    >
                      {financial_summary.balance.toLocaleString()} ل.س
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {active_tab === "reports" && (
            <div className="p-8 space-y-12">
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <h3 className="font-black mb-8 text-slate-800 flex items-center gap-2">
                  <div className="w-2 h-6 bg-blue-600 rounded-full"></div>
                  الإيرادات والمصروفات الشهرية
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={reports_data.monthly}
                    margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#e2e8f0"
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fontWeight: 700, fill: "#94a3b8" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{
                        paddingBottom: "20px",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    />
                    <Bar
                      dataKey="income"
                      name="الإيرادات"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    />
                    <Bar
                      dataKey="expense"
                      name="المصروفات"
                      fill="#EF4444"
                      radius={[4, 4, 0, 0]}
                      barSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-black mb-8 text-slate-800 flex items-center gap-2">
                    <div className="w-2 h-6 bg-green-500 rounded-full"></div>
                    توزيع الإيرادات
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reports_data.income}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        stroke="none"
                      >
                        {reports_data.income.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        iconType="circle"
                        wrapperStyle={{
                          paddingTop: "20px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm">
                  <h3 className="font-black mb-8 text-slate-800 flex items-center gap-2">
                    <div className="w-2 h-6 bg-red-500 rounded-full"></div>
                    توزيع المصروفات
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={reports_data.expense}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        stroke="none"
                      >
                        {reports_data.expense.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        iconType="circle"
                        wrapperStyle={{
                          paddingTop: "20px",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal.is_open && (
        <FinancialEntryModal
          isOpen={modal.is_open}
          onClose={handle_close_modal}
          onSubmit={handle_submit}
          initialData={modal.data}
          users={users}
        />
      )}
      {entry_to_delete && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => set_entry_to_delete(null)}
        >
          <div
            className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-50 mb-6">
                <ExclamationTriangleIcon className="h-10 w-10 text-red-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                تأكيد حذف القيد
              </h3>
              <p className="text-slate-500 mt-3">
                هل أنت متأكد من حذف هذا القيد المالي؟ لا يمكن التراجع عن هذا
                الإجراء.
              </p>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <button
                type="button"
                className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
                onClick={() => set_entry_to_delete(null)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200"
                onClick={handle_confirm_delete}
              >
                نعم، قم بالحذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Modal Component ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any, is_subscription_renewal: boolean) => void;
  initialData?: SiteFinancialEntry;
  users: Profile[];
}
const FinancialEntryModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  users,
}) => {
  const [form_data, set_form_data] = React.useState<any>({});
  const [is_subscription_renewal, set_is_subscription_renewal] =
    React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const data = initialData
        ? {
            ...initialData,
            payment_date: to_input_date_string(initialData.payment_date),
          }
        : {
            type: "income",
            payment_date: to_input_date_string(new Date()),
            amount: 0,
            user_id: "none",
            category: "غير مصنف",
          };
      set_form_data(data);
      set_is_subscription_renewal(
        initialData?.description?.includes("تجديد اشتراك") || false,
      );
    }
  }, [isOpen, initialData]);

  const handle_change = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value, type } = e.target;
    const finalValue =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : value;

    if (name === "is_subscription_renewal") {
      set_is_subscription_renewal(finalValue as boolean);
      if (finalValue) {
        const user = users.find((u) => u.id === form_data.user_id);
        const current_end = user?.subscription_end_date
          ? safe_revive_date(user.subscription_end_date)
          : new Date();
        const new_start = to_input_date_string(current_end);
        const new_end_date = new Date(
          current_end.getFullYear() + 1,
          current_end.getMonth(),
          current_end.getDate(),
        );
        const new_end = to_input_date_string(new_end_date);

        set_form_data((prev: any) => ({
          ...prev,
          description: `تجديد اشتراك لـ ${user?.full_name || "مستخدم"}`,
          new_subscription_start: new_start,
          new_subscription_end: new_end,
        }));
      }
    } else {
      set_form_data((prev: any) => ({ ...prev, [name]: finalValue }));
    }
  };

  const handle_user_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = e.target.value;
    set_form_data((prev: any) => ({ ...prev, user_id: userId }));
    if (is_subscription_renewal) {
      const user = users.find((u) => u.id === userId);
      const current_end = user?.subscription_end_date
        ? safe_revive_date(user.subscription_end_date)
        : new Date();
      const new_start = to_input_date_string(current_end);
      const new_end_date = new Date(
        current_end.getFullYear() + 1,
        current_end.getMonth(),
        current_end.getDate(),
      );
      const new_end = to_input_date_string(new_end_date);

      set_form_data((prev: any) => ({
        ...prev,
        description: `تجديد اشتراك لـ ${user?.full_name || "مستخدم"}`,
        new_subscription_start: new_start,
        new_subscription_end: new_end,
      }));
    }
  };

  const handle_form_submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form_data, is_subscription_renewal);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-lg my-8 animate-in slide-in-from-bottom-8 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black text-slate-900">
            {initialData ? "تعديل قيد مالي" : "إضافة قيد مالي جديد"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
          >
            <PlusIcon className="w-6 h-6 rotate-45" />
          </button>
        </div>
        <form onSubmit={handle_form_submit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
                النوع
              </label>
              <select
                name="type"
                value={form_data.type || "income"}
                onChange={handle_change}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
              >
                <option value="income">إيراد (+)</option>
                <option value="expense">مصروف (-)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
                تاريخ الدفع
              </label>
              <DatePicker
                name="payment_date"
                value={form_data.payment_date || ""}
                onChange={(date, name) =>
                  handle_change({ target: { name, value: date } } as any)
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
              المبلغ (ل.س)
            </label>
            <input
              type="number"
              name="amount"
              value={form_data.amount || 0}
              onChange={handle_change}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-black text-xl text-blue-600"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
              البيان / الوصف
            </label>
            <textarea
              name="description"
              value={form_data.description || ""}
              onChange={handle_change}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
              rows={3}
              placeholder="اكتب تفاصيل القيد هنا..."
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
                المستخدم
              </label>
              <select
                name="user_id"
                value={form_data.user_id || "none"}
                onChange={handle_user_change}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
              >
                <option value="none">-- لا يوجد --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-widest">
                الفئة
              </label>
              <input
                type="text"
                name="category"
                value={form_data.category || ""}
                onChange={handle_change}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                list="expense_categories"
                placeholder="اختر أو اكتب..."
              />
              <datalist id="expense_categories">
                <option value="رواتب" />
                <option value="إيجار مكتب" />
                <option value="فواتير" />
                <option value="مستلزمات مكتبية" />
                <option value="صيانة" />
                <option value="ضرائب ورسوم" />
                <option value="تسويق" />
                <option value="نفقات أخرى" />
              </datalist>
            </div>
          </div>
          {form_data.type === "income" && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    name="is_subscription_renewal"
                    checked={is_subscription_renewal}
                    onChange={handle_change}
                    className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 transition-all checked:bg-blue-600 checked:border-blue-600"
                  />
                  <CheckCircleIcon className="absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity" />
                </div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                  تجديد اشتراك لمستخدم؟
                </span>
              </label>
            </div>
          )}
          {is_subscription_renewal && form_data.user_id !== "none" && (
            <div className="p-6 bg-blue-50 rounded-2xl border border-blue-100 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <h4 className="font-black text-blue-800 text-sm flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                تحديث تواريخ الاشتراك
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    تاريخ البدء
                  </label>
                  <DatePicker
                    name="new_subscription_start"
                    value={form_data.new_subscription_start || ""}
                    onChange={(date, name) =>
                      handle_change({ target: { name, value: date } } as any)
                    }
                    required={is_subscription_renewal}
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    تاريخ الانتهاء
                  </label>
                  <DatePicker
                    name="new_subscription_end"
                    value={form_data.new_subscription_end || ""}
                    onChange={(date, name) =>
                      handle_change({ target: { name, value: date } } as any)
                    }
                    required={is_subscription_renewal}
                  />
                </div>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
            >
              حفظ القيد
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SiteFinancesPage;

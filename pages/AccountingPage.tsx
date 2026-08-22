import * as React from "react";
import DatePicker from "../components/DatePicker";
import {
  AccountingEntry,
  Client,
  Invoice,
  InvoiceItem,
  Case,
  Stage,
  Session,
} from "../types";
import {
  format_date,
  to_input_date_string,
  parse_input_date_string,
  safe_revive_date,
} from "../utils/dateUtils";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  SearchIcon,
  ExclamationTriangleIcon,
  PrintIcon,
  DocumentTextIcon,
  CalculatorIcon,
  ChartPieIcon,
} from "../components/icons";
import { useData } from "../context/DataContext";
import { useFeedback } from "../context/FeedbackContext";
import PrintableInvoice from "../components/PrintableInvoice";
import { printElement } from "../utils/printUtils";
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

// --- TAB: ENTRIES ---

const TabsHeader: React.FC<{
  active_tab: string;
  set_active_tab: (tab: any) => void;
  children?: React.ReactNode;
}> = ({ active_tab, set_active_tab, children }) => {
  const { accounting_entries } = useData();

  const financial_summary = React.useMemo(() => {
    const total_income = accounting_entries
      .filter((e) => e.type === "income")
      .reduce((sum, e) => sum + e.amount, 0);
    const total_expenses = accounting_entries
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      total_income,
      total_expenses,
      balance: total_income - total_expenses,
    };
  }, [accounting_entries]);

  return (
    <div className="sticky top-0 z-20 bg-gray-100 -mx-4 px-4 -mt-4 pt-4 pb-4 shadow-sm border-b border-gray-200 mb-6 space-y-4">
      {/* Title & Actions Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">المحاسبة</h1>
        {children && (
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-start sm:justify-end">
            {children}
          </div>
        )}
      </div>

      {/* Financial Summary Cards in Sticky Header */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-green-50/90 border border-green-200 p-3 rounded-lg shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-green-800">إجمالي المقبوضات</h3>
            <p className="text-lg sm:text-xl font-bold text-green-700 mt-0.5">
              {financial_summary.total_income.toLocaleString()} <span className="text-xs font-normal text-green-600">ل.س</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold">
            ↓
          </div>
        </div>

        <div className="bg-red-50/90 border border-red-200 p-3 rounded-lg shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-red-800">إجمالي المصروفات</h3>
            <p className="text-lg sm:text-xl font-bold text-red-700 mt-0.5">
              {financial_summary.total_expenses.toLocaleString()} <span className="text-xs font-normal text-red-600">ل.س</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center font-bold">
            ↑
          </div>
        </div>

        <div className="bg-blue-50/90 border border-blue-200 p-3 rounded-lg shadow-sm flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-blue-800">الرصيد الصافي</h3>
            <p className={`text-lg sm:text-xl font-bold mt-0.5 ${
              financial_summary.balance >= 0 ? "text-blue-700" : "text-amber-700"
            }`}>
              {financial_summary.balance.toLocaleString()} <span className="text-xs font-normal text-blue-600">ل.س</span>
            </p>
          </div>
          <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
            =
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => set_active_tab("entries")}
          className={`px-6 py-2.5 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${active_tab === "entries" ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
        >
          <div className="flex items-center gap-2">
            <CalculatorIcon className="w-5 h-5" /> القيود اليومية
          </div>
        </button>
        <button
          onClick={() => set_active_tab("invoices")}
          className={`px-6 py-2.5 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${active_tab === "invoices" ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
        >
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5" /> الفواتير
          </div>
        </button>
        <button
          onClick={() => set_active_tab("reports")}
          className={`px-6 py-2.5 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${active_tab === "reports" ? "border-blue-600 text-blue-600 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"}`}
        >
          <div className="flex items-center gap-2">
            <ChartPieIcon className="w-5 h-5" /> التقارير
          </div>
        </button>
      </div>
    </div>
  );
};

const EntriesTab: React.FC<{
  active_tab: string;
  set_active_tab: (tab: any) => void;
}> = ({ active_tab, set_active_tab }) => {
  const {
    accounting_entries,
    set_accounting_entries,
    clients,
    delete_accounting_entry,
    permissions,
    effective_user_id,
  } = useData();
  const { confirm } = useFeedback();
  const [modal, set_modal] = React.useState<{
    is_open: boolean;
    data?: AccountingEntry;
  }>({ is_open: false });
  const [form_data, set_form_data] = React.useState<Partial<AccountingEntry>>(
    {},
  );
  const [search_query, set_search_query] = React.useState("");
  const [selected_entry_ids, set_selected_entry_ids] = React.useState<string[]>([]);

  const financial_summary = React.useMemo(() => {
    const total_income = accounting_entries
      .filter((e) => e.type === "income")
      .reduce((sum, e) => sum + e.amount, 0);
    const total_expenses = accounting_entries
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + e.amount, 0);
    return {
      total_income,
      total_expenses,
      balance: total_income - total_expenses,
    };
  }, [accounting_entries]);

  const filtered_and_sorted_entries = React.useMemo(() => {
    const filtered = accounting_entries.filter((entry) => {
      if (!search_query) return true;
      const lowercased_query = search_query.toLowerCase();
      return (
        entry.description.toLowerCase().includes(lowercased_query) ||
        entry.client_name.toLowerCase().includes(lowercased_query) ||
        entry.amount.toString().includes(search_query)
      );
    });
    return filtered.sort(
      (a, b) =>
        safe_revive_date(b.date).getTime() - safe_revive_date(a.date).getTime(),
    );
  }, [accounting_entries, search_query]);

  const table_totals = React.useMemo(() => {
    return filtered_and_sorted_entries.reduce(
      (acc, entry) => {
        if (entry.type === "income") acc.income += entry.amount;
        else acc.expense += entry.amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );
  }, [filtered_and_sorted_entries]);

  const handle_open_modal = (entry?: AccountingEntry) => {
    set_form_data(
      entry
        ? { ...entry, date: to_input_date_string(entry.date) as unknown as any }
        : {
            type: "expense",
            date: to_input_date_string(new Date()) as unknown as any,
          },
    );
    set_modal({ is_open: true, data: entry });
  };

  const handle_close_modal = () => set_modal({ is_open: false });

  const handle_toggle_select_all = () => {
    if (
      filtered_and_sorted_entries.length > 0 &&
      selected_entry_ids.length === filtered_and_sorted_entries.length
    ) {
      set_selected_entry_ids([]);
    } else {
      set_selected_entry_ids(filtered_and_sorted_entries.map((e) => e.id));
    }
  };

  const handle_toggle_select = (id: string) => {
    set_selected_entry_ids((prev) =>
      prev.includes(id) ? prev.filter((item_id) => item_id !== id) : [...prev, id],
    );
  };

  const handle_delete_selected = () => {
    if (selected_entry_ids.length === 0) return;
    confirm({
      title: "تأكيد حذف القيود المحددة",
      message: `هل أنت متأكد من حذف ${selected_entry_ids.length} قيد محاسبي محدد؟ لا يمكن التراجع عن هذا الإجراء.`,
      confirmText: `حذف (${selected_entry_ids.length})`,
      cancelText: "إلغاء",
      variant: "danger",
      onConfirm: () => {
        selected_entry_ids.forEach((id) => {
          delete_accounting_entry(id);
        });
        set_selected_entry_ids([]);
      },
    });
  };

  const handle_form_change = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    set_form_data((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) : value,
    }));
  };

  const handle_client_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const client_id = e.target.value;
    const client = clients.find((c) => c.id === client_id);
    set_form_data((prev) => ({
      ...prev,
      client_id,
      client_name: client?.name || "",
      case_id: "",
    }));
  };

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry_data: Omit<AccountingEntry, "id"> = {
      type: (form_data.type || "expense") as "income" | "expense",
      amount: Number(form_data.amount),
      date: form_data.date!,
      description: form_data.description!,
      client_id: form_data.client_id || "",
      case_id: form_data.case_id || "",
      client_name: form_data.client_name || "",
      updated_at: new Date().toISOString(),
      user_id: effective_user_id,
    };

    if (modal.data) {
      set_accounting_entries((prev) =>
        prev.map((item) =>
          item.id === modal.data!.id ? { ...item, ...entry_data } : item,
        ),
      );
    } else {
      set_accounting_entries((prev) => [
        ...prev,
        { ...entry_data, id: `acc-${Date.now()}` },
      ]);
    }
    handle_close_modal();
  };

  return (
    <div className="space-y-6">
      <TabsHeader active_tab={active_tab} set_active_tab={set_active_tab}>
        <div className="relative w-full sm:w-64">
          <input
            type="search"
            placeholder="بحث في القيود..."
            value={search_query}
            onChange={(e) => set_search_query(e.target.value)}
            className="w-full p-2 ps-10 border border-gray-300 rounded-lg bg-white focus:ring-blue-500 focus:border-blue-500 shadow-sm text-sm"
          />
          <div className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
            <SearchIcon className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        {permissions.can_delete_financial_entry && selected_entry_ids.length > 0 && (
          <button
            onClick={handle_delete_selected}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold whitespace-nowrap shadow-sm transition"
            title="حذف القيود المحددة"
          >
            <TrashIcon className="w-5 h-5" />
            <span>حذف المحدد ({selected_entry_ids.length})</span>
          </button>
        )}
        {permissions.can_add_financial_entry && (
          <button
            onClick={() => handle_open_modal()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold whitespace-nowrap"
          >
            <PlusIcon className="w-5 h-5" /> <span>قيد جديد</span>
          </button>
        )}
      </TabsHeader>

      <div className="bg-white p-4 rounded-lg shadow space-y-4">
        {selected_entry_ids.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-2.5 rounded-lg flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium">
              تم تحديد <strong className="font-bold text-blue-700">{selected_entry_ids.length}</strong> من أصل {filtered_and_sorted_entries.length} قيد
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => set_selected_entry_ids([])}
                className="text-xs text-gray-600 hover:text-gray-900 underline font-medium"
              >
                إلغاء التحديد
              </button>
              {permissions.can_delete_financial_entry && (
                <button
                  type="button"
                  onClick={handle_delete_selected}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-md hover:bg-red-700 transition shadow-sm"
                >
                  <TrashIcon className="w-4 h-4" />
                  <span>حذف المحدد ({selected_entry_ids.length})</span>
                </button>
              )}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right text-gray-600">
            <thead className="bg-gray-100 text-gray-700 font-semibold">
              <tr>
                <th className="px-3 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filtered_and_sorted_entries.length > 0 &&
                      selected_entry_ids.length === filtered_and_sorted_entries.length
                    }
                    onChange={handle_toggle_select_all}
                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    title="تحديد الكل"
                  />
                </th>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">البيان</th>
                <th className="px-4 py-3">الموكل</th>
                <th className="px-4 py-3 text-green-600">مقبوضات</th>
                <th className="px-4 py-3 text-red-600">مدفوعات</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered_and_sorted_entries.map((entry) => {
                const is_selected = selected_entry_ids.includes(entry.id);
                return (
                  <tr
                    key={entry.id}
                    className={`border-b transition-colors ${
                      is_selected ? "bg-blue-50/80 hover:bg-blue-100/80" : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={is_selected}
                        onChange={() => handle_toggle_select(entry.id)}
                        className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{format_date(entry.date)}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{entry.description}</td>
                    <td className="px-4 py-3">{entry.client_name || "-"}</td>
                    <td className="px-4 py-3 font-bold text-green-600 whitespace-nowrap">
                      {entry.type === "income"
                        ? entry.amount.toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3 font-bold text-red-600 whitespace-nowrap">
                      {entry.type === "expense"
                        ? entry.amount.toLocaleString()
                        : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handle_open_modal(entry)}
                          className="p-1 text-gray-500 hover:text-blue-600 rounded transition"
                          title="تعديل"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        {permissions.can_delete_financial_entry && (
                          <button
                            onClick={() =>
                              confirm({
                                title: "تأكيد الحذف",
                                message: `هل أنت متأكد من حذف القيد "${entry.description}"؟`,
                                confirmText: "حذف",
                                cancelText: "إلغاء",
                                variant: "danger",
                                onConfirm: () => delete_accounting_entry(entry.id),
                              })
                            }
                            className="p-1 text-gray-500 hover:text-red-600 rounded transition"
                            title="حذف"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered_and_sorted_entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center p-6 text-gray-500">
                    لا توجد قيود.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-gray-100 font-bold">
              <tr>
                <td></td>
                <td colSpan={3} className="px-4 py-3 text-left">
                  الإجمالي
                </td>
                <td className="px-4 py-3 text-green-700 whitespace-nowrap">
                  {table_totals.income.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-red-700 whitespace-nowrap">
                  {table_totals.expense.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-blue-800 whitespace-nowrap">
                  الفرق:{" "}
                  {(
                    table_totals.income - table_totals.expense
                  ).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {modal.is_open && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handle_close_modal}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">
              {modal.data ? "تعديل قيد" : "إضافة قيد جديد"}
            </h2>
            <form onSubmit={handle_submit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium">النوع</label>
                  <select
                    name="type"
                    value={form_data.type || "expense"}
                    onChange={handle_form_change}
                    className="w-full p-2 border rounded"
                  >
                    <option value="expense">مصروفات</option>
                    <option value="income">مقبوضات</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium">التاريخ</label>
                  <DatePicker
                    name="date"
                    value={(form_data.date as any) || ""}
                    onChange={(date, name) =>
                      handle_form_change({
                        target: { name, value: date },
                      } as any)
                    }
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium">المبلغ</label>
                <input
                  type="number"
                  name="amount"
                  value={form_data.amount || ""}
                  onChange={handle_form_change}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">البيان</label>
                <input
                  type="text"
                  name="description"
                  value={form_data.description || ""}
                  onChange={handle_form_change}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  الموكل (اختياري)
                </label>
                <select
                  name="client_id"
                  value={form_data.client_id || ""}
                  onChange={handle_client_change}
                  className="w-full p-2 border rounded"
                >
                  <option value="">-- عام --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={handle_close_modal}
                  className="px-4 py-2 bg-gray-200 rounded"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- TAB: INVOICES ---
const InvoicesTab: React.FC<{
  initial_invoice_data?: { client_id: string; case_id?: string };
  clear_initial_invoice_data: () => void;
  active_tab: string;
  set_active_tab: any;
}> = ({ initial_invoice_data, clear_initial_invoice_data, active_tab, set_active_tab }) => {
  const { invoices, set_invoices, clients, delete_invoice, permissions } =
    useData();
  const { confirm, showFeedback } = useFeedback();
  const [modal, set_modal] = React.useState<{
    is_open: boolean;
    data?: Invoice;
  }>({ is_open: false });
  const [is_print_modal_open, set_is_print_modal_open] = React.useState(false);
  const [invoice_to_print, set_invoice_to_print] =
    React.useState<Invoice | null>(null);
  const invoice_print_ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (initial_invoice_data) {
      const client = clients.find(
        (c) => c.id === initial_invoice_data.client_id,
      );
      const case_item = client?.cases.find(
        (c) => c.id === initial_invoice_data.case_id,
      );
      const new_invoice: Partial<Invoice> = {
        client_id: initial_invoice_data.client_id,
        client_name: client?.name || "",
        case_id: initial_invoice_data.case_id,
        case_subject: case_item?.subject,
        issue_date: to_input_date_string(new Date()),
        due_date: to_input_date_string(
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ), // +1 week
        items: [
          { id: `item-${Date.now()}`, description: "أتعاب محاماة", amount: 0 },
        ],
        tax_rate: 0,
        discount: 0,
        status: "draft",
      };
      // @ts-ignore
      set_modal({ is_open: true, data: new_invoice });
      clear_initial_invoice_data();
    }
  }, [initial_invoice_data, clients, clear_initial_invoice_data]);

  const handle_save_invoice = (invoice: Invoice) => {
    if (modal.data && modal.data.id) {
      set_invoices((prev) =>
        prev.map((inv) => (inv.id === invoice.id ? invoice : inv)),
      );
    } else {
      set_invoices((prev) => [...prev, invoice]);
    }
    set_modal({ is_open: false });
  };

  const handle_delete_invoice = (id: string) => {
    confirm({
      title: "حذف الفاتورة",
      message: "هل أنت متأكد من حذف هذه الفاتورة؟",
      confirmText: "حذف",
      cancelText: "إلغاء",
      variant: "danger",
      onConfirm: () => {
        delete_invoice(id);
      },
    });
  };

  const handle_print_invoice = (invoice: Invoice) => {
    set_invoice_to_print(invoice);
    set_is_print_modal_open(true);
  };

  const [selected_invoice_ids, set_selected_invoice_ids] = React.useState<string[]>([]);

  const handle_toggle_select_all = () => {
    if (
      invoices.length > 0 &&
      selected_invoice_ids.length === invoices.length
    ) {
      set_selected_invoice_ids([]);
    } else {
      set_selected_invoice_ids(invoices.map((inv) => inv.id));
    }
  };

  const handle_toggle_select = (id: string) => {
    set_selected_invoice_ids((prev) =>
      prev.includes(id) ? prev.filter((item_id) => item_id !== id) : [...prev, id],
    );
  };

  const handle_delete_selected = () => {
    if (selected_invoice_ids.length === 0) return;
    confirm({
      title: "تأكيد حذف الفواتير المحددة",
      message: `هل أنت متأكد من حذف ${selected_invoice_ids.length} فاتورة محددة؟ لا يمكن التراجع عن هذا الإجراء.`,
      confirmText: `حذف (${selected_invoice_ids.length})`,
      cancelText: "إلغاء",
      variant: "danger",
      onConfirm: () => {
        selected_invoice_ids.forEach((id) => {
          delete_invoice(id);
        });
        set_selected_invoice_ids([]);
      },
    });
  };

  return (
    <div className="space-y-6">
      <TabsHeader active_tab={active_tab} set_active_tab={set_active_tab}>
        {permissions.can_manage_invoices && selected_invoice_ids.length > 0 && (
          <button
            onClick={handle_delete_selected}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold whitespace-nowrap shadow-sm transition"
            title="حذف الفواتير المحددة"
          >
            <TrashIcon className="w-5 h-5" />
            <span>حذف المحدد ({selected_invoice_ids.length})</span>
          </button>
        )}
        {permissions.can_manage_invoices && (
          <button
            onClick={() => set_modal({ is_open: true })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold whitespace-nowrap"
          >
            <PlusIcon className="w-5 h-5" /> <span>فاتورة جديدة</span>
          </button>
        )}
      </TabsHeader>

      {invoices.length > 0 && (
        <div className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={
                invoices.length > 0 &&
                selected_invoice_ids.length === invoices.length
              }
              onChange={handle_toggle_select_all}
              className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
            />
            <span>تحديد الكل ({invoices.length} فاتورة)</span>
          </label>
          {selected_invoice_ids.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-blue-700 font-bold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                المحدد: {selected_invoice_ids.length}
              </span>
              <button
                type="button"
                onClick={() => set_selected_invoice_ids([])}
                className="text-xs text-gray-500 hover:text-gray-800 underline px-1"
              >
                إلغاء
              </button>
              {permissions.can_manage_invoices && (
                <button
                  type="button"
                  onClick={handle_delete_selected}
                  className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-md hover:bg-red-700 transition"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  <span>حذف ({selected_invoice_ids.length})</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {invoices.length > 0 ? (
          invoices.map((inv) => {
            const is_selected = selected_invoice_ids.includes(inv.id);
            return (
            <div
              key={inv.id}
              className={`bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-all relative ${
                is_selected ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50/30" : "border-gray-200"
              }`}
            >
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={is_selected}
                    onChange={() => handle_toggle_select(inv.id)}
                    className="w-4 h-4 mt-1 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{inv.client_name}</h3>
                    <p className="text-xs text-gray-500">رقم: {inv.id}</p>
                  </div>
                </div>
                <span
                  className={`px-2 py-1 text-xs rounded-full font-medium ${
                    inv.status === "paid"
                      ? "bg-green-100 text-green-800"
                      : inv.status === "sent"
                        ? "bg-blue-100 text-blue-800"
                        : inv.status === "overdue"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {inv.status === "paid"
                    ? "مدفوعة"
                    : inv.status === "sent"
                      ? "مرسلة"
                      : inv.status === "overdue"
                        ? "متأخرة"
                        : "مسودة"}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2">
                تاريخ: {format_date(inv.issue_date)}
              </p>
              <div className="border-t pt-2 mt-2 flex justify-between items-center">
                <span className="font-bold text-lg text-blue-900">
                  {(
                    inv.items.reduce((s, i) => s + i.amount, 0) +
                    (inv.items.reduce((s, i) => s + i.amount, 0) *
                      inv.tax_rate) /
                      100 -
                    inv.discount
                  ).toLocaleString()}{" "}
                  ل.س
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handle_print_invoice(inv)}
                    className="p-2 text-gray-500 hover:text-green-600 rounded transition"
                    title="طباعة"
                  >
                    <PrintIcon className="w-4 h-4" />
                  </button>
                  {permissions.can_manage_invoices && (
                    <button
                      onClick={() => set_modal({ is_open: true, data: inv })}
                      className="p-2 text-gray-500 hover:text-blue-600 rounded transition"
                      title="تعديل"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                  )}
                  {permissions.can_manage_invoices && (
                    <button
                      onClick={() => handle_delete_invoice(inv.id)}
                      className="p-2 text-gray-500 hover:text-red-600 rounded transition"
                      title="حذف"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })
        ) : (
          <div className="col-span-full text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
            لا توجد فواتير مسجلة.
          </div>
        )}
      </div>

      {modal.is_open && (
        <InvoiceModal
          is_open={modal.is_open}
          on_close={() => set_modal({ is_open: false })}
          initial_data={modal.data}
          on_save={handle_save_invoice}
          clients={clients}
        />
      )}

      {is_print_modal_open && invoice_to_print && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
          onClick={() => set_is_print_modal_open(false)}
        >
          <div
            className="bg-white p-4 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="overflow-y-auto flex-grow" ref={invoice_print_ref}>
              <PrintableInvoice invoice={invoice_to_print} />
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end gap-4">
              <button
                onClick={() => set_is_print_modal_open(false)}
                className="px-6 py-2 bg-gray-200 rounded-lg"
              >
                إغلاق
              </button>
              <button
                onClick={() =>
                  printElement(invoice_print_ref.current, showFeedback)
                }
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg"
              >
                <PrintIcon className="w-5 h-5" /> طباعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- INVOICE MODAL ---
const InvoiceModal: React.FC<{
  is_open: boolean;
  on_close: () => void;
  initial_data?: Partial<Invoice>;
  on_save: (inv: Invoice) => void;
  clients: Client[];
}> = ({ is_open, on_close, initial_data, on_save, clients }) => {
  const { effective_user_id } = useData();
  const [form_data, set_form_data] = React.useState<Partial<Invoice>>({
    items: [{ id: `item-${Date.now()}`, description: "", amount: 0 }],
    tax_rate: 0,
    discount: 0,
    status: "draft",
    issue_date: to_input_date_string(new Date()),
    due_date: to_input_date_string(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ),
  });

  React.useEffect(() => {
    if (initial_data) {
      set_form_data({
        ...initial_data,
        issue_date: initial_data.issue_date || to_input_date_string(new Date()),
        due_date: initial_data.due_date || to_input_date_string(new Date()),
      });
    }
  }, [initial_data]);

  const handle_client_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const client_id = e.target.value;
    const client = clients.find((c) => c.id === client_id);
    set_form_data((prev) => ({
      ...prev,
      client_id,
      client_name: client?.name || "",
      case_id: undefined,
      case_subject: undefined,
    }));
  };

  const handle_case_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const case_id = e.target.value;
    const client = clients.find((c) => c.id === form_data.client_id);
    const case_item = client?.cases.find((c) => c.id === case_id);
    set_form_data((prev) => ({
      ...prev,
      case_id,
      case_subject: case_item?.subject,
    }));
  };

  const handle_item_change = (
    index: number,
    field: keyof InvoiceItem,
    value: any,
  ) => {
    const new_items = [...(form_data.items || [])];
    new_items[index] = { ...new_items[index], [field]: value };
    set_form_data((prev) => ({ ...prev, items: new_items }));
  };

  const add_item = () =>
    set_form_data((prev) => ({
      ...prev,
      items: [
        ...(prev.items || []),
        { id: `item-${Date.now()}`, description: "", amount: 0 },
      ],
    }));
  const remove_item = (index: number) =>
    set_form_data((prev) => ({
      ...prev,
      items: prev.items?.filter((_, i) => i !== index),
    }));

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    const invoice: Invoice = {
      ...(form_data as Invoice),
      id:
        form_data.id ||
        `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
      updated_at: new Date().toISOString(),
      user_id: effective_user_id,
    };
    on_save(invoice);
  };

  const subtotal = (form_data.items || []).reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const total =
    subtotal +
    (subtotal * (form_data.tax_rate || 0)) / 100 -
    (form_data.discount || 0);

  if (!is_open) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={on_close}
    >
      <div
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">
          {initial_data?.id ? "تعديل فاتورة" : "إنشاء فاتورة جديدة"}
        </h2>
        <form onSubmit={handle_submit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">الموكل</label>
              <select
                value={form_data.client_id || ""}
                onChange={handle_client_change}
                className="w-full p-2 border rounded"
                required
              >
                <option value="">اختر موكل...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">
                القضية (اختياري)
              </label>
              <select
                value={form_data.case_id || ""}
                onChange={handle_case_change}
                className="w-full p-2 border rounded"
                disabled={!form_data.client_id}
              >
                <option value="">-- عام --</option>
                {clients
                  .find((c) => c.id === form_data.client_id)
                  ?.cases.map((cs) => (
                    <option key={cs.id} value={cs.id}>
                      {cs.subject}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">تاريخ الإصدار</label>
              <DatePicker
                value={to_input_date_string(form_data.issue_date)}
                onChange={(date) =>
                  set_form_data({ ...form_data, issue_date: date })
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium">
                تاريخ الاستحقاق
              </label>
              <DatePicker
                value={to_input_date_string(form_data.due_date)}
                onChange={(date) =>
                  set_form_data({ ...form_data, due_date: date })
                }
                required
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">بنود الفاتورة</h3>
              <button
                type="button"
                onClick={add_item}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                <PlusIcon className="w-4 h-4" /> إضافة بند
              </button>
            </div>
            {form_data.items?.map((item, index) => (
              <div key={item.id} className="flex gap-2 mb-2 items-center">
                <input
                  type="text"
                  placeholder="البيان"
                  value={item.description}
                  onChange={(e) =>
                    handle_item_change(index, "description", e.target.value)
                  }
                  className="flex-grow p-2 border rounded text-sm"
                  required
                />
                <input
                  type="number"
                  placeholder="المبلغ"
                  value={item.amount}
                  onChange={(e) =>
                    handle_item_change(index, "amount", Number(e.target.value))
                  }
                  className="w-24 p-2 border rounded text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => remove_item(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-4 border-t pt-4">
            <div>
              <label className="block text-xs font-medium">ضريبة (%)</label>
              <input
                type="number"
                value={form_data.tax_rate || 0}
                onChange={(e) =>
                  set_form_data({
                    ...form_data,
                    tax_rate: Number(e.target.value),
                  })
                }
                className="w-full p-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">خصم (مبلغ)</label>
              <input
                type="number"
                value={form_data.discount || 0}
                onChange={(e) =>
                  set_form_data({
                    ...form_data,
                    discount: Number(e.target.value),
                  })
                }
                className="w-full p-2 border rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium">الحالة</label>
              <select
                value={form_data.status || "draft"}
                onChange={(e) =>
                  set_form_data({ ...form_data, status: e.target.value as any })
                }
                className="w-full p-2 border rounded text-sm"
              >
                <option value="draft">مسودة</option>
                <option value="sent">مرسلة</option>
                <option value="paid">مدفوعة</option>
                <option value="overdue">متأخرة</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center font-bold text-lg bg-gray-50 p-2 rounded">
            <span>الإجمالي:</span>
            <span>{total.toLocaleString()} ل.س</span>
          </div>

          <div className="flex justify-end gap-4 mt-6">
            <button
              type="button"
              onClick={on_close}
              className="px-4 py-2 bg-gray-200 rounded"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              حفظ الفاتورة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- TAB: REPORTS ---
const ReportsTab: React.FC<{active_tab: string; set_active_tab: any}> = ({active_tab, set_active_tab}) => {
  const { accounting_entries } = useData();
  const reports_data = React.useMemo(() => {
    const income = accounting_entries
      .filter((e) => e.type === "income")
      .reduce((sum, e) => sum + e.amount, 0);
    const expense = accounting_entries
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + e.amount, 0);
    return [
      { name: "الإيرادات", value: income, color: "#10B981" },
      { name: "المصروفات", value: expense, color: "#EF4444" },
    ];
  }, [accounting_entries]);

  return (
    <div className="space-y-8">
      <TabsHeader active_tab={active_tab} set_active_tab={set_active_tab} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-lg shadow h-[400px]">
          <h3 className="text-lg font-semibold mb-4 text-center">
            توزيع الإيرادات والمصروفات
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={reports_data}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
                label
              >
                {reports_data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white p-6 rounded-lg shadow h-[400px]">
          <h3 className="text-lg font-semibold mb-4 text-center">
            المقارنة العمودية
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={reports_data}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8">
                {reports_data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
const AccountingPage: React.FC<{
  initial_invoice_data?: { client_id: string; case_id?: string };
  clear_initial_invoice_data: () => void;
}> = ({ initial_invoice_data, clear_initial_invoice_data }) => {
  const [active_tab, set_active_tab] = React.useState<
    "entries" | "invoices" | "reports"
  >("entries");

  // Automatically switch to invoices tab if initial data is present
  React.useEffect(() => {
    if (initial_invoice_data) set_active_tab("invoices");
  }, [initial_invoice_data]);

  return (
    <div className="space-y-6">
      {active_tab === "entries" && <EntriesTab active_tab={active_tab} set_active_tab={set_active_tab} />}
      {active_tab === "invoices" && (
        <InvoicesTab
          initial_invoice_data={initial_invoice_data}
          clear_initial_invoice_data={clear_initial_invoice_data}
          active_tab={active_tab} set_active_tab={set_active_tab}
        />
      )}
      {active_tab === "reports" && <ReportsTab active_tab={active_tab} set_active_tab={set_active_tab} />}
    </div>
  );
};

export default AccountingPage;

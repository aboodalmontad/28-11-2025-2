import * as React from "react";
import DatePicker from "./DatePicker";
import { Case, Client, AccountingEntry } from "../types";
import {
  format_date,
  to_input_date_string,
  safe_revive_date,
} from "../utils/dateUtils";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ExclamationCircleIcon,
} from "./icons";
import { useData } from "../context/DataContext";
import { useFeedback } from "../context/FeedbackContext";

interface CaseAccountingProps {
  case_data: Case;
  client: Client;
  case_accounting_entries: AccountingEntry[];
  set_accounting_entries: (
    updater: (prev: AccountingEntry[]) => AccountingEntry[],
  ) => void;
  on_fee_agreement_change: (new_fee_agreement: string) => void;
}

const CaseAccounting: React.FC<CaseAccountingProps> = ({
  case_data,
  client,
  case_accounting_entries,
  set_accounting_entries,
  on_fee_agreement_change,
}) => {
  const { permissions, effective_user_id } = useData();
  const { confirm } = useFeedback();
  const [is_editing_fee, set_is_editing_fee] = React.useState(false);
  const [fee_agreement, set_fee_agreement] = React.useState(
    case_data.fee_agreement || "",
  );
  const [modal, set_modal] = React.useState<{
    is_open: boolean;
    data?: AccountingEntry;
    type: "income" | "expense";
  }>({ is_open: false, type: "income" });
  const [form_data, set_form_data] = React.useState<Partial<AccountingEntry>>(
    {},
  );

  // --- Permission Check ---
  if (!permissions.can_view_finance) {
    return (
      <div className="p-8 text-center text-gray-500 flex flex-col items-center">
        <ExclamationCircleIcon className="w-12 h-12 text-gray-300 mb-2" />
        <p>ليس لديك صلاحية للاطلاع على التفاصيل المالية لهذه القضية.</p>
      </div>
    );
  }

  const sortedEntries = React.useMemo(
    () =>
      [...case_accounting_entries].sort(
        (a, b) =>
          safe_revive_date(b.date).getTime() -
          safe_revive_date(a.date).getTime(),
      ),
    [case_accounting_entries],
  );

  const totals = React.useMemo(() => {
    const income = case_accounting_entries
      .filter((e) => e.type === "income")
      .reduce((sum, e) => sum + e.amount, 0);
    const expense = case_accounting_entries
      .filter((e) => e.type === "expense")
      .reduce((sum, e) => sum + e.amount, 0);
    return { income, expense, balance: income - expense };
  }, [case_accounting_entries]);

  const handle_save_fee = () => {
    on_fee_agreement_change(fee_agreement);
    set_is_editing_fee(false);
  };

  const handle_open_modal = (
    type: "income" | "expense",
    entry?: AccountingEntry,
  ) => {
    set_form_data(
      entry
        ? { ...entry, date: entry.date }
        : { date: to_input_date_string(new Date()) },
    );
    set_modal({ is_open: true, data: entry, type });
  };

  const handle_close_modal = () =>
    set_modal({ is_open: false, type: "income" });

  const handle_form_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    set_form_data((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) : value,
    }));
  };

  const handle_submit = (e: React.FormEvent) => {
    e.preventDefault();
    const entryData: Omit<AccountingEntry, "id"> = {
      type: modal.type,
      amount: form_data.amount!,
      date: form_data.date!,
      description: form_data.description!,
      client_id: client.id,
      case_id: case_data.id,
      client_name: client.name,
      updated_at: new Date().toISOString(),
      user_id: effective_user_id,
    };

    if (modal.data) {
      // Editing
      set_accounting_entries((prev) =>
        prev.map((item) =>
          item.id === modal.data!.id
            ? ({ ...item, ...entryData } as AccountingEntry)
            : item,
        ),
      );
    } else {
      // Adding
      set_accounting_entries((prev) => [
        ...prev,
        { ...entryData, id: `acc-${Date.now()}` } as AccountingEntry,
      ]);
    }
    handle_close_modal();
  };

  const handle_delete = async (id: string) => {
    confirm({
      title: "حذف قيد مالي",
      message:
        "هل أنت متأكد من حذف هذا القيد المالي؟ لا يمكن التراجع عن هذه العملية.",
      confirmText: "نعم، حذف",
      cancelText: "إلغاء",
      variant: "danger",
      onConfirm: () => {
        set_accounting_entries((prev) => prev.filter((item) => item.id !== id));
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-white">
        <h4 className="font-semibold mb-2">اتفاقية الأتعاب</h4>
        {is_editing_fee ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={fee_agreement}
              onChange={(e) => set_fee_agreement(e.target.value)}
              className="w-full p-2 border rounded"
            />
            <button
              onClick={handle_save_fee}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              حفظ
            </button>
            <button
              onClick={() => set_is_editing_fee(false)}
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              إلغاء
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-gray-700">{fee_agreement || "لم تحدد بعد"}</p>
            {/* Allow edit only if user can edit case (fee agreement is part of case data) or has full finance view permissions logic could be applied here too */}
            {permissions.can_edit_case && (
              <button
                onClick={() => set_is_editing_fee(true)}
                className="p-2 text-gray-500 hover:text-blue-600"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h4 className="font-semibold">كشف حساب القضية</h4>
          <div className="flex gap-2">
            {permissions.can_add_financial_entry && (
              <>
                <button
                  onClick={() => handle_open_modal("income")}
                  className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-200 transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  إضافة مقبوضات
                </button>
                <button
                  onClick={() => handle_open_modal("expense")}
                  className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-200 transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  إضافة مصروفات
                </button>
              </>
            )}
          </div>
        </div>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-100 text-xs uppercase">
              <tr>
                <th className="px-4 py-2">التاريخ</th>
                <th className="px-4 py-2">البيان</th>
                <th className="px-4 py-2">المقبوضات</th>
                <th className="px-4 py-2">المصروفات</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.length > 0 ? (
                sortedEntries.map((entry) => (
                  <tr key={entry.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{format_date(entry.date)}</td>
                    <td className="px-4 py-2">{entry.description}</td>
                    <td className="px-4 py-2 font-semibold text-green-600">
                      {entry.type === "income"
                        ? `${entry.amount.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="px-4 py-2 font-semibold text-red-600">
                      {entry.type === "expense"
                        ? `${entry.amount.toLocaleString()}`
                        : "-"}
                    </td>
                    <td className="px-4 py-2 flex items-center gap-1">
                      {permissions.can_add_financial_entry && (
                        <button
                          onClick={() => handle_open_modal(entry.type, entry)}
                          className="p-1 text-gray-500 hover:text-blue-600"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                      )}
                      {permissions.can_delete_financial_entry && (
                        <button
                          onClick={() => handle_delete(entry.id)}
                          className="p-1 text-gray-500 hover:text-red-600"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center p-4 text-gray-500">
                    لا توجد قيود محاسبية لهذه القضية.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold bg-gray-50">
                <td colSpan={2} className="px-4 py-2 text-left">
                  إجمالي المقبوضات
                </td>
                <td className="px-4 py-2 text-green-600">
                  {totals.income.toLocaleString()} ل.س
                </td>
                <td className="px-4 py-2">-</td>
                <td></td>
              </tr>
              <tr className="font-bold bg-gray-50">
                <td colSpan={2} className="px-4 py-2 text-left">
                  إجمالي المصروفات
                </td>
                <td className="px-4 py-2">-</td>
                <td className="px-4 py-2 text-red-600">
                  {totals.expense.toLocaleString()} ل.س
                </td>
                <td></td>
              </tr>
              <tr className="bg-gray-100 font-bold border-t-2">
                <td colSpan={2} className="px-4 py-2 text-left">
                  الرصيد
                </td>
                <td colSpan={2} className="px-4 py-2 text-center">
                  {totals.balance.toLocaleString()} ل.س
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {modal.is_open && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={handle_close_modal}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">
              {modal.data ? "تعديل" : "إضافة"}{" "}
              {modal.type === "income" ? "مقبوضات" : "مصروفات"}
            </h2>
            <form onSubmit={handle_submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  المبلغ
                </label>
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
                <label className="block text-sm font-medium text-gray-700">
                  التاريخ
                </label>
                <DatePicker
                  name="date"
                  value={
                    form_data.date ? to_input_date_string(form_data.date) : ""
                  }
                  onChange={(date, name) =>
                    handle_form_change({ target: { name, value: date } } as any)
                  }
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  البيان
                </label>
                <input
                  type="text"
                  name="description"
                  value={form_data.description || ""}
                  onChange={handle_form_change}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>
              <div className="mt-6 flex justify-end gap-4">
                <button
                  type="button"
                  onClick={handle_close_modal}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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

export default CaseAccounting;

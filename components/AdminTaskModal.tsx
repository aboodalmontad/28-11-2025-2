import * as React from "react";
import DatePicker from "./DatePicker";
import { AdminTask } from "../types";
import { to_input_date_string, safe_revive_date } from "../utils/dateUtils";

interface AdminTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    taskData: Omit<AdminTask, "id" | "completed"> & { id?: string },
  ) => void;
  initialData?: Partial<Omit<AdminTask, "due_date">> & {
    due_date?: string | Date;
    id?: string;
  };
  assistants: string[];
}

const AdminTaskModal: React.FC<AdminTaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  assistants,
}) => {
  const [task_form_data, set_task_form_data] = React.useState({
    task: "",
    due_date: to_input_date_string(new Date()),
    importance: "normal" as "normal" | "important" | "urgent",
    assignee: "بدون تخصيص",
    location: "",
  });

  // Effect to reset and populate form state when the modal opens.
  React.useEffect(() => {
    if (isOpen) {
      const defaultState = {
        task: "",
        due_date: to_input_date_string(new Date()),
        importance: "normal" as const,
        assignee: "بدون تخصيص",
        location: "",
      };
      set_task_form_data({
        ...defaultState,
        ...initialData,
        due_date: initialData?.due_date
          ? to_input_date_string(initialData.due_date)
          : defaultState.due_date,
      });
    }
  }, [isOpen, initialData]);

  const handle_task_form_change = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    set_task_form_data((prev) => ({ ...prev, [name]: value }));
  };

  const handle_task_submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task_form_data.task || !task_form_data.due_date) return;

    const taskDate = safe_revive_date(task_form_data.due_date);

    // Explicitly construct the payload for onSubmit to ensure type safety and prevent spreading unwanted properties.
    onSubmit({
      // Spread task_form_data to include any other properties like order_index if they exist
      ...task_form_data,
      id: initialData?.id, // Override with id from initialData for editing
      due_date: to_input_date_string(taskDate), // Use the YYYY-MM-DD string
      location: task_form_data.location || "غير محدد", // Ensure location has a default
    } as Omit<AdminTask, "completed"> & { id?: string });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 no-print p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-bold mb-4">
          {initialData?.id ? "تعديل مهمة" : "إضافة مهمة جديدة"}
        </h2>
        <form onSubmit={handle_task_submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              المهمة
            </label>
            <textarea
              name="task"
              value={task_form_data.task || ""}
              onChange={handle_task_form_change}
              className="w-full p-2 border rounded"
              rows={3}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              المكان
            </label>
            <input
              type="text"
              name="location"
              list="locations"
              value={task_form_data.location || ""}
              onChange={handle_task_form_change}
              className="w-full p-2 border rounded"
              placeholder="مثال: القصر العدلي"
            />
            <datalist id="locations">
              <option value="القصر العدلي" />
              <option value="المكتب" />
              <option value="السجل العقاري" />
              <option value="السجل المدني" />
              <option value="المالية" />
            </datalist>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                تاريخ الاستحقاق
              </label>
              <DatePicker
                name="due_date"
                value={task_form_data.due_date || ""}
                onChange={(date, name) =>
                  handle_task_form_change({
                    target: { name, value: date },
                  } as any)
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                الأهمية
              </label>
              <select
                name="importance"
                value={task_form_data.importance || "normal"}
                onChange={handle_task_form_change}
                className="w-full p-2 border rounded"
                required
              >
                <option value="normal">عادي</option>
                <option value="important">مهم</option>
                <option value="urgent">عاجل</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              تخصيص لـ
            </label>
            <select
              name="assignee"
              value={task_form_data.assignee || "بدون تخصيص"}
              onChange={handle_task_form_change}
              className="w-full p-2 border rounded"
            >
              {assistants.map((name, index) => (
                <option key={`${name}-${index}`} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-6 flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
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
  );
};

export default AdminTaskModal;

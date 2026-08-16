import * as React from "react";
import DatePicker from "./DatePicker";
import { AdminTask } from "../types";
import { to_input_date_string, safe_revive_date } from "../utils/dateUtils";
import { CameraIcon, PhotoIcon, TrashIcon } from "./icons";

interface AdminTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    taskData: Omit<AdminTask, "id" | "completed"> & { id?: string },
  ) => void;
  initialData?: Partial<Omit<AdminTask, "due_date">> & {
    due_date?: string | Date;
    id?: string;
    case_id?: string;
    image_url?: string;
  };
  assistants: (string | { name: string; user_id?: string })[];
}

const compressImage = (
  file: File,
  maxWidth = 700,
  maxHeight = 700,
  quality = 0.65
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => reject(new Error("فشل قراءة الصورة"));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error("فشل تحويل الملف"));
    reader.readAsDataURL(file);
  });
};

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
    image_url: undefined as string | undefined,
    case_id: undefined as string | undefined,
  });

  const [isProcessingImage, setIsProcessingImage] = React.useState(false);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);

  // Effect to reset and populate form state when the modal opens.
  React.useEffect(() => {
    if (isOpen) {
      const defaultState = {
        task: "",
        due_date: to_input_date_string(new Date()),
        importance: "normal" as const,
        assignee: "بدون تخصيص",
        location: "",
        image_url: undefined as string | undefined,
        case_id: undefined as string | undefined,
      };
      set_task_form_data({
        ...defaultState,
        ...initialData,
        due_date: initialData?.due_date
          ? to_input_date_string(initialData.due_date)
          : defaultState.due_date,
        case_id: initialData?.case_id,
        image_url: initialData?.image_url,
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

  const handle_image_select = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingImage(true);
      const compressedBase64 = await compressImage(file);
      set_task_form_data((prev) => ({ ...prev, image_url: compressedBase64 }));
    } catch (err) {
      console.error("Error processing image:", err);
      alert("حدث خطأ أثناء معالجة الصورة. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsProcessingImage(false);
      if (e.target) e.target.value = "";
    }
  };

  const remove_image = () => {
    set_task_form_data((prev) => ({ ...prev, image_url: undefined }));
  };

  const handle_task_submit = (e: React.FormEvent) => {
    e.preventDefault();
    const taskText = task_form_data.task.trim() || (task_form_data.image_url ? "صورة مرفقة" : "");
    if (!taskText && !task_form_data.image_url) {
      alert("يرجى إدخال وصف المهمة أو إرفاق صورة.");
      return;
    }
    if (!task_form_data.due_date) return;

    const taskDate = safe_revive_date(task_form_data.due_date);

    onSubmit({
      ...task_form_data,
      task: taskText,
      case_id: initialData?.case_id,
      id: initialData?.id,
      due_date: to_input_date_string(taskDate),
      location: task_form_data.location || "غير محدد",
      image_url: task_form_data.image_url,
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
              المهمة / ملاحظات نصية
            </label>
            <textarea
              name="task"
              value={task_form_data.task || ""}
              onChange={handle_task_form_change}
              className="w-full p-2 border rounded"
              rows={3}
              placeholder={task_form_data.image_url ? "أدخل نص أو ملاحظات مع الصورة (اختياري)..." : "أدخل تفاصيل المهمة..."}
              required={!task_form_data.image_url}
            />
          </div>

          {/* Image Upload Section */}
          <div className="border border-dashed border-gray-300 p-3 rounded-lg bg-gray-50">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              صورة المهمة (كاميرا الجوال أو من الجهاز)
            </label>

            {/* Hidden file inputs */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handle_image_select}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handle_image_select}
              className="hidden"
            />

            {task_form_data.image_url ? (
              <div className="relative inline-block mt-1">
                <img
                  src={task_form_data.image_url}
                  alt="معاينة المهمة"
                  className="w-32 h-32 object-cover rounded-lg border shadow-sm"
                />
                <button
                  type="button"
                  onClick={remove_image}
                  className="absolute -top-2 -right-2 bg-red-600 text-white p-1.5 rounded-full hover:bg-red-700 shadow"
                  title="حذف الصورة"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  <CameraIcon className="w-4 h-4" />
                  <span>التقاط صورة بالكاميرا</span>
                </button>
                <button
                  type="button"
                  onClick={() => galleryInputRef.current?.click()}
                  disabled={isProcessingImage}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <PhotoIcon className="w-4 h-4" />
                  <span>اختيار من الصور</span>
                </button>
              </div>
            )}
            {isProcessingImage && (
              <p className="text-xs text-blue-600 mt-2 font-semibold">جاري معالجة الصورة...</p>
            )}
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
              {assistants.map((assistant, index) => {
                const name =
                  typeof assistant === "string" ? assistant : assistant.name;
                return (
                  <option key={`${name}-${index}`} value={name}>
                    {name}
                  </option>
                );
              })}
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
              disabled={isProcessingImage}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
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

import * as React from "react";
import {
  TrashIcon,
  ExclamationTriangleIcon,
  CloudArrowUpIcon,
  ArrowPathIcon,
  PlusIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  PencilIcon,
} from "../components/icons";
import { Client, AdminTask, Appointment, AccountingEntry } from "../types";
import { useData } from "../context/DataContext";
import {
  get_db,
  DATA_STORE_NAME,
  DOCS_FILES_STORE_NAME,
  DOCS_METADATA_STORE_NAME,
} from "../utils/db";
import AssistantsManager from "../components/AssistantsManager";
import ActivityLogsModal from "../components/ActivityLogsModal";

interface SettingsPageProps {}

const SettingsPage: React.FC<SettingsPageProps> = () => {
  const {
    set_full_data,
    assistants,
    set_assistants,
    user_id,
    is_auto_sync_enabled,
    set_auto_sync_enabled,
    is_auto_backup_enabled,
    set_auto_backup_enabled,
    admin_tasks_layout,
    set_admin_tasks_layout,
    delete_assistant,
    export_data,
    permissions,
    is_update_available,
  } = useData();
  const [feedback, set_feedback] = React.useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [showActivityLogs, setShowActivityLogs] = React.useState(false);
  const [is_confirm_modal_open, set_is_confirm_modal_open] =
    React.useState(false);
  const [is_delete_assistant_modal_open, set_is_delete_assistant_modal_open] =
    React.useState(false);
  const [assistant_to_delete, set_assistant_to_delete] = React.useState<
    string | null
  >(null);
  const [new_assistant, set_new_assistant] = React.useState("");
  const [db_stats, set_db_stats] = React.useState<string | null>(null);
  const [is_assistants_manager_open, set_is_assistants_manager_open] =
    React.useState(false);
  const [editing_assistant_name, set_editing_assistant_name] = React.useState<string | null>(null);
  const [edited_assistant_name, set_edited_assistant_name] = React.useState<string>("");
  const [whatsappPreference, setWhatsappPreference] = React.useState<string | null>(() => {
    return localStorage.getItem("whatsapp_version_choice");
  });

  const show_feedback = (message: string, type: "success" | "error") => {
    set_feedback({ message, type });
    setTimeout(() => set_feedback(null), 4000);
  };

  // ... (existing handlers: handle_confirm_clear_data, handle_export_data, handle_import_data, handle_add_assistant, handle_delete_assistant, handle_confirm_delete_assistant, handle_inspect_db)
  const handle_confirm_clear_data = () => {
    try {
      const emptyData = {
        clients: [],
        admin_tasks: [],
        appointments: [],
        accounting_entries: [],
        assistants: ["بدون تخصيص"],
      };
      set_full_data(emptyData);
      show_feedback("تم مسح جميع البيانات بنجاح.", "success");
    } catch (error) {
      show_feedback("حدث خطأ أثناء مسح البيانات.", "error");
    }
    set_is_confirm_modal_open(false);
  };
  const handle_export_data = () => {
    if (export_data()) {
      show_feedback("تم تصدير البيانات بنجاح.", "success");
    } else {
      show_feedback("فشل تصدير البيانات.", "error");
    }
  };
  const handle_import_data = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== "string")
          throw new Error("File could not be read.");
        const data = JSON.parse(text);

        if (user_id) {
          let backupUserId = null;
          if (data.lawyer_profile && data.lawyer_profile.id) {
            backupUserId = data.lawyer_profile.id;
          } else if (data.clients && data.clients.length > 0 && data.clients[0].user_id) {
            backupUserId = data.clients[0].user_id;
          } else if (data.profiles && data.profiles.length > 0) {
            const mainProfile = data.profiles.find((p: any) => p.role !== "admin" && !p.lawyer_id);
            if (mainProfile) backupUserId = mainProfile.id;
          }

          if (backupUserId && backupUserId !== user_id) {
            show_feedback("لا يمكن استيراد نسخة احتياطية لمكتب آخر. هذه النسخة تخص مكتباً أو مستخدماً مختلفاً.", "error");
            return;
          }
        }

        set_full_data(data);
        show_feedback("تم استيراد البيانات بنجاح.", "success");
      } catch (error) {
        show_feedback("فشل استيراد البيانات.", "error");
      }
    };
    reader.readAsText(file);
  };
  const handle_add_assistant = (e: React.FormEvent) => {
    e.preventDefault();
    const assistantNames = assistants.map((a) => typeof a === "string" ? a : a.name);
    if (
      new_assistant &&
      !assistantNames.includes(new_assistant) &&
      new_assistant !== "بدون تخصيص"
    ) {
      set_assistants((prev) => [...prev, new_assistant.trim()]);
      set_new_assistant("");
    }
  };
  const handle_delete_assistant = (name: string) => {
    if (name !== "بدون تخصيص") {
      set_assistant_to_delete(name);
      set_is_delete_assistant_modal_open(true);
    }
  };
  const handle_save_assistant_name = (oldName: string) => {
    const newName = edited_assistant_name.trim();
    if (!newName || newName === oldName) {
      set_editing_assistant_name(null);
      return;
    }
    const assistantNames = assistants.map((a) => typeof a === "string" ? a : a.name);
    if (assistantNames.includes(newName)) {
      show_feedback("هذا الاسم موجود مسبقاً.", "error");
      return;
    }
    set_assistants((prev) => prev.map((a) => {
      const aName = typeof a === "string" ? a : a.name;
      if (aName === oldName) {
        return typeof a === "string" ? newName : { ...a, name: newName };
      }
      return a;
    }));
    set_editing_assistant_name(null);
    show_feedback("تم تعديل اسم المساعد بنجاح.", "success");
  };
  const handle_confirm_delete_assistant = () => {
    if (assistant_to_delete) {
      delete_assistant(assistant_to_delete);
      show_feedback(
        `تم حذف المساعد "${assistant_to_delete}" بنجاح.`,
        "success",
      );
    }
    set_is_delete_assistant_modal_open(false);
    set_assistant_to_delete(null);
  };
  const handle_inspect_db = async () => {
    set_db_stats("جاري الفحص...");
    try {
      const db = await get_db();
      let stats = "";
      const stores = [
        DATA_STORE_NAME,
        DOCS_METADATA_STORE_NAME,
        DOCS_FILES_STORE_NAME,
      ];
      for (const s of stores) {
        if (db.objectStoreNames.contains(s)) {
          const count = await db.count(s);
          stats += `- ${s}: ${count} سجل\n`;
        }
      }
      set_db_stats(stats);
    } catch (e: any) {
      set_db_stats("فشل: " + e.message);
    }
  };

  const handle_hard_refresh = async () => {
    set_feedback({
      message: "جاري مسح الذاكرة المؤقتة وتحديث التطبيق...",
      type: "success",
    });
    try {
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
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
      setTimeout(() => {
        localStorage.setItem("app_version", "30-04-2026");
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Error clearing cache:", error);
      window.location.reload();
    }
  };

  const ToggleSwitch: React.FC<{
    enabled: boolean;
    on_change: (enabled: boolean) => void;
    label: string;
  }> = ({ enabled, on_change, label }) => (
    <div className="flex items-center">
      <span className="text-gray-700 me-3 font-medium">{label}</span>
      <button
        type="button"
        className={`${enabled ? "bg-blue-600" : "bg-gray-200"} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
        role="switch"
        aria-checked={enabled}
        onClick={() => on_change(!enabled)}
      >
        <span
          aria-hidden="true"
          className={`${enabled ? "translate-x-5" : "translate-x-0"} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800">الإعدادات</h1>
      {feedback && (
        <div
          className={`p-4 rounded-lg flex items-center gap-3 ${feedback.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
        >
          <span>{feedback.message}</span>
        </div>
      )}

      {permissions?.can_delete_client && (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex items-center gap-2">
            <UserGroupIcon className="w-6 h-6 text-blue-600" />
            إدارة المساعدين والصلاحيات
          </h2>
          <p className="text-gray-600 text-sm">
            هنا يمكنك استعراض المساعدين الذين انضموا لمكتبك، تفعيل حساباتهم،
            وتحديد صلاحيات الوصول الخاصة بهم بشكل دقيق.
          </p>
          <button
            onClick={() => set_is_assistants_manager_open(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserGroupIcon className="w-5 h-5" />
            <span>فتح لوحة تعريف المساعدين</span>
          </button>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-3">
          إعدادات المزامنة
        </h2>
        <div className="pt-2 space-y-2">
          <ToggleSwitch
            label="المزامنة التلقائية"
            enabled={is_auto_sync_enabled}
            on_change={(enabled) => {
              set_auto_sync_enabled(enabled);
              show_feedback(
                enabled
                  ? "تم تفعيل المزامنة التلقائية وحفظ الخيار."
                  : "تم تعطيل المزامنة التلقائية وحفظ الخيار.",
                "success"
              );
            }}
          />
          <p className="text-xs text-gray-500">
            {is_auto_sync_enabled
              ? "✓ المزامنة التلقائية مفعلة ومحفوظة."
              : "المزامنة التلقائية معطلة حالياً."}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-3">
          النسخ الاحتياطي
        </h2>
        <div className="pt-2 space-y-2">
          <ToggleSwitch
            label="النسخ الاحتياطي اليومي التلقائي"
            enabled={is_auto_backup_enabled}
            on_change={(enabled) => {
              set_auto_backup_enabled(enabled);
              show_feedback(
                enabled
                  ? "تم تفعيل النسخ الاحتياطي اليومي. سيتم تنزيل نسخة احتياطية عن البيانات عند كل تسجيل دخول."
                  : "تم تعطيل النسخ الاحتياطي اليومي التلقائي وحفظ الخيار.",
                "success"
              );
            }}
          />
          <p className="text-xs text-gray-500">
            {is_auto_backup_enabled
              ? "✓ عند تفعيل النسخ الاحتياطي اليومي، يتم تنزيل نسخة احتياطية عن البيانات تلقائياً عند كل تسجيل دخول للمستخدم."
              : "النسخ الاحتياطي اليومي التلقائي معطل حالياً."}
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-3">
          تخطيط المهام
        </h2>
        <div className="pt-2 flex gap-4">
          <button
            onClick={() => {
              set_admin_tasks_layout("horizontal");
              show_feedback("تم حفظ التخطيط (أفقي) بنجاح.", "success");
            }}
            className={`px-4 py-2 rounded font-medium transition-colors ${admin_tasks_layout === "horizontal" ? "bg-blue-600 text-white shadow" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
          >
            أفقي
          </button>
          <button
            onClick={() => {
              set_admin_tasks_layout("vertical");
              show_feedback("تم حفظ التخطيط (عمودي) بنجاح.", "success");
            }}
            className={`px-4 py-2 rounded font-medium transition-colors ${admin_tasks_layout === "vertical" ? "bg-blue-600 text-white shadow" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
          >
            عمودي
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-3">
          إعدادات المشاركة عبر واتساب
        </h2>
        <div className="pt-2 space-y-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            اختر نسخة واتساب المفضلة لديك ليتم استخدامها تلقائياً عند إرسال المهام والتقارير:
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => {
                localStorage.setItem("whatsapp_version_choice", "app");
                setWhatsappPreference("app");
                show_feedback("تم حفظ تفضيل واتساب العادي.", "success");
              }}
              className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                whatsappPreference === "app"
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/15"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              واتساب العادي (جوال)
            </button>
            <button
              onClick={() => {
                localStorage.setItem("whatsapp_version_choice", "business");
                setWhatsappPreference("business");
                show_feedback("تم حفظ تفضيل واتساب للأعمال.", "success");
              }}
              className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                whatsappPreference === "business"
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/15"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              واتساب للأعمال
            </button>
            <button
              onClick={() => {
                localStorage.setItem("whatsapp_version_choice", "web");
                setWhatsappPreference("web");
                show_feedback("تم حفظ تفضيل واتساب ويب.", "success");
              }}
              className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                whatsappPreference === "web"
                  ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-600/15"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              واتساب ويب (كمبيوتر)
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("whatsapp_version_choice");
                setWhatsappPreference(null);
                show_feedback("سيتم سؤالك عند كل عملية مشاركة الآن.", "success");
              }}
              className={`px-4 py-2 text-sm font-bold rounded-lg border transition-all ${
                whatsappPreference === null
                  ? "bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-600/15"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              }`}
            >
              اسألني في كل مرة
            </button>
          </div>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-3">
          فحص البيانات
        </h2>
        <button
          onClick={handle_inspect_db}
          className="px-4 py-2 bg-gray-600 text-white rounded"
        >
          فحص
        </button>
        {db_stats && (
          <pre className="mt-4 bg-gray-100 p-4 rounded text-xs">{db_stats}</pre>
        )}
      </div>
      {is_update_available && (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex items-center gap-2">
            <ArrowPathIcon className="w-6 h-6 text-blue-600" />
            تحديث النظام
          </h2>
          <p className="text-gray-600 text-sm">
            إذا لم تظهر التعديلات الجديدة أو واجهت مشكلة في العرض، يمكنك تحديث
            التطبيق ومسح الذاكرة المؤقتة (الكاش) لجلب أحدث التغييرات.
          </p>
          <div className="pt-2">
            <button
              onClick={handle_hard_refresh}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowPathIcon className="w-5 h-5" />
              <span>تحديث التطبيق ومسح الكاش</span>
            </button>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex items-center gap-2">
          <CloudArrowUpIcon className="w-6 h-6 text-blue-600" />
          النسخ الاحتياطي ونقل البيانات
        </h2>
        <p className="text-gray-600 text-sm">
          يمكنك تنزيل نسخة احتياطية كاملة من بياناتك (الموكلين، القضايا،
          الجلسات، المحاسبة) للاحتفاظ بها أو استعادتها لاحقاً.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 pt-2">
          <button
            onClick={handle_export_data}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            <span>تنزيل نسخة احتياطية عن البيانات</span>
          </button>
          <label className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-lg cursor-pointer transition-colors border border-gray-300">
            <ArrowUpTrayIcon className="w-5 h-5" />
            <span>استعادة من نسخة احتياطية</span>
            <input
              type="file"
              className="hidden"
              onChange={handle_import_data}
              accept=".json"
            />
          </label>
        </div>
      </div>
      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-3">
          قائمة المساعدين (للقوائم المنسدلة)
        </h2>
        <div className="space-y-4">
          <form onSubmit={handle_add_assistant} className="flex gap-2">
            <input
              type="text"
              value={new_assistant}
              onChange={(e) => set_new_assistant(e.target.value)}
              className="flex-grow p-2 border rounded"
              placeholder="اسم"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              إضافة
            </button>
          </form>
          <ul className="space-y-2">
            {assistants.map((a) => {
              const name = typeof a === "string" ? a : a.name;
              return (
                <li
                  key={name}
                  className="flex justify-between items-center p-2 bg-gray-50 border rounded"
                >
                  {editing_assistant_name === name ? (
                    <div className="flex gap-2 w-full">
                      <input
                        type="text"
                        value={edited_assistant_name}
                        onChange={(e) => set_edited_assistant_name(e.target.value)}
                        className="flex-grow p-1 border rounded"
                      />
                      <button
                        onClick={() => handle_save_assistant_name(name)}
                        className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600"
                      >
                        حفظ
                      </button>
                      <button
                        onClick={() => set_editing_assistant_name(null)}
                        className="px-2 py-1 bg-gray-300 rounded hover:bg-gray-400"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <>
                      <span>{name}</span>
                      {name !== "بدون تخصيص" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              set_editing_assistant_name(name);
                              set_edited_assistant_name(name);
                            }}
                            title="تعديل المساعد"
                          >
                            <PencilIcon className="w-4 h-4 text-blue-500 hover:text-blue-600" />
                          </button>
                          <button onClick={() => handle_delete_assistant(name)} title="حذف المساعد">
                            <TrashIcon className="w-4 h-4 text-red-500 hover:text-red-600" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      
      {permissions?.can_delete_client && (
        <div className="bg-white p-6 rounded-lg shadow space-y-4">
          <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex items-center gap-2">
            <ShieldCheckIcon className="w-6 h-6 text-indigo-600" />
            سجل نشاطات النظام
          </h2>
          <p className="text-gray-600 text-sm">
            استعرض كافة النشاطات، تسجيلات الدخول، والتعديلات التي تمت على النظام من قبل المستخدمين والمساعدين مع الوقت والتاريخ.
          </p>
          <button
            onClick={() => setShowActivityLogs(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <ShieldCheckIcon className="w-5 h-5" />
            <span>فتح سجل النشاطات</span>
          </button>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow space-y-4">
        <h2 className="text-xl font-bold text-gray-800 border-b pb-3">خطر</h2>
        <button
          onClick={() => set_is_confirm_modal_open(true)}
          className="px-4 py-2 bg-red-600 text-white rounded"
        >
          مسح كافة البيانات
        </button>
      </div>

      {is_confirm_modal_open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded shadow-lg">
            <p className="mb-4">هل أنت متأكد؟</p>
            <div className="flex gap-4">
              <button
                onClick={() => set_is_confirm_modal_open(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                إلغاء
              </button>
              <button
                onClick={handle_confirm_clear_data}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                نعم
              </button>
            </div>
          </div>
        </div>
      )}
      {is_delete_assistant_modal_open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded shadow-lg">
            <p className="mb-4">حذف المساعد؟</p>
            <div className="flex gap-4">
              <button
                onClick={() => set_is_delete_assistant_modal_open(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                إلغاء
              </button>
              <button
                onClick={handle_confirm_delete_assistant}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                نعم
              </button>
            </div>
          </div>
        </div>
      )}

      {is_assistants_manager_open && (
        <AssistantsManager
          onClose={() => set_is_assistants_manager_open(false)}
        />
      )}
      
      {showActivityLogs && (
        <ActivityLogsModal onClose={() => setShowActivityLogs(false)} />
      )}
    </div>
  );
};

export default SettingsPage;

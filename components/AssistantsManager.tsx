import * as React from "react";
import { useData } from "../context/DataContext";
import {
  UserIcon,
  TrashIcon,
  CheckCircleIcon,
  NoSymbolIcon,
  PencilIcon,
  ArrowPathIcon,
  ClockIcon,
  ShieldCheckIcon,
} from "./icons";
import { Profile, Permissions, default_permissions } from "../types";
import { get_supabase_client } from "../supabaseClient";
import { useFeedback } from "../context/FeedbackContext";

interface AssistantsManagerProps {
  onClose: () => void;
}

const PermissionsEditor: React.FC<{
  permissions: Permissions;
  onChange: (permissions: Permissions) => void;
}> = ({ permissions, onChange }) => {
  const togglePermission = (key: keyof Permissions) => {
    onChange({
      ...permissions,
      [key]: !permissions[key],
    });
  };

  const sections = [
    {
      title: "عام والمفكرة",
      items: [{ key: "can_view_agenda", label: "عرض المفكرة والصفحة الرئيسية" }],
    },
    {
      title: "الموكلين والقضايا",
      items: [
        { key: "can_view_clients", label: "عرض الموكلين" },
        { key: "can_add_client", label: "إضافة موكل" },
        { key: "can_edit_client", label: "تعديل موكل" },
        { key: "can_delete_client", label: "حذف موكل" },
        { key: "can_view_cases", label: "عرض القضايا" },
        { key: "can_add_case", label: "إضافة قضية" },
        { key: "can_edit_case", label: "تعديل قضية" },
        { key: "can_delete_case", label: "حذف قضية" },
      ],
    },
    {
      title: "الجلسات والوثائق",
      items: [
        { key: "can_view_sessions", label: "عرض الجلسات" },
        { key: "can_add_session", label: "إضافة جلسة" },
        { key: "can_edit_session", label: "تعديل جلسة" },
        { key: "can_delete_session", label: "حذف جلسة" },
        { key: "can_postpone_session", label: "ترحيل الجلسات" },
        { key: "can_decide_session", label: "حسم الجلسات / القرارات" },
        { key: "can_view_documents", label: "عرض الوثائق" },
        { key: "can_add_document", label: "رفع وثائق" },
        { key: "can_delete_document", label: "حذف وثائق" },
      ],
    },
    {
      title: "المهام الإدارية والمالية والتقارير",
      items: [
        { key: "can_view_admin_tasks", label: "عرض المهام الإدارية" },
        { key: "can_add_admin_task", label: "إضافة مهمة إدارية" },
        { key: "can_edit_admin_task", label: "تعديل مهمة إدارية" },
        { key: "can_delete_admin_task", label: "حذف مهمة إدارية" },
        { key: "can_view_finance", label: "عرض قسم المالية" },
        { key: "can_add_financial_entry", label: "إضافة قيود مالية" },
        { key: "can_delete_financial_entry", label: "حذف قيود مالية" },
        { key: "can_manage_invoices", label: "إدارة الفواتير" },
        { key: "can_view_reports", label: "عرض التقارير" },
      ],
    },
  ];

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto p-2" dir="rtl">
      <div className="flex justify-between items-center mb-2 pb-2 border-b">
        <h4 className="font-bold text-gray-800 text-sm">
          تخصيص صلاحيات الوصول:
        </h4>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const allTrue: any = {};
              Object.keys(default_permissions).forEach(
                (k) => (allTrue[k] = true),
              );
              onChange(allTrue);
            }}
            className="text-xs text-blue-600 hover:underline"
          >
            تحديد الكل
          </button>
          <span className="text-gray-300">|</span>
          <button
            type="button"
            onClick={() => onChange(default_permissions)}
            className="text-xs text-gray-600 hover:underline"
          >
            الافتراضي (مقيد)
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map((section, idx) => (
          <div
            key={idx}
            className="bg-gray-50 p-3 rounded-lg border border-gray-200"
          >
            <h5 className="font-semibold text-gray-700 text-xs mb-2 text-blue-800">
              {section.title}
            </h5>
            <div className="space-y-1.5">
              {section.items.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 text-xs cursor-pointer hover:bg-gray-100 p-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={!!permissions[item.key as keyof Permissions]}
                    onChange={() =>
                      togglePermission(item.key as keyof Permissions)
                    }
                    className="w-3.5 h-3.5 text-blue-600 rounded"
                  />
                  <span className="text-gray-700">{item.label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const AssistantsManager: React.FC<AssistantsManagerProps> = ({ onClose }) => {
  const { profiles, set_profiles, user_id } = useData();
  const { showFeedback, confirm } = useFeedback();
  const [assistants, setAssistants] = React.useState<Profile[]>([]);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [editingAssistant, setEditingAssistant] =
    React.useState<Profile | null>(null);
  const [tempPermissions, setTempPermissions] =
    React.useState<Permissions>(default_permissions);
  const supabase = get_supabase_client();

  // Fetch live assistants directly from Supabase for instant real-time synchronization
  const fetchFreshAssistants = React.useCallback(async () => {
    if (!user_id || !supabase) return;
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("lawyer_id", user_id);

      if (!error && data) {
        setAssistants(data);
        // Sync context profiles
        set_profiles((prev) => {
          const map = new Map(prev.map((p) => [p.id, p]));
          data.forEach((p) => map.set(p.id, p));
          return Array.from(map.values());
        });
      }
    } catch (e) {
      console.error("Error fetching assistants:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [user_id, supabase, set_profiles]);

  React.useEffect(() => {
    if (user_id) {
      setAssistants(profiles.filter((p) => p.lawyer_id === user_id));
      fetchFreshAssistants();
    }
  }, [profiles, user_id, fetchFreshAssistants]);

  const handleUpdateAssistant = async (
    assistant: Profile,
    updates: Partial<Profile>,
  ) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", assistant.id);
      if (error) throw error;

      set_profiles((prev) =>
        prev.map((p) => (p.id === assistant.id ? { ...p, ...updates } : p)),
      );
      setAssistants((prev) =>
        prev.map((p) => (p.id === assistant.id ? { ...p, ...updates } : p)),
      );
      if (editingAssistant?.id === assistant.id) setEditingAssistant(null);

      if (updates.is_approved === true) {
        showFeedback(
          `تمت الموافقة بنجاح على (${assistant.full_name}) والسماح له بالدخول إلى المكتب.`,
          "success",
        );
      } else if (updates.is_approved === false) {
        showFeedback(
          `تم تعليق دخول (${assistant.full_name}) إلى المكتب بنجاح.`,
          "info",
        );
      } else {
        showFeedback("تم حفظ البيانات بنجاح.", "success");
      }
    } catch (err: any) {
      showFeedback("فشل تحديث بيانات المساعد: " + err.message, "error");
    }
  };

  const handleApproveAccess = (assistant: Profile) => {
    handleUpdateAssistant(assistant, {
      is_approved: true,
      is_active: true,
      mobile_verified: true,
      permissions: assistant.permissions || default_permissions,
    });
  };

  const handleRevokeAccess = (assistant: Profile) => {
    confirm({
      title: "تعليق الدخول للمكتب",
      message: `هل أنت متأكد من رغبتك في تعليق دخول (${assistant.full_name}) إلى بيانات وقضايا المكتب؟ لن يتمكن من تسجيل الدخول حتى تعيد تفعيله.`,
      confirmText: "نعم، تعليق الدخول",
      cancelText: "إلغاء",
      variant: "danger",
      onConfirm: async () => {
        await handleUpdateAssistant(assistant, { is_approved: false });
      },
    });
  };

  const handleEditPermissions = (assistant: Profile) => {
    setEditingAssistant(assistant);
    setTempPermissions({
      ...default_permissions,
      ...(assistant.permissions || {}),
    });
  };

  const savePermissions = () => {
    if (editingAssistant) {
      handleUpdateAssistant(editingAssistant, { permissions: tempPermissions });
    }
  };

  const handle_delete = async (id: string, name: string) => {
    confirm({
      title: "إلغاء ارتباط محامي/مساعد",
      message: `هل أنت متأكد من حذف (${name}) من مكتبك؟ سيتم إلغاء ارتباطه بالكامل ولن يظهر في قائمة مكتبك.`,
      confirmText: "نعم، حذف وفك الارتباط",
      cancelText: "إلغاء",
      variant: "danger",
      onConfirm: async () => {
        if (!supabase) return;
        try {
          const { error } = await supabase
            .from("profiles")
            .update({ lawyer_id: null, permissions: null, is_approved: false })
            .eq("id", id);
          if (error) throw error;
          set_profiles((prev) => prev.filter((p) => p.id !== id));
          setAssistants((prev) => prev.filter((p) => p.id !== id));
          showFeedback("تم إلغاء ارتباط المساعد بنجاح.", "success");
        } catch (err: any) {
          showFeedback("فشل حذف المساعد: " + err.message, "error");
        }
      },
    });
  };

  const pendingAssistants = assistants.filter((a) => !a.is_approved);
  const approvedAssistants = assistants.filter((a) => a.is_approved);

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5 border-b pb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <ShieldCheckIcon className="w-6 h-6 text-blue-600" />
              <span>إدارة المحامين والمساعدين في المكتب</span>
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              موافقة وتفعيل دخول المحامين والمساعدين المسجلين في مكتبك وتحديد صلاحياتهم
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchFreshAssistants}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
              title="تحديث القائمة الآن"
            >
              <ArrowPathIcon
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>تحديث</span>
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 font-bold text-2xl leading-none px-1"
            >
              &times;
            </button>
          </div>
        </div>

        {pendingAssistants.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-900 text-xs">
            <ClockIcon className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-grow font-medium">
              <span className="font-bold">تنبيه: </span>
              يوجد <span className="font-black text-amber-950 underline">{pendingAssistants.length}</span> طلب انضمام جديد لمكتبك بانتظار موافقتك للسماح بالدخول.
            </div>
          </div>
        )}

        <div className="flex-grow overflow-y-auto space-y-4 p-1">
          {assistants.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-xl border border-dashed border-gray-300">
              <UserIcon className="w-14 h-14 mx-auto text-gray-300 mb-3" />
              <p className="font-bold text-gray-700">لا يوجد محامين أو مساعدين مرتبطين بمكتبك حالياً.</p>
              <p className="text-xs text-gray-500 mt-2 max-w-md mx-auto leading-relaxed">
                عند قيام أي محامي أو مساعد بالتسجيل واختيار (التسجيل في مكتب محامي) وإدخال رقم جوالك، سيظهر طلبه هنا فوراً ولن يتمكن من الدخول حتى توافق عليه.
              </p>
            </div>
          ) : (
            <>
              {/* Pending Approval Section */}
              {pendingAssistants.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    طلبات الانضمام بانتظار موافقتك ({pendingAssistants.length})
                  </h3>
                  {pendingAssistants.map((assistant) => (
                    <div
                      key={assistant.id}
                      className="border-2 border-amber-200 bg-amber-50/40 rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-amber-100 p-2.5 rounded-full text-amber-700">
                            <ClockIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-gray-900 text-base">
                                {assistant.full_name}
                              </h4>
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[11px] font-bold rounded-full border border-amber-300">
                                بانتظار موافقتك للدخول
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 font-mono mt-0.5" dir="ltr">
                              {assistant.mobile_number}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => handleApproveAccess(assistant)}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-black shadow-sm transition-all active:scale-95"
                          >
                            <CheckCircleIcon className="w-4 h-4" />
                            <span>الموافقة والسماح بالدخول</span>
                          </button>
                          <button
                            onClick={() => handleEditPermissions(assistant)}
                            className="p-2 rounded-lg bg-white border border-gray-200 text-blue-600 hover:bg-blue-50 transition-colors"
                            title="تحديد الصلاحيات المسبقة"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handle_delete(assistant.id, assistant.full_name)}
                            className="p-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                            title="رفض وحذف الطلب"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {editingAssistant?.id === assistant.id && (
                        <div className="mt-4 border-t border-amber-200 pt-4 bg-white p-3 rounded-lg">
                          <PermissionsEditor
                            permissions={tempPermissions}
                            onChange={setTempPermissions}
                          />
                          <div className="mt-4 flex justify-end gap-2">
                            <button
                              onClick={() => setEditingAssistant(null)}
                              className="px-4 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-bold"
                            >
                              إلغاء
                            </button>
                            <button
                              onClick={savePermissions}
                              className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm"
                            >
                              حفظ الصلاحيات
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Approved Assistants Section */}
              {approvedAssistants.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    المحامون والمساعدون المعتمدون بالمكتب ({approvedAssistants.length})
                  </h3>
                  {approvedAssistants.map((assistant) => (
                    <div
                      key={assistant.id}
                      className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="bg-blue-50 p-2.5 rounded-full text-blue-600 border border-blue-100">
                            <UserIcon className="w-6 h-6" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-gray-900 text-base">
                                {assistant.full_name}
                              </h4>
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-[11px] font-bold rounded-full border border-green-200">
                                مصرح له بالدخول
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 font-mono mt-0.5" dir="ltr">
                              {assistant.mobile_number}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => handleEditPermissions(assistant)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold border border-blue-200 transition-colors"
                          >
                            <PencilIcon className="w-3.5 h-3.5" />
                            <span>الصلاحيات</span>
                          </button>
                          <button
                            onClick={() => handleRevokeAccess(assistant)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-bold border border-amber-200 transition-colors"
                            title="تعليق الدخول"
                          >
                            <NoSymbolIcon className="w-3.5 h-3.5" />
                            <span>تعليق الدخول</span>
                          </button>
                          <button
                            onClick={() => handle_delete(assistant.id, assistant.full_name)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="حذف من المكتب"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {editingAssistant?.id === assistant.id && (
                        <div className="mt-4 border-t pt-4">
                          <PermissionsEditor
                            permissions={tempPermissions}
                            onChange={setTempPermissions}
                          />
                          <div className="mt-4 flex justify-end gap-2">
                            <button
                              onClick={() => setEditingAssistant(null)}
                              className="px-4 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-bold"
                            >
                              إلغاء
                            </button>
                            <button
                              onClick={savePermissions}
                              className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-sm"
                            >
                              حفظ الصلاحيات
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssistantsManager;

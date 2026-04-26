import * as React from "react";
import JSZip from "jszip";
import DatePicker from "../components/DatePicker";
import { get_supabase_client } from "../supabaseClient";
import { Profile } from "../types";
import {
  format_date,
  to_input_date_string,
  safe_revive_date,
  is_before_today,
} from "../utils/dateUtils";
import {
  CheckCircleIcon,
  NoSymbolIcon,
  PencilIcon,
  TrashIcon,
  ExclamationTriangleIcon,
  PhoneIcon,
  ShareIcon,
  ArrowPathIcon,
  ClipboardDocumentIcon,
  UserIcon,
  UserGroupIcon,
  FolderIcon,
  CloudArrowDownIcon,
} from "../components/icons";
import { useData } from "../context/DataContext";
import UserDetailsModal from "../components/UserDetailsModal";
import { fetch_data_from_supabase } from "../hooks/useOnlineData";
import { useFeedback } from "../context/FeedbackContext";

const formatSubscriptionDateRange = (user: Profile): string => {
  const { subscription_start_date, subscription_end_date } = user;
  if (!subscription_start_date || !subscription_end_date) return "لا يوجد";
  const startDate = safe_revive_date(subscription_start_date);
  const endDate = safe_revive_date(subscription_end_date);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
    return "تاريخ غير صالح";
  return `${format_date(startDate)} - ${format_date(endDate)}`;
};

const getDisplayPhoneNumber = (mobile: string | null | undefined): string => {
  if (!mobile) return "-";
  const digits = mobile.replace(/\D/g, "");
  if (digits.length >= 9) {
    const lastNine = digits.slice(-9);
    if (lastNine.startsWith("9")) return "0" + lastNine;
  }
  return mobile;
};

interface UserRowProps {
  user: Profile;
  lawyer?: Profile; // The parent lawyer if this user is an assistant
  on_view: (user: Profile) => void;
  on_edit: (user: Profile) => void;
  on_delete: (user: Profile) => void;
  on_toggle_approval: (user: Profile) => void;
  on_toggle_active: (user: Profile) => void;
  on_toggle_verification: (user: Profile) => void;
  on_generate_otp: (user: Profile) => void;
  on_view_office: (user: Profile) => void;
  on_download_backup: (user: Profile) => void;
  generating_otp_for: string | null;
  current_admin_id: string | undefined;
  unfiltered_data: any;
}

const UserRow: React.FC<UserRowProps> = ({
  user,
  lawyer,
  on_view,
  on_edit,
  on_delete,
  on_toggle_approval,
  on_toggle_active,
  on_toggle_verification,
  on_generate_otp,
  on_view_office,
  on_download_backup,
  generating_otp_for,
  current_admin_id,
  unfiltered_data,
}) => {
  const [copied_otp_id, set_copied_otp_id] = React.useState<string | null>(
    null,
  );

  const copy_to_clipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      set_copied_otp_id(id);
      setTimeout(() => set_copied_otp_id(null), 2000);
    });
  };

  const send_otp_to_user = (otpCode: string, mobile: string) => {
    if (!otpCode || !mobile) return;
    const cleanMobile = mobile.replace(/\D/g, "");
    const waNumber = cleanMobile.startsWith("0")
      ? "963" + cleanMobile.substring(1)
      : cleanMobile;
    const messageText = `مرحباً ${user.full_name}، كود التحقق الخاص بك هو: *${otpCode}*`;
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank");
  };

  const send_activation_confirmation = () => {
    if (!user.mobile_number) return;
    const cleanMobile = user.mobile_number.replace(/\D/g, "");
    const waNumber = cleanMobile.startsWith("0")
      ? "963" + cleanMobile.substring(1)
      : cleanMobile;

    const startDate = user.subscription_start_date
      ? format_date(user.subscription_start_date)
      : "-";
    const endDate = user.subscription_end_date
      ? format_date(user.subscription_end_date)
      : "-";

    const messageText = `مرحباً الأستاذ ${user.full_name}،\nتم تفعيل حسابك في تطبيق "مكتب المحامي" بنجاح.\nتاريخ التفعيل: ${format_date(new Date())}\nمدة الاشتراك الممنوحة: من ${startDate} إلى ${endDate}.\nيمكنك الآن تسجيل الدخول باستخدام رقم هاتفك وكلمة المرور الخاصة بك.`;
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank");
  };

  const send_expiry_warning_to_user = () => {
    if (!user.mobile_number) return;
    const cleanMobile = user.mobile_number.replace(/\D/g, "");
    const waNumber = cleanMobile.startsWith("0")
      ? "963" + cleanMobile.substring(1)
      : cleanMobile;

    const endDate = user.subscription_end_date
      ? format_date(user.subscription_end_date)
      : "-";

    const messageText = `مرحباً الأستاذ ${user.full_name}،\nنود تذكيركم بأن اشتراككم في تطبيق "مكتب المحامي" قارب على الانتهاء وسينتهي بتاريخ: ${endDate}.\nيرجى تجديد الاشتراك لضمان استمرار عمل التطبيق بدون انقطاع.\nشكراً جزيلاً لثقتكم.`;
    const url = `https://wa.me/${waNumber}?text=${encodeURIComponent(messageText)}`;
    window.open(url, "_blank");
  };

  const is_assistant = !!lawyer;

  // Check parent status: Active, Approved, and Subscription Valid
  const is_parent_subscription_valid = lawyer
    ? !lawyer.subscription_end_date ||
      !is_before_today(lawyer.subscription_end_date)
    : true;
  const is_parent_active = lawyer
    ? lawyer.is_active && lawyer.is_approved && is_parent_subscription_valid
    : true;

  const subscription_date_obj = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
  const days_until_expiry = subscription_date_obj ? Math.ceil((subscription_date_obj.getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : null;
  
  const is_expired = days_until_expiry !== null && days_until_expiry < 0;
  const is_expiring_soon = days_until_expiry !== null && days_until_expiry >= 0 && days_until_expiry <= 7;

  return (
    <tr
      className={`group border-b border-slate-100 transition-colors ${!user.is_approved ? "bg-amber-50/30" : is_assistant ? "bg-slate-50/50" : "bg-white"} hover:bg-slate-50`}
    >
      <td className="px-6 py-4">
        <div
          className={`flex items-center gap-3 ${is_assistant ? "mr-8" : ""}`}
        >
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              user.role === "admin"
                ? "bg-purple-100 text-purple-600"
                : is_assistant
                  ? "bg-slate-200 text-slate-500"
                  : "bg-blue-100 text-blue-600"
            }`}
          >
            {user.role === "admin" ? (
              <UserGroupIcon className="w-5 h-5" />
            ) : (
              <UserIcon className="w-5 h-5" />
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <button
              onClick={() => on_view(user)}
              className="text-slate-900 hover:text-blue-600 font-bold text-right truncate transition-colors"
            >
              {user.full_name}
            </button>
            <div className="flex items-center gap-2 mt-0.5">
              {user.role === "admin" && (
                <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
                  مدير النظام
                </span>
              )}
              {is_assistant && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  مساعد
                </span>
              )}
              {is_assistant && !is_parent_active && (
                <span className="text-[10px] text-red-500 font-bold flex items-center gap-1">
                  <ExclamationTriangleIcon className="w-3 h-3" />
                  المحامي غير نشط
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div
          className="flex items-center gap-2 text-slate-600 font-mono text-sm"
          dir="ltr"
        >
          <PhoneIcon className="w-3.5 h-3.5 text-slate-400" />
          {getDisplayPhoneNumber(user.mobile_number)}
        </div>
      </td>
      <td className="px-6 py-4">
        <span className="text-xs text-slate-500 font-medium">
          {user.created_at ? format_date(user.created_at) : "-"}
        </span>
      </td>
      <td className="px-6 py-4">
        {user.role === 'admin' ? (
           <span className="text-xs text-slate-400 font-bold">-</span>
        ) : (
          <div className="flex flex-col gap-1 items-start">
             <div className="flex items-center gap-1">
                 <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    is_expired ? 'bg-red-100 text-red-700 border border-red-200' :
                    is_expiring_soon ? 'bg-orange-100 text-orange-700 border border-orange-200 animate-pulse' :
                    'bg-slate-100 text-slate-600'
                 }`}>
                   {user.subscription_end_date ? format_date(user.subscription_end_date) : "غير محدد"}
                 </span>
             </div>
             {(is_expiring_soon || is_expired) && (
                 <button 
                    onClick={send_expiry_warning_to_user}
                    className="flex items-center gap-1 text-[10px] text-green-600 hover:text-green-700 hover:underline transition-colors mt-1"
                    title="إرسال تنبيه انتهاء الاشتراك عبر واتساب"
                 >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                    تنبيه التجديد
                 </button>
             )}
          </div>
        )}
      </td>
      <td className="px-6 py-4">
        <div className="flex flex-col gap-2 max-w-[180px]">
          <div className="flex items-center gap-2">
            {user.mobile_verified ? (
              <button
                onClick={() => on_toggle_verification(user)}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 transition-colors"
                title="إلغاء التحقق"
              >
                <CheckCircleIcon className="w-3 h-3 ml-1" />
                تم التحقق
              </button>
            ) : (
              <button
                onClick={() => on_toggle_verification(user)}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200 transition-colors"
                title="تأكيد التحقق يدوياً"
              >
                بانتظار التحقق
              </button>
            )}
            {user.role !== "admin" && (
              <button
                onClick={() => on_generate_otp(user)}
                disabled={generating_otp_for === user.id}
                className="text-blue-600 hover:bg-blue-50 p-1 rounded-lg transition-colors disabled:opacity-30"
                title="توليد كود جديد"
              >
                {generating_otp_for === user.id ? (
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowPathIcon className="w-4 h-4" />
                )}
              </button>
            )}
          </div>

          {user.otp_code && (
            <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-300">
              <div
                className="flex-grow flex items-center justify-between gap-2 text-xs font-black bg-slate-900 text-white rounded-lg px-3 py-2 cursor-pointer hover:bg-slate-800 transition-all shadow-sm"
                onClick={() => copy_to_clipboard(user.otp_code!, user.id)}
              >
                <span className="font-mono tracking-[0.2em]">
                  {user.otp_code}
                </span>
                <ClipboardDocumentIcon className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <button
                onClick={() =>
                  send_otp_to_user(user.otp_code!, user.mobile_number)
                }
                className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm"
                title="إرسال عبر واتساب"
              >
                <ShareIcon className="w-4 h-4" />
              </button>
            </div>
          )}
          {copied_otp_id === user.id && (
            <span className="text-[10px] text-green-600 font-bold text-center">
              تم النسخ بنجاح!
            </span>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => on_toggle_approval(user)}
            disabled={user.role === "admin"}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-30 ${user.is_approved ? "bg-blue-600" : "bg-slate-200"}`}
            title={user.is_approved ? "إلغاء الموافقة" : "موافقة وتفعيل"}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${user.is_approved ? "-translate-x-5" : "translate-x-0"}`}
            />
          </button>
          {user.is_approved && (
            <button
              onClick={send_activation_confirmation}
              className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors"
              title="إرسال تأكيد التفعيل عبر واتساب"
            >
              <ShareIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
      <td className="px-6 py-4">
        <button
          onClick={() => on_toggle_active(user)}
          disabled={user.role === "admin"}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-30 ${user.is_active ? "bg-green-500" : "bg-red-500"}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${user.is_active ? "-translate-x-5" : "translate-x-0"}`}
          />
        </button>
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {user.role !== "admin" && user.id !== current_admin_id ? (
            <>
              <button
                onClick={() => on_download_backup(user)}
                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                title="تنزيل نسخة احتياطية"
              >
                <ArrowPathIcon className="w-4 h-4 rotate-180" />
              </button>
              <button
                onClick={() => on_view_office(user)}
                className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                title="عرض المكتب"
              >
                <FolderIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => on_edit(user)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                title="تعديل"
              >
                <PencilIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => on_delete(user)}
                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                title="حذف"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </>
          ) : (
            <span className="text-[10px] font-bold text-slate-300 px-2">
              محمي
            </span>
          )}
        </div>
      </td>
    </tr>
  );
};

const AdminPage: React.FC = () => {
  const {
    profiles: users,
    clients,
    admin_tasks,
    appointments,
    accounting_entries,
    invoices,
    documents,
    site_finances,
    set_profiles: setUsers,
    is_data_loading: loading,
    user_id,
    fetch_and_refresh,
    set_admin_viewing_user_id,
    unfiltered_data,
  } = useData();
  const { showFeedback } = useFeedback();
  const [error, setError] = React.useState<string | null>(null);
  const [is_downloading, set_is_downloading] = React.useState(false);
  const [is_full_backup_loading, set_is_full_backup_loading] =
    React.useState(false);
  const [editing_user, set_editing_user] = React.useState<Profile | null>(null);
  const [user_to_delete, set_user_to_delete] = React.useState<Profile | null>(
    null,
  );
  const [viewing_user, set_viewing_user] = React.useState<Profile | null>(null);
  const [generating_otp_for, set_generating_otp_for] = React.useState<
    string | null
  >(null);
  const [search_query, set_search_query] = React.useState("");
  const [filter_status, set_filter_status] = React.useState<
    "all" | "pending" | "active" | "inactive"
  >("all");

  const supabase = get_supabase_client();

  const handle_update_user = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing_user) return;

    // Optimistic update
    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        u.id === editing_user.id
          ? { ...editing_user, updated_at: new Date().toISOString() }
          : u,
      ),
    );

    // If using real backend, you would make the API call here
    if (supabase) {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: editing_user.full_name,
            mobile_number: editing_user.mobile_number,
            subscription_start_date: editing_user.subscription_start_date,
            subscription_end_date: editing_user.subscription_end_date,
            is_approved: editing_user.is_approved,
            is_active: editing_user.is_active,
            mobile_verified: editing_user.mobile_verified,
          })
          .eq("id", editing_user.id);
        if (error) throw error;

        // Refresh data to confirm changes from server
        fetch_and_refresh();
      } catch (err: any) {
        console.error("Failed to update user in DB:", err);
        showFeedback(
          "فشل تحديث البيانات في قاعدة البيانات: " + err.message,
          "error",
        );
        // Revert optimistic update by refreshing
        fetch_and_refresh();
      }
    }

    set_editing_user(null);
  };

  const handle_confirm_delete = async () => {
    if (!supabase || !user_to_delete) return;
    const userToDeleteId = user_to_delete.id;

    try {
      const { error: rpcError } = await supabase.rpc("delete_user", {
        user_id_to_delete: userToDeleteId,
      });

      if (rpcError) throw rpcError;
      setUsers((prevUsers) => prevUsers.filter((u) => u.id !== userToDeleteId));
    } catch (err: any) {
      setError("فشل حذف المستخدم: " + err.message);
    } finally {
      set_user_to_delete(null);
    }
  };

  const toggle_user_approval = async (user: Profile) => {
    if (!supabase || user.role === "admin") return;
    const updatedUser = {
      ...user,
      is_approved: !user.is_approved,
      updated_at: new Date().toISOString(),
    };
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_approved: updatedUser.is_approved })
        .eq("id", user.id);
      if (error) throw error;
      fetch_and_refresh();
    } catch (err: any) {
      console.error("Failed to toggle approval:", err);
      fetch_and_refresh();
    }
  };

  const toggle_user_active_status = async (user: Profile) => {
    if (!supabase || user.role === "admin") return;
    const updatedUser = {
      ...user,
      is_active: !user.is_active,
      updated_at: new Date().toISOString(),
    };
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: updatedUser.is_active })
        .eq("id", user.id);
      if (error) throw error;
      fetch_and_refresh();
    } catch (err: any) {
      console.error("Failed to toggle active status:", err);
      fetch_and_refresh();
    }
  };

  const toggle_user_verification = async (user: Profile) => {
    if (!supabase || user.role === "admin") return;
    const updatedUser = {
      ...user,
      mobile_verified: !user.mobile_verified,
      updated_at: new Date().toISOString(),
    };
    setUsers((prev) => prev.map((u) => (u.id === user.id ? updatedUser : u)));

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ mobile_verified: updatedUser.mobile_verified })
        .eq("id", user.id);
      if (error) throw error;
      fetch_and_refresh();
    } catch (err: any) {
      console.error("Failed to toggle verification status:", err);
      fetch_and_refresh();
    }
  };

  const handle_generate_and_send_otp = async (user: Profile) => {
    if (!supabase) return;
    set_generating_otp_for(user.id);
    try {
      const { data: code, error } = await supabase.rpc("generate_mobile_otp", {
        target_user_id: user.id,
      });

      if (error) throw error;

      if (code) {
        // Update local state to show code immediately without refresh
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, otp_code: code } : u)),
        );
        showFeedback(`تم توليد الكود بنجاح: ${code}`, "success");
      }
    } catch (err: any) {
      console.error("Error generating OTP:", err);
      showFeedback("فشل توليد كود التحقق: " + err.message, "error");
    } finally {
      set_generating_otp_for(null);
    }
  };

  const get_user_backup_data = (targetUser: Profile) => {
    const userId = targetUser.id;
    const assistants = unfiltered_data.profiles.filter(
      (u) => u.lawyer_id === userId,
    );
    const assistantIds = assistants.map((a) => a.id);
    const allUserIds = [userId, ...assistantIds];

    return {
      version: "1.2",
      export_date: new Date().toISOString(),
      lawyer_profile: targetUser,
      assistants_profiles: assistants,
      clients: unfiltered_data.clients.filter((c) =>
        allUserIds.includes(c.user_id),
      ),
      admin_tasks: unfiltered_data.admin_tasks.filter((t) =>
        allUserIds.includes(t.user_id),
      ),
      appointments: unfiltered_data.appointments.filter((a) =>
        allUserIds.includes(a.user_id),
      ),
      accounting_entries: unfiltered_data.accounting_entries.filter((e) =>
        allUserIds.includes(e.user_id),
      ),
      invoices: unfiltered_data.invoices.filter((i) =>
        allUserIds.includes(i.user_id),
      ),
      documents: unfiltered_data.documents.filter((d) =>
        allUserIds.includes(d.user_id),
      ),
      site_finances: unfiltered_data.site_finances.filter((f) =>
        allUserIds.includes(f.user_id),
      ),
    };
  };

  const handle_download_single_backup = (user: Profile) => {
    const backup = get_user_backup_data(user);
    const fileName = `${user.full_name}_${new Date().toISOString().split("T")[0]}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handle_download_all_backups = async () => {
    set_is_downloading(true);
    try {
      const zip = new JSZip();
      const dateStr = new Date().toISOString().split("T")[0];
      const folder = zip.folder(dateStr);

      const lawyers = unfiltered_data.profiles.filter(
        (u) => u.role !== "admin" && !u.lawyer_id,
      );

      lawyers.forEach((lawyer) => {
        const backup = get_user_backup_data(lawyer);
        const fileName = `${lawyer.full_name}_${dateStr}.json`;
        folder?.file(fileName, JSON.stringify(backup, null, 2));
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backups_${dateStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to generate ZIP backup:", err);
      showFeedback("فشل إنشاء النسخة الاحتياطية المجمعة.", "error");
    } finally {
      set_is_downloading(false);
    }
  };

  const handle_full_system_backup = async () => {
    set_is_full_backup_loading(true);
    try {
      const data = await fetch_data_from_supabase();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `lawyer_system_full_backup_${timestamp}.json`;

      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showFeedback(
        "تم تحميل النسخة الاحتياطية الشاملة للنظام بنجاح.",
        "success",
      );
    } catch (error: any) {
      console.error("Full system backup failed:", error);
      showFeedback(
        "فشل تحميل النسخة الاحتياطية الشاملة: " + error.message,
        "error",
      );
    } finally {
      set_is_full_backup_loading(false);
    }
  };

  const filtered_users = React.useMemo(() => {
    return users.filter((u) => {
      const matches_search =
        u.full_name.toLowerCase().includes(search_query.toLowerCase()) ||
        (u.mobile_number || "").includes(search_query);

      const matches_status =
        filter_status === "all" ||
        (filter_status === "pending" && !u.is_approved) ||
        (filter_status === "active" && u.is_active && u.is_approved) ||
        (filter_status === "inactive" && !u.is_active);

      return matches_search && matches_status;
    });
  }, [users, search_query, filter_status]);

  // Organize users into hierarchy: Lawyers (and admins) at top, their assistants nested
  const grouped_users = React.useMemo(() => {
    // 1. Find all users who are NOT assistants (Lawyers/Admins)
    const lawyers = filtered_users.filter((u) => !u.lawyer_id);

    // 2. Create a map of lawyer_id -> [assistants]
    const assistantMap = new Map<string, Profile[]>();
    filtered_users
      .filter((u) => u.lawyer_id)
      .forEach((assistant) => {
        const lawyerId = assistant.lawyer_id!;
        if (!assistantMap.has(lawyerId)) {
          assistantMap.set(lawyerId, []);
        }
        assistantMap.get(lawyerId)!.push(assistant);
      });

    // 3. Sort lawyers: Admins first, then by newest
    const sortedLawyers = [...lawyers].sort((a, b) => {
      if (a.role === "admin" && b.role !== "admin") return -1;
      if (a.role !== "admin" && b.role === "admin") return 1;
      const dateA = a.created_at ? safe_revive_date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? safe_revive_date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    // 4. Return structure for rendering
    return sortedLawyers.map((lawyer) => ({
      lawyer,
      assistants: assistantMap.get(lawyer.id) || [],
    }));
  }, [filtered_users]);

  const stats = React.useMemo(() => {
    let total = 0;
    let expired = 0;
    let expiringSoon = 0;
    let active = 0;

    users.forEach((u) => {
      if (u.role === "admin") return;
      total++;
      const expiry = u.subscription_end_date
        ? new Date(u.subscription_end_date)
        : null;
      if (!expiry) return;

      const diffDays = Math.ceil(
        (expiry.getTime() - new Date().getTime()) / (1000 * 3600 * 24),
      );
      if (diffDays < 0) {
        expired++;
      } else if (diffDays <= 7) {
        expiringSoon++;
      } else {
        active++;
      }
    });

    return { total, expired, expiringSoon, active };
  }, [users]);

  if (loading) {
    return <div className="text-center p-8">جاري تحميل المستخدمين...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-slate-500 text-xs font-bold mb-1">إجمالي المستخدمين</div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-2xl border border-green-100 shadow-sm">
          <div className="text-green-600 text-xs font-bold mb-1">نشط</div>
          <div className="text-2xl font-black text-green-700">{stats.active}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 shadow-sm">
          <div className="text-orange-600 text-xs font-bold mb-1">تنتهي قريباً (أسبوع أو أقل)</div>
          <div className="text-2xl font-black text-orange-700">{stats.expiringSoon}</div>
        </div>
        <div className="bg-red-50 p-4 rounded-2xl border border-red-100 shadow-sm">
          <div className="text-red-600 text-xs font-bold mb-1">منتهي الصلاحية</div>
          <div className="text-2xl font-black text-red-700">{stats.expired}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            إدارة المستخدمين
          </h1>
          <p className="text-slate-500 mt-1">
            إدارة حسابات المحامين والمساعدين والتحقق من هويتهم.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handle_full_system_backup}
            disabled={is_full_backup_loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-sm transition-all shadow-sm disabled:opacity-50"
            title="تنزيل نسخة شاملة لكل النظام (الإدارة والمستخدمين)"
          >
            {is_full_backup_loading ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <CloudArrowDownIcon className="w-4 h-4" />
            )}
            نسخة شاملة للنظام
          </button>
          <button
            onClick={handle_download_all_backups}
            disabled={is_downloading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 font-bold text-sm transition-all shadow-sm disabled:opacity-50"
          >
            {is_downloading ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowPathIcon className="w-4 h-4 rotate-180" />
            )}
            تنزيل جميع النسخ الاحتياطية
          </button>
          <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 font-bold text-sm">
            إجمالي المستخدمين: {users.length}
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="flex-grow relative">
          <input
            type="text"
            placeholder="البحث بالاسم أو رقم الجوال..."
            value={search_query}
            onChange={(e) => set_search_query(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          <UserIcon className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
        </div>
        <div className="flex items-center gap-2 min-w-[200px]">
          <select
            value={filter_status}
            onChange={(e) => set_filter_status(e.target.value as any)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-bold"
          >
            <option value="all">جميع الحالات</option>
            <option value="pending">بانتظار الموافقة</option>
            <option value="active">نشط</option>
            <option value="inactive">غير نشط</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right text-slate-600 border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 font-bold text-slate-700">المستخدم</th>
                <th className="px-6 py-4 font-bold text-slate-700">
                  رقم الجوال
                </th>
                <th className="px-6 py-4 font-bold text-slate-700">
                  تاريخ التسجيل
                </th>
                <th className="px-6 py-4 font-bold text-slate-700">
                  الصلاحية
                </th>
                <th className="px-6 py-4 font-bold text-slate-700">
                  التحقق والكود
                </th>
                <th className="px-6 py-4 font-bold text-slate-700">الموافقة</th>
                <th className="px-6 py-4 font-bold text-slate-700">الحالة</th>
                <th className="px-6 py-4 font-bold text-slate-700">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grouped_users.map(({ lawyer, assistants }) => (
                <React.Fragment key={lawyer.id}>
                  {/* Lawyer Row */}
                  <UserRow
                    user={lawyer}
                    on_view={() => set_viewing_user(lawyer)}
                    on_edit={() => set_editing_user(lawyer)}
                    on_delete={() => set_user_to_delete(lawyer)}
                    on_toggle_approval={() => toggle_user_approval(lawyer)}
                    on_toggle_active={() => toggle_user_active_status(lawyer)}
                    on_toggle_verification={() =>
                      toggle_user_verification(lawyer)
                    }
                    on_generate_otp={() => handle_generate_and_send_otp(lawyer)}
                    on_view_office={(u) => set_admin_viewing_user_id(u.id)}
                    on_download_backup={handle_download_single_backup}
                    generating_otp_for={generating_otp_for}
                    current_admin_id={user_id}
                    unfiltered_data={unfiltered_data}
                  />
                  {/* Assistants Rows */}
                  {assistants.length > 0 &&
                    assistants.map((assistant) => (
                      <UserRow
                        key={assistant.id}
                        user={assistant}
                        lawyer={lawyer}
                        on_view={() => set_viewing_user(assistant)}
                        on_edit={() => set_editing_user(assistant)}
                        on_delete={() => set_user_to_delete(assistant)}
                        on_toggle_approval={() =>
                          toggle_user_approval(assistant)
                        }
                        on_toggle_active={() =>
                          toggle_user_active_status(assistant)
                        }
                        on_toggle_verification={() =>
                          toggle_user_verification(assistant)
                        }
                        on_generate_otp={() =>
                          handle_generate_and_send_otp(assistant)
                        }
                        on_view_office={(u) => set_admin_viewing_user_id(u.id)}
                        on_download_backup={handle_download_single_backup}
                        generating_otp_for={generating_otp_for}
                        current_admin_id={user_id}
                        unfiltered_data={unfiltered_data}
                      />
                    ))}
                </React.Fragment>
              ))}
              {grouped_users.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-20">
                    <div className="flex flex-col items-center gap-2">
                      <UserGroupIcon className="w-12 h-12 text-slate-200" />
                      <p className="text-slate-400 font-medium">
                        لا يوجد مستخدمين يطابقون البحث.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing_user && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto"
          onClick={() => set_editing_user(null)}
        >
          <div
            className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">
              تعديل المستخدم: {editing_user.full_name}
            </h2>
            <form onSubmit={handle_update_user} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  الاسم الكامل
                </label>
                <input
                  type="text"
                  value={editing_user.full_name}
                  onChange={(e) =>
                    set_editing_user({
                      ...editing_user,
                      full_name: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  رقم الجوال
                </label>
                <input
                  type="text"
                  value={editing_user.mobile_number}
                  onChange={(e) =>
                    set_editing_user({
                      ...editing_user,
                      mobile_number: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    تاريخ بدء الاشتراك
                  </label>
                  <DatePicker
                    value={to_input_date_string(
                      editing_user.subscription_start_date,
                    )}
                    onChange={(date) =>
                      set_editing_user({
                        ...editing_user,
                        subscription_start_date: date,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    تاريخ انتهاء الاشتراك
                  </label>
                  <DatePicker
                    value={to_input_date_string(
                      editing_user.subscription_end_date,
                    )}
                    onChange={(date) =>
                      set_editing_user({
                        ...editing_user,
                        subscription_end_date: date,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 pt-2 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing_user.is_approved}
                    onChange={(e) =>
                      set_editing_user({
                        ...editing_user,
                        is_approved: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />{" "}
                  موافق عليه
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing_user.is_active}
                    onChange={(e) =>
                      set_editing_user({
                        ...editing_user,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />{" "}
                  الحساب نشط
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing_user.mobile_verified}
                    onChange={(e) =>
                      set_editing_user({
                        ...editing_user,
                        mobile_verified: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />{" "}
                  تم التحقق من الجوال
                </label>
              </div>
              <div className="flex justify-end gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => set_editing_user(null)}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  حفظ التغييرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {user_to_delete && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => set_user_to_delete(null)}
        >
          <div
            className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
                <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">
                تأكيد حذف المستخدم
              </h3>
              <p className="text-gray-600 my-4">
                هل أنت متأكد من حذف المستخدم "{user_to_delete.full_name}"؟ سيتم
                حذف جميع بياناته بشكل نهائي ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
            <div className="mt-6 flex justify-center gap-4">
              <button
                type="button"
                className="px-6 py-2 bg-gray-200 rounded-lg"
                onClick={() => set_user_to_delete(null)}
              >
                إلغاء
              </button>
              <button
                type="button"
                className="px-6 py-2 bg-red-600 text-white rounded-lg"
                onClick={handle_confirm_delete}
              >
                نعم، قم بالحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {viewing_user && (
        <UserDetailsModal
          user={viewing_user}
          onClose={() => set_viewing_user(null)}
          onEdit={() => set_editing_user(viewing_user)}
          onToggleVerification={toggle_user_verification}
        />
      )}
    </div>
  );
};

export default AdminPage;

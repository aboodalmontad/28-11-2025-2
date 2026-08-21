import * as React from "react";
import Logo from "../components/Logo";
import { get_supabase_client } from "../supabaseClient";
import {
  check_supabase_schema,
  fetch_data_from_supabase,
  transform_remote_to_local,
} from "../hooks/useOnlineData";
import { get_db, DATA_STORE_NAME } from "../utils/db";
import { get_app_data_key } from "../hooks/useSupabaseData";
import {
  ExclamationCircleIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardDocumentIcon,
  ClipboardDocumentCheckIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  UserGroupIcon,
  KeyIcon,
  ArrowPathIcon,
  ShareIcon,
  ClockIcon,
  DatabaseIcon,
} from "../components/icons";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  normalize_mobile_for_db,
  normalize_mobile_to_e164,
} from "../utils/mobileUtils";
import { to_input_date_string } from "../utils/dateUtils";
import type { User } from "@supabase/supabase-js";

interface auth_page_props {
  on_force_setup: () => void;
  on_login_success: (user: User, is_offline_login?: boolean) => void;
  initial_mode?: "login" | "signup" | "otp";
  current_user?: User;
  current_mobile?: string;
  on_verification_success?: () => void;
  on_logout?: () => void;
  sync_log?: any[];
  on_clear_log?: () => void;
  is_local_empty?: boolean;
  is_update_available?: boolean;
}

const LAST_USER_CREDENTIALS_CACHE_KEY = "lawyerAppLastUserCredentials";

const CopyButton: React.FC<{ text_to_copy: string }> = ({ text_to_copy }) => {
  const [copied, set_copied] = React.useState(false);
  const handle_copy = () => {
    navigator.clipboard.writeText(text_to_copy).then(() => {
      set_copied(true);
      setTimeout(() => set_copied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={handle_copy}
      className="flex items-center gap-1 text-xs text-gray-300 hover:text-white"
      title="نسخ الأمر"
    >
      {copied ? (
        <ClipboardDocumentCheckIcon className="w-4 h-4 text-green-400" />
      ) : (
        <ClipboardDocumentIcon className="w-4 h-4" />
      )}
      {copied ? "تم النسخ" : "نسخ"}
    </button>
  );
};

const LoginPage: React.FC<auth_page_props> = ({
  on_force_setup,
  on_login_success,
  initial_mode = "login",
  current_user,
  current_mobile,
  on_verification_success,
  on_logout,
  sync_log = [],
  on_clear_log = () => {},
  is_local_empty = false,
  is_update_available = false,
}) => {
  const [auth_step, set_auth_step] = React.useState<
    "login" | "signup" | "otp" | "forgot-password"
  >(initial_mode);
  const [forgot_password_step, set_forgot_password_step] = React.useState<
    "request" | "verify"
  >("request");
  const [loading, set_loading] = React.useState(false);
  const [error, set_error] = React.useState<React.ReactNode | null>(null);
  const [message, set_message] = React.useState<string | null>(null);
  const [info, set_info] = React.useState<string | null>(null);
  const [auth_failed, set_auth_failed] = React.useState(false);
  const [show_password, set_show_password] = React.useState(false);
  const [otp_code, set_otp_code] = React.useState("");
  const [waiting_approval, set_waiting_approval] = React.useState(false);
  const [new_password, set_new_password] = React.useState("");
  const [is_assistant_signup, set_is_assistant_signup] = React.useState(false);
  const [db_status, set_db_status] = React.useState<
    "checking" | "connected" | "failed"
  >("checking");
  const [is_cleaned, set_is_cleaned] = React.useState(false);
  const [force_sync_loading, set_force_sync_loading] = React.useState(false);
  const [diagnostic_loading, set_diagnostic_loading] = React.useState(false);
  const [diagnostic_clients_loading, set_diagnostic_clients_loading] =
    React.useState(false);
  const [diagnostic_profiles_loading, set_diagnostic_profiles_loading] =
    React.useState(false);
  const [show_diagnostic_modal, set_show_diagnostic_modal] =
    React.useState(false);
  const is_online = useOnlineStatus();

  const [form, set_form] = React.useState({
    full_name: "",
    mobile: current_mobile || "",
    password: "",
    lawyer_mobile: "",
  });

  React.useEffect(() => {
    if (current_mobile) {
      set_form((prev) => ({ ...prev, mobile: current_mobile }));
    }
    if (initial_mode) {
      set_auth_step(initial_mode);
    }
    console.log("Checking DB status...");
    check_supabase_schema().then((res) => {
      console.log("DB status result:", res);
      set_db_status(res.success ? "connected" : "failed");
    });
  }, [current_mobile, initial_mode]);

  const supabase = get_supabase_client();

  const sync_user_cloud_data_to_local = async (user_id: string) => {
    if (!supabase) return;
    try {
      console.log(`Checking local data for user: ${user_id}`);
      const storage_key = get_app_data_key(user_id);
      const db = await get_db();
      const cached_data = await db.get(DATA_STORE_NAME, storage_key);

      // Check if data exists and is not effectively empty
      const is_effectively_empty =
        !cached_data ||
        ((cached_data.clients?.length || 0) === 0 &&
          (cached_data.admin_tasks?.length || 0) === 0 &&
          (cached_data.appointments?.length || 0) === 0 &&
          (cached_data.accounting_entries?.length || 0) === 0 &&
          (cached_data.invoices?.length || 0) === 0 &&
          (cached_data.documents?.length || 0) === 0);

      if (!is_effectively_empty) {
        console.log("Local data already exists for this user.");
        return;
      }

      if (!is_online) {
        console.warn("User is offline, cannot sync cloud data to local.");
        return;
      }

      console.log(
        `Fetching cloud data for user: ${user_id} as it's missing or empty locally...`,
      );
      const remote_data_raw = await fetch_data_from_supabase(user_id);
      const remote_flat_data = transform_remote_to_local(remote_data_raw);

      const session_map = new Map<string, any[]>();
      (remote_flat_data.sessions || []).forEach((s) => {
        const stage_id = (s as any).stage_id;
        if (!session_map.has(stage_id)) session_map.set(stage_id, []);
        session_map.get(stage_id)!.push(s);
      });

      const stage_map = new Map<string, any[]>();
      (remote_flat_data.stages || []).forEach((st) => {
        const stage = { ...st, sessions: session_map.get(st.id) || [] };
        const case_id = (st as any).case_id;
        if (!stage_map.has(case_id)) stage_map.set(case_id, []);
        stage_map.get(case_id)!.push(stage);
      });

      const case_map = new Map<string, any[]>();
      (remote_flat_data.cases || []).forEach((cs) => {
        const case_item = { ...cs, stages: stage_map.get(cs.id) || [] };
        const client_id = (cs as any).client_id;
        if (!case_map.has(client_id)) case_map.set(client_id, []);
        case_map.get(client_id)!.push(case_item);
      });

      const invoice_item_map = new Map<string, any[]>();
      (remote_flat_data.invoice_items || []).forEach((item) => {
        const invoice_id = (item as any).invoice_id;
        if (!invoice_item_map.has(invoice_id))
          invoice_item_map.set(invoice_id, []);
        invoice_item_map.get(invoice_id)!.push(item);
      });

      const full_data = {
        clients: (remote_flat_data.clients || []).map((c) => ({
          ...c,
          cases: case_map.get(c.id) || [],
        })),
        admin_tasks: remote_flat_data.admin_tasks || [],
        appointments: remote_flat_data.appointments || [],
        accounting_entries: remote_flat_data.accounting_entries || [],
        assistants: (remote_flat_data.assistants || []).map((a: any) => ({
          name: a.name,
          user_id: a.user_id,
        })),
        invoices: (remote_flat_data.invoices || []).map((inv) => ({
          ...inv,
          items: invoice_item_map.get(inv.id) || [],
        })),
        documents: remote_flat_data.case_documents || [],
        profiles: remote_flat_data.profiles || [],
        site_finances: remote_flat_data.site_finances || [],
      };

      await db.put(DATA_STORE_NAME, full_data, storage_key);
      console.log(
        `Initial cloud-to-local sync complete for key: ${storage_key}`,
      );
    } catch (err) {
      console.error("Failed to sync user cloud data to local:", err);
      // We don't throw here to avoid blocking the login process if sync fails
    }
  };

  const handle_force_sync = async () => {
    if (!supabase) return;
    set_force_sync_loading(true);
    set_error(null);
    set_message(null);
    try {
      console.log("Starting forced cloud-to-local sync...");

      // 1. Find user ID by mobile first to ensure we only fetch THEIR data
      const normalized_mobile = normalize_mobile_for_db(form.mobile);
      const raw_mobile = form.mobile;

      let profile = null;
      let p_error = null;

      // Try normalized first
      if (normalized_mobile) {
        const res = await supabase
          .from("profiles")
          .select("id")
          .eq("mobile_number", normalized_mobile)
          .maybeSingle();
        profile = res.data;
        p_error = res.error;
      }

      // If not found, try raw
      if (!profile && !p_error) {
        const res = await supabase
          .from("profiles")
          .select("id")
          .eq("mobile_number", raw_mobile)
          .maybeSingle();
        profile = res.data;
        p_error = res.error;
      }

      // If still not found, try E164
      if (!profile && !p_error) {
        const e164_mobile = normalize_mobile_to_e164(raw_mobile);
        if (e164_mobile) {
          const res = await supabase
            .from("profiles")
            .select("id")
            .eq("mobile_number", e164_mobile)
            .maybeSingle();
          profile = res.data;
          p_error = res.error;
        }
      }

      if (p_error)
        throw new Error("فشل العثور على الملف الشخصي: " + p_error.message);
      if (!profile)
        throw new Error(
          "لم يتم العثور على ملف شخصي لهذا الرقم. يرجى التأكد من الرقم أو إنشاء حساب جديد.",
        );

      const user_id = profile.id;

      // Force delete local cache first to ensure a fresh pull
      const db = await get_db();
      const storage_key = get_app_data_key(user_id);
      await db.delete(DATA_STORE_NAME, storage_key);

      await sync_user_cloud_data_to_local(user_id);

      set_message(
        "تم جلب كافة البيانات من السحابة وحفظها محلياً بنجاح. يرجى محاولة تسجيل الدخول الآن.",
      );
    } catch (err: any) {
      console.error("Forced sync failed:", err);
      set_error("فشل جلب البيانات: " + err.message);
    } finally {
      set_force_sync_loading(false);
    }
  };

  const fetch_all_diagnostic_data = async () => {
    set_diagnostic_loading(true);
    set_diagnostic_clients_loading(true);
    set_diagnostic_profiles_loading(true);
    try {
      // Try to find user_id by mobile first
      const normalized_mobile = normalize_mobile_for_db(form.mobile);
      const { data: profile } = await supabase!
        .from("profiles")
        .select("id")
        .eq("mobile_number", normalized_mobile || form.mobile)
        .maybeSingle();

      const user_id = profile?.id;

      // Sequentialize these calls to avoid concurrent auth token refresh attempts and network congestion
      await fetch_diagnostic_tasks(user_id);
      await fetch_diagnostic_clients(user_id);
      await fetch_diagnostic_profiles(user_id);

      set_show_diagnostic_modal(true);
    } finally {
      set_diagnostic_loading(false);
      set_diagnostic_clients_loading(false);
      set_diagnostic_profiles_loading(false);
    }
  };

  const fetch_diagnostic_tasks = async (user_id?: string) => {
    // Implementation placeholder
    console.log("Fetching diagnostic tasks for:", user_id);
  };
  const fetch_diagnostic_clients = async (user_id?: string) => {
    // Implementation placeholder
    console.log("Fetching diagnostic clients for:", user_id);
  };
  const fetch_diagnostic_profiles = async (user_id?: string) => {
    // Implementation placeholder
    console.log("Fetching diagnostic profiles for:", user_id);
  };

  const toggle_view = (e: React.MouseEvent) => {
    e.preventDefault();
    set_auth_step((prev) => (prev === "login" ? "signup" : "login"));
    set_error(null);
    set_message(null);
    set_info(
      is_online
        ? null
        : "أنت غير متصل. تسجيل الدخول متاح فقط للمستخدم الأخير الذي سجل دخوله على هذا الجهاز.",
    );
    set_auth_failed(false);
    set_is_assistant_signup(false);
  };

  const handle_input_change = (e: React.ChangeEvent<HTMLInputElement>) => {
    set_form((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) set_error(null);
    if (auth_failed) set_auth_failed(false);
  };

  const handle_forgot_password_request = async (e: React.FormEvent) => {
    e.preventDefault();
    set_loading(true);
    set_error(null);
    set_message(null);

    const normalized_mobile = normalize_mobile_for_db(form.mobile);
    if (!normalized_mobile) {
      set_error("رقم الجوال غير صالح.");
      set_loading(false);
      return;
    }

    if (!supabase) {
      set_error("Supabase client is not available.");
      set_loading(false);
      return;
    }

    try {
      // Step 1: Call RPC to generate the code in the system so the Admin can see it
      // The RPC now returns an object { code: string, full_name: string }
      const { data: res, error: otp_error } = await supabase.rpc(
        "generate_otp_by_mobile",
        {
          mobile_to_check: normalized_mobile,
        },
      );

      if (otp_error) {
        if (
          otp_error.code === "PGRST202" ||
          String(otp_error.message).includes("Could not find the function")
        ) {
          set_error(
            <div className="space-y-2">
              <p>يجب تحديث إعدادات قاعدة البيانات لاستخدام هذه الميزة.</p>
              <button onClick={on_force_setup} className="underline font-bold">
                اضغط هنا لفتح معالج التحديث
              </button>
            </div>,
          );
          return;
        }
        throw otp_error;
      }

      if (!res || !res.code) {
        throw new Error(
          "رقم الجوال غير مسجل في النظام. تأكد من إدخال الرقم الصحيح.",
        );
      }

      // Step 2: Send WhatsApp to the MANAGER with user name and phone
      const manager_wa_number = "963958932922";
      const message_text = `طلب تغيير كلمة مرور:\nالمستخدم: ${res.full_name}\nرقم الهاتف: ${normalized_mobile}\nيريد تغيير كلمة المرور الخاصة به. يرجى تزويده بكود التحقق الظاهر في لوحة التحكم الخاصة بك.`;
      const url = `https://wa.me/${manager_wa_number}?text=${encodeURIComponent(message_text)}`;
      window.open(url, "_blank");

      set_message(
        "تم إرسال طلبك إلى المدير. يرجى التواصل معه للحصول على كود التحقق وإدخاله أدناه.",
      );
      set_forgot_password_step("verify");
    } catch (err: any) {
      let error_message = err.message || "حدث خطأ أثناء إرسال الطلب.";
      if (error_message.toLowerCase().includes("failed to fetch")) {
        error_message =
          "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت، أو التأكد من أن مشروع Supabase الخاص بك يعمل (غير متوقف).";
      }
      set_error(error_message);
    } finally {
      set_loading(false);
    }
  };

  const handle_forgot_password_reset = async (e: React.FormEvent) => {
    e.preventDefault();
    set_loading(true);
    set_error(null);

    const normalized_mobile = normalize_mobile_for_db(form.mobile);
    if (!normalized_mobile) {
      set_error("رقم الجوال غير صالح.");
      set_loading(false);
      return;
    }
    if (new_password.length < 6) {
      set_error("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      set_loading(false);
      return;
    }

    if (!supabase) {
      set_error("Supabase client is not available.");
      set_loading(false);
      return;
    }

    try {
      const { data: success, error: rpc_error } = await supabase.rpc(
        "reset_password_with_otp",
        {
          target_mobile: normalized_mobile,
          code_to_check: otp_code.trim(),
          new_password: new_password,
        },
      );

      if (rpc_error) throw rpc_error;

      if (success) {
        set_message("تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.");
        set_auth_step("login");
        set_forgot_password_step("request");
        set_form((prev) => ({ ...prev, password: "" })); // Clear password field
        set_otp_code("");
        set_new_password("");
      } else {
        throw new Error("رمز التحقق غير صحيح.");
      }
    } catch (err: any) {
      let error_message = err.message || "فشل تغيير كلمة المرور.";
      if (error_message.toLowerCase().includes("failed to fetch")) {
        error_message =
          "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت، أو التأكد من أن مشروع Supabase الخاص بك يعمل (غير متوقف).";
      }
      set_error(error_message);
    } finally {
      set_loading(false);
    }
  };

  const handle_otp_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    set_loading(true);
    set_error(null);
    try {
      if (!supabase) throw new Error("Client not initialized");
      const normalized_mobile = normalize_mobile_for_db(form.mobile) || form.mobile;
      const e164_phone = normalize_mobile_to_e164(form.mobile) || form.mobile;
      if (!normalized_mobile) throw new Error("رقم الجوال غير صالح.");

      const { data: is_verified, error: rpc_error } = await supabase.rpc(
        "verify_mobile_otp",
        { target_mobile: normalized_mobile, code_to_check: otp_code.trim() },
      );
      if (rpc_error) throw rpc_error;
      if (is_verified) {
        // Fetch current profile to check if trial was already used (search all mobile formats)
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .or(`mobile_number.eq.${normalized_mobile},mobile_number.eq.${form.mobile},mobile_number.eq.${e164_phone}`)
          .maybeSingle();

        const hasUsedTrial = Boolean(
          profileData?.trial_used || profileData?.trialUsed
        );

        // Calculate exact 45 days trial duration from today
        const now = new Date();
        const fortyFiveDaysLater = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 45
        );
        const startDateStr = to_input_date_string(now);
        const endDateStr = to_input_date_string(fortyFiveDaysLater);

        if (!hasUsedTrial) {
          // First-time activation: Automatically approve and activate for 45 full days
          const updatePayload: any = {
            is_approved: true,
            is_active: true,
            mobile_verified: true,
            trial_used: true,
            subscription_start_date: startDateStr,
            subscription_end_date: endDateStr,
            updated_at: now.toISOString(),
          };

          // 1. Update by profile ID if found
          if (profileData?.id) {
            let { error: updateError } = await supabase
              .from("profiles")
              .update(updatePayload)
              .eq("id", profileData.id);

            if (updateError && updateError.message?.toLowerCase().includes("trial_used")) {
              const { trial_used, ...fallbackPayload } = updatePayload;
              await supabase
                .from("profiles")
                .update(fallbackPayload)
                .eq("id", profileData.id);
            }
          }

          // 2. Also update by mobile numbers to be 100% resilient
          await supabase
            .from("profiles")
            .update(updatePayload)
            .or(`mobile_number.eq.${normalized_mobile},mobile_number.eq.${form.mobile},mobile_number.eq.${e164_phone}`);

          set_message(
            `تم تفعيل حسابك تلقائياً بنجاح لفترة تجريبية مجانية لمدة 45 يوماً كاملة (حتى ${endDateStr}). جاري الدخول...`
          );

          if (on_verification_success) {
            on_verification_success();
          } else {
            if (form.password) {
              const phone = normalize_mobile_to_e164(form.mobile);
              const email = `sy${phone!.substring(1)}@email.com`;
              const { data: sign_in_data } =
                await supabase.auth.signInWithPassword({
                  email,
                  password: form.password,
                });
              if (sign_in_data.user) {
                // Ensure profile updated by user.id as well
                await supabase
                  .from("profiles")
                  .update(updatePayload)
                  .eq("id", sign_in_data.user.id);

                sessionStorage.setItem(`just_logged_in_user_${sign_in_data.user.id}`, "true");
                on_login_success(sign_in_data.user);
              }
            } else {
              set_auth_step("login");
              set_otp_code("");
            }
          }
        } else {
          // Trial has already been used in the past -> Only admin can activate
          const phoneFilter = `mobile_number.eq.${normalized_mobile},mobile_number.eq.${form.mobile},mobile_number.eq.${e164_phone}`;
          if (profileData?.id) {
            await supabase
              .from("profiles")
              .update({
                mobile_verified: true,
                updated_at: new Date().toISOString(),
              })
              .eq("id", profileData.id);
          } else {
            await supabase
              .from("profiles")
              .update({
                mobile_verified: true,
                updated_at: new Date().toISOString(),
              })
              .or(phoneFilter);
          }

          if (profileData?.is_approved) {
            // Already approved by admin
            set_message("تم تأكيد كود التحقق بنجاح. جاري تسجيل الدخول...");
            if (on_verification_success) {
              on_verification_success();
            } else if (form.password) {
              const phone = normalize_mobile_to_e164(form.mobile);
              const email = `sy${phone!.substring(1)}@email.com`;
              const { data: sign_in_data } =
                await supabase.auth.signInWithPassword({
                  email,
                  password: form.password,
                });
              if (sign_in_data.user) {
                sessionStorage.setItem(`just_logged_in_user_${sign_in_data.user.id}`, "true");
                on_login_success(sign_in_data.user);
              }
            }
          } else {
            // Needs admin approval
            set_message(
              "تم التحقق من رقم الجوال بنجاح. لقد تم استهلاك الفترة التجريبية (45 يوماً) مسبقاً لهذا الحساب. تفعيل الحساب أو التجديد يتم حصراً من قبل المدير."
            );
            set_waiting_approval(true);
          }
        }
      } else {
        throw new Error("رمز التحقق غير صحيح.");
      }
    } catch (err: any) {
      let error_message = err.message || "حدث خطأ أثناء التحقق.";
      if (error_message.toLowerCase().includes("failed to fetch")) {
        error_message =
          "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت، أو التأكد من أن مشروع Supabase الخاص بك يعمل (غير متوقف).";
      }
      set_error(error_message);
    } finally {
      set_loading(false);
    }
  };

  const handle_auth = async (e: React.FormEvent) => {
    e.preventDefault();
    set_loading(true);
    set_error(null);
    set_message(null);
    set_auth_failed(false);
    set_waiting_approval(false);

    const phone = normalize_mobile_to_e164(form.mobile);
    if (!phone) {
      set_error("رقم الجوال غير صالح.");
      set_loading(false);
      set_auth_failed(true);
      return;
    }
    const email = `sy${phone.substring(1)}@email.com`;

    if (!supabase) {
      set_error("Supabase client is not available.");
      set_loading(false);
      return;
    }

    if (auth_step === "login") {
      try {
        const { data: sign_in_data, error: sign_in_error } =
          await supabase.auth.signInWithPassword({
            email,
            password: form.password,
          });
        if (sign_in_error) throw sign_in_error;
        if (sign_in_data.user) {
          let { data: profile, error: profile_error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", sign_in_data.user.id)
            .maybeSingle();

          // If profile is missing, try to create it on the fly (Self-healing)
          if (!profile) {
            console.log("Profile missing for user, creating one...");
            const normalized_mobile =
              normalize_mobile_for_db(form.mobile) || form.mobile;
            const now = new Date();
            const oneYearLater = new Date(
              now.getFullYear() + 1,
              now.getMonth(),
              now.getDate(),
            );
            const new_profile = {
              id: sign_in_data.user.id,
              full_name: sign_in_data.user.user_metadata?.full_name || "مستخدم",
              mobile_number: normalized_mobile,
              role:
                email === "nahwiabdo@gmail.com" ||
                email === "avocat.nahwi@gmail.com" ||
                email === "sy963958932922@email.com"
                  ? "admin"
                  : "user",
              is_approved: true,
              is_active: true,
              mobile_verified: true,
              subscription_start_date: to_input_date_string(now),
              subscription_end_date: to_input_date_string(oneYearLater),
            };
            const { data: created_profile, error: create_error } =
              await supabase
                .from("profiles")
                .upsert([new_profile])
                .select()
                .single();
            if (!create_error) profile = created_profile;
            else console.error("Error creating profile:", create_error);
          }

          if (
            profile &&
            profile.mobile_verified === false &&
            profile.role !== "admin"
          ) {
            set_message("يرجى تأكيد رقم الجوال للمتابعة.");
            set_auth_step("otp");
            set_loading(false);
            return;
          }
          if (profile && profile.lawyer_id && !profile.is_approved) {
            set_error("حسابك بانتظار موافقة المحامي الرئيسي.");
            set_loading(false);
            await supabase.auth.signOut();
            return;
          }
          localStorage.setItem(
            LAST_USER_CREDENTIALS_CACHE_KEY,
            JSON.stringify({ mobile: form.mobile, password: form.password }),
          );
          localStorage.setItem(
            "lawyerAppLastUserData",
            JSON.stringify(sign_in_data.user),
          );

          // استدعاء نجاح تسجيل الدخول لتغيير واجهة التطبيق
          sessionStorage.setItem(`just_logged_in_user_${sign_in_data.user.id}`, "true");
          on_login_success(sign_in_data.user);
        }
      } catch (err: any) {
        let error_message = err.message || "فشل تسجيل الدخول.";
        const isNetworkErr =
          error_message.toLowerCase().includes("failed to fetch") ||
          error_message.toLowerCase().includes("network") ||
          error_message.toLowerCase().includes("abort") ||
          !is_online;

        if (isNetworkErr) {
          error_message =
            "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت، أو التأكد من أن مشروع Supabase الخاص بك يعمل (غير متوقف).";

          // Offline login fallback: attempt cached credentials login if available
          const cached_creds_str = localStorage.getItem(
            LAST_USER_CREDENTIALS_CACHE_KEY,
          );
          const cached_user_str = localStorage.getItem(
            "lawyerAppLastUserData",
          );

          if (cached_creds_str && cached_user_str) {
            try {
              const cached_creds = JSON.parse(cached_creds_str);
              if (
                cached_creds.mobile === form.mobile &&
                cached_creds.password === form.password
              ) {
                const cached_user = JSON.parse(cached_user_str);
                console.log(
                  "Offline login successful using cached credentials.",
                );
                sessionStorage.setItem(`just_logged_in_user_${cached_user.id}`, "true");
                on_login_success(cached_user);
                return; // Exit early on successful offline login
              } else {
                error_message = "بيانات الدخول غير صحيحة (وضع عدم الاتصال).";
              }
            } catch (e) {
              console.error("Error parsing cached credentials:", e);
            }
          } else if (!is_online) {
            error_message =
              "لا توجد بيانات تسجيل دخول محفوظة. يجب الاتصال بالإنترنت لتسجيل الدخول لأول مرة.";
          }
        }
        set_error(error_message);
      } finally {
        set_loading(false);
      }
    } else {
      // Sign up
      try {
        if (!is_online)
          throw new Error("لا يمكن إنشاء حساب جديد بدون اتصال بالإنترنت.");
        const normalized_mobile = normalize_mobile_for_db(form.mobile);
        if (!normalized_mobile) {
          set_error("رقم الجوال غير صالح.");
          set_loading(false);
          set_auth_failed(true);
          return;
        }

        let meta_data: any = {
          full_name: form.full_name,
          mobile_number: form.mobile,
        };

        if (is_assistant_signup) {
          const normalized_lawyer_mobile = normalize_mobile_for_db(
            form.lawyer_mobile,
          );
          if (!normalized_lawyer_mobile) {
            set_error("رقم جوال المحامي غير صالح.");
            set_loading(false);
            return;
          }
          meta_data.lawyer_mobile_number = normalized_lawyer_mobile;
        }

        const { data, error: sign_up_error } =
          await supabase.auth.admin.createUser({
            email,
            password: form.password,
            email_confirm: true,
            user_metadata: meta_data,
          });

        if (sign_up_error) {
          // If admin.createUser fails, try standard signUp as fallback
          console.warn(
            "Admin createUser failed, trying standard signUp:",
            sign_up_error.message,
          );
          const { data: standard_data, error: standard_error } =
            await supabase.auth.signUp({
              email,
              password: form.password,
              options: { data: meta_data },
            });
          if (standard_error) throw standard_error;
          if (standard_data.user) {
            // Create profile manually since trigger might be missing
            const now = new Date();
            const fortyFiveDaysLater = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() + 45
            );
            await supabase.from("profiles").upsert([
              {
                id: standard_data.user.id,
                full_name: form.full_name,
                mobile_number: normalized_mobile,
                role: is_assistant_signup
                  ? "assistant"
                  : email === "nahwiabdo@gmail.com" ||
                      email === "avocat.nahwi@gmail.com" ||
                      email === "sy963958932922@email.com"
                    ? "admin"
                    : "user",
                is_approved: false, // All new users must enter verification code to activate
                is_active: true,
                mobile_verified: false,
                trial_used: false,
                lawyer_id: null,
                subscription_start_date: to_input_date_string(now),
                subscription_end_date: to_input_date_string(fortyFiveDaysLater),
              },
            ]);

            try {
              await supabase.rpc("generate_mobile_otp", {
                target_user_id: standard_data.user.id,
              });
            } catch (e) {}
            set_message(
              "تم إنشاء الحساب بنجاح. يرجى طلب كود التفعيل من المدير عبر واتساب.",
            );
            set_auth_step("otp");
          }
        } else if (data.user) {
          const now = new Date();
          const fortyFiveDaysLater = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 45
          );
          // Create profile manually for admin-created user
          await supabase.from("profiles").upsert([
            {
              id: data.user.id,
              full_name: form.full_name,
              mobile_number: normalized_mobile,
              role: is_assistant_signup
                ? "assistant"
                : email === "nahwiabdo@gmail.com" ||
                    email === "avocat.nahwi@gmail.com" ||
                    email === "sy963958932922@email.com"
                  ? "admin"
                  : "user",
              is_approved: false, // All new users must enter verification code to activate
              is_active: true,
              mobile_verified: false, // Set to false so they go through activation
              trial_used: false,
              lawyer_id: null,
              subscription_start_date: to_input_date_string(now),
              subscription_end_date: to_input_date_string(fortyFiveDaysLater),
            },
          ]);

          try {
            await supabase.rpc("generate_mobile_otp", {
              target_user_id: data.user.id,
            });
          } catch (e) {}
          set_message(
            "تم إنشاء الحساب بنجاح. يرجى طلب كود التفعيل من المدير عبر واتساب.",
          );
          set_auth_step("otp");
        }
      } catch (err: any) {
        let error_message = err.message || "حدث خطأ أثناء إنشاء الحساب.";
        if (error_message.toLowerCase().includes("failed to fetch")) {
          error_message =
            "تعذر الاتصال بالخادم. يرجى التحقق من اتصالك بالإنترنت، أو التأكد من أن مشروع Supabase الخاص بك يعمل (غير متوقف).";
        }
        set_error(error_message);
      } finally {
        set_loading(false);
      }
    }
  };

  const handle_hard_refresh = async () => {
    set_message("جاري مسح الذاكرة المؤقتة وتحديث التطبيق...");
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

  const handle_retry = () => {
    set_error(null);
    set_message(null);
    set_loading(false);
    // Re-trigger the check_supabase_schema to see if we're back online
    set_db_status("checking");
    check_supabase_schema().then((res) => {
      set_db_status(res.success ? "connected" : "failed");
    });
  };

  const ErrorDisplay = ({ error }: { error: React.ReactNode }) => {
    const is_fetch_error =
      typeof error === "string" &&
      (error.includes("تعذر الاتصال بالخادم") ||
        error.toLowerCase().includes("failed to fetch") ||
        error.toLowerCase().includes("network error"));

    return (
      <div className="mb-4 p-4 text-sm text-red-800 bg-red-100 rounded-lg flex flex-col gap-3 border border-red-200 shadow-sm animate-in fade-in slide-in-from-top-2">
        <div className="flex items-start gap-3">
          <ExclamationCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <div className="font-medium leading-relaxed">{error}</div>
        </div>
        {is_fetch_error && (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handle_retry}
              className="px-4 py-1.5 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all flex items-center gap-2 shadow-sm active:scale-95"
            >
              <ArrowPathIcon
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              إعادة المحاولة الآن
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-gray-100 p-4"
      dir="rtl"
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6 flex flex-col items-center">
          <Logo size="xl" className="h-28 w-28 mb-3 shadow-lg rounded-2xl border border-slate-700/30" />
          <h1 className="text-3xl font-bold text-gray-800">مكتب المحامي</h1>
          <p className="text-gray-500">إدارة أعمال المحاماة بكفاءة</p>
          <div className="flex flex-col items-center gap-2 mt-2">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${db_status === "connected" ? "bg-green-100 text-green-800" : db_status === "failed" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${db_status === "connected" ? "bg-green-500" : db_status === "failed" ? "bg-red-500" : "bg-yellow-500"}`}
              ></span>
              {db_status === "connected"
                ? "متصل بقاعدة البيانات"
                : db_status === "failed"
                  ? "فشل الاتصال بقاعدة البيانات"
                  : "جاري فحص الاتصال..."}
            </div>
            {is_update_available ? (
              <button
                onClick={handle_hard_refresh}
                className="flex items-center gap-2 px-4 py-2 text-xs font-black text-white bg-blue-600 hover:bg-blue-700 rounded-full shadow-md transition-all active:scale-95 animate-pulse"
                title="تحديث التطبيق لآخر إصدار"
              >
                <ArrowPathIcon className="w-4 h-4" />
                يوجد تحديث جديد، اضغط هنا للتحديث
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2 mt-1">
                <div className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full shadow-sm">
                  <CheckCircleIcon className="w-4 h-4" />
                  التطبيق محدث لآخر إصدار
                </div>
                <button
                  onClick={handle_hard_refresh}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-full transition-all active:scale-95 cursor-pointer mt-1"
                  title="مسح الكاش وتحديث الملفات فورياً دون حذف البيانات"
                >
                  <ArrowPathIcon className="w-3.5 h-3.5 animate-spin-reverse hover:animate-spin" />
                  تحديث إجباري (مسح الذاكرة المؤقتة فقط)
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-center text-gray-700 mb-6">
            {auth_step === "login"
              ? "تسجيل الدخول"
              : auth_step === "signup"
                ? "إنشاء حساب جديد"
                : auth_step === "forgot-password"
                  ? "استعادة كلمة المرور"
                  : "تفعيل الحساب"}
          </h2>

          {error && <ErrorDisplay error={error} />}
          {message && (
            <div className="mb-4 p-4 text-sm text-green-800 bg-green-100 rounded-lg flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5" />
              {message}
            </div>
          )}
          {info && (
            <div className="mb-4 p-4 text-sm text-blue-800 bg-blue-100 rounded-lg">
              {info}
            </div>
          )}

          {auth_step === "otp" ? (
            <div className="space-y-6">
              {!waiting_approval ? (
                <>
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <div className="flex items-center gap-2 mb-2">
                      <ExclamationCircleIcon className="w-5 h-5" />
                      <p className="font-bold">تفعيل الحساب (فترة تجريبية 45 يوماً):</p>
                    </div>
                    <p className="mb-2">
                      عند إدخال كود التحقق الصحيح لأول مرة، سيتم تفعيل حسابك تلقائياً وبشكل مجاني لمدة 45 يوماً.
                    </p>
                    <ol className="list-decimal list-inside space-y-1 font-medium text-xs">
                      <li>اضغط على الزر أدناه لطلب كود التحقق من المدير عبر واتساب.</li>
                      <li>بعد استلام الكود، أدخله في المربع أدناه للتفعيل الفوري.</li>
                      <li>بعد انتهاء فترة الـ 45 يوماً، يتم تجديد التفعيل حصراً من قبل المدير.</li>
                    </ol>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const manager_wa_number = "963958932922";
                      const message_text = `طلب كود تفعيل:\nالمحامي: ${form.full_name || "مستخدم جديد"}\nرقم الهاتف: ${form.mobile}\nلقد سجلت في الموقع وأريد كود التفعيل الخاص بي.`;
                      const url = `https://wa.me/${manager_wa_number}?text=${encodeURIComponent(message_text)}`;
                      window.open(url, "_blank");
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white p-3 rounded-lg font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
                  >
                    <ShareIcon className="w-5 h-5" />
                    طلب كود التفعيل من المدير (واتساب)
                  </button>

                  <div className="relative py-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-500 font-bold">
                        أدخل الكود المستلم
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handle_otp_submit} className="space-y-4">
                    <input
                      type="text"
                      value={otp_code || ""}
                      onChange={(e) =>
                        set_otp_code(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      className="mt-2 block w-full text-center text-3xl font-black tracking-[0.5em] px-3 py-4 border-2 border-blue-100 rounded-xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all bg-slate-50"
                      placeholder="000000"
                      required
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={loading || otp_code.length < 4}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-bold transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none"
                    >
                      {loading ? (
                        <ArrowPathIcon className="w-6 h-6 animate-spin mx-auto" />
                      ) : (
                        "تفعيل الحساب الآن"
                      )}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center space-y-4 py-6">
                  <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                    <ClockIcon className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">
                    بانتظار تفعيل الحساب
                  </h3>
                  <p className="text-gray-600">
                    تم التحقق من رقم جوالك. يرجى الانتظار حتى يقوم المدير
                    بمراجعة وتفعيل حسابك بشكل نهائي.
                  </p>
                  <p className="text-sm text-gray-500">
                    ستتمكن من تسجيل الدخول فور تفعيل الحساب.
                  </p>
                </div>
              )}
              <div className="text-center">
                {on_logout ? (
                  <button
                    onClick={on_logout}
                    className="text-sm text-gray-600 hover:underline"
                  >
                    تسجيل الخروج
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      set_auth_step("login");
                      set_waiting_approval(false);
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    العودة
                  </button>
                )}
              </div>
            </div>
          ) : auth_step === "forgot-password" ? (
            <div className="space-y-6">
              {forgot_password_step === "request" ? (
                <form
                  onSubmit={handle_forgot_password_request}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      رقم الجوال المرتبط بالحساب
                    </label>
                    <input
                      name="mobile"
                      type="tel"
                      value={form.mobile || ""}
                      onChange={handle_input_change}
                      required
                      className="mt-1 block w-full px-3 py-2 border rounded-md"
                      placeholder="09xxxxxxxx"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 text-white p-2 rounded"
                  >
                    {loading ? "جاري الإرسال..." : "إرسال طلب استعادة للمدير"}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handle_forgot_password_reset}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      رمز التحقق (الذي يزودك به المدير)
                    </label>
                    <input
                      type="text"
                      value={otp_code || ""}
                      onChange={(e) =>
                        set_otp_code(
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      className="mt-1 block w-full text-center text-xl tracking-widest px-3 py-2 border rounded-md"
                      placeholder="------"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      كلمة المرور الجديدة
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={show_password ? "text" : "password"}
                        value={new_password || ""}
                        onChange={(e) => set_new_password(e.target.value)}
                        required
                        className="block w-full px-3 py-2 border rounded-md"
                      />
                      <button
                        type="button"
                        onClick={() => set_show_password(!show_password)}
                        className="absolute inset-y-0 left-0 px-3 flex items-center text-gray-400"
                      >
                        {show_password ? (
                          <EyeSlashIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-green-600 text-white p-2 rounded"
                  >
                    {loading ? "جاري التحديث..." : "تغيير كلمة المرور"}
                  </button>
                </form>
              )}
              <div className="text-center">
                <button
                  onClick={() => {
                    set_auth_step("login");
                    set_forgot_password_step("request");
                    set_error(null);
                    set_message(null);
                  }}
                  className="text-sm text-blue-600"
                >
                  العودة لتسجيل الدخول
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handle_auth} className="space-y-6">
              {auth_step === "signup" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      الاسم الكامل
                    </label>
                    <input
                      name="full_name"
                      value={form.full_name || ""}
                      onChange={handle_input_change}
                      required
                      className="mt-1 block w-full px-3 py-2 border rounded-md"
                    />
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <input
                      type="checkbox"
                      id="is_assistant_signup"
                      checked={is_assistant_signup}
                      onChange={(e) =>
                        set_is_assistant_signup(e.target.checked)
                      }
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label
                      htmlFor="is_assistant_signup"
                      className="text-sm font-medium text-blue-900 cursor-pointer flex items-center gap-2"
                    >
                      <UserGroupIcon className="w-4 h-4" />
                      التسجيل كمساعد لمحامي
                    </label>
                  </div>
                  {is_assistant_signup && (
                    <div className="animate-fade-in">
                      <label className="block text-sm font-medium text-gray-700">
                        رقم جوال المحامي الرئيسي
                      </label>
                      <input
                        name="lawyer_mobile"
                        type="tel"
                        value={form.lawyer_mobile || ""}
                        onChange={handle_input_change}
                        required={is_assistant_signup}
                        placeholder="09xxxxxxxx"
                        className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-md bg-blue-50"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        سيتم ربط حسابك بمكتب المحامي صاحب هذا الرقم.
                      </p>
                    </div>
                  )}
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  رقم الجوال
                </label>
                <input
                  name="mobile"
                  type="tel"
                  value={form.mobile || ""}
                  onChange={handle_input_change}
                  required
                  className="mt-1 block w-full px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  كلمة المرور
                </label>
                <div className="relative mt-1">
                  <input
                    name="password"
                    type={show_password ? "text" : "password"}
                    value={form.password || ""}
                    onChange={handle_input_change}
                    required
                    className="block w-full px-3 py-2 border rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => set_show_password(!show_password)}
                    className="absolute inset-y-0 left-0 px-3 flex items-center text-gray-400"
                  >
                    {show_password ? (
                      <EyeSlashIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {auth_step === "login" && (
                  <div className="mt-2 text-left">
                    <button
                      type="button"
                      onClick={() => {
                        set_auth_step("forgot-password");
                        set_error(null);
                        set_message(null);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <KeyIcon className="w-4 h-4" />
                      نسيت كلمة المرور؟
                    </button>
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white p-2 rounded"
              >
                {loading
                  ? "جاري التحميل..."
                  : auth_step === "login"
                    ? "تسجيل الدخول"
                    : "إنشاء الحساب"}
              </button>
            </form>
          )}
          {auth_step !== "otp" && auth_step !== "forgot-password" && (
            <p className="mt-6 text-center text-sm text-gray-600">
              {auth_step === "login" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}
              <a
                href="#"
                onClick={toggle_view}
                className="font-medium text-blue-600 ms-1"
              >
                {auth_step === "login" ? "أنشئ حساباً جديداً" : "سجل الدخول"}
              </a>
            </p>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 mb-1">الإصدار: 18-8-2026</p>
          <p className="text-xs text-gray-400">
            جميع حقوق الملكية محفوظة لشركة الحلول التقنية ©{" "}
            {new Date().getFullYear()}
          </p>
        </div>
      </div>
      <div className="mt-8 border-t border-slate-100 pt-6">
      </div>
    </div>
  );
};

export default LoginPage;

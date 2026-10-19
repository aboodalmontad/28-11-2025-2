import * as React from "react";
import { Profile } from "../types";
import { format_date, safe_revive_date } from "../utils/dateUtils";
import { useFeedback } from "../context/FeedbackContext";

interface TrialReminderBannerProps {
  user_profile: Profile | null;
  on_contact_admin?: (message: string, phone: string) => void;
}

export const TrialReminderBanner: React.FC<TrialReminderBannerProps> = ({
  user_profile,
  on_contact_admin,
}) => {
  const { showFeedback } = useFeedback();
  const [is_snoozed, set_is_snoozed] = React.useState(false);
  const [is_minimized, set_is_minimized] = React.useState(false);

  const admin_phone = "963958932922";

  // Calculate days remaining
  const trial_info = React.useMemo(() => {
    if (!user_profile || user_profile.role === "admin") return null;
    if (!user_profile.subscription_end_date) return null;

    const end_date = safe_revive_date(user_profile.subscription_end_date);
    if (isNaN(end_date.getTime())) return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(
      end_date.getFullYear(),
      end_date.getMonth(),
      end_date.getDate(),
    );

    const diff_time = target.getTime() - today.getTime();
    const days_remaining = Math.ceil(diff_time / (1000 * 60 * 60 * 24));

    // Show reminder only when 10 days or fewer remaining and not expired
    if (days_remaining > 10 || days_remaining < 0) {
      return null;
    }

    return {
      days_remaining,
      end_date,
      formatted_end_date: format_date(end_date),
      full_name: user_profile.full_name || "الأستاذ المحامي",
      mobile: user_profile.mobile_number || "",
    };
  }, [user_profile]);

  // Check snooze status (every 2 days = 48 hours)
  React.useEffect(() => {
    if (!trial_info || !user_profile) return;

    const storage_key = `trial_reminder_snoozed_${user_profile.id}`;
    const saved = localStorage.getItem(storage_key);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const elapsed_time = Date.now() - Number(parsed.timestamp || 0);
        const two_days_ms = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

        if (elapsed_time < two_days_ms) {
          set_is_snoozed(true);
          return;
        } else {
          // 48 hours passed: remove snooze and trigger reminder
          localStorage.removeItem(storage_key);
          set_is_snoozed(false);
        }
      } catch (e) {
        localStorage.removeItem(storage_key);
        set_is_snoozed(false);
      }
    } else {
      set_is_snoozed(false);
    }

    // Show a gentle toast feedback once per session if in warning window
    const session_toast_key = `trial_toast_shown_${user_profile.id}_${trial_info.days_remaining}`;
    if (!sessionStorage.getItem(session_toast_key)) {
      sessionStorage.setItem(session_toast_key, "true");
      const days_text =
        trial_info.days_remaining === 0
          ? "اليوم هو آخر يوم"
          : trial_info.days_remaining === 1
            ? "يوم واحد"
            : trial_info.days_remaining === 2
              ? "يومان"
              : `${trial_info.days_remaining} أيام`;
      showFeedback(
        `🌟 تذكير لطيف: تبقى لديك ${days_text} على انتهاء الفترة التجريبية (${trial_info.formatted_end_date}).`,
        "info",
      );
    }
  }, [trial_info, user_profile, showFeedback]);

  if (!trial_info) return null;

  const handle_snooze_two_days = () => {
    if (!user_profile) return;
    const storage_key = `trial_reminder_snoozed_${user_profile.id}`;
    localStorage.setItem(
      storage_key,
      JSON.stringify({
        timestamp: Date.now(),
        days_remaining: trial_info.days_remaining,
      }),
    );
    set_is_snoozed(true);
    showFeedback("سيتم تذكيرك مجدداً بعد يومين.", "info");
  };

  const handle_renew_click = () => {
    const days_text =
      trial_info.days_remaining === 0
        ? "تنتهي اليوم"
        : trial_info.days_remaining === 1
          ? "يوم واحد"
          : trial_info.days_remaining === 2
            ? "يومان"
            : `${trial_info.days_remaining} أيام`;

    const message = `مرحباً أستاذ،\nأود تجديد اشتراكي في تطبيق إدارة مكتب المحاماة.\nالاسم: ${trial_info.full_name}\nرقم الهاتف: ${trial_info.mobile}\nمتبقي على انتهاء الفترة التجريبية: ${days_text} (تاريخ الانتهاء: ${trial_info.formatted_end_date}).\nيرجى تزويدي بتفاصيل التجديد والتفعيل. شكراً جزيلاً!`;

    if (on_contact_admin) {
      on_contact_admin(message, admin_phone);
    } else {
      const clean_phone = admin_phone.replace(/\D/g, "");
      const url = `https://wa.me/${clean_phone}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank");
    }
  };

  const days_label =
    trial_info.days_remaining === 0
      ? "اليوم الأخير"
      : trial_info.days_remaining === 1
        ? "يوم واحد متبقٍ"
        : trial_info.days_remaining === 2
          ? "يومان متبقيان"
          : `${trial_info.days_remaining} أيام متبقية`;

  // Total trial length is 45 days
  const total_trial_days = 45;
  const days_used = Math.max(
    0,
    Math.min(total_trial_days, total_trial_days - trial_info.days_remaining),
  );
  const progress_pct = Math.min(
    100,
    Math.round((days_used / total_trial_days) * 100),
  );

  // If snoozed for 2 days, show a subtle reminder pill that can be expanded
  if (is_snoozed) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl p-2.5 px-4 flex items-center justify-between shadow-xs transition-all animate-fade-in text-xs">
        <div className="flex items-center gap-2 text-amber-900 font-medium">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          <span>
            الفترة التجريبية: متبقي{" "}
            <strong className="text-amber-800 font-bold font-mono">
              {days_label}
            </strong>{" "}
            (حتى {trial_info.formatted_end_date})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handle_renew_click}
            className="text-emerald-700 hover:text-emerald-800 font-bold hover:underline flex items-center gap-1"
          >
            تجديد عبر واتساب
          </button>
          <span className="text-amber-300">|</span>
          <button
            onClick={() => set_is_snoozed(false)}
            className="text-amber-700 hover:text-amber-900 font-bold hover:underline"
          >
            عرض التفاصيل
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50/70 to-amber-100/50 border border-amber-200/90 rounded-2xl p-4 sm:p-5 shadow-sm transition-all animate-fade-in">
      {/* Decorative background glow */}
      <div className="absolute top-0 end-0 -mt-8 -me-8 w-32 h-32 bg-amber-300/20 rounded-full blur-2xl pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        {/* Main Content */}
        <div className="space-y-2 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-white rounded-full text-xs font-black shadow-xs">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-3.5 h-3.5"
              >
                <path
                  fillRule="evenodd"
                  d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
                  clipRule="evenodd"
                />
              </svg>
              <span>تذكير لطيف بالفترة التجريبية</span>
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100/80 text-amber-900 border border-amber-300/60 rounded-full text-xs font-bold font-mono">
              ⏳ {days_label}
            </span>

            <span className="text-xs text-amber-800 font-medium">
              (تاريخ الانتهاء: {trial_info.formatted_end_date})
            </span>
          </div>

          <p className="text-sm text-slate-700 font-medium leading-relaxed">
            أهلاً بك <strong className="text-slate-900">{trial_info.full_name}</strong>، نود تذكيرك بأنه متبقي على انتهاء الفترة التجريبية المجانية{" "}
            <span className="font-bold text-amber-700">{days_label}</span>. لضمان استمرار وصولك لكافة بيانات قضاياك ومواعيدك وسجلاتك دون انقطاع، يسعدنا تواصلك مع الإدارة لتجديد الاشتراك.
          </p>

          {/* Progress Timeline */}
          <div className="pt-1 max-w-md">
            <div className="flex justify-between text-[11px] font-bold text-amber-800 mb-1">
              <span>الفترة التجريبية (45 يوماً)</span>
              <span>متبقي {trial_info.days_remaining} يوم</span>
            </div>
            <div className="w-full h-2 bg-amber-200/70 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  trial_info.days_remaining <= 3
                    ? "bg-rose-500"
                    : trial_info.days_remaining <= 7
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                }`}
                style={{ width: `${progress_pct}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 pt-2 md:pt-0">
          <button
            onClick={handle_renew_click}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm rounded-xl shadow-sm transition-all"
            title="التواصل مع الإدارة عبر واتساب لتجديد الاشتراك"
          >
            {/* WhatsApp Icon */}
            <svg
              className="w-4 h-4 fill-current"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
            <span>تجديد الاشتراك</span>
          </button>

          <button
            onClick={handle_snooze_two_days}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 bg-amber-100 hover:bg-amber-200 active:scale-95 text-amber-900 font-bold text-xs rounded-xl border border-amber-300/80 transition-all"
            title="إخفاء الإشعار وتذكيري مجدداً بعد يومين"
          >
            <span>تذكيري بعد يومين</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialReminderBanner;

import * as React from "react";
import {
  PowerIcon,
  UserGroupIcon,
  ClockIcon,
  ShareIcon,
  ArrowPathIcon,
} from "../components/icons";
import { Profile } from "../types";

interface PendingApprovalPageProps {
  onLogout: () => void;
  profile?: Profile | null;
  profiles?: Profile[];
}

const PendingApprovalPage: React.FC<PendingApprovalPageProps> = ({
  onLogout,
  profile,
  profiles = [],
}) => {
  const isOfficeAssistant = Boolean(profile?.lawyer_id);
  const officeLawyer = isOfficeAssistant
    ? profiles.find((p) => p.id === profile?.lawyer_id)
    : null;

  const lawyerName = officeLawyer?.full_name || "صاحب المكتب";
  const lawyerMobile = officeLawyer?.mobile_number;

  const handleContactLawyer = () => {
    if (!lawyerMobile) return;
    const cleanMobile = lawyerMobile.replace(/\D/g, "");
    const formatted = cleanMobile.startsWith("0")
      ? "963" + cleanMobile.slice(1)
      : cleanMobile.startsWith("963")
        ? cleanMobile
        : "963" + cleanMobile;
    const msg = `مرحباً أستاذ ${lawyerName}، لقد قمت بالتسجيل في مكتبكم (${profile?.full_name || "محامي جديد"}) برقم (${profile?.mobile_number || ""})، وأنتظر تفعيل حسابي من لوحة التحكم للمتابعة.`;
    window.open(`https://wa.me/${formatted}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4" dir="rtl">
      <div className="w-full max-w-md p-8 text-center bg-white rounded-2xl shadow-xl border border-gray-100 animate-in fade-in zoom-in duration-200">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm">
          {isOfficeAssistant ? (
            <UserGroupIcon className="w-8 h-8" />
          ) : (
            <ClockIcon className="w-8 h-8" />
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-800">
          {isOfficeAssistant
            ? "بانتظار موافقة صاحب المكتب"
            : "الحساب قيد المراجعة"}
        </h1>

        <div className="mt-4 text-sm text-gray-600 leading-relaxed space-y-3">
          {isOfficeAssistant ? (
            <>
              <p>
                تم ربط حسابك بمكتب المحامي{" "}
                <span className="font-bold text-gray-800">({lawyerName})</span>.
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs text-right space-y-1.5">
                <p className="font-bold">سياسة أمان وخصوصية المكتب:</p>
                <p>
                  لا يُسمح بالدخول إلى ملفات وقضايا وبيانات المكتب إلا بعد قيام المحامي صاحب المكتب بالموافقة على حسابك وتحديد صلاحياتك من لوحة التحكم (إدارة المساعدين).
                </p>
              </div>
            </>
          ) : (
            <p>
              شكراً لتسجيلك. تم إرسال طلبك إلى المسؤول للموافقة عليه. ستتمكن من الدخول إلى حسابك فور تفعيل الحساب.
            </p>
          )}
        </div>

        <div className="mt-8 space-y-3">
          {isOfficeAssistant && lawyerMobile && (
            <button
              onClick={handleContactLawyer}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-green-600 rounded-xl hover:bg-green-700 shadow-md transition-all active:scale-95"
            >
              <ShareIcon className="w-4 h-4" />
              <span>إشعار المحامي صاحب المكتب (واتساب)</span>
            </button>
          )}

          <button
            onClick={() => window.location.reload()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
          >
            <ArrowPathIcon className="w-4 h-4" />
            <span>فحص حالة الموافقة وتحديث الصفحة</span>
          </button>

          <button
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <PowerIcon className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PendingApprovalPage;

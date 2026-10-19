import * as React from "react";
import { MessageSquare, Smartphone, Building2, Laptop, Check, X } from "lucide-react";

interface WhatsAppChooserModalProps {
  text: string;
  phone?: string;
  onClose: () => void;
}

export const WhatsAppChooserModal: React.FC<WhatsAppChooserModalProps> = ({
  text,
  phone,
  onClose,
}) => {
  const [selectedVersion, setSelectedVersion] = React.useState<"app" | "business" | "web">("app");
  const [rememberChoice, setRememberChoice] = React.useState<boolean>(false);

  // Auto-detect if user has a default preference saved
  React.useEffect(() => {
    const saved = localStorage.getItem("whatsapp_version_choice");
    if (saved === "app" || saved === "business" || saved === "web") {
      // If we have a saved choice and the component mounted, we can just process and close immediately
      // to keep it friction-free, BUT we want to let them see/change if they want.
      // Actually, if they want to override or choose, they can do it. Let's select it by default in the UI.
      setSelectedVersion(saved);
    }
  }, []);

  const handleSend = () => {
    const cleanText = encodeURIComponent(text);
    const cleanPhone = phone ? phone.replace(/\D/g, "") : "";

    const isIOS = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = typeof navigator !== "undefined" && /Android/.test(navigator.userAgent);

    let url = "";
    let useDirectHref = false;

    if (selectedVersion === "web") {
      url = cleanPhone
        ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${cleanText}`
        : `https://web.whatsapp.com/send?text=${cleanText}`;
    } else if (selectedVersion === "business") {
      if (isIOS) {
        url = cleanPhone
          ? `whatsapp-business://send?phone=${cleanPhone}&text=${cleanText}`
          : `whatsapp-business://send?text=${cleanText}`;
        useDirectHref = true;
      } else if (isAndroid) {
        // Force WhatsApp Business package specifically on Android
        url = cleanPhone
          ? `intent://send?phone=${cleanPhone}&text=${cleanText}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`
          : `intent://send?text=${cleanText}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`;
        useDirectHref = true;
      } else {
        // Desktop / Generic Fallback
        url = cleanPhone
          ? `https://wa.me/${cleanPhone}?text=${cleanText}`
          : `https://wa.me/?text=${cleanText}`;
      }
    } else {
      // Default / Standard app ("app")
      if (isIOS) {
        url = cleanPhone
          ? `whatsapp://send?phone=${cleanPhone}&text=${cleanText}`
          : `whatsapp://send?text=${cleanText}`;
        useDirectHref = true;
      } else if (isAndroid) {
        // Force standard WhatsApp package specifically on Android
        url = cleanPhone
          ? `intent://send?phone=${cleanPhone}&text=${cleanText}#Intent;package=com.whatsapp;scheme=whatsapp;end`
          : `intent://send?text=${cleanText}#Intent;package=com.whatsapp;scheme=whatsapp;end`;
        useDirectHref = true;
      } else {
        // Desktop / Generic Fallback
        url = cleanPhone
          ? `whatsapp://send?phone=${cleanPhone}&text=${cleanText}`
          : `whatsapp://send?text=${cleanText}`;
      }
    }

    if (rememberChoice) {
      localStorage.setItem("whatsapp_version_choice", selectedVersion);
    } else {
      // If they uncheck, remove any saved default
      localStorage.removeItem("whatsapp_version_choice");
    }

    if (useDirectHref) {
      window.location.href = url;
    } else {
      window.open(url, "_blank");
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
      dir="rtl"
    >
      <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden transform transition-all duration-300 scale-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">إرسال عبر واتساب</h3>
              <p className="text-xs text-emerald-100 mt-0.5">اختر نسخة التطبيق المناسبة لجهازك</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 transition-colors text-white/80 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            يرجى اختيار الطريقة المفضلة لإرسال التقرير أو المهمة عبر الواتساب على هذا الجهاز:
          </p>

          <div className="space-y-3">
            {/* Standard App */}
            <label
              onClick={() => setSelectedVersion("app")}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedVersion === "app"
                  ? "border-emerald-600 bg-emerald-50/50"
                  : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <div
                className={`mt-1 p-2 rounded-lg ${
                  selectedVersion === "app" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">واتساب العادي (رابط ذكي wa.me)</span>
                  {selectedVersion === "app" && <Check className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-normal">
                  يفتح رابط الواتساب الذكي للعمل على الجوال والتابلت وفتح التطبيق الرسمي تلقائياً.
                </p>
              </div>
            </label>

            {/* WhatsApp Business */}
            <label
              onClick={() => setSelectedVersion("business")}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedVersion === "business"
                  ? "border-emerald-600 bg-emerald-50/50"
                  : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <div
                className={`mt-1 p-2 rounded-lg ${
                  selectedVersion === "business" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">واتساب للأعمال (WhatsApp Business)</span>
                  {selectedVersion === "business" && <Check className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-normal">
                  استدعاء مباشر ومخصص لنسخة واتساب الأعمال على أجهزة آيفون وأندرويد.
                </p>
              </div>
            </label>

            {/* WhatsApp Web */}
            <label
              onClick={() => setSelectedVersion("web")}
              className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                selectedVersion === "web"
                  ? "border-emerald-600 bg-emerald-50/50"
                  : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <div
                className={`mt-1 p-2 rounded-lg ${
                  selectedVersion === "web" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-500"
                }`}
              >
                <Laptop className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-slate-900">واتساب ويب (متصفح الكمبيوتر)</span>
                  {selectedVersion === "web" && <Check className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-normal">
                  يفتح نافذة جديدة لـ WhatsApp Web مباشرة في المتصفح. مثالي عند استخدام الكمبيوتر.
                </p>
              </div>
            </label>
          </div>

          {/* Remember Choice Checkbox */}
          <div className="pt-2">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(e) => setRememberChoice(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
              />
              <span className="text-xs font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                حفظ هذا الخيار كافتراضي دائماً على هذا الجهاز
              </span>
            </label>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="bg-slate-50 px-6 py-4 flex flex-row-reverse gap-3 border-t border-slate-100">
          <button
            onClick={handleSend}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm rounded-xl shadow-md shadow-emerald-600/10 transition-colors flex items-center justify-center gap-2"
          >
            <span>إرسال ومتابعة</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 active:bg-slate-100 font-bold text-sm rounded-xl transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, Send, Copy, Check, MessageSquare } from 'lucide-react';
import { CourtSession, Client, Invoice, OfficeSettings } from '../types';
import { formatDateArabic } from '../utils/dateUtils';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  session?: CourtSession;
  client?: Client;
  invoice?: Invoice;
  settings: OfficeSettings;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  session,
  client,
  invoice,
  settings,
}) => {
  const [copied, setCopied] = useState(false);
  const [customPhone, setCustomPhone] = useState(client?.phone || client?.whatsapp || '');

  if (!isOpen) return null;

  let defaultMessage = '';

  if (session) {
    defaultMessage = `السلام عليكم ورحمة الله وبركاته،
سعادة الموكل الكريم: ${session.clientName} المحترم،

نفيدكم بمستجدات جلستكم في القضية رقم (${session.caseNumber}) المنعقدة لدى (${session.court} - ${session.circuit || ''}) بتاريخ اليوم ${formatDateArabic(session.sessionDate)}:

📌 *قرار الجلسة وما تم فيها:*
${session.decision || session.requirements || 'تم حضور الجلسة والترافع وتقديم ما يلزم'}

${session.nextSessionDate ? `📅 *موعد الجلسة القادمة:* ${formatDateArabic(session.nextSessionDate)}` : ''}
${session.postponementReason ? `⚖️ *سبب التأجيل:* ${session.postponementReason}` : ''}

شاكرين ثقتكم الغالية بنا.
—
*${settings.officeName}*
هاتف المكتب: ${settings.phone}`;
  } else if (invoice) {
    defaultMessage = `السلام عليكم ورحمة الله وبركاته،
سعادة الموكل الكريم: ${invoice.clientName} المحترم،

تحية طيبة وبعد،
نود تذكيركم بصدور فاتورة أتعاب قانونية رقم (${invoice.invoiceNumber}) بمبلغ إجمالي (${invoice.totalAmount.toLocaleString()} ${settings.currency}).
المبلغ المتبقي للسداد: (${(invoice.totalAmount - (invoice.paidAmount || 0)).toLocaleString()} ${settings.currency}).

شاكرين لكم حسن تعاونكم.
—
*${settings.officeName}*
هاتف المكتب: ${settings.phone}`;
  } else if (client) {
    defaultMessage = `السلام عليكم ورحمة الله وبركاته،
سعادة الموكل الكريم: ${client.name} المحترم،

تحية طيبة وبعد،
نحيطكم علماً بأننا نعمل بكل اهتمام على متابعة قضاياكم وإجراءاتكم القانونية لدى مكتبنا. يسعدنا دائماً تواصلكم.

—
*${settings.officeName}*
هاتف المكتب: ${settings.phone}`;
  }

  const [message, setMessage] = useState(defaultMessage);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWhatsApp = () => {
    let phoneNum = customPhone.replace(/[^0-9]/g, '');
    if (phoneNum.startsWith('05')) {
      phoneNum = '966' + phoneNum.substring(1);
    }
    const encodedText = encodeURIComponent(message);
    const url = phoneNum ? `https://wa.me/${phoneNum}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-emerald-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-700/60 rounded-xl">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">إرسال إشعار واتساب للموكل</h3>
              <p className="text-xs text-emerald-100">صياغة رسالة فورية وإرسالها مباشرة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-emerald-700/50 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              رقم هاتف / واتساب الموكل
            </label>
            <input
              type="text"
              value={customPhone}
              onChange={e => setCustomPhone(e.target.value)}
              placeholder="مثال: 0555112233 أو 966555112233"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left dir-ltr"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              نص الرسالة
            </label>
            <textarea
              rows={8}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm leading-relaxed"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'تم النسخ!' : 'نسخ النص'}
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all"
            >
              <Send className="w-4 h-4" />
              فتح وإرسال عبر WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

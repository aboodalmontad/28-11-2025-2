import React, { useState } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { CourtSession } from '../types';

interface PostponeSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: CourtSession | null;
  onPostpone: (id: string, nextDate: string, reason: string) => void;
}

export const PostponeSessionModal: React.FC<PostponeSessionModalProps> = ({
  isOpen,
  onClose,
  session,
  onPostpone,
}) => {
  const [nextDate, setNextDate] = useState('');
  const [reason, setReason] = useState('استمهال الخصم للرد والمستندات');
  const [customReason, setCustomReason] = useState('');

  if (!isOpen || !session) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextDate) return;
    const finalReason = reason === 'أخرى' ? customReason : reason;
    onPostpone(session.id, nextDate, finalReason || 'تأجيل إداري');
    onClose();
  };

  const commonReasons = [
    'استمهال الخصم للرد والمستندات',
    'ورود تقرير الخبير الهندسي / المحاسبي',
    'إعادة إعلان الخصم وتبليغه رسمياً',
    'تقديم المذكرة الجوابية والمستندات الختامية',
    'حضور الأصيل للإقرار أو توجيه اليمين الحاسمة',
    'تأجيل إداري لعدم انعقاد الدائرة',
    'أخرى',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-amber-600 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-700/60 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">تأجيل الجلسة وجدولة الموعد القادم</h3>
              <p className="text-xs text-amber-100">القضية: {session.caseNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-amber-700/50 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              سيتم وضع علامة &quot;مؤجلة&quot; على هذه الجلسة وتلقائياً إنشاء سجل جلسة جديدة في التقويم بالتاريخ المحدد.
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              تاريخ الجلسة القادمة *
            </label>
            <input
              type="date"
              required
              value={nextDate}
              onChange={e => setNextDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              سبب التأجيل وقرار المحكمة
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 mb-2"
            >
              {commonReasons.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            {reason === 'أخرى' && (
              <input
                type="text"
                placeholder="اكتب سبب التأجيل هنا..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-md transition-all"
            >
              حفظ وتأجيل الجلسة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

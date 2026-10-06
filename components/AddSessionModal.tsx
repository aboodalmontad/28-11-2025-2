import React, { useState } from 'react';
import { X, Calendar, Plus } from 'lucide-react';
import { CourtSession, Case } from '../types';

interface AddSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: Case[];
  onAdd: (session: Omit<CourtSession, 'id'>) => void;
  preselectedCaseId?: string;
}

export const AddSessionModal: React.FC<AddSessionModalProps> = ({
  isOpen,
  onClose,
  cases,
  onAdd,
  preselectedCaseId,
}) => {
  const defaultCase = cases.find(c => c.id === preselectedCaseId) || cases[0];
  const [caseId, setCaseId] = useState(defaultCase?.id || '');
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [sessionTime, setSessionTime] = useState('09:30');
  const [hall, setHall] = useState('القاعة 1');
  const [sessionType, setSessionType] = useState('جلسة مرافعة وتبادل مذكرات');
  const [requirements, setRequirements] = useState('');
  const [attendedLawyer, setAttendedLawyer] = useState('أ. محمد النحوي');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCase = cases.find(c => c.id === caseId);
    if (!selectedCase || !sessionDate) return;

    onAdd({
      caseId: selectedCase.id,
      caseNumber: selectedCase.caseNumber,
      caseYear: selectedCase.caseYear,
      court: selectedCase.court,
      circuit: selectedCase.circuit,
      clientName: selectedCase.clientName,
      sessionDate,
      sessionTime,
      hall,
      sessionType,
      requirements,
      attendedLawyer,
      status: 'upcoming',
      notes,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-emerald-700 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-800/60 rounded-xl">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">جدولة جلسة محكمة جديدة</h3>
              <p className="text-xs text-emerald-100">إضافة موعد جلسة في رول القضايا والتقويم القضائي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-emerald-800/50 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              اختر القضية المعنية *
            </label>
            <select
              required
              value={caseId}
              onChange={e => setCaseId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              {cases.map(c => (
                <option key={c.id} value={c.id}>
                  {c.caseNumber} - {c.clientName} ({c.court})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تاريخ الجلسة *
              </label>
              <input
                type="date"
                required
                value={sessionDate}
                onChange={e => setSessionDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                وقت انعقاد الجلسة
              </label>
              <input
                type="time"
                value={sessionTime}
                onChange={e => setSessionTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                القاعة / الرابط المرئي
              </label>
              <input
                type="text"
                placeholder="قاعة 3 أو جلسة عن بعد (ناجز)"
                value={hall}
                onChange={e => setHall(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                المحامي المكلف بالحضور
              </label>
              <input
                type="text"
                value={attendedLawyer}
                onChange={e => setAttendedLawyer(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              طبيعة / نوع الجلسة
            </label>
            <input
              type="text"
              placeholder="مرافعة، تقديم بينات، خبرة، نطق بالحكم..."
              value={sessionType}
              onChange={e => setSessionType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              المطلوب تجهيزه للجلسة (مذكرات، مستندات، شهود)
            </label>
            <textarea
              rows={2}
              placeholder="إعداد مذكرة الرد وحافظة المستندات..."
              value={requirements}
              onChange={e => setRequirements(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm"
            />
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
              className="px-6 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              حفظ الجلسة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

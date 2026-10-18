import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Plus,
  Send,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Edit2,
  Trash2,
  Printer,
  ChevronRight,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { CourtSession } from '../types';
import { formatDateArabic, isToday, isTomorrow } from '../utils/dateUtils';
import { triggerPrint } from '../utils/printUtils';

interface SessionsPageProps {
  onOpenAddSession: () => void;
  onOpenPostpone: (session: CourtSession) => void;
  onOpenWhatsApp: (session: CourtSession) => void;
}

export const SessionsPage: React.FC<SessionsPageProps> = ({
  onOpenAddSession,
  onOpenPostpone,
  onOpenWhatsApp,
}) => {
  const { sessions, updateSession, deleteSession, searchQuery, settings } = useData();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courtFilter, setCourtFilter] = useState<string>('all');
  const [selectedSessionForDecision, setSelectedSessionForDecision] = useState<CourtSession | null>(null);
  const [decisionText, setDecisionText] = useState('');

  // Extract unique courts
  const courts = useMemo(() => {
    const list = new Set<string>();
    sessions.forEach(s => {
      if (s.court) list.add(s.court);
    });
    return Array.from(list);
  }, [sessions]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      // Global search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchCase = s.caseNumber.toLowerCase().includes(q);
        const matchClient = s.clientName.toLowerCase().includes(q);
        const matchCourt = s.court.toLowerCase().includes(q);
        const matchType = s.sessionType.toLowerCase().includes(q);
        if (!matchCase && !matchClient && !matchCourt && !matchType) return false;
      }

      // Status filter
      if (statusFilter === 'today') {
        if (!isToday(s.sessionDate)) return false;
      } else if (statusFilter === 'upcoming') {
        if (s.status !== 'upcoming') return false;
      } else if (statusFilter === 'postponed') {
        if (s.status !== 'postponed') return false;
      } else if (statusFilter === 'completed') {
        if (s.status !== 'completed' && s.status !== 'judged') return false;
      }

      // Court filter
      if (courtFilter !== 'all' && s.court !== courtFilter) {
        return false;
      }

      return true;
    });
  }, [sessions, searchQuery, statusFilter, courtFilter]);

  const handleSaveDecision = () => {
    if (!selectedSessionForDecision) return;
    updateSession(selectedSessionForDecision.id, {
      decision: decisionText,
      status: 'completed',
    });
    setSelectedSessionForDecision(null);
    setDecisionText('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <span>رول ومواعيد جلسات المحاكم</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            متابعة الجلسات اليومية، قرارات الدوائر القضائية، وإخطار الموكلين فورياً
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => triggerPrint()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            طباعة رول الجلسات
          </button>

          <button
            onClick={onOpenAddSession}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            جدولة جلسة جديدة
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'كافة الجلسات' },
            { id: 'today', label: 'جلسات اليوم 🌟' },
            { id: 'upcoming', label: 'الجلسات القادمة' },
            { id: 'postponed', label: 'المؤجلة' },
            { id: 'completed', label: 'المنتهية والمنطوق بها' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                statusFilter === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Court Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={courtFilter}
            onChange={e => setCourtFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
          >
            <option value="all">كل المحاكم</option>
            {courts.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold">
                <th className="py-3 px-4">رقم القضية</th>
                <th className="py-3 px-4">الموكل</th>
                <th className="py-3 px-4">المحكمة والدائرة</th>
                <th className="py-3 px-4">موعد الجلسة</th>
                <th className="py-3 px-4">نوع الجلسة والمطلوب</th>
                <th className="py-3 px-4">القرار / ما تم فيها</th>
                <th className="py-3 px-4">الحالة</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    لا توجد جلسات تطابق خيارات البحث والفلترة.
                  </td>
                </tr>
              ) : (
                filteredSessions.map(sess => {
                  const isTodaySess = isToday(sess.sessionDate);
                  return (
                    <tr
                      key={sess.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                        isTodaySess ? 'bg-amber-50/50 dark:bg-amber-950/20 font-medium' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                        {sess.caseNumber}
                      </td>
                      <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200">
                        {sess.clientName}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold block text-slate-900 dark:text-slate-100">
                          {sess.court}
                        </span>
                        <span className="text-[11px] text-slate-400">{sess.circuit || '-'}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="block font-semibold text-emerald-700 dark:text-emerald-400">
                          {formatDateArabic(sess.sessionDate)}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {sess.sessionTime || '09:00 ص'} • {sess.hall || 'عن بعد'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="block font-medium text-slate-900 dark:text-slate-100">
                          {sess.sessionType}
                        </span>
                        {sess.requirements && (
                          <span className="text-[11px] text-amber-700 dark:text-amber-400 block mt-0.5">
                            المطلوب: {sess.requirements}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        {sess.decision ? (
                          <span className="text-slate-800 dark:text-slate-200 block">
                            {sess.decision}
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedSessionForDecision(sess);
                              setDecisionText('');
                            }}
                            className="text-xs text-blue-600 hover:underline font-semibold"
                          >
                            + تسجيل قرار الجلسة
                          </button>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {sess.status === 'upcoming' && (
                          <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                            قادمة
                          </span>
                        )}
                        {sess.status === 'postponed' && (
                          <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                            مؤجلة
                          </span>
                        )}
                        {sess.status === 'completed' && (
                          <span className="px-2 py-1 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            تمت
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onOpenWhatsApp(sess)}
                            title="إرسال إشعار واتساب بالقرار للموكل"
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenPostpone(sess)}
                            title="تأجيل الجلسة"
                            className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteSession(sess.id)}
                            title="حذف الجلسة"
                            className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Modal */}
      {selectedSessionForDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
              تسجيل قرار المحكمة وما دار بالجلسة
            </h3>
            <p className="text-xs text-slate-500">
              قضية: {selectedSessionForDecision.caseNumber} • {selectedSessionForDecision.court}
            </p>

            <textarea
              rows={4}
              placeholder="اكتب قرار القاضي أو منطوق الجلسة هنا..."
              value={decisionText}
              onChange={e => setDecisionText(e.target.value)}
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedSessionForDecision(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveDecision}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
              >
                حفظ القرار وإنهاء الجلسة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

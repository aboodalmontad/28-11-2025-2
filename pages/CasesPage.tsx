import React, { useState, useMemo } from 'react';
import {
  Briefcase,
  Search,
  Filter,
  Plus,
  Calendar,
  FileText,
  DollarSign,
  ChevronLeft,
  User,
  Shield,
  Clock,
  Trash2,
  X,
  Send,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { Case, CourtSession } from '../types';
import { formatDateArabic } from '../utils/dateUtils';

interface CasesPageProps {
  onOpenAddCase: () => void;
  onOpenAddSessionForCase: (caseId: string) => void;
}

export const CasesPage: React.FC<CasesPageProps> = ({
  onOpenAddCase,
  onOpenAddSessionForCase,
}) => {
  const { cases, sessions, documents, invoices, transactions, updateCase, deleteCase, searchQuery, settings } = useData();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);

  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchNum = c.caseNumber.toLowerCase().includes(q);
        const matchClient = c.clientName.toLowerCase().includes(q);
        const matchCourt = c.court.toLowerCase().includes(q);
        const matchSubject = c.subject.toLowerCase().includes(q);
        const matchOpponent = c.opponentName?.toLowerCase().includes(q);
        if (!matchNum && !matchClient && !matchCourt && !matchSubject && !matchOpponent) return false;
      }

      if (statusFilter !== 'all' && c.status !== statusFilter) return false;

      return true;
    });
  }, [cases, searchQuery, statusFilter]);

  const caseSessions = useMemo(() => {
    if (!selectedCase) return [];
    return sessions.filter(s => s.caseId === selectedCase.id);
  }, [sessions, selectedCase]);

  const caseDocuments = useMemo(() => {
    if (!selectedCase) return [];
    return documents.filter(d => d.caseId === selectedCase.id);
  }, [documents, selectedCase]);

  const caseTransactions = useMemo(() => {
    if (!selectedCase) return [];
    return transactions.filter(t => t.caseId === selectedCase.id);
  }, [transactions, selectedCase]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-600" />
            <span>ملفات وسجلات القضايا</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            أرشيف القضايا الجارية والمحكومة، تفاصيل الأطراف والمحاكم ومتابعة الجلسات
          </p>
        </div>

        <button
          onClick={onOpenAddCase}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          قيد قضية جديدة
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {[
          { id: 'all', label: 'كافة القضايا' },
          { id: 'active', label: 'قضايا جارية' },
          { id: 'judged', label: 'صدر فيها حكم' },
          { id: 'closed', label: 'منتهية ومغلقة' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === tab.id
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cases Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCases.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            لا توجد قضايا مسجلة مطابقة للبحث.
          </div>
        ) : (
          filteredCases.map(c => {
            const paidRatio = c.feesTotal > 0 ? Math.min(100, Math.round(((c.feesPaid || 0) / c.feesTotal) * 100)) : 0;
            return (
              <div
                key={c.id}
                onClick={() => setSelectedCase(c)}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500/50 cursor-pointer transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                      #{c.caseNumber}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        c.status === 'active'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {c.status === 'active' ? 'جارية' : c.status === 'judged' ? 'محكومة' : 'مغلقة'}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-emerald-600 transition-colors">
                    {c.clientName}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {c.subject}
                  </p>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">المحكمة:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{c.court}</span>
                    </div>
                    {c.opponentName && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">الخصم:</span>
                        <span className="text-slate-800 dark:text-slate-200 truncate max-w-[150px]">{c.opponentName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial bar */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-400">الأتعاب المسددة:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {(c.feesPaid || 0).toLocaleString()} / {c.feesTotal.toLocaleString()} {settings.currency}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${paidRatio}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Case Details Drawer / Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-emerald-800 text-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-900/60 rounded-xl">
                  <Briefcase className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">ملف القضية رقم: {selectedCase.caseNumber}</h3>
                  <p className="text-xs text-emerald-100">{selectedCase.court} • {selectedCase.circuit || 'الدائرة العامة'}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-2 hover:bg-emerald-900/50 rounded-lg transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
              {/* Core Information Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">الموكل وصفته في الدعوى:</span>
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {selectedCase.clientName}{' '}
                    <span className="text-xs text-emerald-600">
                      ({selectedCase.clientRole === 'plaintiff' ? 'مدعي' : 'مدعى عليه'})
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-1">الطرف الخصم ومحاميه:</span>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedCase.opponentName || 'غير محدد'}{' '}
                    {selectedCase.opponentLawyer && (
                      <span className="text-xs text-slate-500">({selectedCase.opponentLawyer})</span>
                    )}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <span className="text-xs text-slate-400 block mb-1">موضوع الدعوى والطلبات:</span>
                  <p className="text-slate-800 dark:text-slate-200 leading-relaxed">
                    {selectedCase.subject}
                  </p>
                </div>
              </div>

              {/* Sessions in Case */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    جلسات المحكمة المرتبطة بهذه القضية ({caseSessions.length})
                  </h4>
                  <button
                    onClick={() => onOpenAddSessionForCase(selectedCase.id)}
                    className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    + جدولة جلسة جديدة
                  </button>
                </div>

                {caseSessions.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-400 text-xs">
                    لم تسجل أي جلسات بعد لهذه القضية.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {caseSessions.map(s => (
                      <div
                        key={s.id}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-bold text-emerald-700 dark:text-emerald-400">
                            {formatDateArabic(s.sessionDate)} - {s.sessionTime || 'صباحاً'}
                          </span>
                          <p className="text-slate-600 dark:text-slate-300 mt-0.5">{s.sessionType}</p>
                          {s.decision && (
                            <p className="text-blue-600 dark:text-blue-400 mt-0.5">القرار: {s.decision}</p>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800">
                          {s.status === 'upcoming' ? 'قادمة' : s.status === 'postponed' ? 'مؤجلة' : 'تمت'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Case Documents */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" />
                  المستندات والأدلة المؤرشفة للقضية ({caseDocuments.length})
                </h4>

                {caseDocuments.length === 0 ? (
                  <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/40 text-slate-400 text-xs">
                    لا توجد مستندات مرفقة حالياً.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {caseDocuments.map(doc => (
                      <div
                        key={doc.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 text-xs"
                      >
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="font-bold truncate">{doc.title}</p>
                          <span className="text-[10px] text-slate-400">{doc.fileSize}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
              <button
                onClick={() => {
                  if (confirm('هل أنت متأكد من حذف هذه القضية؟')) {
                    deleteCase(selectedCase.id);
                    setSelectedCase(null);
                  }
                }}
                className="flex items-center gap-1 text-xs text-rose-600 hover:underline font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                حذف ملف القضية
              </button>

              <button
                onClick={() => setSelectedCase(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

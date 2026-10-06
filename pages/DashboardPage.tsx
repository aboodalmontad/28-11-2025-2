import React from 'react';
import {
  Users,
  Briefcase,
  Calendar,
  CheckSquare,
  Receipt,
  TrendingUp,
  AlertTriangle,
  Clock,
  Send,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Building,
  Scale,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatDateArabic, isToday, isTomorrow, getDaysRemaining } from '../utils/dateUtils';
import { CourtSession } from '../types';

interface DashboardPageProps {
  onOpenWhatsApp: (session: CourtSession) => void;
  onOpenPostpone: (session: CourtSession) => void;
  onOpenAddCase: () => void;
  onOpenAddClient: () => void;
  onOpenAddSession: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onOpenWhatsApp,
  onOpenPostpone,
  onOpenAddCase,
  onOpenAddClient,
  onOpenAddSession,
}) => {
  const {
    clients,
    cases,
    sessions,
    tasks,
    invoices,
    transactions,
    settings,
    setActiveTab,
    toggleTaskStatus,
  } = useData();

  const activeCases = cases.filter(c => c.status === 'active');
  const todaySessions = sessions.filter(s => isToday(s.sessionDate) && s.status !== 'cancelled');
  const upcomingSessions = sessions.filter(s => s.status === 'upcoming');
  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid' || i.status === 'partial');

  const totalCollected = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      {/* Welcome & Office Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-emerald-800 via-emerald-900 to-slate-900 text-white p-6 lg:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold">
              <Scale className="w-3.5 h-3.5" />
              <span>نظام إدارة العمل القانوني والمحاكم الذكي</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black tracking-tight">
              أهلاً وسهلاً، {settings.lawyerName}
            </h2>
            <p className="text-emerald-100/80 text-xs lg:text-sm leading-relaxed">
              لديك اليوم <span className="font-bold text-white">{todaySessions.length}</span> جلسات محكمة مجدولة، و{' '}
              <span className="font-bold text-white">{pendingTasks.length}</span> مهمة قيد المتابعة.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onOpenAddSession}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-500/30 transition-all"
            >
              <Calendar className="w-4 h-4" />
              جدولة جلسة
            </button>
            <button
              onClick={onOpenAddCase}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-semibold text-xs transition-all"
            >
              <Briefcase className="w-4 h-4" />
              قيد قضية
            </button>
            <button
              onClick={onOpenAddClient}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-semibold text-xs transition-all"
            >
              <Users className="w-4 h-4" />
              إضافة موكل
            </button>
          </div>
        </div>

        {/* Decorative background element */}
        <div className="absolute left-[-20px] bottom-[-20px] opacity-10 text-white pointer-events-none">
          <Scale className="w-64 h-64" />
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
        {/* Clients */}
        <div
          onClick={() => setActiveTab('clients')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">إجمالي الموكلين</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {clients.length}
            </span>
            <span className="text-[10px] text-slate-400">موكل</span>
          </div>
        </div>

        {/* Active Cases */}
        <div
          onClick={() => setActiveTab('cases')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">القضايا الجارية</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 group-hover:scale-110 transition-transform">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {activeCases.length}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold">نشطة</span>
          </div>
        </div>

        {/* Today's Sessions */}
        <div
          onClick={() => setActiveTab('sessions')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">جلسات اليوم</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
              {todaySessions.length}
            </span>
            <span className="text-[10px] text-slate-400">جلسة</span>
          </div>
        </div>

        {/* Pending Tasks */}
        <div
          onClick={() => setActiveTab('tasks')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">مهام مستحقة</span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 group-hover:scale-110 transition-transform">
              <CheckSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {pendingTasks.length}
            </span>
            <span className="text-[10px] text-rose-500 font-semibold">قيد الإنجاز</span>
          </div>
        </div>

        {/* Unpaid Invoices */}
        <div
          onClick={() => setActiveTab('accounting')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">فواتير معلقة</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 group-hover:scale-110 transition-transform">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
              {unpaidInvoices.length}
            </span>
            <span className="text-[10px] text-slate-400">فاتورة</span>
          </div>
        </div>

        {/* Revenue */}
        <div
          onClick={() => setActiveTab('accounting')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold">المقبوضات</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 truncate">
              {totalCollected.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-400">{settings.currency}</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Sessions & Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Sessions Roll */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                رول جلسات المحاكم القادمة
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('sessions')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              عرض كامل الرول
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {upcomingSessions.length === 0 ? (
              <div className="p-8 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                لا توجد جلسات محددة قادمة. اضغط على زر &quot;جدولة جلسة&quot; لإضافة موعد جديد.
              </div>
            ) : (
              upcomingSessions.slice(0, 4).map(sess => {
                const daysLeft = getDaysRemaining(sess.sessionDate);
                const isTodaySess = isToday(sess.sessionDate);
                const isTomorrowSess = isTomorrow(sess.sessionDate);

                return (
                  <div
                    key={sess.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isTodaySess
                        ? 'bg-amber-500/10 border-amber-300 dark:border-amber-800/60 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                            قضية رقم: {sess.caseNumber}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {sess.court}
                          </span>
                          {isTodaySess && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500 text-white animate-pulse">
                              اليوم
                            </span>
                          )}
                          {isTomorrowSess && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500 text-white">
                              غداً
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                          الموكل: <span className="text-slate-900 dark:text-slate-100">{sess.clientName}</span> • {sess.sessionType}
                        </p>
                        {sess.requirements && (
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                            المطلوب: {sess.requirements}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => onOpenPostpone(sess)}
                          className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition-colors"
                        >
                          تأجيل
                        </button>
                        <button
                          onClick={() => onOpenWhatsApp(sess)}
                          title="إرسال تقرير الجلسة بالواتساب للموكل"
                          className="p-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDateArabic(sess.sessionDate)} - {sess.sessionTime || 'صباحاً'}</span>
                      </div>
                      <span>القاعة: {sess.hall || 'عن بعد'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Urgent Tasks & Quick Stats */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                المهام ومواعيد الطعون
              </h3>
            </div>
            <button
              onClick={() => setActiveTab('tasks')}
              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              الكل
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {pendingTasks.length === 0 ? (
              <div className="p-6 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                تم إنجاز كافة المهام بنجاح!
              </div>
            ) : (
              pendingTasks.slice(0, 5).map(t => (
                <div
                  key={t.id}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start gap-3 shadow-sm hover:border-slate-300 transition-colors"
                >
                  <button
                    onClick={() => toggleTaskStatus(t.id)}
                    className="mt-0.5 text-slate-400 hover:text-emerald-600"
                  >
                    <CheckSquare className="w-4 h-4" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                        {t.title}
                      </h4>
                      {t.priority === 'urgent' && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          عاجل
                        </span>
                      )}
                    </div>
                    {t.caseNumber && (
                      <p className="text-[11px] text-slate-500">قضية: {t.caseNumber}</p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                      <span>المسؤول: {t.assignedTo || 'المحامي'}</span>
                      <span>تستحق: {t.dueDate}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

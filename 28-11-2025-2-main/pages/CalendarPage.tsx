import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  Clock,
  Plus,
  Calendar as CalendarIcon,
  CheckCircle,
  MapPin,
  User,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatDateArabic, formatShortDate } from '../utils/dateUtils';
import { CourtSession, Appointment, CaseTask } from '../types';

interface CalendarPageProps {
  onOpenAddSession: () => void;
  onOpenAddAppointment: () => void;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  onOpenAddSession,
  onOpenAddAppointment,
}) => {
  const { sessions, appointments, tasks } = useData();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string>(new Date().toISOString().split('T')[0]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First day of month & number of days
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Events on selected day
  const daySessions = useMemo(() => {
    return sessions.filter(s => s.sessionDate === selectedDay);
  }, [sessions, selectedDay]);

  const dayAppointments = useMemo(() => {
    return appointments.filter(a => a.date === selectedDay);
  }, [appointments, selectedDay]);

  const dayTasks = useMemo(() => {
    return tasks.filter(t => t.dueDate === selectedDay);
  }, [tasks, selectedDay]);

  // Generate calendar grid cells
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  // Padding for start day (Sunday = 0, so 0 blanks)
  const blanksArray = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
            <span>التقويم والمواعيد القضائية</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            جدول الجلسات والاستشارات والاجتماعات ومواعيد الطعون القانونية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddAppointment}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 shadow-sm"
          >
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            حجز موعد / استشارة
          </button>
          <button
            onClick={onOpenAddSession}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
          >
            <Plus className="w-4 h-4" />
            جدولة جلسة
          </button>
        </div>
      </div>

      {/* Main Grid: Calendar & Day Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
          {/* Month Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {monthNames[month]} {year}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                اليوم
              </button>
              <button
                onClick={handleNextMonth}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-400 mb-2">
            <div>الأحد</div>
            <div>الإثنين</div>
            <div>الثلاثاء</div>
            <div>الأربعاء</div>
            <div>الخميس</div>
            <div className="text-rose-400">الجمعة</div>
            <div>السبت</div>
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1.5">
            {blanksArray.map(b => (
              <div key={`blank-${b}`} className="h-20 sm:h-24 rounded-xl bg-slate-50/50 dark:bg-slate-900/30"></div>
            ))}

            {daysArray.map(day => {
              const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = selectedDay === dayStr;
              const isTodayDate = new Date().toISOString().split('T')[0] === dayStr;

              const countSessions = sessions.filter(s => s.sessionDate === dayStr).length;
              const countApts = appointments.filter(a => a.date === dayStr).length;
              const countDueTasks = tasks.filter(t => t.dueDate === dayStr && t.status !== 'completed').length;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDay(dayStr)}
                  className={`h-20 sm:h-24 p-2 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50/30 dark:bg-emerald-950/20 ring-2 ring-emerald-500/50'
                      : isTodayDate
                      ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
                      : 'border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isTodayDate
                          ? 'bg-amber-500 text-white'
                          : isSelected
                          ? 'bg-emerald-600 text-white'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {day}
                    </span>
                  </div>

                  {/* Event indicators */}
                  <div className="space-y-1">
                    {countSessions > 0 && (
                      <div className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-[9px] font-bold text-amber-800 dark:text-amber-300 truncate">
                        ⚖️ {countSessions} جلسة
                      </div>
                    )}
                    {countApts > 0 && (
                      <div className="px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-[9px] font-bold text-blue-800 dark:text-blue-300 truncate">
                        🕒 {countApts} موعد
                      </div>
                    )}
                    {countDueTasks > 0 && (
                      <div className="px-1 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-[9px] font-bold text-rose-800 dark:text-rose-300 truncate">
                        ⚠️ {countDueTasks} مهمة
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda (1 Col) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <span className="text-xs text-slate-400">جدول أعمال يوم:</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              {formatDateArabic(selectedDay)}
            </h3>
          </div>

          {/* Sessions on day */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5 text-amber-500" />
              جلسات المحكمة ({daySessions.length})
            </h4>
            {daySessions.length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد جلسات محكمة في هذا اليوم.</p>
            ) : (
              daySessions.map(s => (
                <div
                  key={s.id}
                  className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">قضية #{s.caseNumber}</span>
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">{s.sessionTime || '09:00 ص'}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 mt-1">{s.court} • {s.clientName}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{s.sessionType}</p>
                </div>
              ))
            )}
          </div>

          {/* Appointments on day */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              الاستشارات والمواعيد ({dayAppointments.length})
            </h4>
            {dayAppointments.length === 0 ? (
              <p className="text-xs text-slate-400">لا توجد مواعيد استشارات مسجلة.</p>
            ) : (
              dayAppointments.map(a => (
                <div
                  key={a.id}
                  className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-slate-100">{a.title}</span>
                    <span className="text-blue-700 dark:text-blue-400 font-semibold">{a.time}</span>
                  </div>
                  {a.clientName && (
                    <p className="text-slate-600 dark:text-slate-300 mt-1">العميل: {a.clientName}</p>
                  )}
                  <p className="text-[11px] text-slate-500 mt-0.5">{a.location}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import * as React from "react";
import {
  get_days_in_month,
  get_first_day_of_month,
  is_same_day,
  is_today,
  is_weekend,
  get_public_holiday,
  format_month_year,
  is_before_today,
} from "../utils/dateUtils";
import { Session, Appointment } from "../types";
import { ChevronLeftIcon } from "./icons";

interface CalendarProps {
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  sessions: Session[];
  appointments: Appointment[];
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
}

const Calendar: React.FC<CalendarProps> = ({
  onDateSelect,
  selectedDate,
  sessions,
  appointments,
  currentDate,
  setCurrentDate,
}) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = get_days_in_month(year, month);
  const firstDay = get_first_day_of_month(year, month);

  const weekDays = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];

  // Formatter for Syrian Arabic locale with English (Latin) numerals.
  const monthYearFormatter = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    year: "numeric",
    month: "long",
  });

  const dayFormatter = new Intl.DateTimeFormat("ar-SY-u-nu-latn", {
    day: "numeric",
  });

  const numberFormatter = new Intl.NumberFormat("en-US");

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(year, month + offset, 1));
  };

  const getEventsCountForDay = (day: Date) => {
    const daySessions = sessions.filter((s) => is_same_day(s.date, day));
    const isPast = is_before_today(day);
    const isCurrentDay = is_today(day);

    let postponedCount = 0; // أخضر - جلسات مرحلة
    let unpostponedCount = 0; // برتقالي داكن - جلسات غير مرحلة (فائتة)
    let todayCount = 0; // برتقالي فاتح - جلسات اليوم
    let futureCount = 0; // أزرق - جلسات قادمة

    daySessions.forEach((s) => {
      const isPostponed =
        s.is_postponed || !!s.stage_decision_date || !!s.next_session_date;

      if (isPostponed) {
        postponedCount++;
      } else if (isPast) {
        unpostponedCount++;
      } else if (isCurrentDay) {
        todayCount++;
      } else {
        futureCount++;
      }
    });

    const appointmentCount = appointments.filter((a) =>
      is_same_day(a.date, day)
    ).length;

    return {
      postponedCount,
      unpostponedCount,
      todayCount,
      futureCount,
      appointmentCount,
    };
  };

  return (
    <div className="w-full mx-auto bg-white rounded-lg">
      <div className="flex items-center justify-between px-2 py-3">
        <button
          onClick={() => changeMonth(-1)}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <ChevronLeftIcon className="w-6 h-6 transform rotate-180" />
        </button>
        <h2 className="text-lg font-bold truncate">
          {format_month_year(currentDate)}
        </h2>
        <button
          onClick={() => changeMonth(1)}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs sm:text-sm font-semibold text-gray-600 mb-2 py-1.5 bg-gray-50 rounded-md">
        {weekDays.map((day) => (
          <div key={day} className="truncate">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} />
        ))}
        {daysInMonth.map((day) => {
          const {
            postponedCount,
            unpostponedCount,
            todayCount,
            futureCount,
            appointmentCount,
          } = getEventsCountForDay(day);
          const isSelected = is_same_day(day, selectedDate);
          const isCurrentDay = is_today(day);
          const holidayName = get_public_holiday(day);
          const isWknd = is_weekend(day);
          let title = holidayName || "";

          let dayClasses =
            "relative flex flex-col items-center justify-start pt-1 min-h-[3rem] w-full rounded-lg cursor-pointer transition-colors duration-200";

          if (isSelected) {
            dayClasses += " bg-blue-600 text-white shadow-md";
          } else if (holidayName) {
            dayClasses +=
              " bg-red-500 text-white font-bold shadow-sm hover:bg-red-600";
          } else if (isCurrentDay) {
            dayClasses +=
              " bg-orange-100/90 text-orange-900 font-bold ring-2 ring-orange-400/80 hover:bg-orange-200/90";
          } else if (isWknd) {
            dayClasses +=
              " bg-pink-100/70 text-pink-800 hover:bg-pink-200/70";
          } else {
            dayClasses += " hover:bg-gray-100";
          }

          return (
            <div
              key={day.toString()}
              onClick={() => onDateSelect(day)}
              className={dayClasses}
              title={title}
            >
              <span className="text-sm">{dayFormatter.format(day)}</span>
              <div className="mt-auto mb-1 flex w-full flex-wrap justify-center items-center gap-0.5 px-0.5">
                {postponedCount > 0 && (
                  <span
                    className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-bold text-white bg-green-600 rounded-full shadow-sm"
                    title={`${numberFormatter.format(postponedCount)} جلسات مرحلة`}
                  >
                    {numberFormatter.format(postponedCount)}
                  </span>
                )}
                {unpostponedCount > 0 && (
                  <span
                    className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-bold text-white bg-orange-600 rounded-full shadow-sm"
                    title={`${numberFormatter.format(unpostponedCount)} جلسات غير مرحلة`}
                  >
                    {numberFormatter.format(unpostponedCount)}
                  </span>
                )}
                {todayCount > 0 && (
                  <span
                    className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-bold text-white bg-orange-400 rounded-full shadow-sm"
                    title={`${numberFormatter.format(todayCount)} جلسات اليوم`}
                  >
                    {numberFormatter.format(todayCount)}
                  </span>
                )}
                {futureCount > 0 && (
                  <span
                    className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-bold text-white bg-blue-600 rounded-full shadow-sm"
                    title={`${numberFormatter.format(futureCount)} جلسات قادمة`}
                  >
                    {numberFormatter.format(futureCount)}
                  </span>
                )}
                {appointmentCount > 0 && (
                  <span
                    className="flex items-center justify-center min-w-[1.25rem] h-5 px-1 text-[10px] font-bold text-white bg-purple-500 rounded-full shadow-sm"
                    title={`${numberFormatter.format(appointmentCount)} مواعيد`}
                  >
                    {numberFormatter.format(appointmentCount)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(Calendar);

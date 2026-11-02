import React, { useState, useEffect } from 'react';
import {
  Search,
  Bell,
  Plus,
  Scale,
  Sun,
  Moon,
  Printer,
  Calendar as CalendarIcon,
  CheckCircle,
  X,
  FileText,
  UserPlus,
  Briefcase,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatDateArabic, formatHijriDate } from '../utils/dateUtils';
import { triggerPrint } from '../utils/printUtils';

interface NavbarProps {
  onOpenAddClient: () => void;
  onOpenAddCase: () => void;
  onOpenAddSession: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAddClient,
  onOpenAddCase,
  onOpenAddSession,
}) => {
  const {
    settings,
    searchQuery,
    setSearchQuery,
    notifications,
    unreadNotificationsCount,
    markAllNotificationsAsRead,
    setActiveTab,
  } = useData();

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return document.documentElement.classList.contains('dark');
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const todayGregorian = formatDateArabic(new Date().toISOString());
  const todayHijri = formatHijriDate(new Date().toISOString());

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 no-print">
      <div className="flex items-center justify-between px-4 lg:px-8 py-3">
        {/* Left Side: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center text-white shadow-md shadow-emerald-700/20">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-base lg:text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{settings.officeName || 'مكتب المحامي'}</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {settings.lawyerName} • {settings.barNumber}
            </p>
          </div>
        </div>

        {/* Center: Search & Date Header */}
        <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="بحث سريع برقم القضية، اسم الموكل، المحكمة، أو الموضوع..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-4 pr-9 py-2 text-xs lg:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Hijri & Gregorian Badge */}
          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-xs">
            <CalendarIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <div className="text-right">
              <span className="font-semibold text-slate-700 dark:text-slate-200 block">{todayHijri}</span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{todayGregorian}</span>
            </div>
          </div>

          {/* Quick Print Button */}
          <button
            onClick={() => triggerPrint()}
            title="طباعة التقرير الحالي"
            className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            title="تبديل الوضع الليلي / النهاري"
            className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications) {
                  markAllNotificationsAsRead();
                }
              }}
              className="relative p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <div className="absolute left-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">تنبيهات القضايا والجلسات</h4>
                  <span className="text-xs text-emerald-600 font-medium">
                    {notifications.length} إشعار
                  </span>
                </div>

                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400">
                      لا توجد جلسات أو مواعيد عاجلة اليوم
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (n.linkTab) setActiveTab(n.linkTab);
                          setShowNotifications(false);
                        }}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors text-right"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">
                            {n.title}
                          </span>
                          <span className="text-[10px] text-slate-400">اليوم</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Add Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowQuickMenu(!showQuickMenu)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سريعة</span>
            </button>

            {showQuickMenu && (
              <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 text-right">
                <button
                  onClick={() => {
                    onOpenAddClient();
                    setShowQuickMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                >
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                  موكل جديد
                </button>
                <button
                  onClick={() => {
                    onOpenAddCase();
                    setShowQuickMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                >
                  <Briefcase className="w-4 h-4 text-blue-600" />
                  قضية جديدة
                </button>
                <button
                  onClick={() => {
                    onOpenAddSession();
                    setShowQuickMenu(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors"
                >
                  <CalendarIcon className="w-4 h-4 text-amber-600" />
                  جلسة محكمة
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

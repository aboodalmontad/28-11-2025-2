import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Briefcase,
  Users,
  CalendarDays,
  CheckSquare,
  Receipt,
  FileText,
  Sparkles,
  Printer,
  History,
  Settings,
  Scale,
} from 'lucide-react';
import { useData } from '../context/DataContext';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, sessions, tasks, cases, clients } = useData();

  // Calculate badges
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySessionsCount = sessions.filter(
    s => s.sessionDate.startsWith(todayStr) && s.status === 'upcoming'
  ).length;
  const pendingTasksCount = tasks.filter(t => t.status !== 'completed').length;
  const activeCasesCount = cases.filter(c => c.status === 'active').length;

  const navItems = [
    {
      id: 'dashboard',
      label: 'الرئيسية والإحصائيات',
      icon: LayoutDashboard,
    },
    {
      id: 'sessions',
      label: 'رول الجلسات والمحاكم',
      icon: Calendar,
      badge: todaySessionsCount > 0 ? `${todaySessionsCount} اليوم` : undefined,
      badgeColor: 'bg-amber-500 text-white',
    },
    {
      id: 'cases',
      label: 'ملفات القضايا',
      icon: Briefcase,
      badge: activeCasesCount > 0 ? `${activeCasesCount}` : undefined,
    },
    {
      id: 'clients',
      label: 'دليل الموكلين',
      icon: Users,
      badge: clients.length > 0 ? `${clients.length}` : undefined,
    },
    {
      id: 'calendar',
      label: 'التقويم والمواعيد',
      icon: CalendarDays,
    },
    {
      id: 'tasks',
      label: 'المهام وإسناد الأعمال',
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? `${pendingTasksCount}` : undefined,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'accounting',
      label: 'المحاسبة والسندات',
      icon: Receipt,
    },
    {
      id: 'documents',
      label: 'الأرشيف والمستندات',
      icon: FileText,
    },
    {
      id: 'ai_assistant',
      label: 'المساعد القانوني الذكي',
      icon: Sparkles,
      highlight: true,
    },
    {
      id: 'reports',
      label: 'التقارير وسجل الرول',
      icon: Printer,
    },
    {
      id: 'logs',
      label: 'سجل العمليات والرقابة',
      icon: History,
    },
    {
      id: 'settings',
      label: 'إعدادات المكتب والنسخ',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col h-[calc(100vh-61px)] sticky top-[61px] select-none no-print">
      <div className="p-3 space-y-1 overflow-y-auto flex-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-xs transition-all duration-150 ${
                isActive
                  ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-700/20'
                  : item.highlight
                  ? 'bg-gradient-to-r from-purple-500/10 to-emerald-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-500/20'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-white'
                      : item.highlight
                      ? 'text-purple-600 dark:text-purple-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    item.badgeColor
                      ? item.badgeColor
                      : isActive
                      ? 'bg-emerald-700 text-white'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span>النظام متصل • حفظ محلي آمن</span>
        </div>
      </div>
    </aside>
  );
};

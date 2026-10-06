import React, { useState, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Calendar,
  AlertCircle,
  Clock,
  User,
  Trash2,
  CheckCircle2,
  Circle,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { CaseTask, TaskPriority } from '../types';
import { formatDateArabic } from '../utils/dateUtils';

interface TasksPageProps {
  onOpenAddTask: () => void;
}

export const TasksPage: React.FC<TasksPageProps> = ({ onOpenAddTask }) => {
  const { tasks, toggleTaskStatus, deleteTask, searchQuery } = useData();

  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchAssignee = t.assignedTo?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchAssignee) return false;
      }

      if (statusFilter === 'pending' && t.status === 'completed') return false;
      if (statusFilter === 'completed' && t.status !== 'completed') return false;

      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

      return true;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-600" />
            <span>المهام وإسناد الأعمال القانونية</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            متابعة صياغة المذكرات، استخراج الأحكام، مواعيد الطعون، وإسناد المهام للمساعدين
          </p>
        </div>

        <button
          onClick={onOpenAddTask}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          إسناد مهمة جديدة
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
        <div className="flex gap-1.5">
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === 'pending'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            مهام قيد الإنجاز ({tasks.filter(t => t.status !== 'completed').length})
          </button>
          <button
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === 'completed'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            المهام المنجزة ({tasks.filter(t => t.status === 'completed').length})
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === 'all'
                ? 'bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            الكل
          </button>
        </div>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-medium"
        >
          <option value="all">كل الأولويات</option>
          <option value="urgent">عاجل وطارئ</option>
          <option value="high">أولوية عالية</option>
          <option value="medium">أولوية متوسطة</option>
          <option value="low">أولوية عادية</option>
        </select>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            لا توجد مهام تطابق البحث والفلترة.
          </div>
        ) : (
          filteredTasks.map(task => {
            const isCompleted = task.status === 'completed';
            return (
              <div
                key={task.id}
                className={`p-4 rounded-2xl border transition-all flex items-start gap-4 ${
                  isCompleted
                    ? 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800/80 opacity-75'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300 shadow-sm'
                }`}
              >
                <button
                  onClick={() => toggleTaskStatus(task.id)}
                  className="mt-1 text-slate-400 hover:text-emerald-600 transition-colors"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h3
                      className={`text-sm font-bold ${
                        isCompleted
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {task.title}
                    </h3>

                    <div className="flex items-center gap-2">
                      {task.priority === 'urgent' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          عاجل جداً
                        </span>
                      )}
                      {task.priority === 'high' && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                          أولوية عالية
                        </span>
                      )}
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {task.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    {task.caseNumber && (
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        القضية: {task.caseNumber}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      المكلف: {task.assignedTo || 'المحامي'}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <Calendar className="w-3.5 h-3.5" />
                      تاريخ الاستحقاق: {formatDateArabic(task.dueDate)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

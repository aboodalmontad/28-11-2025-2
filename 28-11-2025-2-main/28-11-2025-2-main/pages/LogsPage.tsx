import React from 'react';
import { History, Shield, Clock, User } from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatDateArabic } from '../utils/dateUtils';

export const LogsPage: React.FC = () => {
  const { logs } = useData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <History className="w-5 h-5 text-emerald-600" />
          <span>سجل الرقابة والعمليات (Audit Trail)</span>
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          توثيق كافة الإجراءات والعمليات المنفذة على النظام لضمان الشفافية
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">لا توجد عمليات مسجلة.</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="p-4 flex items-start justify-between gap-4 text-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {log.action}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                        {log.entityType}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                      {log.details}
                    </p>
                  </div>
                </div>

                <div className="text-left text-slate-400 font-mono text-[11px] shrink-0">
                  <span className="block font-semibold text-slate-600 dark:text-slate-300">
                    {log.userName}
                  </span>
                  <span>{new Date(log.timestamp).toLocaleString('ar-SA')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

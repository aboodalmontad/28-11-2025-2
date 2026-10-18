import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Download,
  Trash2,
  Eye,
  FileCheck,
  ShieldAlert,
  Scale,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { CaseDocument, DocumentCategory } from '../types';
import { formatDateArabic } from '../utils/dateUtils';

interface DocumentsPageProps {
  onOpenAddDocument: () => void;
}

export const DocumentsPage: React.FC<DocumentsPageProps> = ({ onOpenAddDocument }) => {
  const { documents, deleteDocument, searchQuery, clients, cases } = useData();

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<CaseDocument | null>(null);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = doc.title.toLowerCase().includes(q);
        const matchFileName = doc.fileName.toLowerCase().includes(q);
        if (!matchTitle && !matchFileName) return false;
      }

      if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;

      return true;
    });
  }, [documents, searchQuery, categoryFilter]);

  const getCategoryBadge = (cat: DocumentCategory) => {
    switch (cat) {
      case 'power_of_attorney':
        return { label: 'وكالة شرعية', bg: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' };
      case 'petition':
        return { label: 'صحيفة دعوى', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' };
      case 'memo':
        return { label: 'مذكرة دفاع', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' };
      case 'judgment':
        return { label: 'صك حكم', bg: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' };
      case 'contract':
        return { label: 'عقد اتفاق', bg: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' };
      default:
        return { label: 'مستند قانوني', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            <span>الأرشيف والمستندات القانونية</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            حفظ الوكالات الشرعية، صحف الدعاوى، المذكرات الجوابية، والأحكام القضائية
          </p>
        </div>

        <button
          onClick={onOpenAddDocument}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          أرشفة مستند جديد
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        {[
          { id: 'all', label: 'كافة المستندات' },
          { id: 'power_of_attorney', label: 'الوكالات الشرعية' },
          { id: 'petition', label: 'صحف الدعاوى واللوائح' },
          { id: 'memo', label: 'مذكرات الدفاع' },
          { id: 'judgment', label: 'صكوك الأحكام' },
          { id: 'contract', label: 'العقود والاتفاقيات' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setCategoryFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              categoryFilter === tab.id
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            لا توجد مستندات مؤرشفة مطابقة للبحث.
          </div>
        ) : (
          filteredDocs.map(doc => {
            const badge = getCategoryBadge(doc.category);
            const linkedCase = cases.find(c => c.id === doc.caseId);
            const linkedClient = clients.find(c => c.id === doc.clientId);

            return (
              <div
                key={doc.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${badge.bg}`}>
                      {badge.label}
                    </span>
                    <span className="text-[11px] text-slate-400">{doc.fileSize || '300 KB'}</span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">
                    {doc.title}
                  </h3>

                  <p className="text-xs text-slate-500 font-mono mt-1 truncate">{doc.fileName}</p>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1 text-xs text-slate-500">
                    {linkedCase && (
                      <p>
                        القضية: <strong className="text-slate-700 dark:text-slate-300">{linkedCase.caseNumber}</strong>
                      </p>
                    )}
                    {linkedClient && (
                      <p>
                        الموكل: <strong className="text-slate-700 dark:text-slate-300">{linkedClient.name}</strong>
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400">
                      تاريخ الأرشفة: {formatDateArabic(doc.uploadDate)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5" />
                    مستند معتمد
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => deleteDocument(doc.id)}
                      title="حذف المستند"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

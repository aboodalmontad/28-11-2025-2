import React, { useState } from 'react';
import { X, FileText, Upload, Plus } from 'lucide-react';
import { CaseDocument, DocumentCategory, Client, Case } from '../types';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  cases: Case[];
  onAdd: (doc: Omit<CaseDocument, 'id' | 'uploadDate'>) => void;
}

export const AddDocumentModal: React.FC<AddDocumentModalProps> = ({
  isOpen,
  onClose,
  clients,
  cases,
  onAdd,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('power_of_attorney');
  const [clientId, setClientId] = useState('');
  const [caseId, setCaseId] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [fileData, setFileData] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      const sizeInMB = file.size / (1024 * 1024);
      setFileSize(sizeInMB < 1 ? `${Math.round(file.size / 1024)} KB` : `${sizeInMB.toFixed(1)} MB`);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFileData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    onAdd({
      title,
      category,
      clientId: clientId || undefined,
      caseId: caseId || undefined,
      fileName: fileName || `${title}.pdf`,
      fileSize: fileSize || '350 KB',
      fileType: 'application/pdf',
      fileData: fileData || undefined,
      notes: notes || undefined,
    });

    onClose();
  };

  const categories: { id: DocumentCategory; label: string }[] = [
    { id: 'power_of_attorney', label: 'وكالة شرعية / تفويض' },
    { id: 'petition', label: 'صحيفة دعوى / لائحة استئناف' },
    { id: 'memo', label: 'مذكرة دفاع / رد جوابي' },
    { id: 'judgment', label: 'صك حكم / قرار قضائي' },
    { id: 'contract', label: 'عقد / اتفاقية' },
    { id: 'evidence', label: 'حافظة مستندات وأدلة' },
    { id: 'other', label: 'مستند قانوني آخر' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-emerald-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-900/60 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">أرشفة مستند قانوني</h3>
              <p className="text-xs text-emerald-100">إضافة وثيقة أو صك إلى الأرشيف الإلكتروني</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-emerald-900/50 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* File Upload Box */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors bg-slate-50/50 dark:bg-slate-800/30">
            <input
              type="file"
              id="file-upload"
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full">
                <Upload className="w-6 h-6" />
              </div>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {fileName ? fileName : 'انقر لاختيار ملف من جهازك أو اسحبه هنا'}
              </span>
              <span className="text-xs text-slate-500">
                {fileSize ? `الحجم: ${fileSize}` : 'يدعم صيغ PDF، Word، والصور'}
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              عنوان المستند / المسمى الرسمي *
            </label>
            <input
              type="text"
              required
              placeholder="مثال: صك الوكالة الإلكترونية 1447"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              تصنيف الوثيقة *
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as DocumentCategory)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                الموكل المرتبط
              </label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
              >
                <option value="">-- اختياري --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                القضية المرتبطة
              </label>
              <select
                value={caseId}
                onChange={e => setCaseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
              >
                <option value="">-- اختياري --</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} - {c.clientName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              ملاحظات وتفاصيل المستند
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              حفظ في الأرشيف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

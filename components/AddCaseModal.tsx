import React, { useState } from 'react';
import { X, Briefcase, Plus } from 'lucide-react';
import { Case, Client, CaseStage, CaseStatus, ClientRole } from '../types';

interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  onAdd: (caseItem: Omit<Case, 'id' | 'createdAt'>) => void;
}

export const AddCaseModal: React.FC<AddCaseModalProps> = ({
  isOpen,
  onClose,
  clients,
  onAdd,
}) => {
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [caseNumber, setCaseNumber] = useState('');
  const [caseYear, setCaseYear] = useState('1447هـ');
  const [court, setCourt] = useState('المحكمة العامة');
  const [circuit, setCircuit] = useState('');
  const [caseType, setCaseType] = useState('دعوى حقوقية عامة');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [stage, setStage] = useState<CaseStage>('preliminary');
  const [status, setStatus] = useState<CaseStatus>('active');
  const [clientRole, setClientRole] = useState<ClientRole>('plaintiff');
  const [opponentName, setOpponentName] = useState('');
  const [opponentLawyer, setOpponentLawyer] = useState('');
  const [opponentPhone, setOpponentPhone] = useState('');
  const [filingDate, setFilingDate] = useState(new Date().toISOString().split('T')[0]);
  const [assignedLawyer, setAssignedLawyer] = useState('');
  const [feesTotal, setFeesTotal] = useState<number>(10000);
  const [feesPaid, setFeesPaid] = useState<number>(0);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseNumber || !clientId || !subject) return;

    const selectedClient = clients.find(c => c.id === clientId);

    onAdd({
      clientId,
      clientName: selectedClient ? selectedClient.name : 'موكل غير محدد',
      caseNumber,
      caseYear,
      court,
      circuit,
      caseType,
      subject,
      description,
      stage,
      status,
      clientRole,
      opponentName,
      opponentLawyer,
      opponentPhone,
      filingDate,
      assignedLawyer,
      feesTotal: Number(feesTotal) || 0,
      feesPaid: Number(feesPaid) || 0,
    });

    onClose();
  };

  const courtsList = [
    'المحكمة العامة بالرياض',
    'المحكمة التجارية بالرياض',
    'المحكمة العمالية بالرياض',
    'محكمة الأحوال الشخصية بالرياض',
    'المحكمة الجزائية بالرياض',
    'محكمة التنفيذ بالرياض',
    'محكمة الاستئناف',
    'المحكمة العليا',
    'ديوان المظالم (المحكمة الإدارية)',
    'اللجنة المصرفية والتمويلية',
    'لجنة الفصل في منازعات الأوراق المالية',
    'لجنة التأمين والمنازعات التمويلية',
    'أخرى',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-emerald-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-900/60 rounded-xl">
              <Briefcase className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">قيد ملف قضية جديدة</h3>
              <p className="text-xs text-emerald-100">تسجيل بيانات الدعوى والمحكمة والأطراف والأتعاب</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-emerald-900/50 rounded-lg transition-colors text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                الموكل صاحب القضية *
              </label>
              <select
                required
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.clientType === 'company' ? 'شركة' : 'فرد'})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                صفة الموكل في الدعوى
              </label>
              <select
                value={clientRole}
                onChange={e => setClientRole(e.target.value as ClientRole)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              >
                <option value="plaintiff">مدعي (صاحب الحق)</option>
                <option value="defendant">مدعى عليه</option>
                <option value="petitioner">مستأنف / طاعن</option>
                <option value="respondent">مستأنف ضده / مطعون ضده</option>
                <option value="third_party">طالب تنفيذ / منفذ ضده</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                رقم القضية *
              </label>
              <input
                type="text"
                required
                placeholder="مثال: 4491/1447"
                value={caseNumber}
                onChange={e => setCaseNumber(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                عام الدعوى
              </label>
              <input
                type="text"
                value={caseYear}
                onChange={e => setCaseYear(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تاريخ القيد / رفع الدعوى
              </label>
              <input
                type="date"
                value={filingDate}
                onChange={e => setFilingDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                المحكمة المختصة *
              </label>
              <select
                value={court}
                onChange={e => setCourt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              >
                {courtsList.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                الدائرة القضائية
              </label>
              <input
                type="text"
                placeholder="مثال: الدائرة التجارية الخامسة"
                value={circuit}
                onChange={e => setCircuit(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تصنيف / نوع الدعوى
              </label>
              <input
                type="text"
                placeholder="مثال: مطالبة مالية، نزاع عقاري، تركات"
                value={caseType}
                onChange={e => setCaseType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                المحامي المسؤول
              </label>
              <input
                type="text"
                placeholder="مثال: أ. محمد النحوي"
                value={assignedLawyer}
                onChange={e => setAssignedLawyer(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              موضوع الدعوى وطلباتها *
            </label>
            <textarea
              rows={2}
              required
              placeholder="المطالبة بإلزام المدعى عليه بسداد مبلغ..."
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm"
            />
          </div>

          <div className="p-4 bg-slate-100 dark:bg-slate-800/60 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">بيانات الخصم</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">اسم الخصم</label>
                <input
                  type="text"
                  placeholder="شركة ..."
                  value={opponentName}
                  onChange={e => setOpponentName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">محامي الخصم</label>
                <input
                  type="text"
                  placeholder="أ. ..."
                  value={opponentLawyer}
                  onChange={e => setOpponentLawyer(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">هاتف الخصم</label>
                <input
                  type="text"
                  placeholder="05..."
                  value={opponentPhone}
                  onChange={e => setOpponentPhone(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                إجمالي أتعاب القضية المتفق عليها
              </label>
              <input
                type="number"
                value={feesTotal}
                onChange={e => setFeesTotal(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                الدفعة المقدمة المدفوعة
              </label>
              <input
                type="number"
                value={feesPaid}
                onChange={e => setFeesPaid(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
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
              حفظ وقيد الدعوى
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

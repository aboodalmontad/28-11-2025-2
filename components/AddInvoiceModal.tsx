import React, { useState } from 'react';
import { X, Receipt, Plus, Trash2 } from 'lucide-react';
import { Invoice, Client, Case, InvoiceItem } from '../types';
import { generateId, generateInvoiceNumber } from '../utils/idUtils';

interface AddInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  cases: Case[];
  invoicesCount: number;
  currency: string;
  onAdd: (invoice: Omit<Invoice, 'id'>) => void;
}

export const AddInvoiceModal: React.FC<AddInvoiceModalProps> = ({
  isOpen,
  onClose,
  clients,
  cases,
  invoicesCount,
  currency,
  onAdd,
}) => {
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [caseId, setCaseId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [taxRate, setTaxRate] = useState<number>(15);
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: generateId(), description: 'أتعاب الترافع والدراسة القانونية', amount: 5000 },
  ]);
  const [notes, setNotes] = useState('شاملة ضريبة القيمة المضافة - واجبة السداد فور الاستلام');

  if (!isOpen) return null;

  const addItem = () => {
    setItems(prev => [...prev, { id: generateId(), description: '', amount: 0 }]);
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const updateItem = (id: string, field: 'description' | 'amount', value: any) => {
    setItems(prev =>
      prev.map(i => (i.id === id ? { ...i, [field]: field === 'amount' ? Number(value) : value } : i))
    );
  };

  const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const taxAmount = (subtotal * (Number(taxRate) || 0)) / 100;
  const totalAmount = subtotal + taxAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedClient = clients.find(c => c.id === clientId);
    if (!selectedClient || subtotal <= 0) return;

    onAdd({
      invoiceNumber: generateInvoiceNumber(invoicesCount),
      clientId,
      clientName: selectedClient.name,
      caseId: caseId || undefined,
      issueDate,
      dueDate,
      items,
      subtotal,
      taxRate,
      taxAmount,
      totalAmount,
      paidAmount: 0,
      status: 'unpaid',
      notes,
    });

    onClose();
  };

  const clientCases = cases.filter(c => c.clientId === clientId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-emerald-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-900/60 rounded-xl">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">إصدار فاتورة أتعاب ضريبية</h3>
              <p className="text-xs text-emerald-100">إنشاء فاتورة أتعاب قانونية مع حساب القيمة المضافة تلقائياً</p>
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
                الموكل *
              </label>
              <select
                required
                value={clientId}
                onChange={e => {
                  setClientId(e.target.value);
                  setCaseId('');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                القضية المرتبطة (اختياري)
              </label>
              <select
                value={caseId}
                onChange={e => setCaseId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 text-sm"
              >
                <option value="">-- فاتورة أتعاب عامة / استشارة --</option>
                {clientCases.map(c => (
                  <option key={c.id} value={c.id}>
                    قضية رقم {c.caseNumber} ({c.court})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تاريخ الإصدار
              </label>
              <input
                type="date"
                required
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تاريخ الاستحقاق
              </label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                نسبة الضريبة (VAT %)
              </label>
              <input
                type="number"
                value={taxRate}
                onChange={e => setTaxRate(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
              />
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200">بنود الأتعاب والخدمات</label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة بند آخر
              </button>
            </div>

            {items.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  placeholder={`وصف الخدمة / البند #${idx + 1}`}
                  value={item.description}
                  onChange={e => updateItem(item.id, 'description', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
                />
                <div className="w-36 flex items-center gap-1">
                  <input
                    type="number"
                    required
                    min={0}
                    placeholder="المبلغ"
                    value={item.amount}
                    onChange={e => updateItem(item.id, 'amount', e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-semibold text-left dir-ltr"
                  />
                  <span className="text-xs text-slate-500">{currency}</span>
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Calculations Summary */}
          <div className="bg-slate-100 dark:bg-slate-800/80 p-4 rounded-xl space-y-2 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>المجموع قبل الضريبة:</span>
              <span className="font-semibold">{subtotal.toLocaleString()} {currency}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>ضريبة القيمة المضافة ({taxRate}%):</span>
              <span className="font-semibold">{taxAmount.toLocaleString()} {currency}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-emerald-700 dark:text-emerald-400 border-t border-slate-200 dark:border-slate-700 pt-2">
              <span>الإجمالي المستحق:</span>
              <span>{totalAmount.toLocaleString()} {currency}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              شروط وملاحظات الفاتورة
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
              إصدار الفاتورة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

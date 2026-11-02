import React, { useState } from 'react';
import { X, CreditCard, Plus } from 'lucide-react';
import { FinancialTransaction, TransactionType, PaymentMethod, Client, Case, Invoice } from '../types';
import { generateReceiptNumber } from '../utils/idUtils';

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  clients: Client[];
  cases: Case[];
  invoices: Invoice[];
  transactionsCount: number;
  currency: string;
  onAdd: (tx: Omit<FinancialTransaction, 'id'>) => void;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  isOpen,
  onClose,
  clients,
  cases,
  invoices,
  transactionsCount,
  currency,
  onAdd,
}) => {
  const [type, setType] = useState<TransactionType>('income');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [caseId, setCaseId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState<number>(1000);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [category, setCategory] = useState(type === 'income' ? 'أتعاب محاماة' : 'رسوم قضائية وخبرة');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;

    const selectedClient = clients.find(c => c.id === clientId);

    onAdd({
      type,
      receiptNumber: generateReceiptNumber(transactionsCount, type),
      clientId: clientId || undefined,
      clientName: selectedClient?.name,
      caseId: caseId || undefined,
      invoiceId: invoiceId || undefined,
      date,
      amount: Number(amount),
      paymentMethod,
      category,
      referenceNumber: referenceNumber || undefined,
      notes: notes || undefined,
    });

    onClose();
  };

  const incomeCategories = ['أتعاب محاماة', 'أتعاب استشارة قانونية', 'أتعاب تحكيم', 'استرداد مصاريف قضائية', 'أخرى'];
  const expenseCategories = ['رسوم قضائية وتوثيق', 'أمانة خبير هندسي/محاسبي', 'مصاريف انتقال ومراجعات', 'أتعاب مكاتب معاونة', 'مصاريف إدارية وطباعة', 'أخرى'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-emerald-800 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-900/60 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">
                {type === 'income' ? 'إصدار سند قبض مالي' : 'تسجيل سند صرف ومصروفات'}
              </h3>
              <p className="text-xs text-emerald-100">سند رسمي معتمد للحركات المالية</p>
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
          {/* Transaction Type */}
          <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setType('income');
                setCategory('أتعاب محاماة');
              }}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              📥 سند قبض (إيراد / أتعاب)
            </button>
            <button
              type="button"
              onClick={() => {
                setType('expense');
                setCategory('رسوم قضائية وتوثيق');
              }}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              📤 سند صرف (مصروف قضائي)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                المبلغ * ({currency})
              </label>
              <input
                type="number"
                required
                min={1}
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-bold text-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تاريخ السند *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                طريقة الدفع
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
              >
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="cash">نقداً (كاش)</option>
                <option value="card">شبكة / بطاقة مدى</option>
                <option value="check">شيك مصرفي</option>
                <option value="online">سداد إلكتروني</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                تصنيف السند
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
              >
                {(type === 'income' ? incomeCategories : expenseCategories).map(cat => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                الموكل
              </label>
              <select
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
              >
                <option value="">-- غير محدد --</option>
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
                <option value="">-- غير مرتبطة بقضية --</option>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} - {c.clientName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {type === 'income' && invoices.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ربط بسداد فاتورة محددة (اختياري)
              </label>
              <select
                value={invoiceId}
                onChange={e => setInvoiceId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
              >
                <option value="">-- سداد مباشر بدون فاتورة --</option>
                {invoices.filter(i => i.status !== 'paid').map(inv => (
                  <option key={inv.id} value={inv.id}>
                    فاتورة {inv.invoiceNumber} للموكل ({inv.clientName}) - المتبقي: {(inv.totalAmount - (inv.paidAmount || 0)).toLocaleString()} {currency}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              رقم الحوالة / الشيك / العملية البنكية
            </label>
            <input
              type="text"
              placeholder="مثال: TRX-883921"
              value={referenceNumber}
              onChange={e => setReferenceNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              البيان / تفاصيل السند
            </label>
            <textarea
              rows={2}
              placeholder="شرح وتفاصيل السند..."
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
              حفظ السند المالي
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

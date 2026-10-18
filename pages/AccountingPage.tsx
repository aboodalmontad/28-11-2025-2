import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  Trash2,
  FileText,
  Send,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { Invoice, FinancialTransaction } from '../types';
import { formatDateArabic } from '../utils/dateUtils';
import { triggerPrint } from '../utils/printUtils';

interface AccountingPageProps {
  onOpenAddInvoice: () => void;
  onOpenAddTransaction: () => void;
  onOpenWhatsAppInvoice: (invoice: Invoice) => void;
}

export const AccountingPage: React.FC<AccountingPageProps> = ({
  onOpenAddInvoice,
  onOpenAddTransaction,
  onOpenWhatsAppInvoice,
}) => {
  const { invoices, transactions, deleteInvoice, deleteTransaction, settings, searchQuery } = useData();

  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'transactions'>('invoices');

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const netIncome = totalIncome - totalExpenses;

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.clientName.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [invoices, searchQuery]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          t.receiptNumber.toLowerCase().includes(q) ||
          t.clientName?.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [transactions, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <span>المحاسبة القانونية والفواتير</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            إصدار فواتير الأتعاب الضريبية، سندات القبض والصرف، ومتابعة التحصيل
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAddTransaction}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 shadow-sm"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            سند قبض / صرف
          </button>

          <button
            onClick={onOpenAddInvoice}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
          >
            <Plus className="w-4 h-4" />
            إصدار فاتورة أتعاب
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs text-slate-500 block">إجمالي الفواتير الصادرة</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-900 dark:text-slate-100">
              {totalInvoiced.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">{settings.currency}</span>
          </div>
        </div>

        {/* Total Income */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">إجمالي المقبوضات (إيرادات)</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
              {totalIncome.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">{settings.currency}</span>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">إجمالي المصروفات القضائية</span>
            <ArrowUpRight className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-rose-600 dark:text-rose-400">
              {totalExpenses.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400">{settings.currency}</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 shadow-sm">
          <span className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold block">صافي الإيراد الفعلي</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-black text-emerald-700 dark:text-emerald-300">
              {netIncome.toLocaleString()}
            </span>
            <span className="text-xs text-emerald-600">{settings.currency}</span>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab('invoices')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'invoices'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          فواتير الأتعاب ({invoices.length})
        </button>
        <button
          onClick={() => setActiveSubTab('transactions')}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            activeSubTab === 'transactions'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          سندات القبض والصرف ({transactions.length})
        </button>
      </div>

      {/* Invoices Table */}
      {activeSubTab === 'invoices' ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold">
                  <th className="py-3 px-4">رقم الفاتورة</th>
                  <th className="py-3 px-4">الموكل</th>
                  <th className="py-3 px-4">تاريخ الإصدار</th>
                  <th className="py-3 px-4">المبلغ الإجمالي</th>
                  <th className="py-3 px-4">المدفوع</th>
                  <th className="py-3 px-4">المتبقي</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      لا توجد فواتير مسجلة.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => {
                    const remaining = inv.totalAmount - (inv.paidAmount || 0);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                          {inv.clientName}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {formatDateArabic(inv.issueDate)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                          {inv.totalAmount.toLocaleString()} {settings.currency}
                        </td>
                        <td className="py-3.5 px-4 text-emerald-600 font-semibold">
                          {(inv.paidAmount || 0).toLocaleString()} {settings.currency}
                        </td>
                        <td className="py-3.5 px-4 text-rose-600 font-semibold">
                          {remaining.toLocaleString()} {settings.currency}
                        </td>
                        <td className="py-3.5 px-4">
                          {inv.status === 'paid' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              مدفوعة بالكامل
                            </span>
                          )}
                          {inv.status === 'partial' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                              سداد جزئي
                            </span>
                          )}
                          {inv.status === 'unpaid' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                              غير مدفوعة
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => onOpenWhatsAppInvoice(inv)}
                              title="إرسال تذكير بالواتساب"
                              className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteInvoice(inv.id)}
                              title="حذف الفاتورة"
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Transactions Table */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold">
                  <th className="py-3 px-4">رقم السند</th>
                  <th className="py-3 px-4">النوع</th>
                  <th className="py-3 px-4">الموكل / المستفيد</th>
                  <th className="py-3 px-4">التصنيف</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4">المبلغ</th>
                  <th className="py-3 px-4">طريقة الدفع</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      لا توجد حركات مالية مسجلة.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {tx.receiptNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        {tx.type === 'income' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            سند قبض 📥
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                            سند صرف 📤
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-slate-200">
                        {tx.clientName || 'عام'}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{tx.category}</td>
                      <td className="py-3.5 px-4 text-slate-500">{formatDateArabic(tx.date)}</td>
                      <td
                        className={`py-3.5 px-4 font-bold ${
                          tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {tx.amount.toLocaleString()} {settings.currency}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {tx.paymentMethod === 'bank_transfer'
                          ? 'تحويل بنكي'
                          : tx.paymentMethod === 'cash'
                          ? 'نقدي'
                          : tx.paymentMethod === 'card'
                          ? 'شبكة'
                          : 'أخرى'}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => deleteTransaction(tx.id)}
                            title="حذف السند"
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

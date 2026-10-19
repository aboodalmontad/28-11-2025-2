import React, { useState } from 'react';
import {
  Printer,
  Calendar,
  Users,
  Briefcase,
  DollarSign,
  FileCheck,
  Download,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { formatDateArabic, formatHijriDate } from '../utils/dateUtils';
import { triggerPrint } from '../utils/printUtils';

export const ReportsPage: React.FC = () => {
  const { sessions, cases, clients, invoices, transactions, settings } = useData();

  const [reportType, setReportType] = useState<'sessions_roll' | 'client_statement' | 'financial_summary'>('sessions_roll');
  const [selectedClientId, setSelectedClientId] = useState<string>(clients[0]?.id || '');

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter(s => s.sessionDate === todayStr);

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const clientCases = cases.filter(c => c.clientId === selectedClientId);
  const clientInvoices = invoices.filter(i => i.clientId === selectedClientId);
  const clientTransactions = transactions.filter(t => t.clientId === selectedClientId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-600" />
            <span>التقارير وسجل الرول القضائي للطباعة</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            توليد كشوفات رسمية مطبوعة ومجهزة برأس وتذييل المكتب
          </p>
        </div>

        <button
          onClick={() => triggerPrint()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md transition-all self-start sm:self-auto"
        >
          <Printer className="w-4 h-4" />
          طباعة التقرير المعروض (Ctrl+P)
        </button>
      </div>

      {/* Report Selector Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit no-print">
        <button
          onClick={() => setReportType('sessions_roll')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            reportType === 'sessions_roll'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          📋 رول الجلسات والمحاكم اليومي
        </button>
        <button
          onClick={() => setReportType('client_statement')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            reportType === 'client_statement'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          📑 كشف حساب وبيانات موكل
        </button>
        <button
          onClick={() => setReportType('financial_summary')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            reportType === 'financial_summary'
              ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          💰 تقرير الإيرادات والتحصيل المالي
        </button>
      </div>

      {reportType === 'client_statement' && (
        <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 no-print">
          <label className="block text-xs font-bold mb-1">اختر الموكل لإصدار كشف الحساب:</label>
          <select
            value={selectedClientId}
            onChange={e => setSelectedClientId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm max-w-md w-full"
          >
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Printable Sheet View */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-slate-900 dark:text-slate-100 min-h-[600px] printable-area">
        {/* Official Header */}
        <div className="border-b-2 border-emerald-800 pb-4 mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-emerald-900 dark:text-emerald-400">
              {settings.officeName}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold mt-1">
              {settings.lawyerName} • {settings.lawyerTitle}
            </p>
            <p className="text-[11px] text-slate-500">
              ترخيص رقم: {settings.barNumber} • الرقم الضريبي: {settings.taxNumber}
            </p>
          </div>

          <div className="text-left text-xs text-slate-500 font-mono">
            <p>التاريخ: {formatDateArabic(todayStr)}</p>
            <p>الموافق: {formatHijriDate(todayStr)}</p>
          </div>
        </div>

        {/* SESSIONS ROLL REPORT */}
        {reportType === 'sessions_roll' && (
          <div className="space-y-4">
            <div className="text-center py-2 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
              <h2 className="text-base font-black">رول الجلسات القضائية - اليوم</h2>
            </div>

            <table className="w-full text-right border-collapse text-xs border border-slate-300 dark:border-slate-700">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-300 dark:border-slate-700">
                  <th className="p-2.5 border">رقم القضية</th>
                  <th className="p-2.5 border">المحكمة والدائرة</th>
                  <th className="p-2.5 border">الموكل</th>
                  <th className="p-2.5 border">الوقت والقاعة</th>
                  <th className="p-2.5 border">نوع الجلسة والمطلوب</th>
                  <th className="p-2.5 border">قرار الجلسة</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-400">
                      لا توجد جلسات مسجلة.
                    </td>
                  </tr>
                ) : (
                  sessions.map(s => (
                    <tr key={s.id} className="border-b border-slate-200 dark:border-slate-800">
                      <td className="p-2.5 border font-bold">{s.caseNumber}</td>
                      <td className="p-2.5 border">
                        {s.court} {s.circuit && `- ${s.circuit}`}
                      </td>
                      <td className="p-2.5 border">{s.clientName}</td>
                      <td className="p-2.5 border">
                        {s.sessionTime || '09:00 ص'} ({s.hall || 'عن بعد'})
                      </td>
                      <td className="p-2.5 border">
                        <span className="font-semibold">{s.sessionType}</span>
                        {s.requirements && <p className="text-[11px] text-amber-700">المطلوب: {s.requirements}</p>}
                      </td>
                      <td className="p-2.5 border">{s.decision || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* CLIENT STATEMENT */}
        {reportType === 'client_statement' && selectedClient && (
          <div className="space-y-4">
            <div className="text-center py-2 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
              <h2 className="text-base font-black">كشف حساب وبيان قضايا الموكل</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs mb-4">
              <div>
                <p>
                  <strong>اسم الموكل:</strong> {selectedClient.name}
                </p>
                <p className="mt-1">
                  <strong>رقم الهوية / السجل:</strong> {selectedClient.nationalId || '-'}
                </p>
              </div>
              <div>
                <p>
                  <strong>رقم الهاتف:</strong> {selectedClient.phone}
                </p>
                <p className="mt-1">
                  <strong>العنوان:</strong> {selectedClient.address || '-'}
                </p>
              </div>
            </div>

            <h3 className="font-bold text-xs">قضايا الموكل:</h3>
            <table className="w-full text-right border-collapse text-xs border border-slate-300 dark:border-slate-700 mb-6">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-300">
                  <th className="p-2 border">رقم القضية</th>
                  <th className="p-2 border">المحكمة</th>
                  <th className="p-2 border">موضوع الدعوى</th>
                  <th className="p-2 border">الأتعاب المتفق عليها</th>
                  <th className="p-2 border">المدفوع</th>
                  <th className="p-2 border">المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {clientCases.map(c => (
                  <tr key={c.id} className="border-b border-slate-200">
                    <td className="p-2 border font-bold">{c.caseNumber}</td>
                    <td className="p-2 border">{c.court}</td>
                    <td className="p-2 border">{c.subject}</td>
                    <td className="p-2 border">{c.feesTotal.toLocaleString()} {settings.currency}</td>
                    <td className="p-2 border text-emerald-600">{(c.feesPaid || 0).toLocaleString()} {settings.currency}</td>
                    <td className="p-2 border text-rose-600">{(c.feesTotal - (c.feesPaid || 0)).toLocaleString()} {settings.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* FINANCIAL SUMMARY */}
        {reportType === 'financial_summary' && (
          <div className="space-y-4">
            <div className="text-center py-2 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
              <h2 className="text-base font-black">تقرير الموقف المالي وحركة الخزينة</h2>
            </div>

            <table className="w-full text-right border-collapse text-xs border border-slate-300 dark:border-slate-700">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-300">
                  <th className="p-2 border">رقم السند</th>
                  <th className="p-2 border">النوع</th>
                  <th className="p-2 border">الموكل / الحساب</th>
                  <th className="p-2 border">التصنيف</th>
                  <th className="p-2 border">التاريخ</th>
                  <th className="p-2 border">المبلغ ({settings.currency})</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(t => (
                  <tr key={t.id} className="border-b border-slate-200">
                    <td className="p-2 border font-mono font-bold">{t.receiptNumber}</td>
                    <td className="p-2 border">{t.type === 'income' ? 'قبض 📥' : 'صرف 📤'}</td>
                    <td className="p-2 border">{t.clientName || 'عام'}</td>
                    <td className="p-2 border">{t.category}</td>
                    <td className="p-2 border">{formatDateArabic(t.date)}</td>
                    <td className={`p-2 border font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Official Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs text-slate-500">
          <span>{settings.footerText}</span>
          <span>توقيع وختم المحامي: ____________________</span>
        </div>
      </div>
    </div>
  );
};

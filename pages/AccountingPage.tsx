
import * as React from 'react';
import { AccountingEntry, Client, Invoice, InvoiceItem, Case, Stage, Session } from '../types';
import { format_date, to_input_date_string, parse_input_date_string, safe_revive_date } from '../utils/dateUtils';
import { PlusIcon, PencilIcon, TrashIcon, SearchIcon, ExclamationTriangleIcon, PrintIcon, DocumentTextIcon, CalculatorIcon, ChartPieIcon } from '../components/icons';
import { useData } from '../context/DataContext';
import PrintableInvoice from '../components/PrintableInvoice';
import { printElement } from '../utils/printUtils';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- TAB: ENTRIES ---
const EntriesTab: React.FC = () => {
    const { accounting_entries, set_accounting_entries, clients, delete_accounting_entry, permissions, effective_user_id } = useData();
    const [modal, set_modal] = React.useState<{ is_open: boolean; data?: AccountingEntry }>({ is_open: false });
    const [form_data, set_form_data] = React.useState<Partial<AccountingEntry>>({});
    const [search_query, set_search_query] = React.useState('');
    const [is_delete_modal_open, set_is_delete_modal_open] = React.useState(false);
    const [entry_to_delete, set_entry_to_delete] = React.useState<AccountingEntry | null>(null);

    const financial_summary = React.useMemo(() => {
        const total_income = accounting_entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        const total_expenses = accounting_entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
        return { total_income, total_expenses, balance: total_income - total_expenses };
    }, [accounting_entries]);

    const filtered_and_sorted_entries = React.useMemo(() => {
        const filtered = accounting_entries.filter(entry => {
            if (!search_query) return true;
            const lowercased_query = search_query.toLowerCase();
            return (
                entry.description.toLowerCase().includes(lowercased_query) ||
                entry.client_name.toLowerCase().includes(lowercased_query) ||
                entry.amount.toString().includes(search_query)
            );
        });
        return filtered.sort((a, b) => safe_revive_date(b.date).getTime() - safe_revive_date(a.date).getTime());
    }, [accounting_entries, search_query]);

    const table_totals = React.useMemo(() => {
        return filtered_and_sorted_entries.reduce((acc, entry) => {
            if (entry.type === 'income') acc.income += entry.amount;
            else acc.expense += entry.amount;
            return acc;
        }, { income: 0, expense: 0 });
    }, [filtered_and_sorted_entries]);

    const handle_open_modal = (entry?: AccountingEntry) => {
        set_form_data(entry ? { ...entry, date: to_input_date_string(entry.date) as unknown as any } : { type: 'income', date: to_input_date_string(new Date()) as unknown as any });
        set_modal({ is_open: true, data: entry });
    };

    const handle_close_modal = () => set_modal({ is_open: false });

    const handle_form_change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        set_form_data(prev => ({ ...prev, [name]: name === 'amount' ? parseFloat(value) : value }));
    };

    const handle_client_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const client_id = e.target.value;
        const client = clients.find(c => c.id === client_id);
        set_form_data(prev => ({ ...prev, client_id, client_name: client?.name || '', case_id: '' }));
    };

    const handle_submit = (e: React.FormEvent) => {
        e.preventDefault();
        const entry_data: Omit<AccountingEntry, 'id'> = {
            type: form_data.type as 'income' | 'expense',
            amount: Number(form_data.amount),
            date: form_data.date!,
            description: form_data.description!,
            client_id: form_data.client_id || '',
            case_id: form_data.case_id || '',
            client_name: form_data.client_name || '',
            updated_at: new Date().toISOString(),
            user_id: effective_user_id
        };

        if (modal.data) {
            set_accounting_entries(prev => prev.map(item => item.id === modal.data!.id ? { ...item, ...entry_data } : item));
        } else {
            set_accounting_entries(prev => [...prev, { ...entry_data, id: `acc-${Date.now()}` }]);
        }
        handle_close_modal();
    };

    const confirm_delete = (entry: AccountingEntry) => {
        set_entry_to_delete(entry);
        set_is_delete_modal_open(true);
    };

    const handle_delete = () => {
        if (entry_to_delete) {
            delete_accounting_entry(entry_to_delete.id);
            set_is_delete_modal_open(false);
            set_entry_to_delete(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-green-100 p-4 rounded-lg shadow-sm border border-green-200">
                    <h3 className="text-green-800 font-semibold">إجمالي المقبوضات</h3>
                    <p className="text-2xl font-bold text-green-900">{financial_summary.total_income.toLocaleString()} ل.س</p>
                </div>
                <div className="bg-red-100 p-4 rounded-lg shadow-sm border border-red-200">
                    <h3 className="text-red-800 font-semibold">إجمالي المصروفات</h3>
                    <p className="text-2xl font-bold text-red-900">{financial_summary.total_expenses.toLocaleString()} ل.س</p>
                </div>
                <div className="bg-blue-100 p-4 rounded-lg shadow-sm border border-blue-200">
                    <h3 className="text-blue-800 font-semibold">الرصيد الصافي</h3>
                    <p className="text-2xl font-bold text-blue-900">{financial_summary.balance.toLocaleString()} ل.س</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4">
                    <div className="relative w-full sm:w-64">
                        <input type="search" placeholder="بحث في القيود..." value={search_query} onChange={(e) => set_search_query(e.target.value)} className="w-full p-2 ps-10 border rounded-lg bg-gray-50 focus:ring-blue-500" />
                        <SearchIcon className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                    </div>
                    {permissions.can_add_financial_entry && (
                        <button onClick={() => handle_open_modal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                            <PlusIcon className="w-5 h-5" /> <span>قيد جديد</span>
                        </button>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right text-gray-600">
                        <thead className="bg-gray-100 text-gray-700 font-semibold">
                            <tr>
                                <th className="px-4 py-3">التاريخ</th>
                                <th className="px-4 py-3">البيان</th>
                                <th className="px-4 py-3">الموكل</th>
                                <th className="px-4 py-3 text-green-600">مقبوضات</th>
                                <th className="px-4 py-3 text-red-600">مدفوعات</th>
                                <th className="px-4 py-3">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered_and_sorted_entries.map(entry => (
                                <tr key={entry.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3">{format_date(entry.date)}</td>
                                    <td className="px-4 py-3">{entry.description}</td>
                                    <td className="px-4 py-3">{entry.client_name || '-'}</td>
                                    <td className="px-4 py-3 font-bold text-green-600">
                                        {entry.type === 'income' ? entry.amount.toLocaleString() : '-'}
                                    </td>
                                    <td className="px-4 py-3 font-bold text-red-600">
                                        {entry.type === 'expense' ? entry.amount.toLocaleString() : '-'}
                                    </td>
                                    <td className="px-4 py-3 flex gap-2">
                                        <button onClick={() => handle_open_modal(entry)} className="p-1 text-gray-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>
                                        {permissions.can_delete_financial_entry && <button onClick={() => confirm_delete(entry)} className="p-1 text-gray-500 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>}
                                    </td>
                                </tr>
                            ))}
                            {filtered_and_sorted_entries.length === 0 && <tr><td colSpan={6} className="text-center p-4">لا توجد قيود.</td></tr>}
                        </tbody>
                        <tfoot className="bg-gray-100 font-bold">
                            <tr>
                                <td colSpan={3} className="px-4 py-3 text-left">الإجمالي</td>
                                <td className="px-4 py-3 text-green-700">{table_totals.income.toLocaleString()}</td>
                                <td className="px-4 py-3 text-red-700">{table_totals.expense.toLocaleString()}</td>
                                <td className="px-4 py-3 text-blue-800">الفرق: {(table_totals.income - table_totals.expense).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {modal.is_open && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={handle_close_modal}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4">{modal.data ? 'تعديل قيد' : 'إضافة قيد جديد'}</h2>
                        <form onSubmit={handle_submit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium">النوع</label><select name="type" value={form_data.type || 'income'} onChange={handle_form_change} className="w-full p-2 border rounded"><option value="income">مقبوضات</option><option value="expense">مصروفات</option></select></div>
                                <div><label className="block text-sm font-medium">التاريخ</label><input type="date" name="date" value={(form_data.date as any) || ''} onChange={handle_form_change} className="w-full p-2 border rounded" required /></div>
                            </div>
                            <div><label className="block text-sm font-medium">المبلغ</label><input type="number" name="amount" value={form_data.amount || ''} onChange={handle_form_change} className="w-full p-2 border rounded" required /></div>
                            <div><label className="block text-sm font-medium">البيان</label><input type="text" name="description" value={form_data.description || ''} onChange={handle_form_change} className="w-full p-2 border rounded" required /></div>
                            <div><label className="block text-sm font-medium">الموكل (اختياري)</label><select name="client_id" value={form_data.client_id || ''} onChange={handle_client_change} className="w-full p-2 border rounded"><option value="">-- عام --</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                            <div className="flex justify-end gap-4 mt-6"><button type="button" onClick={handle_close_modal} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">حفظ</button></div>
                        </form>
                    </div>
                </div>
            )}
            
            {is_delete_modal_open && entry_to_delete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => set_is_delete_modal_open(false)}>
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
                            <h3 className="text-lg font-bold mb-2">تأكيد الحذف</h3>
                            <p className="text-gray-600 mb-6">هل أنت متأكد من حذف القيد "{entry_to_delete.description}"؟</p>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => set_is_delete_modal_open(false)} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button>
                                <button onClick={handle_delete} className="px-4 py-2 bg-red-600 text-white rounded">حذف</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- TAB: INVOICES ---
const InvoicesTab: React.FC<{ initial_invoice_data?: { client_id: string, case_id?: string }, clear_initial_invoice_data: () => void }> = ({ initial_invoice_data, clear_initial_invoice_data }) => {
    const { invoices, set_invoices, clients, delete_invoice, permissions } = useData();
    const [modal, set_modal] = React.useState<{ is_open: boolean; data?: Invoice }>({ is_open: false });
    const [is_print_modal_open, set_is_print_modal_open] = React.useState(false);
    const [invoice_to_print, set_invoice_to_print] = React.useState<Invoice | null>(null);
    const invoice_print_ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (initial_invoice_data) {
            const client = clients.find(c => c.id === initial_invoice_data.client_id);
            const case_item = client?.cases.find(c => c.id === initial_invoice_data.case_id);
            const new_invoice: Partial<Invoice> = {
                client_id: initial_invoice_data.client_id,
                client_name: client?.name || '',
                case_id: initial_invoice_data.case_id,
                case_subject: case_item?.subject,
                issue_date: to_input_date_string(new Date()),
                due_date: to_input_date_string(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // +1 week
                items: [{ id: `item-${Date.now()}`, description: 'أتعاب محاماة', amount: 0 }],
                tax_rate: 0,
                discount: 0,
                status: 'draft'
            };
            // @ts-ignore
            set_modal({ is_open: true, data: new_invoice }); 
            clear_initial_invoice_data();
        }
    }, [initial_invoice_data, clients, clear_initial_invoice_data]);

    const handle_save_invoice = (invoice: Invoice) => {
        if (modal.data && modal.data.id) {
            set_invoices(prev => prev.map(inv => inv.id === invoice.id ? invoice : inv));
        } else {
            set_invoices(prev => [...prev, invoice]);
        }
        set_modal({ is_open: false });
    };

    const handle_delete_invoice = (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
            delete_invoice(id);
        }
    };

    const handle_print_invoice = (invoice: Invoice) => {
        set_invoice_to_print(invoice);
        set_is_print_modal_open(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow">
                <h2 className="text-xl font-bold text-gray-800">سجل الفواتير</h2>
                {permissions.can_manage_invoices && (
                    <button onClick={() => set_modal({ is_open: true })} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">
                        <PlusIcon className="w-5 h-5" /> <span>فاتورة جديدة</span>
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {invoices.length > 0 ? invoices.map(inv => (
                    <div key={inv.id} className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-lg">{inv.client_name}</h3>
                            <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                inv.status === 'paid' ? 'bg-green-100 text-green-800' :
                                inv.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                                inv.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>{inv.status === 'paid' ? 'مدفوعة' : inv.status === 'sent' ? 'مرسلة' : inv.status === 'overdue' ? 'متأخرة' : 'مسودة'}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">رقم: {inv.id}</p>
                        <p className="text-sm text-gray-600 mb-2">تاريخ: {format_date(inv.issue_date)}</p>
                        <div className="border-t pt-2 mt-2 flex justify-between items-center">
                            <span className="font-bold text-lg text-blue-900">
                                {(inv.items.reduce((s, i) => s + i.amount, 0) + (inv.items.reduce((s, i) => s + i.amount, 0) * inv.tax_rate / 100) - inv.discount).toLocaleString()} ل.س
                            </span>
                            <div className="flex gap-1">
                                <button onClick={() => handle_print_invoice(inv)} className="p-2 text-gray-500 hover:text-green-600" title="طباعة"><PrintIcon className="w-4 h-4" /></button>
                                {permissions.can_manage_invoices && <button onClick={() => set_modal({ is_open: true, data: inv })} className="p-2 text-gray-500 hover:text-blue-600" title="تعديل"><PencilIcon className="w-4 h-4" /></button>}
                                {permissions.can_manage_invoices && <button onClick={() => handle_delete_invoice(inv.id)} className="p-2 text-gray-500 hover:text-red-600" title="حذف"><TrashIcon className="w-4 h-4" /></button>}
                            </div>
                        </div>
                    </div>
                )) : (
                    <div className="col-span-full text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">لا توجد فواتير مسجلة.</div>
                )}
            </div>

            {modal.is_open && (
                <InvoiceModal 
                    is_open={modal.is_open} 
                    on_close={() => set_modal({ is_open: false })} 
                    initial_data={modal.data} 
                    on_save={handle_save_invoice} 
                    clients={clients}
                />
            )}

            {is_print_modal_open && invoice_to_print && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]" onClick={() => set_is_print_modal_open(false)}>
                    <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="overflow-y-auto flex-grow" ref={invoice_print_ref}>
                            <PrintableInvoice invoice={invoice_to_print} />
                        </div>
                        <div className="mt-4 pt-4 border-t flex justify-end gap-4">
                            <button onClick={() => set_is_print_modal_open(false)} className="px-6 py-2 bg-gray-200 rounded-lg">إغلاق</button>
                            <button onClick={() => printElement(invoice_print_ref.current)} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg"><PrintIcon className="w-5 h-5"/> طباعة</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- INVOICE MODAL ---
const InvoiceModal: React.FC<{ is_open: boolean; on_close: () => void; initial_data?: Partial<Invoice>; on_save: (inv: Invoice) => void; clients: Client[] }> = ({ is_open, on_close, initial_data, on_save, clients }) => {
    const { effective_user_id } = useData();
    const [form_data, set_form_data] = React.useState<Partial<Invoice>>({
        items: [{ id: `item-${Date.now()}`, description: '', amount: 0 }],
        tax_rate: 0,
        discount: 0,
        status: 'draft',
        issue_date: to_input_date_string(new Date()),
        due_date: to_input_date_string(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
    });

    React.useEffect(() => {
        if (initial_data) {
            set_form_data({ 
                ...initial_data, 
                issue_date: initial_data.issue_date || to_input_date_string(new Date()), 
                due_date: initial_data.due_date || to_input_date_string(new Date()) 
            });
        }
    }, [initial_data]);

    const handle_client_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const client_id = e.target.value;
        const client = clients.find(c => c.id === client_id);
        set_form_data(prev => ({ ...prev, client_id, client_name: client?.name || '', case_id: undefined, case_subject: undefined }));
    };

    const handle_case_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const case_id = e.target.value;
        const client = clients.find(c => c.id === form_data.client_id);
        const case_item = client?.cases.find(c => c.id === case_id);
        set_form_data(prev => ({ ...prev, case_id, case_subject: case_item?.subject }));
    };

    const handle_item_change = (index: number, field: keyof InvoiceItem, value: any) => {
        const new_items = [...(form_data.items || [])];
        new_items[index] = { ...new_items[index], [field]: value };
        set_form_data(prev => ({ ...prev, items: new_items }));
    };

    const add_item = () => set_form_data(prev => ({ ...prev, items: [...(prev.items || []), { id: `item-${Date.now()}`, description: '', amount: 0 }] }));
    const remove_item = (index: number) => set_form_data(prev => ({ ...prev, items: prev.items?.filter((_, i) => i !== index) }));

    const handle_submit = (e: React.FormEvent) => {
        e.preventDefault();
        const invoice: Invoice = {
            ...form_data as Invoice,
            id: form_data.id || `INV-${new Date().getFullYear()}-${Math.floor(Math.random() * 10000)}`,
            updated_at: new Date().toISOString(),
            user_id: effective_user_id
        };
        on_save(invoice);
    };

    const subtotal = (form_data.items || []).reduce((sum, item) => sum + Number(item.amount), 0);
    const total = subtotal + (subtotal * (form_data.tax_rate || 0) / 100) - (form_data.discount || 0);

    if (!is_open) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={on_close}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{initial_data?.id ? 'تعديل فاتورة' : 'إنشاء فاتورة جديدة'}</h2>
                <form onSubmit={handle_submit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">الموكل</label>
                            <select value={form_data.client_id || ''} onChange={handle_client_change} className="w-full p-2 border rounded" required>
                                <option value="">اختر موكل...</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">القضية (اختياري)</label>
                            <select value={form_data.case_id || ''} onChange={handle_case_change} className="w-full p-2 border rounded" disabled={!form_data.client_id}>
                                <option value="">-- عام --</option>
                                {clients.find(c => c.id === form_data.client_id)?.cases.map(cs => <option key={cs.id} value={cs.id}>{cs.subject}</option>)}
                            </select>
                        </div>
                        <div><label className="block text-sm font-medium">تاريخ الإصدار</label><input type="date" value={to_input_date_string(form_data.issue_date)} onChange={e => set_form_data({...form_data, issue_date: e.target.value})} className="w-full p-2 border rounded" required /></div>
                        <div><label className="block text-sm font-medium">تاريخ الاستحقاق</label><input type="date" value={to_input_date_string(form_data.due_date)} onChange={e => set_form_data({...form_data, due_date: e.target.value})} className="w-full p-2 border rounded" required /></div>
                    </div>

                    <div className="border-t pt-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold">بنود الفاتورة</h3>
                            <button type="button" onClick={add_item} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"><PlusIcon className="w-4 h-4"/> إضافة بند</button>
                        </div>
                        {form_data.items?.map((item, index) => (
                            <div key={item.id} className="flex gap-2 mb-2 items-center">
                                <input type="text" placeholder="البيان" value={item.description} onChange={e => handle_item_change(index, 'description', e.target.value)} className="flex-grow p-2 border rounded text-sm" required />
                                <input type="number" placeholder="المبلغ" value={item.amount} onChange={e => handle_item_change(index, 'amount', Number(e.target.value))} className="w-24 p-2 border rounded text-sm" required />
                                <button type="button" onClick={() => remove_item(index)} className="text-red-500 hover:text-red-700"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-t pt-4">
                        <div><label className="block text-xs font-medium">ضريبة (%)</label><input type="number" value={form_data.tax_rate || 0} onChange={e => set_form_data({...form_data, tax_rate: Number(e.target.value)})} className="w-full p-2 border rounded text-sm" /></div>
                        <div><label className="block text-xs font-medium">خصم (مبلغ)</label><input type="number" value={form_data.discount || 0} onChange={e => set_form_data({...form_data, discount: Number(e.target.value)})} className="w-full p-2 border rounded text-sm" /></div>
                        <div><label className="block text-xs font-medium">الحالة</label><select value={form_data.status || 'draft'} onChange={e => set_form_data({...form_data, status: e.target.value as any})} className="w-full p-2 border rounded text-sm"><option value="draft">مسودة</option><option value="sent">مرسلة</option><option value="paid">مدفوعة</option><option value="overdue">متأخرة</option></select></div>
                    </div>
                    
                    <div className="flex justify-between items-center font-bold text-lg bg-gray-50 p-2 rounded">
                        <span>الإجمالي:</span>
                        <span>{total.toLocaleString()} ل.س</span>
                    </div>

                    <div className="flex justify-end gap-4 mt-6">
                        <button type="button" onClick={on_close} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">حفظ الفاتورة</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- TAB: REPORTS ---
const ReportsTab: React.FC = () => {
    const { accounting_entries } = useData();
    const reports_data = React.useMemo(() => {
        const income = accounting_entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        const expense = accounting_entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
        return [
            { name: 'الإيرادات', value: income, color: '#10B981' },
            { name: 'المصروفات', value: expense, color: '#EF4444' }
        ];
    }, [accounting_entries]);

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-bold text-gray-800">التقارير المالية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow h-[400px]">
                    <h3 className="text-lg font-semibold mb-4 text-center">توزيع الإيرادات والمصروفات</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={reports_data} cx="50%" cy="50%" outerRadius={100} fill="#8884d8" dataKey="value" label>
                                {reports_data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-white p-6 rounded-lg shadow h-[400px]">
                    <h3 className="text-lg font-semibold mb-4 text-center">المقارنة العمودية</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reports_data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="value" fill="#8884d8">
                                 {reports_data.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---
const AccountingPage: React.FC<{ initial_invoice_data?: { client_id: string, case_id?: string }, clear_initial_invoice_data: () => void }> = ({ initial_invoice_data, clear_initial_invoice_data }) => {
    const [active_tab, set_active_tab] = React.useState<'entries' | 'invoices' | 'reports'>('entries');
    
    // Automatically switch to invoices tab if initial data is present
    React.useEffect(() => {
        if (initial_invoice_data) set_active_tab('invoices');
    }, [initial_invoice_data]);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">المحاسبة</h1>
            <div className="bg-white p-4 rounded-lg shadow">
                <div className="flex border-b">
                    <button onClick={() => set_active_tab('entries')} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${active_tab === 'entries' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <div className="flex items-center gap-2"><CalculatorIcon className="w-5 h-5"/> القيود اليومية</div>
                    </button>
                    <button onClick={() => set_active_tab('invoices')} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${active_tab === 'invoices' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <div className="flex items-center gap-2"><DocumentTextIcon className="w-5 h-5"/> الفواتير</div>
                    </button>
                    <button onClick={() => set_active_tab('reports')} className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${active_tab === 'reports' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                        <div className="flex items-center gap-2"><ChartPieIcon className="w-5 h-5"/> التقارير</div>
                    </button>
                </div>
                <div className="p-6">
                    {active_tab === 'entries' && <EntriesTab />}
                    {active_tab === 'invoices' && <InvoicesTab initial_invoice_data={initial_invoice_data} clear_initial_invoice_data={clear_initial_invoice_data} />}
                    {active_tab === 'reports' && <ReportsTab />}
                </div>
            </div>
        </div>
    );
};

export default AccountingPage;

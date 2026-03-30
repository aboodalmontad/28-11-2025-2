import * as React from 'react';
import { get_supabase_client } from '../supabaseClient';
import { SiteFinancialEntry, Profile } from '../types';
import { format_date, to_input_date_string, safe_revive_date } from '../utils/dateUtils';
import { PlusIcon, PencilIcon, TrashIcon, ExclamationTriangleIcon } from '../components/icons';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useData } from '../context/DataContext';

const StatCard: React.FC<{ title: string; value: string; className?: string }> = ({ title, value, className = '' }) => (
    <div className={`p-6 rounded-lg shadow ${className}`}>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-3xl font-bold">{value}</p>
    </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-2 border shadow-lg rounded-md text-sm">
                <p className="font-bold mb-1">{label}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} style={{ color: pld.color }}>
                        {`${pld.name}: ${pld.value.toLocaleString()} ل.س`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const SiteFinancesPage: React.FC = () => {
    const { site_finances: entries, set_site_finances, profiles: users, is_data_loading: loading } = useData();
    const [error, set_error] = React.useState<string | null>(null);
    const [modal, set_modal] = React.useState<{ is_open: boolean; data?: SiteFinancialEntry }>({ is_open: false });
    const [entry_to_delete, set_entry_to_delete] = React.useState<SiteFinancialEntry | null>(null);
    const [active_tab, set_active_tab] = React.useState<'entries' | 'reports'>('entries');

    const supabase = get_supabase_client();

    const handle_open_modal = (entry?: SiteFinancialEntry) => set_modal({ is_open: true, data: entry });
    const handle_close_modal = () => set_modal({ is_open: false });

    const handle_submit = async (form_data: any, is_subscription_renewal: boolean) => {
        if (!supabase) return;

        const { new_subscription_start, new_subscription_end, ...financialData } = form_data;
        const finalFinancialData = { ...financialData, user_id: financialData.user_id === 'none' ? null : financialData.user_id, updated_at: new Date().toISOString() };

        if (modal.data) {
             set_site_finances(prev => prev.map(e => e.id === modal.data!.id ? { ...e, ...finalFinancialData } : e));
        } else {
            const newEntry = { ...finalFinancialData, id: -Date.now() }; // Temporary negative ID
            set_site_finances(prev => [...prev, newEntry]);
        }
        
        // This part remains to update profiles which is a separate concern from financial entries
        if (is_subscription_renewal && form_data.user_id && form_data.new_subscription_start && form_data.new_subscription_end) {
            try {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        subscription_start_date: form_data.new_subscription_start,
                        subscription_end_date: form_data.new_subscription_end
                    })
                    .eq('id', form_data.user_id);

                if (profileError) throw profileError;

            } catch (err: any) {
                let errorMessage = "فشل تحديث الاشتراك.";
                if (String(err.message).toLowerCase().includes('failed to fetch')) {
                    errorMessage += " يرجى التحقق من اتصالك بالإنترنت.";
                } else {
                    errorMessage += ` السبب: ${err.message}`;
                }
                set_error(errorMessage);
            }
        }
        
        handle_close_modal();
    };

    const handle_confirm_delete = async () => {
        if (!supabase || !entry_to_delete) return;
        set_site_finances(prev => prev.filter(e => e.id !== entry_to_delete.id));
        set_entry_to_delete(null);
    };

    const financial_summary = React.useMemo(() => {
        const totalIncome = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
        const totalExpenses = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
        const subscriptionIncome = entries.filter(e => e.type === 'income' && e.description?.includes('تجديد اشتراك')).reduce((sum, e) => sum + e.amount, 0);
        return { totalIncome, totalExpenses, balance: totalIncome - totalExpenses, subscriptionIncome };
    }, [entries]);

    // Report Data Processing
    const reports_data = React.useMemo(() => {
        type MonthlyData = { month: string; monthDate: Date; income: number; expense: number };
        const monthlyData = entries.reduce((acc: Record<string, MonthlyData>, entry) => {
            const d = safe_revive_date(entry.payment_date);
            if (isNaN(d.getTime())) {
                console.warn("Skipping financial entry with invalid date:", entry);
                return acc; 
            }
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthKey = monthStart.toISOString();

            if (!acc[monthKey]) {
                acc[monthKey] = {
                    month: d.toLocaleString('ar-EG', { month: 'short', year: 'numeric' }),
                    monthDate: monthStart,
                    income: 0,
                    expense: 0
                };
            }
            if (entry.type === 'income') {
                acc[monthKey].income += entry.amount;
            } else {
                acc[monthKey].expense += entry.amount;
            }
            return acc;
        }, {});

        const incomeBreakdown = entries
            .filter(e => e.type === 'income')
            .reduce((acc, entry) => {
                const key = entry.description?.includes('تجديد اشتراك') ? 'الاشتراكات' : 'إيرادات أخرى';
                acc[key] = (acc[key] || 0) + entry.amount;
                return acc;
            }, {} as Record<string, number>);

        const expenseBreakdown = entries
            .filter(e => e.type === 'expense')
            .reduce((acc, entry) => {
                const key = entry.category || 'غير مصنف';
                acc[key] = (acc[key] || 0) + entry.amount;
                return acc;
            }, {} as Record<string, number>);

        return {
            monthly: Object.values(monthlyData).sort((a: MonthlyData, b: MonthlyData) => safe_revive_date(a.monthDate).getTime() - safe_revive_date(b.monthDate).getTime()),
            income: Object.entries(incomeBreakdown).map(([name, value]) => ({ name, value })),
            expense: Object.entries(expenseBreakdown).map(([name, value]) => ({ name, value })),
        };
    }, [entries]);

    if (loading) return <div className="text-center p-8">جاري تحميل البيانات المالية...</div>;
    if (error) return <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>;

    const PIE_COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-800">المحاسبة المالية للموقع</h1>
                <button onClick={() => handle_open_modal()} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"><PlusIcon className="w-5 h-5" /><span>إضافة قيد مالي</span></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="إجمالي الإيرادات" value={`${financial_summary.totalIncome.toLocaleString()} ل.س`} className="bg-green-100 text-green-800" />
                <StatCard title="إجمالي المصروفات" value={`${financial_summary.totalExpenses.toLocaleString()} ل.س`} className="bg-red-100 text-red-800" />
                <StatCard title="صافي الربح" value={`${financial_summary.balance.toLocaleString()} ل.س`} className="bg-blue-100 text-blue-800" />
                <StatCard title="إيرادات الاشتراكات" value={`${financial_summary.subscriptionIncome.toLocaleString()} ل.س`} className="bg-purple-100 text-purple-800" />
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
                 <div className="border-b border-gray-200"><nav className="-mb-px flex space-x-8"><button onClick={() => set_active_tab('entries')} className={`${active_tab === 'entries' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>القيود المالية</button><button onClick={() => set_active_tab('reports')} className={`${active_tab === 'reports' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}>التقارير</button></nav></div>
                <div className="pt-6">
                    {active_tab === 'entries' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-right text-gray-600">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                    <tr>
                                        <th className="px-6 py-3">التاريخ</th>
                                        <th className="px-6 py-3">البيان</th>
                                        <th className="px-6 py-3">الفئة</th>
                                        <th className="px-6 py-3">المستخدم</th>
                                        <th className="px-6 py-3">المبلغ</th>
                                        <th className="px-6 py-3">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map(entry => (
                                        <tr key={entry.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4">{format_date(entry.payment_date)}</td>
                                            <td className="px-6 py-4">{entry.description}</td>
                                            <td className="px-6 py-4">{entry.category || '-'}</td>
                                            <td className="px-6 py-4">{users.find(u => u.id === entry.user_id)?.full_name || 'N/A'}</td>
                                            <td className={`px-6 py-4 font-semibold ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{entry.amount.toLocaleString()} ل.س</td>
                                            <td className="px-6 py-4 flex items-center gap-2">
                                                <button onClick={() => handle_open_modal(entry)} className="p-2 text-gray-500 hover:text-blue-600"><PencilIcon className="w-4 h-4" /></button>
                                                <button onClick={() => set_entry_to_delete(entry)} className="p-2 text-gray-500 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {active_tab === 'reports' && (
                        <div className="space-y-12">
                             <div>
                                <h3 className="font-bold mb-4 text-center text-gray-700">الإيرادات والمصروفات الشهرية</h3>
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={reports_data.monthly} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="month" />
                                        <YAxis />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar dataKey="income" name="الإيرادات" fill="#10B981" />
                                        <Bar dataKey="expense" name="المصروفات" fill="#EF4444" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-6 rounded-lg">
                                    <h3 className="font-bold mb-4 text-center text-gray-700">توزيع الإيرادات</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={reports_data.income} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                                {reports_data.income.map((_entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="bg-white p-6 rounded-lg">
                                    <h3 className="font-bold mb-4 text-center text-gray-700">توزيع المصروفات</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie data={reports_data.expense} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                                {reports_data.expense.map((_entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {modal.is_open && <FinancialEntryModal isOpen={modal.is_open} onClose={handle_close_modal} onSubmit={handle_submit} initialData={modal.data} users={users} />}
            {entry_to_delete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => set_entry_to_delete(null)}>
                    <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><ExclamationTriangleIcon className="h-8 w-8 text-red-600" /></div>
                            <h3 className="text-2xl font-bold text-gray-900">تأكيد حذف القيد</h3>
                            <p className="text-gray-600 my-4">هل أنت متأكد من حذف هذا القيد المالي؟ لا يمكن التراجع عن هذا الإجراء.</p>
                        </div>
                        <div className="mt-6 flex justify-center gap-4">
                            <button type="button" className="px-6 py-2 bg-gray-200 rounded-lg" onClick={() => set_entry_to_delete(null)}>إلغاء</button>
                            <button type="button" className="px-6 py-2 bg-red-600 text-white rounded-lg" onClick={handle_confirm_delete}>نعم، قم بالحذف</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Modal Component ---
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any, is_subscription_renewal: boolean) => void;
    initialData?: SiteFinancialEntry;
    users: Profile[];
}
const FinancialEntryModal: React.FC<ModalProps> = ({ isOpen, onClose, onSubmit, initialData, users }) => {
    const [form_data, set_form_data] = React.useState<any>({});
    const [is_subscription_renewal, set_is_subscription_renewal] = React.useState(false);

    React.useEffect(() => {
        if (isOpen) {
            const data = initialData ? { ...initialData, payment_date: to_input_date_string(initialData.payment_date) } : { type: 'income', payment_date: to_input_date_string(new Date()), amount: 0, user_id: 'none', category: 'غير مصنف' };
            set_form_data(data);
            set_is_subscription_renewal(initialData?.description?.includes('تجديد اشتراك') || false);
        }
    }, [isOpen, initialData]);

    const handle_change = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const finalValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
        
        if (name === 'is_subscription_renewal') {
            set_is_subscription_renewal(finalValue as boolean);
            if (finalValue) {
                const user = users.find(u => u.id === form_data.user_id);
                set_form_data((prev: any) => ({ ...prev, description: `تجديد اشتراك لـ ${user?.full_name || 'مستخدم'}` }));
            }
        } else {
            set_form_data((prev: any) => ({ ...prev, [name]: finalValue }));
        }
    };
    
    const handle_user_change = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const userId = e.target.value;
        set_form_data((prev: any) => ({ ...prev, user_id: userId }));
        if (is_subscription_renewal) {
            const user = users.find(u => u.id === userId);
            set_form_data((prev: any) => ({ ...prev, description: `تجديد اشتراك لـ ${user?.full_name || 'مستخدم'}` }));
        }
    };

    const handle_form_submit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(form_data, is_subscription_renewal);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 p-4 overflow-y-auto" onClick={onClose}>
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4">{initialData ? 'تعديل قيد مالي' : 'إضافة قيد مالي جديد'}</h2>
                <form onSubmit={handle_form_submit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="block text-sm font-medium">النوع</label><select name="type" value={form_data.type || 'income'} onChange={handle_change} className="w-full p-2 border rounded"><option value="income">إيراد</option><option value="expense">مصروف</option></select></div>
                        <div><label className="block text-sm font-medium">تاريخ الدفع</label><input type="date" name="payment_date" value={form_data.payment_date || ''} onChange={handle_change} className="w-full p-2 border rounded" required /></div>
                    </div>
                    <div><label className="block text-sm font-medium">المبلغ</label><input type="number" name="amount" value={form_data.amount || 0} onChange={handle_change} className="w-full p-2 border rounded" required /></div>
                    <div>
                        <label className="block text-sm font-medium">البيان</label>
                        <textarea name="description" value={form_data.description || ''} onChange={handle_change} className="w-full p-2 border rounded" rows={3} required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">المستخدم (إن وجد)</label>
                            <select name="user_id" value={form_data.user_id || 'none'} onChange={handle_user_change} className="w-full p-2 border rounded">
                                <option value="none">-- لا يوجد --</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium">الفئة</label>
                            <input type="text" name="category" value={form_data.category || ''} onChange={handle_change} className="w-full p-2 border rounded" list="expense_categories" />
                            <datalist id="expense_categories">
                                <option value="رواتب" />
                                <option value="إيجار مكتب" />
                                <option value="فواتير (كهرباء, ماء, انترنت)" />
                                <option value="مستلزمات مكتبية" />
                                <option value="صيانة" />
                                <option value="ضرائب ورسوم" />
                                <option value="تسويق" />
                                <option value="نفقات أخرى" />
                            </datalist>
                        </div>
                    </div>
                    {form_data.type === 'income' && (
                        <div className="pt-2">
                             <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700">
                                <input type="checkbox" name="is_subscription_renewal" checked={is_subscription_renewal} onChange={handle_change} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                                هذا المبلغ هو تجديد اشتراك لمستخدم؟
                            </label>
                        </div>
                    )}
                    {is_subscription_renewal && form_data.user_id !== 'none' && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
                            <h4 className="font-semibold text-blue-800">تحديث تواريخ الاشتراك:</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-sm font-medium">تاريخ البدء الجديد</label><input type="date" name="new_subscription_start" value={form_data.new_subscription_start || ''} onChange={handle_change} className="w-full p-2 border rounded" required={is_subscription_renewal} /></div>
                                <div><label className="block text-sm font-medium">تاريخ الانتهاء الجديد</label><input type="date" name="new_subscription_end" value={form_data.new_subscription_end || ''} onChange={handle_change} className="w-full p-2 border rounded" required={is_subscription_renewal} /></div>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-4 pt-4"><button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded">إلغاء</button><button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">حفظ</button></div>
                </form>
            </div>
        </div>
    );
};
export default SiteFinancesPage;

import * as React from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { MusicalNoteIcon, PlayCircleIcon, TrashIcon, ArrowUpTrayIcon, ServerIcon, CloudArrowDownIcon, CloudArrowUpIcon, CheckCircleIcon, ExclamationTriangleIcon, ArrowPathIcon } from '../components/icons';
import { defaultUserApprovalSoundBase64 } from '../components/RealtimeNotifier';
import { fetchDataFromSupabase, FlatData } from '../hooks/useOnlineData'; // Import fetcher
import { getSupabaseClient } from '../supabaseClient'; // Import client

const USER_APPROVAL_SOUND_KEY = 'customUserApprovalSound';

interface AdminSettingsPageProps {
    onOpenConfig: () => void;
}

const AdminSettingsPage: React.FC<AdminSettingsPageProps> = ({ onOpenConfig }) => {
    const [customSound, setCustomSound] = useLocalStorage<string | null>(USER_APPROVAL_SOUND_KEY, null);
    const [feedback, setFeedback] = React.useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [isProcessing, setIsProcessing] = React.useState(false);
    const [progress, setProgress] = React.useState<{ current: number; total: number; stage: string } | null>(null);

    const showFeedback = (message: string, type: 'success' | 'error' | 'info') => {
        setFeedback({ message, type });
        if (type !== 'info') {
            setTimeout(() => setFeedback(null), 5000);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('audio/')) {
            showFeedback('الرجاء اختيار ملف صوتي صالح.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setCustomSound(base64);
            showFeedback('تم حفظ صوت التنبيه الجديد بنجاح.', 'success');
        };
        reader.onerror = () => {
            showFeedback('فشل في قراءة الملف.', 'error');
        };
        reader.readAsDataURL(file);
    };

    const playSound = () => {
        const soundSource = customSound || defaultUserApprovalSoundBase64;
        
        if (!soundSource) {
             showFeedback('الملف الصوتي المعتمد للتنبيه غير موجود. الرجاء اختيار نغمة جديدة.', 'error');
             return;
        }

        try {
            const audio = new Audio(soundSource);
            audio.play().catch(e => {
                console.error("Audio preview playback failed:", e);
                showFeedback('فشل تشغيل الملف الصوتي. قد يكون الملف تالفاً أو غير مدعوم. الرجاء اختيار نغمة تنبيه جديدة.', 'error');
            });
        } catch (e) {
            console.error("Error creating Audio object for preview:", e);
            showFeedback('حدث خطأ في تهيئة الصوت. الرجاء إعادة تحميل الصفحة أو اختيار نغمة جديدة.', 'error');
        }
    };

    const resetSound = () => {
        setCustomSound(null);
        showFeedback('تمت استعادة الصوت الافتراضي.', 'success');
    };

    // --- Backup & Restore Logic ---

    const handleFullBackup = async () => {
        setIsProcessing(true);
        showFeedback('جاري تحضير النسخة الاحتياطية من السحابة... يرجى الانتظار.', 'info');
        
        try {
            const data = await fetchDataFromSupabase();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `lawyer_system_full_backup_${timestamp}.json`;
            
            const jsonString = JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            showFeedback('تم تنزيل النسخة الاحتياطية بنجاح.', 'success');
        } catch (error: any) {
            console.error("Backup failed:", error);
            showFeedback(`فشل النسخ الاحتياطي: ${error.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRestoreFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!window.confirm("تحذير: ستقوم هذه العملية باستبدال/تحديث البيانات الموجودة في السحابة بالبيانات الموجودة في الملف. هل أنت متأكد تماماً؟")) {
            event.target.value = ''; // Reset input
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("Could not read file");
                const data = JSON.parse(text) as Partial<FlatData>;
                await restoreDataToSupabase(data);
            } catch (error: any) {
                console.error("Restore failed:", error);
                showFeedback(`فشل الاستعادة: ${error.message}`, 'error');
                setIsProcessing(false);
                setProgress(null);
            }
            event.target.value = ''; // Reset input for next time
        };
        reader.readAsText(file);
    };

    const restoreDataToSupabase = async (data: Partial<FlatData>) => {
        const supabase = getSupabaseClient();
        if (!supabase) throw new Error("Supabase client not available");

        setIsProcessing(true);
        showFeedback('جاري استعادة البيانات إلى السحابة... يرجى عدم إغلاق الصفحة.', 'info');

        // Order matters for Foreign Key constraints!
        // Parent tables first, then children.
        const tableOrder: { key: keyof FlatData, table: string }[] = [
            { key: 'profiles', table: 'profiles' },
            { key: 'assistants', table: 'assistants' },
            { key: 'clients', table: 'clients' },
            { key: 'cases', table: 'cases' },
            { key: 'stages', table: 'stages' },
            { key: 'sessions', table: 'sessions' },
            { key: 'invoices', table: 'invoices' },
            { key: 'invoice_items', table: 'invoice_items' },
            { key: 'accounting_entries', table: 'accounting_entries' },
            { key: 'admin_tasks', table: 'admin_tasks' },
            { key: 'appointments', table: 'appointments' },
            { key: 'site_finances', table: 'site_finances' },
            { key: 'case_documents', table: 'case_documents' }, // Only metadata
        ];

        let totalRecords = 0;
        let processedRecords = 0;

        // Calculate total for progress bar
        tableOrder.forEach(({ key }) => {
            if (data[key]) totalRecords += data[key]!.length;
        });

        for (const { key, table } of tableOrder) {
            const records = data[key];
            if (!records || records.length === 0) continue;

            // Update stage message
            setProgress({ current: processedRecords, total: totalRecords, stage: `جاري معالجة جدول: ${table} (${records.length} سجل)` });

            // Chunking to avoid payload limits
            const CHUNK_SIZE = 100;
            for (let i = 0; i < records.length; i += CHUNK_SIZE) {
                const chunk = records.slice(i, i + CHUNK_SIZE);
                
                // Sanitize data if needed (e.g. remove extra props not in DB schema if any)
                // For direct DB restore, we assume the backup matches the schema.
                
                const { error } = await supabase.from(table).upsert(chunk);
                
                if (error) {
                    console.error(`Error restoring ${table} chunk ${i}:`, error);
                    throw new Error(`Error in table ${table}: ${error.message}`);
                }

                processedRecords += chunk.length;
                setProgress({ current: processedRecords, total: totalRecords, stage: `جاري معالجة جدول: ${table}` });
            }
        }

        setIsProcessing(false);
        setProgress(null);
        showFeedback('تمت عملية الاستعادة بنجاح كامل!', 'success');
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">إعدادات المدير</h1>

            {feedback && (
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                    feedback.type === 'success' ? 'bg-green-100 text-green-800' : 
                    feedback.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                    {feedback.type === 'success' && <CheckCircleIcon className="w-5 h-5"/>}
                    {feedback.type === 'error' && <ExclamationTriangleIcon className="w-5 h-5"/>}
                    {feedback.type === 'info' && <ArrowPathIcon className="w-5 h-5 animate-spin"/>}
                    <span>{feedback.message}</span>
                </div>
            )}

            {isProcessing && progress && (
                <div className="bg-white p-4 rounded-lg shadow border border-blue-200">
                    <p className="text-sm font-semibold text-blue-800 mb-2">{progress.stage}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                            className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                            style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                        ></div>
                    </div>
                    <p className="text-xs text-right mt-1 text-gray-500">{Math.round((progress.current / progress.total) * 100)}%</p>
                </div>
            )}
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Database Backup Section */}
                <div className="bg-white p-6 rounded-lg shadow space-y-6">
                    <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex items-center gap-3">
                        <CloudArrowUpIcon className="w-6 h-6 text-blue-600" />
                        <span>نسخ واستعادة قاعدة البيانات</span>
                    </h2>
                    
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                        <h3 className="font-semibold text-blue-900 mb-2">تنزيل نسخة احتياطية كاملة</h3>
                        <p className="text-sm text-blue-700 mb-4">
                            قم بتنزيل ملف JSON يحتوي على كافة بيانات قاعدة البيانات السحابية (الموكلين، القضايا، المالية، المستخدمين، إلخ). يمكنك استخدام هذا الملف لاستعادة النظام لاحقاً.
                        </p>
                        <button 
                            onClick={handleFullBackup}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
                        >
                            {isProcessing ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <CloudArrowDownIcon className="w-5 h-5" />}
                            <span>تحميل النسخة الاحتياطية</span>
                        </button>
                    </div>

                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-lg">
                        <h3 className="font-semibold text-orange-900 mb-2">استعادة من نسخة احتياطية</h3>
                        <p className="text-sm text-orange-800 mb-4">
                            رفع ملف نسخة احتياطية لإعادة تعبئة قاعدة البيانات. 
                            <br/>
                            <span className="font-bold text-red-600">تنبيه:</span> سيتم تحديث السجلات الموجودة وإضافة السجلات الجديدة. يفضل استخدام هذا الخيار بحذر.
                        </p>
                        <label className={`flex items-center gap-2 px-4 py-2 bg-orange-600 text-white font-semibold rounded-lg hover:bg-orange-700 transition-colors cursor-pointer w-full justify-center ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            {isProcessing ? <ArrowPathIcon className="w-5 h-5 animate-spin"/> : <CloudArrowUpIcon className="w-5 h-5" />}
                            <span>رفع واستعادة الملف</span>
                            <input 
                                type="file" 
                                accept=".json" 
                                onChange={handleRestoreFileChange} 
                                disabled={isProcessing}
                                className="hidden" 
                            />
                        </label>
                    </div>
                </div>

                {/* Other Configs */}
                <div className="space-y-6">
                    {/* Database Setup Wizard */}
                    <div className="bg-white p-6 rounded-lg shadow space-y-6">
                        <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex items-center gap-3">
                            <ServerIcon className="w-6 h-6 text-gray-600" />
                            <span>تكوين النظام</span>
                        </h2>
                        <div className="p-4 bg-gray-50 border rounded-lg">
                            <h3 className="font-semibold text-lg text-gray-800">معالج إعداد قاعدة البيانات</h3>
                            <p className="text-sm text-gray-600 mt-1">
                                استخدم هذه الأداة لإعداد جداول قاعدة البيانات، وتكوين صلاحيات التخزين، وإصلاح مشاكل المزامنة.
                            </p>
                            <div className="mt-4">
                                <button 
                                    onClick={onOpenConfig}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors w-full justify-center"
                                >
                                    <ServerIcon className="w-5 h-5" />
                                    <span>فتح معالج الإعداد</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Sound Settings */}
                    <div className="bg-white p-6 rounded-lg shadow space-y-6">
                        <h2 className="text-xl font-bold text-gray-800 border-b pb-3 flex items-center gap-3">
                            <MusicalNoteIcon className="w-6 h-6 text-purple-600" />
                            <span>تخصيص صوت التنبيهات</span>
                        </h2>

                        <div className="p-4 bg-purple-50 border border-purple-100 rounded-lg">
                            <h3 className="font-semibold text-lg text-purple-900">تنبيه تسجيل مستخدم جديد</h3>
                            <p className="text-sm text-purple-700 mt-1 mb-4">
                                اختر ملفًا صوتيًا ليتم تشغيله عند انضمام مستخدم جديد.
                            </p>

                            <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors cursor-pointer w-full justify-center">
                                    <ArrowUpTrayIcon className="w-5 h-5" />
                                    <span>اختر نغمة مخصصة...</span>
                                    <input
                                        type="file"
                                        id="sound-upload"
                                        accept="audio/*"
                                        className="hidden"
                                        onChange={handleFileChange}
                                    />
                                </label>

                                <div className="flex gap-2">
                                    <button
                                        onClick={playSound}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white border border-purple-300 text-purple-700 font-semibold rounded-lg hover:bg-purple-50 transition-colors"
                                    >
                                        <PlayCircleIcon className="w-5 h-5" />
                                        <span>تجربة</span>
                                    </button>
                                    {customSound && (
                                        <button
                                            onClick={resetSound}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200 transition-colors"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                            <span>حذف</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-center mt-3 text-purple-600">
                                {customSound ? 'تم تعيين نغمة مخصصة.' : 'يتم استخدام النغمة الافتراضية.'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSettingsPage;

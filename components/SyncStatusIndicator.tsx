
import * as React from 'react';
import { ArrowPathIcon, NoSymbolIcon, CheckCircleIcon, ExclamationCircleIcon } from './icons';
import { SyncStatus } from '../hooks/useSync';

interface SyncStatusIndicatorProps {
    status: SyncStatus;
    lastError: string | null;
    isDirty: boolean;
    isOnline: boolean;
    onManualSync: () => void;
    isAutoSyncEnabled: boolean;
    className?: string;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ status, lastError, isDirty, isOnline, onManualSync, isAutoSyncEnabled, className = "" }) => {
    
    let displayStatus;
    let dotClass = "";

    // ترتيب التحقق مهم جداً للأولوية البصرية
    if (!isOnline) {
        displayStatus = {
            icon: <NoSymbolIcon className="w-5 h-5 text-gray-400" />,
            text: 'أوفلاين',
            className: 'text-gray-500',
            title: 'أنت غير متصل بالإنترنت. التغييرات محفوظة محلياً فقط.'
        };
        dotClass = "bg-gray-400 shadow-none";
    } else if (status === 'syncing' || status === 'loading') {
        displayStatus = {
            icon: <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />,
            text: status === 'syncing' ? 'جاري المزامنة...' : 'جاري التحميل...',
            className: 'text-blue-600',
            title: 'يتم الآن تبادل البيانات مع السيرفر السحابي.'
        };
        dotClass = "bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]";
    } else if (status === 'error') {
        displayStatus = {
            icon: <ExclamationCircleIcon className="w-5 h-5 text-red-500" />,
            text: 'فشل المزامنة',
            className: 'text-red-600',
            title: `خطأ اتصال: ${lastError || 'تعذر الوصول للسيرفر'}`
        };
        dotClass = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]";
    } else if (isDirty) {
        displayStatus = {
            icon: <ArrowPathIcon className="w-5 h-5 text-amber-600" />,
            text: isAutoSyncEnabled ? 'بانتظار الرفع' : 'تحديث مطلوب',
            className: 'text-amber-700',
            title: 'توجد بيانات جديدة على جهازك لم ترفع للسحابة بعد.'
        };
        dotClass = "bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]";
    } else {
        displayStatus = {
            icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
            text: 'متزامن',
            className: 'text-green-600',
            title: 'جميع البيانات محمية ومرفوعة على السحابة بنجاح.'
        };
        dotClass = "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.9)]";
    }

    const canSyncManually = isOnline && status !== 'syncing' && status !== 'loading';

    return (
        <button
            onClick={canSyncManually ? onManualSync : undefined}
            disabled={!canSyncManually}
            className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-full border border-gray-100 bg-white shadow-sm transition-all duration-300 ${canSyncManually ? 'cursor-pointer hover:border-blue-300 hover:shadow-md active:scale-95' : 'cursor-default'} ${className}`}
            title={displayStatus.title}
        >
            {/* الدائرة المتوهجة الاحترافية */}
            <span className="relative flex h-3 w-3">
                {isOnline && !isDirty && status === 'synced' && (
                    <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"></span>
                )}
                <span className={`relative inline-flex rounded-full h-3 w-3 transition-colors duration-500 ${dotClass}`}></span>
            </span>

            <div className="flex items-center gap-1.5">
                <span className="hidden sm:inline transition-opacity group-hover:opacity-80">
                    {displayStatus.icon}
                </span>
                <span className={`text-[11px] font-extrabold uppercase tracking-tight ${displayStatus.className}`}>
                    {displayStatus.text}
                </span>
            </div>
        </button>
    );
};

export default SyncStatusIndicator;

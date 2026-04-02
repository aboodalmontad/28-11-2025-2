import * as React from 'react';
import { ArrowPathIcon, NoSymbolIcon, CheckCircleIcon, ExclamationCircleIcon } from './icons';
import { SyncStatus, SyncLogEntry } from '../hooks/useSync';

interface SyncStatusIndicatorProps {
    status: SyncStatus;
    last_error: string | null;
    is_dirty: boolean;
    is_online: boolean;
    on_manual_sync: () => void;
    is_auto_sync_enabled: boolean;
    className?: string;
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ 
    status, 
    last_error, 
    is_dirty, 
    is_online, 
    on_manual_sync, 
    is_auto_sync_enabled, 
    className = ""
}) => {
    let displayStatus;
    if (!is_online) {
        displayStatus = {
            icon: <NoSymbolIcon className="w-5 h-5 text-gray-500" />,
            text: 'غير متصل',
            className: 'text-gray-500',
            title: 'أنت غير متصل بالإنترنت. التغييرات محفوظة محلياً.'
        };
    } else if (!is_auto_sync_enabled && is_dirty) {
        displayStatus = {
            icon: <ArrowPathIcon className="w-5 h-5 text-yellow-600 animate-pulse" />,
            text: 'مزامنة يدوية مطلوبة',
            className: 'text-yellow-600',
            title: 'المزامنة التلقائية متوقفة. اضغط للمزامنة الآن.'
        };
    } else if (status === 'unconfigured' || status === 'uninitialized') {
         displayStatus = {
            icon: <ExclamationCircleIcon className="w-5 h-5 text-red-500" />,
            text: 'الإعداد مطلوب',
            className: 'text-red-500',
            title: 'قاعدة البيانات غير مهيأة.'
        };
    } else if (status === 'loading') {
         displayStatus = {
            icon: <ArrowPathIcon className="w-5 h-5 text-gray-500 animate-spin" />,
            text: 'جاري التحميل...',
            className: 'text-gray-500',
            title: 'جاري تحميل البيانات...'
        };
    } else if (status === 'syncing') {
         displayStatus = {
            icon: <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-pulse" />,
            text: 'جاري المزامنة...',
            className: 'text-blue-500',
            title: 'جاري مزامنة بياناتك مع السحابة.'
        };
    } else if (status === 'error') {
         displayStatus = {
            icon: <ExclamationCircleIcon className="w-5 h-5 text-red-500" />,
            text: 'فشل المزامنة',
            className: 'text-red-500',
            title: `فشل المزامنة: ${last_error}`
        };
    } else if (is_dirty) {
         displayStatus = {
            icon: <ArrowPathIcon className="w-5 h-5 text-yellow-600" />,
            text: 'تغييرات غير محفوظة',
            className: 'text-yellow-600',
            title: 'لديك تغييرات لم تتم مزامنتها بعد.'
        };
    } else {
        displayStatus = {
            icon: <CheckCircleIcon className="w-5 h-5 text-green-500" />,
            text: 'متزامن',
            className: 'text-green-500',
            title: 'جميع بياناتك محدثة.'
        };
    }

    const canSyncManually = is_online && status !== 'syncing' && status !== 'loading' && status !== 'unconfigured' && status !== 'uninitialized';

    return (
        <div className="flex items-center gap-1">
            <button
                onClick={canSyncManually ? on_manual_sync : undefined}
                disabled={!canSyncManually}
                className={`flex items-center gap-2 text-sm font-semibold p-2 rounded-lg ${canSyncManually ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default'} ${className}`}
                title={displayStatus.title}
            >
                {displayStatus.icon}
                <span className={`${displayStatus.className} hidden sm:inline`}>{displayStatus.text}</span>
            </button>
        </div>
    );
};

export default SyncStatusIndicator;
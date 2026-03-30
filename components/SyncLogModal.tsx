import * as React from 'react';
import { XMarkIcon, TrashIcon, CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, ExclamationTriangleIcon } from './icons';
import { SyncLogEntry } from '../hooks/useSync';

import { safe_revive_date } from '../utils/dateUtils';

interface SyncLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    logs: SyncLogEntry[];
    onClear: () => void;
}

const SyncLogModal: React.FC<SyncLogModalProps> = ({ isOpen, onClose, logs, onClear }) => {
    if (!isOpen) return null;

    const getIcon = (type: SyncLogEntry['type']) => {
        switch (type) {
            case 'success': return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
            case 'error': return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
            case 'warning': return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
            default: return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-bold text-gray-800">سجل المزامنة</h2>
                        <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">{logs.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={onClear}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="مسح السجل"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            <XMarkIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-3">
                    {logs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <InformationCircleIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p>لا يوجد سجلات حالياً</p>
                        </div>
                    ) : (
                        logs.slice().reverse().map((log) => (
                            <div key={log.id} className="flex gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-all shadow-sm">
                                <div className="mt-0.5">{getIcon(log.type)}</div>
                                <div className="flex-grow min-w-0">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-xs font-medium text-gray-400">
                                            {safe_revive_date(log.timestamp).toLocaleTimeString('ar-EG')}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-800 font-medium leading-relaxed">{log.message}</p>
                                    {log.details && (
                                        <p className="text-xs text-gray-500 mt-1 font-mono break-words bg-gray-50 p-2 rounded border border-gray-100">
                                            {log.details}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-colors shadow-lg shadow-gray-200"
                    >
                        إغلاق
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SyncLogModal;

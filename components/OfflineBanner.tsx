import * as React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import { NoSymbolIcon } from './icons.tsx';

const OfflineBanner: React.FC = () => {
    const isOnline = useOnlineStatus();
    const [isVisible, setIsVisible] = React.useState(!isOnline);
    const [isRendered, setIsRendered] = React.useState(!isOnline);

    React.useEffect(() => {
        if (!isOnline) {
            setIsRendered(true);
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => {
                setIsRendered(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOnline]);
    
    if (!isRendered) return null;

    return (
        <div 
            className={`no-print w-full bg-yellow-100 text-yellow-800 p-3 text-center text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full'}`}
            role="status"
            aria-live="polite"
        >
            <NoSymbolIcon className="w-5 h-5" />
            <span>أنت غير متصل بالإنترنت. التغييرات محفوظة محلياً وستتم مزامنتها تلقائياً عند عودة الاتصال.</span>
        </div>
    );
};

export default OfflineBanner;

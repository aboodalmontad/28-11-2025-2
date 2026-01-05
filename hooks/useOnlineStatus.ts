
import * as React from 'react';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = React.useState(() => {
      if (typeof navigator !== 'undefined') {
          return navigator.onLine;
      }
      return true;
  });

  React.useEffect(() => {
    // تحديث الحالة فوراً عند التحميل للتأكد من دقتها
    const initialStatus = navigator.onLine;
    if (isOnline !== initialStatus) {
        setIsOnline(initialStatus);
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isOnline]);

  return isOnline;
};

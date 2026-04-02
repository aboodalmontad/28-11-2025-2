import * as React from 'react';

export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = React.useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);

  const checkStatus = React.useCallback(async () => {
    if (typeof navigator === 'undefined') return;
    
    if (!navigator.onLine) {
      setIsOnline(false);
      return;
    }

    // If navigator says we are online, verify with a small ping to the app's own origin
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      // Pinging our own origin is more reliable and avoids CORS issues with external sites
      await fetch('/favicon.ico', { 
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      setIsOnline(true);
    } catch (error) {
      // If fetch fails, we might be on a local network without internet access
      console.warn("Navigator says online, but ping failed. Assuming offline.");
      setIsOnline(false);
    }
  }, []);

  React.useEffect(() => {
    const handleOnline = () => {
      // When the browser says we are online, double check with a ping
      checkStatus();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodically check status every 30 seconds if we are offline
    const interval = setInterval(() => {
      if (!isOnline) {
        checkStatus();
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkStatus, isOnline]);

  return isOnline;
};

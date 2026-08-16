import * as React from "react";

// Global state for online status to avoid multiple disparate pollers
let globalIsOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
const listeners = new Set<(online: boolean) => void>();

// Quick connectivity probe with cache buster and timeout
export const checkInternetConnection = async (): Promise<boolean> => {
  if (typeof window === "undefined") return true;
  if (!navigator.onLine) {
    updateOnlineStatus(false);
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    // Use version.json or origin ping with timestamp
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => {
      // Fallback to simple GET with abort
      return fetch(`/favicon.ico?t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
    });

    clearTimeout(timeoutId);
    const online = res.ok || res.type === "opaque" || res.status < 500;
    updateOnlineStatus(online);
    return online;
  } catch (e) {
    // If browser says navigator.onLine is true, check if it's a transient network issue or complete offline
    const isActuallyOnline = navigator.onLine;
    updateOnlineStatus(isActuallyOnline);
    return isActuallyOnline;
  }
};

const updateOnlineStatus = (newStatus: boolean) => {
  const previous = globalIsOnline;
  globalIsOnline = newStatus;

  if (previous !== newStatus) {
    listeners.forEach((listener) => listener(newStatus));

    if (newStatus && !previous) {
      console.log("🌐 Internet connection restored. Broadcasting app:online_restored event.");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("app:online_restored"));
      }
    }
  }
};

// Setup global window event listeners once
if (typeof window !== "undefined") {
  const handleBrowserOnline = () => {
    updateOnlineStatus(true);
    checkInternetConnection();
  };

  const handleBrowserOffline = () => {
    updateOnlineStatus(false);
  };

  window.addEventListener("online", handleBrowserOnline);
  window.addEventListener("offline", handleBrowserOffline);

  // When tab becomes active or window focused, verify internet connectivity
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkInternetConnection();
    }
  });
  window.addEventListener("focus", () => {
    checkInternetConnection();
  });

  // Adaptive background interval
  setInterval(() => {
    // If currently offline, check more frequently (every 10s) to catch reconnect quickly
    // If online, check every 60s
    checkInternetConnection();
  }, globalIsOnline ? 60000 : 10000);
}

export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = React.useState<boolean>(globalIsOnline);

  React.useEffect(() => {
    setIsOnline(globalIsOnline);

    const listener = (status: boolean) => {
      setIsOnline(status);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return isOnline;
};

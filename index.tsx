import * as React from 'react';
import { createRoot } from 'react-dom/client';
// Fix: Added .tsx extension for browser native ESM compatibility.
import App from './App.tsx';

// Listen for logout events from other tabs to ensure session state is synchronized.
window.addEventListener('storage', (event) => {
  // When the 'lawyerAppLoggedOut' key is set, it indicates another tab has signed out.
  if (event.key === 'lawyerAppLoggedOut' && event.newValue === 'true') {
    // Reload the page to clear the local session state and redirect to the login page.
    // The flag is removed upon a new successful login, preventing reload loops.
    window.location.reload();
  }
});


// Global safety net for unhandled auth errors (like "Refresh Token Not Found")
window.addEventListener('unhandledrejection', (event) => {
  const error = event.reason;
  const message = error?.message || String(error);
  
  if (message.includes('Refresh Token Not Found') || message.includes('invalid_refresh_token') || message.includes('Invalid Refresh Token')) {
    console.error("Global Auth Guard: Detected invalid refresh token. Clearing session.");
    window.localStorage.removeItem('lawyer-app-auth-token');
    Object.keys(window.localStorage).forEach(key => {
        if (key.startsWith('sb-')) window.localStorage.removeItem(key);
    });
    window.localStorage.setItem('lawyerAppLoggedOut', 'true');
    
    // Only reload if we are not already on the login page (to avoid loops)
    if (!window.location.search.includes('error=unauthorized')) {
        window.location.href = '/?error=unauthorized';
    }
  }
});

// Register Service Worker for offline capabilities
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'RELOAD_PAGE_NOW') {
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
        
        const checkForUpdate = () => {
            if (!navigator.onLine) return;
            
            console.log('Checking for service worker update...');
            registration.update().catch(err => {
                console.warn('Service Worker update check failed (likely network issue):', err);
            });
        };

        // Don't check immediately to avoid race conditions with initial registration
        setTimeout(checkForUpdate, 5000);
        
        setInterval(checkForUpdate, 60 * 60 * 1000); // 1 hour
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

const container = document.getElementById('root');

// Wrapper component to manage the application's key, allowing for a full remount.
const AppWrapper = () => {
    const [appKey, setAppKey] = React.useState(0);

    // This function, when called, changes the key on the App component,
    // forcing React to unmount the old instance and mount a new one,
    // effectively resetting the entire application's state.
    const handleRefresh = () => {
        setAppKey(prevKey => prevKey + 1);
    };

    return <App key={appKey} onRefresh={handleRefresh} />;
};


if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AppWrapper />
    </React.StrictMode>
  );
  
  // Explicitly remove the loader after a short delay to ensure React has taken over
  setTimeout(() => {
      const loader = document.getElementById('initial-loader');
      if (loader) {
          loader.style.opacity = '0';
          setTimeout(() => loader.remove(), 500);
      }
  }, 100);
} else {
    console.error('Failed to find the root element');
}
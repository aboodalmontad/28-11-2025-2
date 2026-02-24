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
            console.log('Checking for service worker update...');
            registration.update();
        };

        checkForUpdate();
        
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
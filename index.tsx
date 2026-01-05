
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

// Listen for logout events from other tabs
window.addEventListener('storage', (event) => {
  if (event.key === 'lawyerAppLoggedOut' && event.newValue === 'true') {
    window.location.reload();
  }
});

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'RELOAD_PAGE_NOW') {
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(registration => {
        registration.update();
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch(error => {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

const container = document.getElementById('root');

const AppWrapper = () => {
    const [appKey, setAppKey] = React.useState(0);
    const handleRefresh = () => setAppKey(prev => prev + 1);
    return <App key={appKey} onRefresh={handleRefresh} />;
};

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <AppWrapper />
    </React.StrictMode>
  );
}

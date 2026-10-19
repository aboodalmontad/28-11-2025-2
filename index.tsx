import React from 'react';
import ReactDOM from 'react-dom/client';
import { DataProvider } from './context/DataContext';
import { FeedbackProvider } from './context/FeedbackContext';
import { AppContent } from './App';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <FeedbackProvider>
        <DataProvider>
          <AppContent />
        </DataProvider>
      </FeedbackProvider>
    </React.StrictMode>
  );
}

import React, { createContext, useContext, useState, useCallback } from 'react';

type FeedbackType = 'success' | 'error' | 'info' | 'warning';

interface FeedbackState {
  message: string;
  type: FeedbackType;
}

interface ConfirmationState {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'default';
}

interface FeedbackContextType {
  showFeedback: (message: string, type?: FeedbackType) => void;
  confirm: (options: ConfirmationState) => void;
  feedback: FeedbackState | null;
  confirmation: ConfirmationState | null;
  closeFeedback: () => void;
  closeConfirmation: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);

  const showFeedback = useCallback((message: string, type: FeedbackType = 'info') => {
    setFeedback({ message, type });
    // Auto-close after 5 seconds
    setTimeout(() => {
      setFeedback(prev => (prev?.message === message ? null : prev));
    }, 5000);
  }, []);

  const confirm = useCallback((options: ConfirmationState) => {
    setConfirmation(options);
  }, []);

  const closeFeedback = useCallback(() => setFeedback(null), []);
  const closeConfirmation = useCallback(() => setConfirmation(null), []);

  return (
    <FeedbackContext.Provider value={{ showFeedback, confirm, feedback, confirmation, closeFeedback, closeConfirmation }}>
      {children}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used within FeedbackProvider');
  return context;
};

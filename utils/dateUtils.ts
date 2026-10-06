// Date and Calendar utilities for legal management
export const formatDateArabic = (dateString?: string): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }).format(date);
  } catch {
    return dateString;
  }
};

export const formatShortDate = (dateString?: string): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  } catch {
    return dateString;
  }
};

export const formatHijriDate = (dateString?: string): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch {
    return '';
  }
};

export const getDaysRemaining = (targetDate: string): number => {
  const target = new Date(targetDate);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const isToday = (dateString: string): boolean => {
  if (!dateString) return false;
  const today = new Date().toISOString().split('T')[0];
  return dateString.startsWith(today);
};

export const isTomorrow = (dateString: string): boolean => {
  if (!dateString) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  return dateString.startsWith(tomorrowStr);
};

export const getTodayString = (): string => {
  return new Date().toISOString().split('T')[0];
};

// Date and Calendar utilities for legal management
export const safe_revive_date = (dateInput?: any): Date => {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  const parsed = new Date(dateInput);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const to_input_date_string = (dateInput?: any): string => {
  if (!dateInput) return "";
  const d = safe_revive_date(dateInput);
  return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
};

export const parse_input_date_string = (str?: string): Date => {
  if (!str) return new Date();
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date() : d;
};

export const is_weekend = (dateInput?: any): boolean => {
  const d = safe_revive_date(dateInput);
  const day = d.getDay();
  return day === 5 || day === 6;
};

export const get_public_holiday = (dateInput?: any): string | null => {
  return null;
};

export const is_holiday = (dateInput?: any): boolean => {
  return false;
};

export const get_days_in_month = (year: number, month: number): Date[] => {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
};

export const get_first_day_of_month = (year: number, month: number): number => {
  return new Date(year, month, 1).getDay();
};

export const get_month_name_with_number = (dateInput?: any): string => {
  const d = safe_revive_date(dateInput);
  try {
    return new Intl.DateTimeFormat('ar-SA', { month: 'long', year: 'numeric' }).format(d);
  } catch {
    return '';
  }
};

export const format_month_year = (dateInput?: any): string => {
  return get_month_name_with_number(dateInput);
};

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

export const isToday = (dateInput?: any): boolean => {
  const d = safe_revive_date(dateInput);
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

export const is_today = isToday;

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

export const format_date = (dateInput?: any): string => {
  return formatShortDate(to_input_date_string(dateInput));
};

export const format_time = (timeStr?: string): string => {
  if (!timeStr) return '';
  return timeStr;
};

export const is_same_day = (d1: any, d2: any): boolean => {
  return to_input_date_string(d1) === to_input_date_string(d2);
};

export const is_before_today = (d: any): boolean => {
  return to_input_date_string(d) < getTodayString();
};

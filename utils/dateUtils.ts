
export const getDaysInMonth = (year: number, month: number): Date[] => {
    const date = new Date(year, month, 1);
    const days: Date[] = [];
    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
};

export const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
};

export const isSameDay = (date1: Date | string, date2: Date | string): boolean => {
    if (!date1 || !date2) return false;
    const d1 = date1 instanceof Date ? date1 : new Date(date1);
    const d2 = date2 instanceof Date ? date2 : new Date(date2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
    
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
};

export const isToday = (date: Date | string): boolean => {
    return isSameDay(date, new Date());
}

export const isBeforeToday = (date: Date | string): boolean => {
    if (!date) return false;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return false;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d < today;
}

export const formatDate = (date: Date | string | number | null | undefined): string => {
    if (!date) return 'غير محدد';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return 'تاريخ غير صالح';
    try {
        return new Intl.DateTimeFormat('ar-SY', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(d);
    } catch (e) {
        return 'خطأ في التاريخ';
    }
};

/**
 * تحويل التاريخ إلى نص YYYY-MM-DD باستخدام المكونات المحلية لمنع نقص اليوم.
 */
export const toInputDateString = (date: Date | string | null | undefined): string => {
    if (!date) return ''; 
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * تحويل النص المدخل إلى كائن تاريخ مع ضبط الساعة 12 ظهراً لضمان عدم تغير اليوم.
 */
export const parseInputDateString = (dateString: string | null | undefined): Date | null => {
    if (!dateString || typeof dateString !== 'string') return null;
    const parts = dateString.split('-');
    if (parts.length !== 3) return null;
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    
    // نستخدم 12 ظهراً كمنطقة عازلة تمنع انزياح التاريخ عند التحويل لـ UTC
    const d = new Date(year, month, day, 12, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
};

export const isWeekend = (date: Date | string): boolean => {
    if (!date) return false;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return false;
    const day = d.getDay();
    return day === 5 || day === 6; 
};

export const getPublicHoliday = (date: Date | string): string | null => {
    if (!date) return null;
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return null;
    return null;
};

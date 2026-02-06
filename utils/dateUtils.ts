
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

const ensureDate = (date: Date | string | number | undefined | null): Date => {
    if (!date) return new Date();
    if (date instanceof Date) return date;
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
};

export const isSameDay = (date1: Date | string | number, date2: Date | string | number): boolean => {
    const d1 = ensureDate(date1);
    const d2 = ensureDate(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
};

export const isToday = (date: Date | string | number): boolean => {
    return isSameDay(date, new Date());
}

export const isBeforeToday = (date: Date | string | number): boolean => {
    const d = ensureDate(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of today
    return d < today;
}

export const formatDate = (date: Date | string | number): string => {
    const d = ensureDate(date);
    return new Intl.DateTimeFormat('ar-SY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(d);
};

/**
 * A robust helper function to format a Date object or string into a 'YYYY-MM-DD' string for input fields.
 * It handles null, undefined, empty, and invalid date strings gracefully.
 */
export const toInputDateString = (date: Date | string | null | undefined): string => {
    if (!date) return ''; 
    const d = new Date(date);
    if (isNaN(d.getTime())) {
        return '';
    }
    // Correctly handle local time for YYYY-MM-DD format
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * A robust helper function to parse a 'YYYY-MM-DD' string from an input field into a Date object.
 */
export const parseInputDateString = (dateString: string | null | undefined): Date | null => {
    if (!dateString) return null;
    const d = new Date(`${dateString}T00:00:00`);
    if (isNaN(d.getTime())) {
        console.warn(`Invalid date string provided to parseInputDateString: ${dateString}`);
        return null;
    }
    return d;
};


// --- Holiday and Weekend Logic ---

// List of fixed Syrian public holidays (Month is 0-indexed)
const fixedHolidays: { month: number; day: number; name: string }[] = [
    { month: 0, day: 1, name: 'رأس السنة الميلادية' },
    { month: 2, day: 21, name: 'عيد الأم' },
    { month: 3, day: 17, name: 'عيد الجلاء' },
    { month: 4, day: 1, name: 'عيد العمال العالمي' },
    { month: 4, day: 6, name: 'عيد الشهداء' },
    { month: 9, day: 6, name: 'ذكرى حرب تشرين' },
    { month: 11, day: 25, name: 'عيد الميلاد المجيد' },
];

// Approximations for floating holidays for 2024-2025.
const floatingHolidays: { [year: number]: { month: number; day: number; name: string; length?: number }[] } = {
    2024: [
        { month: 3, day: 10, name: 'عيد الفطر', length: 3 },
        { month: 5, day: 16, name: 'عيد الأضحى', length: 4 },
        { month: 6, day: 7, name: 'رأس السنة الهجرية' },
        { month: 8, day: 15, name: 'المولد النبوي الشريف' },
        { month: 2, day: 31, name: 'عيد الفصح (غربي)'},
        { month: 4, day: 5, name: 'عيد الفصح (شرقي)'},
    ],
    2025: [
        { month: 2, day: 30, name: 'عيد الفطر', length: 3 },
        { month: 5, day: 6, name: 'عيد الأضحى', length: 4 },
        { month: 5, day: 26, name: 'رأس السنة الهجرية' },
        { month: 8, day: 4, name: 'المولد النبوي الشريف' },
        { month: 3, day: 20, name: 'عيد الفصح (غربي وشرقي)'},
    ],
};

export const isWeekend = (date: Date): boolean => {
    const day = date.getDay();
    return day === 5 || day === 6; // 5 = Friday, 6 = Saturday
};

export const getPublicHoliday = (date: Date): string | null => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    const fixedHoliday = fixedHolidays.find(h => h.month === month && h.day === day);
    if (fixedHoliday) {
        return fixedHoliday.name;
    }

    const yearFloatingHolidays = floatingHolidays[year] || [];
    for (const holiday of yearFloatingHolidays) {
        if (holiday.length) {
            const startDate = new Date(year, holiday.month, holiday.day);
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + holiday.length - 1);

            if (date >= startDate && date <= endDate) {
                return holiday.name;
            }
        } else {
             if (holiday.month === month && holiday.day === day) {
                return holiday.name;
            }
        }
    }
    
    return null;
};

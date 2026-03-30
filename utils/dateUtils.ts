
export const get_days_in_month = (year: number, month: number): Date[] => {
    const date = new Date(year, month, 1);
    const days: Date[] = [];
    while (date.getMonth() === month) {
        days.push(new Date(date));
        date.setDate(date.getDate() + 1);
    }
    return days;
};

export const get_first_day_of_month = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay();
};

/**
 * Safely revives a date value (string or object) into a Date object.
 * Returns the current date if the input is invalid or null.
 */
export const safe_revive_date = (date: any): Date => {
    if (!date) return new Date();
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
};

export const is_same_day = (d1: Date | string | null | undefined, d2: Date | string | null | undefined): boolean => {
    if (!d1 || !d2) return false;
    
    const s1 = to_input_date_string(d1);
    const s2 = to_input_date_string(d2);
    
    return s1 !== '' && s2 !== '' && s1 === s2;
};

export const is_today = (date: Date | string): boolean => {
    return is_same_day(date, new Date());
}

export const is_before_today = (date: Date | string): boolean => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    
    const s_date = to_input_date_string(d);
    const s_today = to_input_date_string(new Date());
    
    return s_date < s_today;
}

export const format_date = (date: Date | string): string => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'تاريخ غير صالح';
    return new Intl.DateTimeFormat('ar-SY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(d);
};

/**
 * A robust helper function to format a Date object or string into a 'YYYY-MM-DD' string for input fields.
 * It handles null, undefined, empty, and invalid date strings gracefully.
 * @param date The date to format.
 * @returns A formatted 'YYYY-MM-DD' string or an empty string if the date is invalid.
 */
export const to_input_date_string = (date: Date | string | null | undefined): string => {
    if (!date) return ''; // Handles null, undefined, ''
    
    // If it's a string in YYYY-MM-DD format, return it as is to avoid timezone shifts
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
    }

    const d = new Date(date);
    if (isNaN(d.getTime())) { // Handles invalid dates
        return '';
    }
    
    // If it's a string that might be an ISO string, we need to be careful.
    // If it was created from a string like "2026-03-26", new Date() makes it UTC.
    // We want the date part that the user intended.
    
    // If the input was a string and contains 'T', it's likely an ISO string with time.
    // In that case, we should use local time parts.
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * A robust helper function to parse a 'YYYY-MM-DD' string from an input field into a Date object.
 * It correctly handles timezones by creating the date at midnight in the user's local timezone.
 * @param date_string The date string to parse.
 * @returns A Date object or null if the string is invalid.
 */
export const parse_input_date_string = (date_string: string | null | undefined): Date | null => {
    if (!date_string) return null;
    // The 'T00:00:00' part ensures the date is parsed in the local timezone, not UTC.
    const d = new Date(`${date_string}T00:00:00`);
    if (isNaN(d.getTime())) {
        console.warn(`Invalid date string provided to parse_input_date_string: ${date_string}`);
        return null;
    }
    return d;
};


// --- Holiday and Weekend Logic ---

// List of fixed Syrian public holidays (Month is 0-indexed)
const fixed_holidays: { month: number; day: number; name: string }[] = [
    { month: 0, day: 1, name: 'رأس السنة الميلادية' },
    { month: 2, day: 21, name: 'عيد الأم' },
    { month: 3, day: 17, name: 'عيد الجلاء' },
    { month: 4, day: 1, name: 'عيد العمال العالمي' },
    { month: 4, day: 6, name: 'عيد الشهداء' },
    { month: 9, day: 6, name: 'ذكرى حرب تشرين' },
    { month: 11, day: 25, name: 'عيد الميلاد المجيد' },
];

// Approximations for floating holidays for 2024-2025.
const floating_holidays: { [year: number]: { month: number; day: number; name: string; length?: number }[] } = {
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

/**
 * Checks if a given date is a weekend (Friday or Saturday).
 * @param date The date to check.
 * @returns True if the date is a Friday or Saturday.
 */
export const is_weekend = (date: Date | string): boolean => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return false;
    const day = d.getDay();
    return day === 5 || day === 6; // 5 = Friday, 6 = Saturday
};

/**
 * Checks if a given date is a weekend or a public holiday.
 * @param date The date to check.
 * @returns True if the date is a weekend or a public holiday.
 */
export const is_holiday = (date: Date | string): boolean => {
    return is_weekend(date) || get_public_holiday(date) !== null;
};

/**
 * Checks if a given date is a Syrian public holiday.
 * @param date The date to check.
 * @returns The name of the holiday if it is one, otherwise null.
 */
export const get_public_holiday = (date: Date | string): string | null => {
    const d = new Date(date);
    if (isNaN(d.getTime())) return null;
    
    const year = d.getFullYear();
    const month = d.getMonth();
    const day = d.getDate();

    // Check fixed holidays
    const fixed_holiday = fixed_holidays.find(h => h.month === month && h.day === day);
    if (fixed_holiday) {
        return fixed_holiday.name;
    }

    // Check floating holidays for the given year
    const year_floating_holidays = floating_holidays[year] || [];
    for (const holiday of year_floating_holidays) {
        if (holiday.length) { // For multi-day holidays like Eid
            const start_date = new Date(year, holiday.month, holiday.day);
            const end_date = new Date(start_date);
            end_date.setDate(start_date.getDate() + holiday.length - 1);

            if (d >= start_date && d <= end_date) {
                return holiday.name;
            }
        } else { // For single-day holidays
             if (holiday.month === month && holiday.day === day) {
                return holiday.name;
            }
        }
    }
    
    return null;
};

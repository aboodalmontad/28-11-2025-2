
import * as React from 'react';
import ReactDatePicker, { registerLocale } from 'react-datepicker';
import { ar } from 'date-fns/locale/ar';
import { safe_revive_date, to_input_date_string } from '../utils/dateUtils';
import { CalendarDaysIcon } from './icons';

registerLocale('ar', ar);

interface DatePickerProps {
    value: string | Date | null | undefined;
    onChange: (date: string, name?: string) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
    disabled?: boolean;
    name?: string;
    id?: string;
}

const DatePicker: React.FC<DatePickerProps> = ({ 
    value, 
    onChange, 
    placeholder = 'dd/mm/yyyy', 
    className = '', 
    required = false,
    disabled = false,
    name,
    id
}) => {
    const selectedDate = value ? safe_revive_date(value) : null;

    const handleChange = (date: Date | null) => {
        onChange(date ? to_input_date_string(date) : '', name);
    };

    return (
        <div className="relative w-full">
            <ReactDatePicker
                selected={selectedDate}
                onChange={handleChange}
                dateFormat="dd/MM/yyyy"
                locale="ar"
                placeholderText={placeholder}
                className={`w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none transition-all ${className}`}
                required={required}
                disabled={disabled}
                name={name}
                id={id}
                autoComplete="off"
                isClearable={false}
                showYearDropdown
                scrollableYearDropdown
                yearDropdownItemNumber={15}
                portalId="datepicker-portal"
            />
            <CalendarDaysIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
    );
};

export default DatePicker;

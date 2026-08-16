import * as React from "react";
import ReactDatePicker, { registerLocale } from "react-datepicker";
import { ar } from "date-fns/locale/ar";
import { safe_revive_date, to_input_date_string, format_month_year } from "../utils/dateUtils";
import { CalendarDaysIcon } from "./icons";

registerLocale("ar", ar);

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
  placeholder = "dd/mm/yyyy",
  className = "",
  required = false,
  disabled = false,
  name,
  id,
}) => {
  const selectedDate = value ? safe_revive_date(value) : null;

  const handleChange = (date: Date | null) => {
    onChange(date ? to_input_date_string(date) : "", name);
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
        renderCustomHeader={({
          date,
          decreaseMonth,
          increaseMonth,
          prevMonthButtonDisabled,
          nextMonthButtonDisabled,
        }) => (
          <div className="flex items-center justify-between px-2 py-1 bg-gray-50 border-b">
            <button
              onClick={decreaseMonth}
              disabled={prevMonthButtonDisabled}
              type="button"
              className="p-1 hover:bg-gray-200 rounded text-gray-700 disabled:opacity-30 text-xs font-bold"
            >
              {"<"}
            </button>
            <span className="font-bold text-gray-800 text-xs">
              {format_month_year(date)}
            </span>
            <button
              onClick={increaseMonth}
              disabled={nextMonthButtonDisabled}
              type="button"
              className="p-1 hover:bg-gray-200 rounded text-gray-700 disabled:opacity-30 text-xs font-bold"
            >
              {">"}
            </button>
          </div>
        )}
      />
      <CalendarDaysIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
};

export default DatePicker;

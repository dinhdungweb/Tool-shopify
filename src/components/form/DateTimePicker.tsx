import { useEffect } from 'react';
import flatpickr from 'flatpickr';
import 'flatpickr/dist/flatpickr.css';
import Label from './Label';
import { CalenderIcon } from '../../icons';

type DateTimePickerProps = {
  id: string;
  value?: string;
  onChange?: (date: string) => void;
  label?: string;
  placeholder?: string;
  minDate?: string;
  disabled?: boolean;
};

export default function DateTimePicker({
  id,
  value,
  onChange,
  label,
  placeholder,
  minDate,
  disabled = false,
}: DateTimePickerProps) {
  useEffect(() => {
    const flatPickr = flatpickr(`#${id}`, {
      enableTime: true,
      dateFormat: "Y-m-d H:i",
      time_24hr: true,
      static: false, // Allow calendar to append to body to avoid overflow issues
      monthSelectorType: "static",
      defaultDate: value || undefined,
      minDate: minDate || undefined,
      appendTo: document.body, // Append to body to avoid z-index issues
      onChange: (selectedDates) => {
        if (onChange && selectedDates.length > 0) {
          const date = selectedDates[0];
          // Format to datetime-local format (YYYY-MM-DDTHH:mm)
          const formatted = date.toISOString().slice(0, 16);
          onChange(formatted);
        }
      },
    });

    return () => {
      if (!Array.isArray(flatPickr)) {
        flatPickr.destroy();
      }
    };
  }, [id, value, onChange, minDate]);

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          id={id}
          placeholder={placeholder}
          disabled={disabled}
          className="h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700 dark:focus:border-brand-800 disabled:opacity-50 disabled:cursor-not-allowed"
        />

        <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  );
}

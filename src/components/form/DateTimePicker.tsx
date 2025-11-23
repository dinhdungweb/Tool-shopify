import { useEffect, useRef } from 'react';
import flatpickr from 'flatpickr';
import type { Instance } from 'flatpickr/dist/types/instance';
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
  const flatpickrInstance = useRef<Instance | Instance[] | null>(null);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    if (!flatpickrInstance.current) {
      const instance = flatpickr(`#${id}`, {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        time_24hr: true,
        static: false,
        monthSelectorType: "static",
        defaultDate: value || undefined,
        minDate: minDate || undefined,
        appendTo: document.body,
        onChange: (selectedDates) => {
          if (onChange && selectedDates.length > 0 && !isUpdatingRef.current) {
            const date = selectedDates[0];
            // Format to local datetime string without timezone conversion
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const formatted = `${year}-${month}-${day}T${hours}:${minutes}`;
            onChange(formatted);
          }
        },
      });
      flatpickrInstance.current = instance;
    }

    return () => {
      if (flatpickrInstance.current) {
        if (Array.isArray(flatpickrInstance.current)) {
          flatpickrInstance.current.forEach(fp => fp.destroy());
        } else {
          flatpickrInstance.current.destroy();
        }
        flatpickrInstance.current = null;
      }
    };
  }, [id]);

  // Update flatpickr when value changes externally (without recreating instance)
  useEffect(() => {
    if (flatpickrInstance.current && value) {
      isUpdatingRef.current = true;
      const instance = Array.isArray(flatpickrInstance.current) 
        ? flatpickrInstance.current[0] 
        : flatpickrInstance.current;
      instance.setDate(value, false); // false = don't trigger onChange
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  }, [value]);

  // Update minDate when it changes
  useEffect(() => {
    if (flatpickrInstance.current && minDate) {
      const instance = Array.isArray(flatpickrInstance.current) 
        ? flatpickrInstance.current[0] 
        : flatpickrInstance.current;
      instance.set('minDate', minDate);
    }
  }, [minDate]);

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

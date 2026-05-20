import type { ReactNode } from 'react';
import { clsx } from 'clsx';

type FormFieldProps = {
  id: string;
  label: string;
  required?: boolean;
  helper?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
};

export function FormField({
  id,
  label,
  required,
  helper,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={clsx('flex flex-col', className)}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700 mb-1.5"
      >
        {label}
        {required && (
          <span className="text-rose-500 ml-0.5" aria-label="required">
            *
          </span>
        )}
      </label>
      {children}
      {helper && !error && (
        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{helper}</p>
      )}
      {error && (
        <p
          className="mt-1.5 text-xs text-rose-600 font-medium"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

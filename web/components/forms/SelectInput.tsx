import { forwardRef, type SelectHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { selectBase } from './inputStyles';

type SelectInputProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  function SelectInput({ className, invalid, children, ...rest }, ref) {
    return (
      <select
        ref={ref}
        className={clsx(selectBase, className)}
        aria-invalid={invalid || undefined}
        {...rest}
      >
        {children}
      </select>
    );
  },
);

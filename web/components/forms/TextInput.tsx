import { forwardRef, type InputHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { inputBase } from './inputStyles';

type TextInputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  function TextInput({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={clsx(inputBase, className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);

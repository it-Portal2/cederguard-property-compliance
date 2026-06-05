import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { textareaBase } from './inputStyles';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={clsx(textareaBase, className)}
        aria-invalid={invalid || undefined}
        {...rest}
      />
    );
  },
);

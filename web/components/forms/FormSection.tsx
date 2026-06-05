import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

type FormSectionProps = {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function FormSection({
  icon: Icon,
  title,
  description,
  action,
  children,
  className,
}: FormSectionProps) {
  return (
    <section className={clsx('space-y-6', className)}>
      <header className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="min-w-0 flex items-start gap-3">
          {Icon && (
            <span className="mt-0.5 inline-flex w-9 h-9 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 flex-shrink-0">
              <Icon className="w-5 h-5" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 leading-tight">
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

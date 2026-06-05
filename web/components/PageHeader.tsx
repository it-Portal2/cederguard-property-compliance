import { Fragment } from "react";

interface BreadcrumbItem {
  label: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  const inner = (
    <div>
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
        {breadcrumbs.map((crumb, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="text-slate-300">/</span>}
            <span
              className={
                i === breadcrumbs.length - 1
                  ? "text-slate-700 font-medium truncate max-w-[420px]"
                  : "text-slate-500"
              }
            >
              {crumb.label}
            </span>
          </Fragment>
        ))}
      </nav>
      <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="text-[13px] text-slate-500 mt-1 max-w-2xl">{subtitle}</p>}
    </div>
  );

  if (actions) {
    return (
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        {inner}
        <div>{actions}</div>
      </div>
    );
  }

  return inner;
}

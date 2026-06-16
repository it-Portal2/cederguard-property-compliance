import { Link } from "react-router";
import { Plus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Button text. The button only renders when `showAction` and a `to`/`onAction` is given. */
  actionLabel?: string;
  /** Render the action as a router Link to this path. */
  to?: string;
  /** Render the action as a button calling this handler (used when `to` is absent). */
  onAction?: () => void;
  /** Toggle the call-to-action button (e.g. gate on a permission). Defaults to true. */
  showAction?: boolean;
}

/**
 * Shared Resource Planner empty state — stacked translucent tiles with the page
 * icon and an optional "+" token, a title, a description, and an optional CTA.
 * Reused across the Dashboard, Demand Forecast and Timeline pages.
 */
export default function RpEmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  to,
  onAction,
  showAction = true,
}: Props) {
  const hasAction = !!(showAction && actionLabel && (to || onAction));
  const btnClass =
    "mt-5 inline-flex items-center gap-1.5 px-4 h-10 bg-indigo-600 text-white text-sm font-semibold rounded-md hover:bg-indigo-700 transition-colors";

  return (
    <div className="bg-white rounded-xl border border-slate-200 px-6 py-16">
      <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
        {/* Stacked translucent tiles + optional plus token */}
        <div className="relative w-32 h-24 mb-6">
          <span className="absolute left-3 top-4 w-20 h-12 rounded-md bg-slate-100 border border-slate-200 -rotate-6" />
          <span className="absolute left-7 top-2 w-20 h-12 rounded-md bg-slate-50 border border-slate-200 rotate-3" />
          <span className="absolute left-11 top-0 w-20 h-12 rounded-md bg-white border border-slate-300 shadow-sm flex items-center justify-center">
            <Icon className="w-5 h-5 text-indigo-500" />
          </span>
          {hasAction && (
            <span className="absolute -right-1 -top-1 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-sm ring-4 ring-white">
              <Plus className="w-4 h-4" strokeWidth={3} />
            </span>
          )}
        </div>

        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm text-slate-500 max-w-sm">{description}</p>
        )}

        {hasAction &&
          (to ? (
            <Link to={to} className={btnClass}>
              <Plus className="w-4 h-4" /> {actionLabel}
            </Link>
          ) : (
            <button onClick={onAction} className={btnClass}>
              <Plus className="w-4 h-4" /> {actionLabel}
            </button>
          ))}
      </div>
    </div>
  );
}

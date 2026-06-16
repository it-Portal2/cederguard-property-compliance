import type { ResourceScheme } from "../../../lib/resourcePlanner/types";

export interface SchemeFilterState {
  programme: string;
  batch: string;
  route: string;
  status: string;
  complexity: string;
}

export const emptySchemeFilters: SchemeFilterState = {
  programme: "",
  batch: "",
  route: "",
  status: "",
  complexity: "",
};

const UNMAPPED = "(unmapped)";

/** Apply the filter bar to a scheme list (programme/batch/route/status/complexity). */
export function applySchemeFilters(
  schemes: ResourceScheme[],
  f: SchemeFilterState,
): ResourceScheme[] {
  return schemes.filter((s) => {
    if (f.programme && (s.programme || "") !== f.programme) return false;
    if (f.batch && (s.batch || "") !== f.batch) return false;
    if (f.route && (s.deliveryRoute || "") !== f.route) return false;
    if (f.status && (s.status || "") !== f.status) return false;
    if (f.complexity) {
      if (f.complexity === UNMAPPED) {
        if (s.complexity) return false;
      } else if (s.complexity !== f.complexity) return false;
    }
    return true;
  });
}

const distinct = (schemes: ResourceScheme[], pick: (s: ResourceScheme) => string) =>
  Array.from(new Set(schemes.map(pick).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

export default function SchemeFilters({
  schemes,
  value,
  onChange,
}: {
  schemes: ResourceScheme[];
  value: SchemeFilterState;
  onChange: (next: SchemeFilterState) => void;
}) {
  const complexityValues = (() => {
    const set = new Set<string>();
    schemes.forEach((s) => set.add(s.complexity || UNMAPPED));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  })();

  const selectCls =
    "rounded-lg border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-200";

  const dropdown = (
    key: keyof SchemeFilterState,
    label: string,
    options: string[],
  ) => (
    <select
      className={selectCls}
      value={value[key]}
      onChange={(e) => onChange({ ...value, [key]: e.target.value })}
      aria-label={label}
    >
      <option value="">{label}: all</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );

  const dirty = Object.values(value).some(Boolean);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {dropdown("programme", "Programme", distinct(schemes, (s) => s.programme || ""))}
      {dropdown("batch", "Batch", distinct(schemes, (s) => s.batch || ""))}
      {dropdown("route", "Route", distinct(schemes, (s) => s.deliveryRoute || ""))}
      {dropdown("status", "Status", distinct(schemes, (s) => s.status || ""))}
      {dropdown("complexity", "Complexity", complexityValues)}
      {dirty && (
        <button
          onClick={() => onChange(emptySchemeFilters)}
          className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-indigo-600 hover:bg-indigo-50"
        >
          Clear
        </button>
      )}
    </div>
  );
}

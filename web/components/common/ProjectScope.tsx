import { clsx } from "clsx";

export type ProjectScope = "project" | "all";

/**
 * Filter a tenant-wide register to the active project. In "project" mode this
 * keeps records tagged to the active project. By default it also keeps org-wide
 * (untagged) records, since a shared register's org-wide entries apply to every
 * project — pass `includeUntagged: false` for registers where an untagged record
 * belongs to no project (e.g. Resource Planner schemes → portfolio-only). "all"
 * returns everything. No server round-trip — the register is already loaded.
 */
export function scopeByProject<T extends { projectId?: string | null }>(
  items: T[],
  scope: ProjectScope,
  activeProjectId: string | null,
  opts?: { includeUntagged?: boolean },
): T[] {
  if (scope !== "project" || !activeProjectId) return items;
  const includeUntagged = opts?.includeUntagged ?? true;
  return items.filter(
    (i) =>
      i.projectId === activeProjectId || (includeUntagged && !i.projectId),
  );
}

export function ProjectScopeToggle({
  scope,
  onChange,
}: {
  scope: ProjectScope;
  onChange: (scope: ProjectScope) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-semibold shadow-sm">
      <button
        type="button"
        onClick={() => onChange("project")}
        className={clsx(
          "rounded-md px-2.5 py-1.5",
          scope === "project"
            ? "bg-indigo-600 text-white"
            : "text-slate-600 hover:text-indigo-700",
        )}
      >
        This project
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={clsx(
          "rounded-md px-2.5 py-1.5",
          scope === "all"
            ? "bg-indigo-600 text-white"
            : "text-slate-600 hover:text-indigo-700",
        )}
      >
        All
      </button>
    </div>
  );
}

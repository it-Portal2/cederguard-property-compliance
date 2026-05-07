import { clsx } from "clsx";
import {
  FileText,
  Image as ImageIcon,
  ClipboardList,
  PoundSterling,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

// 5-tab strip for the enquiry workspace. Summary is the default + the only
// fully-implemented tab in Phase 3. Drawing / RFI / Cost / Compliance render
// placeholder content until their phases ship (4 / 5 / 6 / 7 respectively).
//
// No Sparkle / Brain / Rocket / Wand2 icons.

export type TacWorkspaceTabId =
  | "summary"
  | "drawing"
  | "rfi"
  | "costProgramme"
  | "compliance";

interface TabSpec {
  id: TacWorkspaceTabId;
  label: string;
  icon: LucideIcon;
  /** Phase that ships the real implementation. Used for the "Coming in Phase X"
   *  hint inside placeholder tabs (not on the strip itself). */
  phase: number;
  available: boolean;
}

export const TAB_SPECS: TabSpec[] = [
  {
    id: "summary",
    label: "Summary",
    icon: FileText,
    phase: 3,
    available: true,
  },
  {
    id: "drawing",
    label: "Drawing",
    icon: ImageIcon,
    phase: 4,
    available: true,
  },
  {
    id: "rfi",
    label: "RFI draft",
    icon: ClipboardList,
    phase: 5,
    available: true,
  },
  {
    id: "costProgramme",
    label: "Cost & programme",
    icon: PoundSterling,
    phase: 6,
    available: true,
  },
  {
    id: "compliance",
    label: "Compliance & citations",
    icon: ShieldCheck,
    phase: 7,
    available: true,
  },
];

interface TabStripProps {
  activeTab: TacWorkspaceTabId;
  onChange: (id: TacWorkspaceTabId) => void;
}

export function TabStrip({ activeTab, onChange }: TabStripProps) {
  return (
    <div
      className="border-b border-slate-200"
      role="tablist"
      aria-label="Enquiry deliverables"
    >
      <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto">
        {TAB_SPECS.map((spec) => {
          const Icon = spec.icon;
          const isActive = activeTab === spec.id;
          return (
            <button
              key={spec.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(spec.id)}
              className={clsx(
                "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                isActive
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700",
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
              {spec.label}
              {!spec.available && (
                <span className="ml-1 inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

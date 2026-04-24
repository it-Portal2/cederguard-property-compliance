// Client-side view of the template library. Mirrors api/lib/templateSeed.ts.

export type TemplateCategory =
  | 'gateway'
  | 'milestone'
  | 'finance'
  | 'shareholder'
  | 'cabinet'
  | 'other';

export interface TemplateSection {
  id: string;
  order: number;
  name: string;
  guidance: string;
  mandatory: boolean;
  /** Seed-only. Super-admin can still flip. PgM cannot. Matches UK statutory
   *  Cabinet-paper requirements. */
  statutory: boolean;
  /** PgM-toggleable soft-lock. Prevents author deletion; can be unlocked by
   *  the PgM again at any time. Decoupled from statutory so PgMs can protect
   *  council-specific sections without claiming legal status. */
  locked?: boolean;
  aiDraftAllowed: boolean;
  complianceCheck: boolean;
  citedRegulations?: string[];
  routingRules?: string;
  requiredAttachments?: string[];
}

export interface ReportTemplate {
  _id: string;
  id: string;
  clientId: string;
  code: string;
  category: TemplateCategory;
  title: string;
  description: string;
  defaultRoute: string;
  requireSeniorPmReview: boolean;
  sections: TemplateSection[];
  version: number;
  status: 'draft' | 'published' | 'superseded';
  customised: boolean;
  originStarterId: string | null;
  publishedAt?: string;
  publishedBy?: string;
  updatedAt?: string;
  createdAt?: string;
}

export const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  gateway: 'Gateway',
  milestone: 'Key Milestone',
  finance: 'Finance',
  shareholder: 'Shareholder',
  cabinet: 'Cabinet',
  other: 'Other',
};

// Per-category chrome. Same palette as TIER_STYLES in framework/types.ts to
// keep visual language consistent.
export const CATEGORY_STYLES: Record<
  TemplateCategory,
  { badge: string; dot: string; ring: string }
> = {
  gateway: {
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-200',
  },
  milestone: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
  },
  finance: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
  },
  shareholder: {
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
    ring: 'ring-rose-200',
  },
  cabinet: {
    badge: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    dot: 'bg-indigo-600',
    ring: 'ring-indigo-200',
  },
  other: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500',
    ring: 'ring-slate-200',
  },
};

export const CATEGORY_FILTERS: Array<{ key: TemplateCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'gateway', label: 'Gateway' },
  { key: 'milestone', label: 'Key Milestone' },
  { key: 'finance', label: 'Finance' },
  { key: 'shareholder', label: 'Shareholder' },
  { key: 'cabinet', label: 'Cabinet' },
  { key: 'other', label: 'Other' },
];

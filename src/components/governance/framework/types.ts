// Client-side view of the framework data. Mirrors api/lib/frameworkSeed.ts.
// Kept local to the framework folder so the rest of the app doesn't reach
// into governance types it doesn't need.

export type BodyTier = 'political' | 'corporate' | 'programme' | 'project';

export interface FrameworkBody {
  _id: string;
  id: string;
  clientId: string;
  frameworkId: string;
  tier: BodyTier;
  name: string;
  cadence: string;
  chair: string;
  authority: string;
  acceptedReportTypes?: string[];
  standingItems?: string[];
  colorHex?: string;
  cabinetMemberPortfolio?: string;
  stepSequence?: Array<{
    key: string;
    label: string;
    offsetWorkingDays: number;
    responsibility?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface FrameworkThreshold {
  _id: string;
  id: string;
  bandLabel: string;
  bandMin: number | null;
  bandMax: number | null;
  decisionRoute: string;
  reportTypes?: string[];
  notes?: string;
}

export interface Framework {
  clientId: string;
  version: number;
  status: 'draft' | 'published' | 'superseded';
  publishedAt?: string;
  publishedBy?: string;
  updatedAt?: string;
  seeded?: boolean;
}

export interface TermsOfReference {
  _id: string;
  ownerBodyId: string;
  clientId: string;
  version: number;
  status: 'draft' | 'published' | 'superseded';
  purpose?: string;
  scope?: string;
  authorityLevel?: string;
  decisionRights?: string;
  operatingPrinciples?: string;
  publishedAt?: string;
  publishedBy?: string;
  updatedAt?: string;
  supersededAt?: string;
}

export interface FrameworkSnapshot {
  framework: Framework | null;
  bodies: FrameworkBody[];
  thresholds: FrameworkThreshold[];
  /** Active ToR per body — draft if one exists, else published. */
  tors: Record<string, TermsOfReference>;
  /** Last published ToR per body, independent of whether a draft exists.
   *  Used for the status badge context ("last published vN on ..."). */
  publishedTors: Record<string, TermsOfReference>;
}

export const TIER_ORDER: BodyTier[] = ['political', 'corporate', 'programme', 'project'];
export const TIER_LABEL: Record<BodyTier, string> = {
  political: 'Political',
  corporate: 'Corporate',
  programme: 'Programme',
  project: 'Project',
};
// Tier chrome — subtle top-border accent + pill colour. No violet.
export const TIER_STYLES: Record<BodyTier, { badge: string; dot: string; ring: string }> = {
  political: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500',
    ring: 'ring-amber-200',
  },
  corporate: {
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
    ring: 'ring-indigo-200',
  },
  programme: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-200',
  },
  project: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500',
    ring: 'ring-slate-200',
  },
};

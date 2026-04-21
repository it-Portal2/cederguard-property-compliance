export type ProjectSize = 'Small' | 'Medium' | 'Large' | 'Major';
export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export const L_TO_PCT: Record<RiskLevel, number> = {
  1: 20,
  2: 40,
  3: 60,
  4: 80,
  5: 100,
};

export const PROGRAMME_IMPACT_BANDS: Record<RiskLevel, number> = {
  1: 250_000,
  2: 1_000_000,
  3: 5_000_000,
  4: 10_000_000,
  5: 15_000_000,
};

export const PROJECT_IMPACT_BANDS: Record<ProjectSize, Record<RiskLevel, number>> = {
  Small: { 1: 5_000, 2: 50_000, 3: 100_000, 4: 150_000, 5: 200_000 },
  Medium: { 1: 25_000, 2: 50_000, 3: 100_000, 4: 150_000, 5: 200_000 },
  Large: { 1: 25_000, 2: 50_000, 3: 100_000, 4: 150_000, 5: 200_000 },
  Major: { 1: 25_000, 2: 50_000, 3: 100_000, 4: 300_000, 5: 400_000 },
};

export const DEFAULT_PROJECT_SIZE: ProjectSize = 'Medium';

export const PROJECT_SIZE_OPTIONS: { value: ProjectSize; label: string }[] = [
  { value: 'Small', label: 'Small (≤ £5m / ≤ 50 units)' },
  { value: 'Medium', label: 'Medium (£5–25m / 50–150 units)' },
  { value: 'Large', label: 'Large (£25–75m / 150–400 units)' },
  { value: 'Major', label: 'Major (> £75m / 400+ units)' },
];

export function clampRiskLevel(v: unknown): RiskLevel {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return 1;
  const clamped = Math.max(1, Math.min(5, Math.round(n)));
  return clamped as RiskLevel;
}

export function resolveImpactValue(
  impactRating: RiskLevel,
  opts: { isProgrammeLevel: boolean; projectSize?: ProjectSize }
): number {
  if (opts.isProgrammeLevel) return PROGRAMME_IMPACT_BANDS[impactRating];
  return PROJECT_IMPACT_BANDS[opts.projectSize ?? DEFAULT_PROJECT_SIZE][impactRating];
}

/**
 * Infer ProjectSize from existing project fields.
 * Uses numberOfUnits (primary — set at project initiation) mapped to the
 * spec's unit bands: ≤50=Small, 51–150=Medium, 151–400=Large, 400+=Major.
 * Falls back to DEFAULT_PROJECT_SIZE when units are absent or unparseable.
 */
export function deriveProjectSize(project?: {
  numberOfUnits?: number | string | null;
} | null): ProjectSize {
  if (!project) return DEFAULT_PROJECT_SIZE;
  const raw = project.numberOfUnits;
  const units =
    typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(units) || units <= 0) return DEFAULT_PROJECT_SIZE;
  if (units <= 50) return 'Small';
  if (units <= 150) return 'Medium';
  if (units <= 400) return 'Large';
  return 'Major';
}

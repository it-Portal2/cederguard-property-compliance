import { useEffect, useMemo, useState } from 'react';
import { Loader2, Link2, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../../lib/api';

// ───── Standardised taxonomy ──────────────────

export const DECISION_LEVEL_OPTIONS = [
  'Strategic',
  'Corporate',
  'Programme',
  'Project',
] as const;
export type DecisionLevel = (typeof DECISION_LEVEL_OPTIONS)[number];

export const FINANCIAL_THRESHOLD_OPTIONS = [
  'Under £100k',
  '£100k – £500k',
  '£500k – £5m',
  '£5m+',
] as const;
export type FinancialThreshold = (typeof FINANCIAL_THRESHOLD_OPTIONS)[number];

export const RISK_PROFILE_OPTIONS = [
  'Building Safety / Compliance-critical',
  'Financial / Legal / Regulatory',
  'Standard',
] as const;
export type RiskProfile = (typeof RISK_PROFILE_OPTIONS)[number];

export const DECISION_AUTHORITY_OPTIONS = [
  'Cabinet / Members',
  'Executive Team',
  'Strategic Director',
  'Delegated Officer',
] as const;
export type DecisionAuthority = (typeof DECISION_AUTHORITY_OPTIONS)[number];

// ───── Shape ─────────────────────────────────────────────────────────────

export interface GovernanceProfileValues {
  decisionDeliveryLevel: DecisionLevel | '';
  financialThreshold: FinancialThreshold | '';
  riskRegulatoryProfile: RiskProfile | '';
  decisionAuthority: DecisionAuthority | '';
}

interface Props {
  values: GovernanceProfileValues;
  onChange: <K extends keyof GovernanceProfileValues>(
    key: K,
    val: GovernanceProfileValues[K],
  ) => void;
  disabled?: boolean;
  /** Tailwind class strings — passed through so we visually match the host
   *  page (Programme uses one set of input classes, Project another).*/
  classes: {
    label: string;
    input: string;
  };
}

// ───── Framework lookup helpers (: linked to live Framework) ──────

interface BodyLite {
  _id: string;
  id?: string;
  name?: string;
  tier?: string;
}

interface ThresholdLite {
  _id: string;
  label?: string;
  bandMin?: number | null;
  bandMax?: number | null;
  decisionRoute?: string;
  reportTypes?: string[];
}

// Map our standardised tier label → the framework's tier value casing.
function matchTierForLevel(level: DecisionLevel): string {
  switch (level) {
    case 'Strategic':
      return 'political';
    case 'Corporate':
      return 'corporate';
    case 'Programme':
      return 'programme';
    case 'Project':
      return 'project';
  }
}

// Map "£500k – £5m" → the threshold band that contains the upper bound.
// Authority bands stored as { bandMin, bandMax } in pounds.
function matchThresholdForBand(
  threshold: FinancialThreshold,
  bands: ThresholdLite[],
): ThresholdLite | null {
  // Probe value sits comfortably inside each enum band so the match is
  // unambiguous without depending on inclusive/exclusive band edges.
  let probe = 50_000;
  if (threshold === '£100k – £500k') probe = 250_000;
  else if (threshold === '£500k – £5m') probe = 2_500_000;
  else if (threshold === '£5m+') probe = 10_000_000;

  for (const b of bands) {
    const min = b.bandMin == null ? -Infinity : b.bandMin;
    const max = b.bandMax == null ? Infinity : b.bandMax;
    if (probe >= min && probe <= max) return b;
  }
  return null;
}

// ───── Component ─────────────────────────────────────────────────────────

export function GovernanceProfileFields({
  values,
  onChange,
  disabled,
  classes,
}: Props) {
  const [bodies, setBodies] = useState<BodyLite[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErrored(false);
      try {
        const res = await api.governanceGetFramework();
        if (cancelled) return;
        if (!res?.success) throw new Error(res?.error ?? 'Failed to load framework.');
        setBodies((res.bodies ?? []) as BodyLite[]);
        setThresholds((res.thresholds ?? []) as ThresholdLite[]);
      } catch (e) {
        if (cancelled) return;
        console.error('[GovernanceProfileFields] framework load failed', e);
        setErrored(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Derive the framework matches for each picked value.
  const matchedBodies = useMemo(() => {
    if (!values.decisionDeliveryLevel) return [];
    const tierKey = matchTierForLevel(values.decisionDeliveryLevel);
    return bodies.filter(
      (b) => (b.tier ?? '').toLowerCase() === tierKey,
    );
  }, [bodies, values.decisionDeliveryLevel]);

  const matchedThreshold = useMemo(() => {
    if (!values.financialThreshold) return null;
    return matchThresholdForBand(values.financialThreshold, thresholds);
  }, [thresholds, values.financialThreshold]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-50 pt-6">
      {/* Decision & Delivery Level*/}
      <FieldWrap classes={classes} label="Decision & Delivery Level">
        <select
          className={classes.input}
          value={values.decisionDeliveryLevel}
          disabled={disabled}
          onChange={(e) =>
            onChange('decisionDeliveryLevel', e.target.value as DecisionLevel | '')
          }
        >
          <option value="">— Select governance tier —</option>
          {DECISION_LEVEL_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o === 'Strategic' ? 'Strategic / Political' : o}
            </option>
          ))}
        </select>
        <FrameworkLinkLine
          loading={loading}
          errored={errored}
          empty={!values.decisionDeliveryLevel}
          emptyText="Defines the governance tier."
          matchText={
            matchedBodies.length === 0
              ? 'No matching framework bodies in your workspace yet.'
              : `Routes via ${matchedBodies
                  .slice(0, 4)
                  .map((b) => shortenBodyName(b.name))
                  .join(' · ')}${matchedBodies.length > 4 ? ` +${matchedBodies.length - 4} more` : ''}`
          }
        />
      </FieldWrap>

      {/* Financial Threshold*/}
      <FieldWrap classes={classes} label="Financial Threshold">
        <select
          className={classes.input}
          value={values.financialThreshold}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              'financialThreshold',
              e.target.value as FinancialThreshold | '',
            )
          }
        >
          <option value="">— Select threshold band —</option>
          {FINANCIAL_THRESHOLD_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <FrameworkLinkLine
          loading={loading}
          errored={errored}
          empty={!values.financialThreshold}
          emptyText="Determines approval route."
          matchText={
            matchedThreshold
              ? `Maps to "${matchedThreshold.label ?? '(unnamed band)'}" → ${matchedThreshold.decisionRoute ?? 'route not set'}`
              : 'No matching authority band configured.'
          }
        />
      </FieldWrap>

      {/* Risk / Regulatory Profile*/}
      <FieldWrap classes={classes} label="Risk / Regulatory Profile">
        <select
          className={classes.input}
          value={values.riskRegulatoryProfile}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              'riskRegulatoryProfile',
              e.target.value as RiskProfile | '',
            )
          }
        >
          <option value="">— Select profile —</option>
          {RISK_PROFILE_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[10px] text-slate-400">
          Triggers mandatory governance.
          {values.riskRegulatoryProfile ===
            'Building Safety / Compliance-critical' && (
            <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-amber-700">
              <AlertTriangle className="h-2.5 w-2.5" />
              HRB / BSB route enforced.
            </span>
          )}
        </p>
      </FieldWrap>

      {/* Decision Authority*/}
      <FieldWrap classes={classes} label="Decision Authority">
        <select
          className={classes.input}
          value={values.decisionAuthority}
          disabled={disabled}
          onChange={(e) =>
            onChange(
              'decisionAuthority',
              e.target.value as DecisionAuthority | '',
            )
          }
        >
          <option value="">— Select authority —</option>
          {DECISION_AUTHORITY_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[10px] text-slate-400">
          Sets escalation and approvals.
        </p>
      </FieldWrap>
    </div>
  );
}

// ───── Small helpers ─────────────────────────────────────────────────────

function shortenBodyName(fullName: string | undefined): string {
  if (!fullName) return '';
  const idx = fullName.indexOf(' · ');
  return idx > 0 ? fullName.slice(0, idx) : fullName;
}

function FieldWrap({
  classes,
  label,
  children,
}: {
  classes: Props['classes'];
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={classes.label}>{label}</label>
      {children}
    </div>
  );
}

function FrameworkLinkLine({
  loading,
  errored,
  empty,
  emptyText,
  matchText,
}: {
  loading: boolean;
  errored: boolean;
  empty: boolean;
  emptyText: string;
  matchText: string;
}) {
  if (empty) {
    return (
      <p className="mt-1.5 text-[10px] text-slate-400">{emptyText}</p>
    );
  }
  if (loading) {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-slate-400">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Resolving in the Governance Framework…
      </p>
    );
  }
  if (errored) {
    return (
      <p className="mt-1.5 text-[10px] text-amber-700">
        Couldn't load the Framework — saved as a label only.
      </p>
    );
  }
  return (
    <p
      className={clsx(
        'mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold',
        'text-indigo-700',
      )}
    >
      <Link2 className="h-2.5 w-2.5" />
      {matchText}
    </p>
  );
}

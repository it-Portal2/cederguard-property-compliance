import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { clsx } from 'clsx';

const STORAGE_KEY = 'cg.lastVisitAt';

function formatGBP(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`;
  return `£${Math.round(n)}`;
}

type Props = { className?: string };

export function SinceLastVisitBadge({ className }: Props) {
  const { risks } = useStore();
  const [lastVisitAt] = useState<Date | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Date(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      // ignore quota / privacy-mode errors
    }
  }, []);

  const safeRisks = Array.isArray(risks) ? risks : [];

  const since = useMemo(() => {
    if (!lastVisitAt) return null;
    const recent = safeRisks.filter((r: any) => {
      const raw = r?.dateAdded;
      if (!raw) return false;
      const d = new Date(raw);
      return !isNaN(d.getTime()) && d > lastVisitAt;
    });
    const newRisks = recent.length;
    const newExposure = recent.reduce(
      (s: number, r: any) => s + Number(r?.residualALE || 0),
      0,
    );
    if (newRisks === 0 && newExposure === 0) return null;
    return { newRisks, newExposure };
  }, [lastVisitAt, safeRisks]);

  if (!since) return null;

  return (
    <span
      className={clsx(
        'hidden 2xl:inline-flex items-center gap-2 h-8 px-3 bg-white border border-slate-200 rounded-md text-xs text-slate-600 whitespace-nowrap',
        className,
      )}
      title={`Since you last visited (${lastVisitAt?.toLocaleString('en-GB')})`}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"
        style={{
          boxShadow: '0 0 0 2px rgba(99,102,241,0.18)',
          animation: 'pulse 2.4s ease-out infinite',
        }}
      />
      <span>
        Since your last visit:{' '}
        <b className="font-semibold text-slate-900 tabular-nums">+{since.newRisks}</b>{' '}
        risk{since.newRisks === 1 ? '' : 's'}
        {since.newExposure > 0 ? (
          <>
            ,{' '}
            <b className="font-semibold text-slate-900 tabular-nums">
              +{formatGBP(since.newExposure)}
            </b>{' '}
            exposure
          </>
        ) : null}
      </span>
    </span>
  );
}

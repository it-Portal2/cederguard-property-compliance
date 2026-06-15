// Demo mode — client-only "Load / Clear demo data" persistence (localStorage,
// never the DB). Ids use the 'cgdemo-' prefix (NOT 'demo-', which collides with
// the 'demo-aspen-court' governance seed) so they can't hijack a real flow.

export const DEMO_KEY = 'cedar:demoMode';
export const DEMO_ID_PREFIX = 'cgdemo-';

export type DemoKind = 'programme' | 'project';

/** Persisted demo flag. `prior` = the real context to restore on Clear. */
export interface DemoFlag {
  kind: DemoKind;
  prior?: {
    projectId: string | null;
    programmeId: string | null;
  };
}

function hasStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage;
  } catch {
    return false;
  }
}

export function getDemoFlag(): DemoFlag | null {
  if (!hasStorage()) return null;
  try {
    const raw = window.localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoFlag;
    if (parsed?.kind === 'programme' || parsed?.kind === 'project') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function isDemoActive(): boolean {
  return getDemoFlag() !== null;
}

export function setDemoFlag(kind: DemoKind, prior?: DemoFlag['prior']): void {
  if (!hasStorage()) return;
  try {
    const payload: DemoFlag = prior ? { kind, prior } : { kind };
    window.localStorage.setItem(DEMO_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private-mode failures are non-fatal.
  }
}

export function clearDemoFlag(): void {
  if (!hasStorage()) return;
  try {
    window.localStorage.removeItem(DEMO_KEY);
  } catch {
    // no-op
  }
}

// Real project/programme ids never start with the prefix, so this is inert for
// real data — the store loaders use it to short-circuit to the demo bundle.
export function isDemoId(id?: string | null): boolean {
  return !!id && id.startsWith(DEMO_ID_PREFIX);
}

export function withTimeout<T>(promise: Promise<T>, ms: number, reason: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(reason)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export interface PostResult {
  ok: boolean;
  status: number;
  body: string;
}

/** POST JSON to an external webhook/API with a hard timeout. Never throws on HTTP error — returns the status. */
export async function postJson(
  url: string,
  payload: any,
  opts: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<PostResult> {
  const res = await withTimeout(
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: JSON.stringify(payload),
    }),
    opts.timeoutMs ?? 15000,
    'External request timed out',
  );
  const body = await res.text().catch(() => '');
  return { ok: res.ok, status: res.status, body };
}

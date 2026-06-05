// Best-effort write queue for dual-writes (e.g., programme-path sync after a
// primary risk save). Serializes with primary writes on the same collection
// key, but failures are swallowed with a console.error since the primary
// write is the source of truth.

const collectionQueues = new Map<string, Promise<unknown>>();

export function enqueueOnCollection<T>(
  collectionKey: string,
  work: () => Promise<T>,
): Promise<T> {
  const prev = collectionQueues.get(collectionKey) || Promise.resolve();
  const next = prev.catch(() => undefined).then(() => work());
  collectionQueues.set(collectionKey, next);
  next.finally(() => {
    if (collectionQueues.get(collectionKey) === next) {
      collectionQueues.delete(collectionKey);
    }
  });
  return next;
}

export function enqueueBestEffort(
  collectionKey: string,
  work: () => Promise<void>,
  context: string,
): void {
  enqueueOnCollection(collectionKey, work).catch((e) => {
    console.error(`[mutations] best-effort write failed: ${context}`, e);
  });
}

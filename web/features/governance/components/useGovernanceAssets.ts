import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../lib/api';

export interface StampRecord {
  id: string;
  label: string;
  url: string;
  sizeBytes?: number;
  updatedAt?: string;
}

export interface GovernanceAssets {
  logoUrl: string | null;
  stamps: Record<string, StampRecord>;
  signatureUrl: string | null;
}

const EMPTY: GovernanceAssets = { logoUrl: null, stamps: {}, signatureUrl: null };

// Pulls the signed-in user's signature + their council's logo + stamps in
// a single hook. Used by the editor so uploaded assets show up live inside
// the TipTap canvas (not just in the rendered PDF).
export function useGovernanceAssets() {
  const [assets, setAssets] = useState<GovernanceAssets>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [council, signature] = await Promise.all([
        api.governanceGetCouncilAssets(),
        api.governanceGetUserSignature(),
      ]);
      setAssets({
        logoUrl: council?.logoUrl ?? null,
        stamps: council?.stamps ?? {},
        signatureUrl: signature?.url ?? null,
      });
    } catch (e: any) {
      console.error('[useGovernanceAssets] fetch failed', e);
      setError(e?.message ?? 'Could not load branding assets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { assets, loading, error, refresh };
}

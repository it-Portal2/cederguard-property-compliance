// Programme Governance API — route handler map.
// All actions follow the project's standard return shape:
//   success → { success: true, ...payload }
//   failure → { success: false, error: string, code?: string }
// See other route files (e.g. ./team.ts) for reference.

import { renderReportPdf } from '../lib/pdfRenderer.js';
import type { ApiContext } from '../lib/context.js';
import {
  compressLogo,
  compressStamp,
  processSignature,
  decodeBase64Image,
} from '../lib/imageProcessing.js';
import {
  uploadAsset,
  deleteAsset,
  readAssetAsDataUri,
  assetPaths,
} from '../lib/storage.js';

// --- Phase 1: editor sandbox endpoints -----------------------------------
// These power the standalone editor test page at /governance/editor-sandbox.
// They are deliberately scoped to a per-user sandbox document under
// `_governanceSandbox/{uid}` and DO NOT touch any real `reports` collection.
// Real report persistence lands in Phase 6.

const SANDBOX_COLLECTION = '_governanceSandbox';

async function governanceSandboxSaveSection(req: any, res: any, ctx: ApiContext) {
  try {
    const { sectionId, content, wordCount } = req.body ?? {};
    if (!sectionId || typeof sectionId !== 'string' || sectionId.length > 128) {
      return res.status(400).json({
        success: false,
        error: 'sectionId is required (string, ≤128 chars).',
        code: 'INVALID_INPUT',
      });
    }
    if (!content || typeof content !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'content (Tiptap JSON) is required.',
        code: 'INVALID_INPUT',
      });
    }
    const safeWordCount = Number.isFinite(wordCount) ? Math.max(0, Math.floor(wordCount)) : 0;

    const docRef = ctx.db
      .collection(SANDBOX_COLLECTION)
      .doc(ctx.uid)
      .collection('sections')
      .doc(sectionId);

    await docRef.set(
      {
        sectionId,
        content,
        wordCount: safeWordCount,
        lastEditedAt: new Date().toISOString(),
        lastEditedBy: ctx.uid,
      },
      { merge: true },
    );

    return res.status(200).json({
      success: true,
      savedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[governanceSandboxSaveSection] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Auto-save failed. Your draft is held in the browser.',
      code: 'SAVE_FAILED',
    });
  }
}

async function governanceSandboxLoadSection(req: any, res: any, ctx: ApiContext) {
  try {
    const { sectionId } = req.body ?? {};
    if (!sectionId || typeof sectionId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'sectionId is required.',
        code: 'INVALID_INPUT',
      });
    }

    const snap = await ctx.db
      .collection(SANDBOX_COLLECTION)
      .doc(ctx.uid)
      .collection('sections')
      .doc(sectionId)
      .get();

    if (!snap.exists) {
      return res.status(200).json({ success: true, content: null });
    }

    return res.status(200).json({
      success: true,
      content: snap.data()?.content ?? null,
      wordCount: snap.data()?.wordCount ?? 0,
      lastEditedAt: snap.data()?.lastEditedAt ?? null,
    });
  } catch (e: any) {
    console.error('[governanceSandboxLoadSection] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load draft.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceRenderSandboxPdf(req: any, res: any, ctx: ApiContext) {
  try {
    const { content, councilLogoDataUri, signatureDataUris, meta } = req.body ?? {};
    if (!content || typeof content !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'content (Tiptap JSON) is required.',
        code: 'INVALID_INPUT',
      });
    }

    // If the caller didn't pre-resolve assets, pull them from Storage now so
    // the rendered PDF includes the council's actual logo + the signed-in
    // user's actual signature. Caller can still override by passing explicit
    // data URIs in the request body.
    let resolvedLogoDataUri: string | null = councilLogoDataUri ?? null;
    let resolvedSignatures: Record<'A' | 'B', string | undefined> = {
      A: signatureDataUris?.A,
      B: signatureDataUris?.B,
    };

    if (!resolvedLogoDataUri && ctx.primaryUid) {
      try {
        resolvedLogoDataUri = await readAssetAsDataUri(
          assetPaths.councilLogo(ctx.primaryUid),
        );
      } catch (e) {
        console.warn('[governanceRenderSandboxPdf] logo lookup failed:', e);
      }
    }

    if (!resolvedSignatures.A) {
      try {
        const sigUri = await readAssetAsDataUri(assetPaths.userSignature(ctx.uid));
        if (sigUri) resolvedSignatures.A = sigUri;
      } catch (e) {
        console.warn('[governanceRenderSandboxPdf] signature lookup failed:', e);
      }
    }

    const buffer = renderReportPdf({
      doc: content,
      councilLogoDataUri: resolvedLogoDataUri,
      signatureDataUris: resolvedSignatures,
      meta: meta ?? {},
    });

    // Return as base64 — the client wraps it as a `data:application/pdf;base64,...`
    // URL and feeds it to EmbedPDF. This keeps Phase 1 self-contained (no
    // Firebase Storage roundtrip).
    const base64 = buffer.toString('base64');

    return res.status(200).json({
      success: true,
      pdfBase64: base64,
      byteLength: buffer.byteLength,
      generatedBy: ctx.uid,
      generatedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[governanceRenderSandboxPdf] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'PDF render failed.',
      code: 'RENDER_FAILED',
    });
  }
}

// --- Phase 2: branding asset uploads -------------------------------------
// Council logo + named stamps live on the org-owner user doc keyed by the
// caller's primaryUid (= clientId). User signatures live on the caller's own
// user doc. Every upload runs through `sharp` for compression / white-bg
// removal before hitting Storage; client never talks to Storage directly.

const STAMP_ID_RE = /^[a-z0-9_-]{1,40}$/i;

async function governanceUploadCouncilLogo(req: any, res: any, ctx: ApiContext) {
  try {
    const { fileBase64 } = req.body ?? {};
    // Org-owner only (the user who owns the clientId).
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can update the council logo.',
        code: 'FORBIDDEN',
      });
    }
    const { buffer } = decodeBase64Image(fileBase64);
    const compressed = await compressLogo(buffer);
    const path = assetPaths.councilLogo(ctx.primaryUid);
    const { url } = await uploadAsset(path, compressed, 'image/png');
    await ctx.db
      .collection('users')
      .doc(ctx.primaryUid)
      .set(
        {
          logoUrl: url,
          logoUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return res.status(200).json({
      success: true,
      url,
      sizeBytes: compressed.byteLength,
    });
  } catch (e: any) {
    console.error('[governanceUploadCouncilLogo] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Logo upload failed.',
      code: 'UPLOAD_FAILED',
    });
  }
}

async function governanceDeleteCouncilLogo(_req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can remove the council logo.',
        code: 'FORBIDDEN',
      });
    }
    await deleteAsset(assetPaths.councilLogo(ctx.primaryUid));
    await ctx.db
      .collection('users')
      .doc(ctx.primaryUid)
      .set({ logoUrl: null, logoUpdatedAt: new Date().toISOString() }, { merge: true });
    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('[governanceDeleteCouncilLogo] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Logo delete failed.',
      code: 'DELETE_FAILED',
    });
  }
}

async function governanceUploadCouncilStamp(req: any, res: any, ctx: ApiContext) {
  try {
    const { stampId, label, fileBase64 } = req.body ?? {};
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can manage stamps.',
        code: 'FORBIDDEN',
      });
    }
    if (!STAMP_ID_RE.test(stampId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'stampId must be 1–40 chars: letters, digits, underscore, hyphen.',
        code: 'INVALID_INPUT',
      });
    }
    const safeLabel = typeof label === 'string' && label.trim() ? label.trim().slice(0, 80) : stampId;
    const { buffer } = decodeBase64Image(fileBase64);
    const compressed = await compressStamp(buffer);
    const path = assetPaths.councilStamp(ctx.primaryUid, stampId);
    const { url } = await uploadAsset(path, compressed, 'image/png');

    const userRef = ctx.db.collection('users').doc(ctx.primaryUid);
    const snap = await userRef.get();
    const existing = (snap.data()?.stamps ?? {}) as Record<string, any>;
    existing[stampId] = {
      id: stampId,
      label: safeLabel,
      url,
      sizeBytes: compressed.byteLength,
      updatedAt: new Date().toISOString(),
    };
    await userRef.set({ stamps: existing }, { merge: true });
    return res.status(200).json({ success: true, stamp: existing[stampId] });
  } catch (e: any) {
    console.error('[governanceUploadCouncilStamp] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Stamp upload failed.',
      code: 'UPLOAD_FAILED',
    });
  }
}

async function governanceDeleteCouncilStamp(req: any, res: any, ctx: ApiContext) {
  try {
    const { stampId } = req.body ?? {};
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can manage stamps.',
        code: 'FORBIDDEN',
      });
    }
    if (!STAMP_ID_RE.test(stampId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'stampId is required.',
        code: 'INVALID_INPUT',
      });
    }
    await deleteAsset(assetPaths.councilStamp(ctx.primaryUid, stampId));
    const userRef = ctx.db.collection('users').doc(ctx.primaryUid);
    const snap = await userRef.get();
    const existing = (snap.data()?.stamps ?? {}) as Record<string, any>;
    delete existing[stampId];
    await userRef.set({ stamps: existing }, { merge: true });
    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('[governanceDeleteCouncilStamp] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Stamp delete failed.',
      code: 'DELETE_FAILED',
    });
  }
}

async function governanceGetCouncilAssets(_req: any, res: any, ctx: ApiContext) {
  try {
    // Anyone in the org can READ branding assets — they're embedded in
    // every published report anyway. Only the org-owner doc holds them.
    const snap = await ctx.db.collection('users').doc(ctx.primaryUid).get();
    const data = snap.data() ?? {};
    return res.status(200).json({
      success: true,
      logoUrl: data.logoUrl ?? null,
      logoUpdatedAt: data.logoUpdatedAt ?? null,
      stamps: data.stamps ?? {},
    });
  } catch (e: any) {
    console.error('[governanceGetCouncilAssets] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load branding assets.',
      code: 'LOAD_FAILED',
    });
  }
}

async function governanceUploadUserSignature(req: any, res: any, ctx: ApiContext) {
  try {
    const { fileBase64 } = req.body ?? {};
    const { buffer } = decodeBase64Image(fileBase64, [
      'image/png',
      'image/jpeg',
    ]);
    const processed = await processSignature(buffer);
    const path = assetPaths.userSignature(ctx.uid);
    const { url } = await uploadAsset(path, processed, 'image/png');
    await ctx.db
      .collection('users')
      .doc(ctx.uid)
      .set(
        {
          signatureUrl: url,
          signatureUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    return res.status(200).json({
      success: true,
      url,
      sizeBytes: processed.byteLength,
    });
  } catch (e: any) {
    console.error('[governanceUploadUserSignature] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Signature upload failed.',
      code: 'UPLOAD_FAILED',
    });
  }
}

async function governanceDeleteUserSignature(_req: any, res: any, ctx: ApiContext) {
  try {
    await deleteAsset(assetPaths.userSignature(ctx.uid));
    await ctx.db
      .collection('users')
      .doc(ctx.uid)
      .set(
        { signatureUrl: null, signatureUpdatedAt: new Date().toISOString() },
        { merge: true },
      );
    return res.status(200).json({ success: true });
  } catch (e: any) {
    console.error('[governanceDeleteUserSignature] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Signature delete failed.',
      code: 'DELETE_FAILED',
    });
  }
}

async function governanceGetUserSignature(_req: any, res: any, ctx: ApiContext) {
  try {
    const snap = await ctx.db.collection('users').doc(ctx.uid).get();
    const data = snap.data() ?? {};
    return res.status(200).json({
      success: true,
      url: data.signatureUrl ?? null,
      updatedAt: data.signatureUpdatedAt ?? null,
    });
  } catch (e: any) {
    console.error('[governanceGetUserSignature] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load signature.',
      code: 'LOAD_FAILED',
    });
  }
}

export const governanceRoutes: Record<string, any> = {
  governanceSandboxSaveSection,
  governanceSandboxLoadSection,
  governanceRenderSandboxPdf,
  // Phase 2 — branding assets
  governanceUploadCouncilLogo,
  governanceDeleteCouncilLogo,
  governanceUploadCouncilStamp,
  governanceDeleteCouncilStamp,
  governanceGetCouncilAssets,
  governanceUploadUserSignature,
  governanceDeleteUserSignature,
  governanceGetUserSignature,
};

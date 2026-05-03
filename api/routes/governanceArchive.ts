// Phase 10 — Archive & Audit.
//
// The Archive surface aggregates **completed-state** entities across
// every governance collection so PgMs / FOI officers / Scrutiny readers
// have ONE place to find what's already happened:
//   • reports with status === 'Sealed' (Phase 6d)
//   • meetings with status === 'Held' (Phase 8a/b)
//   • projectGovernanceDocs with status === 'Published' (Phase 9)
//
// Endpoints:
//   • governanceListArchive            — single round-trip aggregator;
//                                         returns a unified shape so
//                                         the client can render one
//                                         table.
//   • governanceGetArchiveAuditTrail   — audit events for a specific
//                                         entity (best-effort filter
//                                         by clientId + entityId
//                                         / meta.*Id).
//   • governanceExportArchiveFoi       — CSV export. Part 2 redaction
//                                         is handled by individual
//                                         report PDFs (Phase 13);
//                                         this CSV exposes metadata
//                                         only (title / type / date
//                                         / classification) so it's
//                                         FOI-safe by construction.

import type { ApiContext } from '../lib/context.js';
import {
  readMonthlySnapshot,
  monthEndIso,
} from '../lib/historicalSnapshots.js';

export type ArchiveKind = 'report' | 'meeting' | 'projectDoc';

interface ArchiveItem {
  kind: ArchiveKind;
  id: string;
  reference: string;
  title: string;
  subtitle: string | null;
  category: string | null;
  decisionDate: string | null;
  status: string;
  isHRB: boolean;
  partClassification: string | null;
  goldenThreadHash: string | null;
  ownerUid: string | null;
  projectId: string | null;
  /** Last activity timestamp (createdAt or updatedAt). */
  lastActivityAt: string | null;
  /** Optional path to the sealed PDF / artifact, when available. */
  artifactPath: string | null;
}

function nowIso() {
  return new Date().toISOString();
}

function toIsoOrNull(v: any): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  // Firestore Timestamp objects expose toDate()
  try {
    if (typeof v?.toDate === 'function') return v.toDate().toISOString();
  } catch {
    /* fall through */
  }
  return null;
}

// ── Aggregator ─────────────────────────────────────────────────────────

async function governanceListArchive(req: any, res: any, ctx: ApiContext) {
  try {
    // HRC HR-7 — when `asOfMonth` (YYYY-MM) is in the request body, the
    // archive renders the historical snapshot instead of live data:
    // reports/meetings/projectGovernanceDocs come from the snapshot
    // collections, and goldenThread rows are filtered to those whose
    // sealedAt is on/before month-end. The Golden Thread itself is
    // already immutable WORM, so a date filter is sufficient.
    const asOfMonth: string | null =
      typeof req?.body?.asOfMonth === 'string' &&
      req.body.asOfMonth.match(/^\d{4}-\d{2}$/)
        ? req.body.asOfMonth
        : null;

    let reportsDocs: Array<{ data: () => any; id: string }> = [];
    let meetingsDocs: Array<{ data: () => any; id: string }> = [];
    let docsDocs: Array<{ data: () => any; id: string }> = [];
    let goldenDocs: Array<{ data: () => any; id: string }> = [];

    if (asOfMonth) {
      const monthCutoff = monthEndIso(asOfMonth);
      const [reportsSnap, meetingsSnap, projectDocsSnap, goldenSnap] =
        await Promise.all([
          readMonthlySnapshot(ctx, ctx.primaryUid, asOfMonth, 'reports'),
          readMonthlySnapshot(ctx, ctx.primaryUid, asOfMonth, 'meetings'),
          readMonthlySnapshot(ctx, ctx.primaryUid, asOfMonth, 'projectGovernanceDocs'),
          ctx.db
            .collection('goldenThread')
            .where('clientId', '==', ctx.primaryUid)
            .get(),
        ]);

      const wrapEntries = (entries: any[]) =>
        entries
          .filter((e) => e?.kind === 'governanceDoc' && e.doc)
          .map((e) => ({
            id: e.docId ?? e.doc.id ?? '',
            data: () => e.doc,
          }));

      reportsDocs = wrapEntries(reportsSnap?.entries ?? []).filter(
        (d) => d.data().status === 'Sealed',
      );
      meetingsDocs = wrapEntries(meetingsSnap?.entries ?? []).filter(
        (d) => d.data().status === 'Held',
      );
      docsDocs = wrapEntries(projectDocsSnap?.entries ?? []).filter(
        (d) => d.data().status === 'Published',
      );
      goldenDocs = goldenSnap.docs.filter((d: any) => {
        const data = d.data() ?? {};
        const ts = (data.sealedAt ?? data.createdAt ?? '') as string;
        return typeof ts === 'string' && ts <= monthCutoff;
      });
    } else {
      // Live path — original parallel fetch.
      const [reportsSnap, meetingsSnap, projectDocsSnap, goldenSnap] =
        await Promise.all([
          ctx.db
            .collection('reports')
            .where('clientId', '==', ctx.primaryUid)
            .where('status', '==', 'Sealed')
            .get(),
          ctx.db
            .collection('meetings')
            .where('clientId', '==', ctx.primaryUid)
            .where('status', '==', 'Held')
            .get(),
          ctx.db
            .collection('projectGovernanceDocs')
            .where('clientId', '==', ctx.primaryUid)
            .where('status', '==', 'Published')
            .get(),
          ctx.db
            .collection('goldenThread')
            .where('clientId', '==', ctx.primaryUid)
            .get(),
        ]);
      reportsDocs = reportsSnap.docs;
      meetingsDocs = meetingsSnap.docs;
      docsDocs = projectDocsSnap.docs;
      goldenDocs = goldenSnap.docs;
    }

    // Backwards-compat aliases for the rest of the function.
    const reportsSnap = { docs: reportsDocs };
    const meetingsSnap = { docs: meetingsDocs };
    const docsSnap = { docs: docsDocs };
    const goldenSnap = { docs: goldenDocs };

    // Index Golden Thread chain by reportId so report rows can surface
    // the latest hash (the WORM chain head).
    const goldenByReport = new Map<string, { hash: string }>();
    for (const d of goldenSnap.docs) {
      const data = d.data() ?? {};
      const reportId = data.reportId as string | undefined;
      if (!reportId) continue;
      const existing = goldenByReport.get(reportId);
      // Pick the newest entry — fall back to keeping the first seen
      // when timestamps are missing.
      const ts = data.sealedAt ?? data.createdAt ?? '';
      if (!existing) goldenByReport.set(reportId, { hash: data.hash ?? d.id });
      else if (typeof ts === 'string' && ts > '') {
        goldenByReport.set(reportId, { hash: data.hash ?? d.id });
      }
    }

    const items: ArchiveItem[] = [];

    for (const d of reportsSnap.docs) {
      const r = d.data() ?? {};
      if (r.softDeleted) continue;
      items.push({
        kind: 'report',
        id: r.id ?? d.id,
        reference: r.id ?? d.id,
        title: r.title ?? 'Untitled report',
        subtitle: r.scheme ?? null,
        category: r.partClassification ?? null,
        decisionDate: toIsoOrNull(r.sealedAt ?? r.approvedAt ?? r.targetBoardDate),
        status: 'Sealed',
        isHRB: !!r.isHRB,
        partClassification: r.partClassification ?? null,
        goldenThreadHash: goldenByReport.get(r.id)?.hash ?? null,
        ownerUid: r.ownerUid ?? null,
        projectId: r.projectId ?? null,
        lastActivityAt: toIsoOrNull(r.updatedAt ?? r.sealedAt),
        artifactPath: r.sealedPdfPath ?? null,
      });
    }

    for (const d of meetingsSnap.docs) {
      const m = d.data() ?? {};
      if (m.softDeleted) continue;
      const decisionCount = Array.isArray(m.decisions) ? m.decisions.length : 0;
      items.push({
        kind: 'meeting',
        id: m.id ?? d.id,
        reference: m.id ?? d.id,
        title: m.title ?? m.governanceBodyLabel ?? 'Meeting',
        subtitle:
          decisionCount > 0
            ? `${decisionCount} decision${decisionCount === 1 ? '' : 's'} recorded`
            : 'Held — minutes filed',
        category: m.governanceBodyLabel ?? null,
        decisionDate: toIsoOrNull(m.heldAt ?? m.date),
        status: 'Held',
        isHRB: false,
        partClassification: null,
        goldenThreadHash: null,
        ownerUid: m.ownerUid ?? null,
        projectId: null,
        lastActivityAt: toIsoOrNull(m.updatedAt ?? m.heldAt),
        artifactPath: null,
      });
    }

    for (const d of docsSnap.docs) {
      const p = d.data() ?? {};
      if (p.softDeleted) continue;
      items.push({
        kind: 'projectDoc',
        id: p.id ?? d.id,
        reference: `${p.id ?? d.id} · v${p.version ?? 1}`,
        title: p.title ?? 'Project doc',
        subtitle: p.summary ?? null,
        category: p.category ?? null,
        decisionDate: toIsoOrNull(p.publishedAt ?? p.updatedAt),
        status: 'Published',
        isHRB: false,
        partClassification: null,
        goldenThreadHash: null,
        ownerUid: p.ownerUid ?? null,
        projectId: p.projectId ?? null,
        lastActivityAt: toIsoOrNull(p.updatedAt ?? p.publishedAt),
        artifactPath: null,
      });
    }

    // Newest first (decisionDate fallback to lastActivityAt).
    items.sort((a, b) => {
      const ax = a.decisionDate ?? a.lastActivityAt ?? '';
      const bx = b.decisionDate ?? b.lastActivityAt ?? '';
      return bx.localeCompare(ax);
    });

    return res.status(200).json({
      success: true,
      items,
      summary: {
        total: items.length,
        sealedReports: items.filter((i) => i.kind === 'report').length,
        heldMeetings: items.filter((i) => i.kind === 'meeting').length,
        publishedDocs: items.filter((i) => i.kind === 'projectDoc').length,
        hrbCount: items.filter((i) => i.isHRB).length,
      },
    });
  } catch (e: any) {
    console.error('[governanceListArchive] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load archive.',
      code: 'LOAD_FAILED',
    });
  }
}

// ── Audit trail per entity ─────────────────────────────────────────────

async function governanceGetArchiveAuditTrail(
  req: any,
  res: any,
  ctx: ApiContext,
) {
  try {
    const { entityId } = req.body ?? {};
    if (typeof entityId !== 'string' || !entityId) {
      return res.status(400).json({
        success: false,
        error: 'entityId required.',
        code: 'INVALID_INPUT',
      });
    }

    // auditEvents shape varies across phases — filter client-side
    // after a tenant-scoped fetch. Keeps the helper simple while
    // we still honour cross-tenant isolation.
    const snap = await ctx.db
      .collection('auditEvents')
      .where('clientId', '==', ctx.primaryUid)
      .get();

    const events = snap.docs
      .map((d) => ({ _id: d.id, ...d.data() }))
      .filter((ev: any) => {
        if (ev.entityId === entityId) return true;
        const meta = ev.meta ?? {};
        return (
          meta.itemId === entityId ||
          meta.reportId === entityId ||
          meta.meetingId === entityId ||
          meta.docId === entityId
        );
      })
      .sort((a: any, b: any) => {
        const ax = a.createdAt ?? a.timestamp ?? '';
        const bx = b.createdAt ?? b.timestamp ?? '';
        return bx.localeCompare(ax);
      });

    return res.status(200).json({ success: true, events });
  } catch (e: any) {
    console.error('[governanceGetArchiveAuditTrail] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load audit trail.',
      code: 'LOAD_FAILED',
    });
  }
}

// ── FOI export ─────────────────────────────────────────────────────────
//
// Returns metadata-only CSV. Part 2 (closed) report bodies live inside
// the report PDF — this CSV deliberately exposes only `kind / reference
// / title / category / decisionDate / status / hrb / partClassification
// / goldenThreadHash` so it is FOI-safe by construction.  Anyone needing
// the full document goes through the per-report PDF flow which already
// honours Part 2 redaction (Phase 6d watermark + planned Phase 13
// per-paragraph redaction).

function csvEscape(v: unknown): string {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function governanceExportArchiveFoi(_req: any, res: any, ctx: ApiContext) {
  try {
    const aggregator = await new Promise<{ items: ArchiveItem[] } | null>(
      (resolve) => {
        const fakeRes = {
          status() {
            return this;
          },
          json(payload: any) {
            if (payload?.success) resolve({ items: payload.items });
            else resolve(null);
          },
        };
        // Reuse the aggregator. Slight indirection vs. duplicating the
        // query, keeps source-of-truth in one place.
        governanceListArchive(_req, fakeRes, ctx).catch(() => resolve(null));
      },
    );
    if (!aggregator) {
      return res.status(500).json({
        success: false,
        error: 'Failed to assemble archive for export.',
        code: 'EXPORT_FAILED',
      });
    }

    // Phase 5.5e — header gains 4 trailing columns to mirror the
    // Southwark FP sheet's people fields + approval state. The current
    // archive only emits Sealed reports / Held meetings / Published
    // docs (no FP-item kind), so these columns are blank for v1 rows.
    // When FP items become an archive kind in v2 they populate cleanly,
    // and any consumer parsing by header name keeps working today
    // (append-at-end, Q-E in the locked plan).
    const header = [
      'Kind',
      'Reference',
      'Title',
      'Category',
      'Decision date',
      'Status',
      'HRB',
      'Part classification',
      'Golden Thread hash',
      'Approval status',
      'Strategic Lead',
      'Report Author',
      'Decision Maker',
    ];
    const lines = [header.map(csvEscape).join(',')];
    for (const it of aggregator.items) {
      lines.push(
        [
          it.kind,
          it.reference,
          it.title,
          it.category ?? '',
          it.decisionDate ?? '',
          it.status,
          it.isHRB ? 'Yes' : 'No',
          it.partClassification ?? '',
          it.goldenThreadHash ?? '',
          // Reserved for future FP-item archive kind. Blank for current
          // report / meeting / projectDoc rows.
          '',
          '',
          '',
          '',
        ]
          .map(csvEscape)
          .join(','),
      );
    }
    const csv = lines.join('\n');
    const fileBase64 = Buffer.from(csv, 'utf8').toString('base64');
    const filename = `archive-foi-export-${nowIso().slice(0, 10)}.csv`;

    return res.status(200).json({
      success: true,
      fileBase64,
      filename,
      mimeType: 'text/csv',
      rowCount: aggregator.items.length,
    });
  } catch (e: any) {
    console.error('[governanceExportArchiveFoi] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Export failed.',
      code: 'EXPORT_FAILED',
    });
  }
}

export const governanceArchiveRoutes: Record<string, any> = {
  governanceListArchive,
  governanceGetArchiveAuditTrail,
  governanceExportArchiveFoi,
};

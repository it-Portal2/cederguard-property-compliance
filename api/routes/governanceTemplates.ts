// Programme Governance — Report Template endpoints.
//
// Storage layout:
//   • `reportTemplates/{clientId_templateId}` — working doc (draft | published)
//   • `reportTemplates/{clientId_templateId}/versions/{n}` — snapshot on publish
//
// Every pattern from Phase 3 is reused:
//   • Field whitelists on every upsert
//   • Atomic transactions for seed + publish + duplicate
//   • Draft-preferred reads (returns the in-progress draft if one exists)
//   • Never create empty rows — client opens a modal, validates, then saves.
//     This file only exposes upsert endpoints; no "create blank" action.
//
// Authorisation: all writes require `ctx.isClientAdmin` (PgM/super-admin).
// Reads require `isSignedIn` so PMs can browse the library when authoring
// reports.

import type { ApiContext } from '../lib/context.js';
import { SEED_TEMPLATES, type SeedTemplate } from '../lib/templateSeed.js';

const TEMPLATE_ID_RE = /^[a-z0-9_-]{1,80}$/i;
const SECTION_ID_RE = /^[a-z0-9_-]{1,80}$/i;

const TEMPLATE_WRITABLE_FIELDS = [
  'title',
  'description',
  'code',
  'category',
  'defaultRoute',
  'requireSeniorPmReview',
  'sections',
  // Accepted only on CREATE; stripped from update payloads below.
  'originStarterId',
] as const;

// PgM-level writable fields. `locked` is PgM-toggleable (lock / unlock a
// section so authors can't delete it). `statutory` stays off this list
// because flipping it is a legal-compliance decision — only super_admin
// can make that call via `SECTION_WRITABLE_FIELDS_SUPERADMIN` below.
const SECTION_WRITABLE_FIELDS = [
  'order',
  'name',
  'guidance',
  'mandatory',
  'aiDraftAllowed',
  'complianceCheck',
  'citedRegulations',
  'routingRules',
  'requiredAttachments',
  'locked',
] as const;

// Super-admin override whitelist — adds `statutory` so platform operators
// can redefine what counts as a statutory section when Cabinet-paper
// requirements change (e.g. a new statutory instrument).
const SECTION_WRITABLE_FIELDS_SUPERADMIN = [
  ...SECTION_WRITABLE_FIELDS,
  'statutory',
] as const;

function pickFields<T extends readonly string[]>(input: any, allowed: T): Record<string, any> {
  if (!input || typeof input !== 'object') return {};
  const out: Record<string, any> = {};
  for (const key of allowed) {
    if (key in input) out[key] = input[key];
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function templateDocId(ctx: ApiContext, templateId: string): string {
  return `${ctx.primaryUid}_${templateId}`;
}

// ── Seed-on-first-read ────────────────────────────────────────────────────

async function seedTemplatesIfMissing(ctx: ApiContext) {
  // Cheap existence probe — if ANY template exists for this client, skip seed.
  const probe = await ctx.db
    .collection('reportTemplates')
    .where('clientId', '==', ctx.primaryUid)
    .limit(1)
    .get();
  if (!probe.empty) return;

  // Transactional seed — each template is its own doc, so we use a batched
  // write; transaction would be overkill (no read-before-write data
  // dependency after the initial probe).
  const batch = ctx.db.batch();
  const ts = nowIso();
  for (const seed of SEED_TEMPLATES) {
    const ref = ctx.db.collection('reportTemplates').doc(templateDocId(ctx, seed.id));
    batch.set(ref, {
      ...seedToDoc(seed),
      clientId: ctx.primaryUid,
      originStarterId: seed.id,
      customised: false,
      version: 1,
      status: 'published',
      publishedAt: ts,
      publishedBy: ctx.uid,
      createdAt: ts,
      createdBy: ctx.uid,
      updatedAt: ts,
      seeded: true,
    });
  }
  await batch.commit();
}

function seedToDoc(seed: SeedTemplate) {
  return {
    id: seed.id,
    code: seed.code,
    category: seed.category,
    title: seed.title,
    description: seed.description,
    requireSeniorPmReview: seed.requireSeniorPmReview,
    defaultRoute: seed.defaultRoute,
    sections: seed.sections,
  };
}

// ── GET all templates ─────────────────────────────────────────────────────

async function governanceListTemplates(_req: any, res: any, ctx: ApiContext) {
  try {
    await seedTemplatesIfMissing(ctx);
    const snap = await ctx.db
      .collection('reportTemplates')
      .where('clientId', '==', ctx.primaryUid)
      .get();
    const templates = snap.docs.map((d) => ({ _id: d.id, ...d.data() }));
    return res.status(200).json({ success: true, templates });
  } catch (e: any) {
    console.error('[governanceListTemplates] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load templates.',
      code: 'LOAD_FAILED',
    });
  }
}

// ── GET one template with full section detail ─────────────────────────────

async function governanceGetTemplate(req: any, res: any, ctx: ApiContext) {
  try {
    const { templateId } = req.body ?? {};
    if (!TEMPLATE_ID_RE.test(templateId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'templateId required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db.collection('reportTemplates').doc(templateDocId(ctx, templateId));
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({
        success: false,
        error: 'Template not found.',
        code: 'NOT_FOUND',
      });
    }
    // Defence: never leak a template from another tenant even if an attacker
    // crafts a collision-prone ID.
    const data = snap.data() ?? {};
    if (data.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Template belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }
    return res.status(200).json({ success: true, template: { _id: snap.id, ...data } });
  } catch (e: any) {
    console.error('[governanceGetTemplate] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Failed to load template.',
      code: 'LOAD_FAILED',
    });
  }
}

// ── Upsert template metadata + sections ───────────────────────────────────

async function governanceUpsertTemplate(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can edit templates.',
        code: 'FORBIDDEN',
      });
    }
    const { templateId, patch } = req.body ?? {};
    if (!TEMPLATE_ID_RE.test(templateId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'templateId required.',
        code: 'INVALID_INPUT',
      });
    }
    if (!patch || typeof patch !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'patch required.',
        code: 'INVALID_INPUT',
      });
    }

    const safePatch = pickFields(patch, TEMPLATE_WRITABLE_FIELDS);

    // If caller sent `sections`, sanitise each section too.
    // Super admins get the wider whitelist (can flip `statutory`);
    // everyone else preserves statutory as-is from the prior document.
    const sectionWhitelist = ctx.isAdmin
      ? SECTION_WRITABLE_FIELDS_SUPERADMIN
      : SECTION_WRITABLE_FIELDS;
    let priorSectionsById: Record<string, any> = {};
    if (Array.isArray(safePatch.sections)) {
      // Load prior sections from the existing doc so we can preserve
      // `statutory` for non-super-admin writers.
      try {
        const existingSnap = await ctx.db
          .collection('reportTemplates')
          .doc(templateDocId(ctx, templateId))
          .get();
        const priorSections = (existingSnap.data()?.sections ?? []) as any[];
        for (const s of priorSections) {
          if (s?.id) priorSectionsById[s.id] = s;
        }
      } catch (e) {
        console.warn('[governanceUpsertTemplate] could not read prior sections:', e);
      }

      safePatch.sections = (safePatch.sections as any[]).map((s, i) => {
        if (!s || typeof s !== 'object') return null;
        if (!SECTION_ID_RE.test(s.id ?? '')) return null;
        const clean: Record<string, any> = pickFields(s, sectionWhitelist);
        clean.id = s.id;
        if (!ctx.isAdmin) {
          // Non-super-admin: `statutory` is preserved from the prior doc,
          // never trusted from the client payload. New sections created
          // by PgM default to statutory:false.
          clean.statutory = !!priorSectionsById[s.id]?.statutory;
        } else {
          // Super admin: accept statutory from the patch, default to false
          // if not explicitly set.
          clean.statutory = !!s.statutory;
        }
        clean.locked = !!clean.locked;
        clean.order = typeof clean.order === 'number' ? clean.order : i + 1;
        return clean;
      }).filter(Boolean);
    }

    const ref = ctx.db.collection('reportTemplates').doc(templateDocId(ctx, templateId));
    const snap = await ref.get();
    const exists = snap.exists;
    if (exists && snap.data()?.clientId !== ctx.primaryUid) {
      return res.status(403).json({
        success: false,
        error: 'Template belongs to another workspace.',
        code: 'FORBIDDEN',
      });
    }

    const payload: Record<string, any> = {
      ...safePatch,
      id: templateId,
      clientId: ctx.primaryUid,
      updatedAt: nowIso(),
      updatedBy: ctx.uid,
      status: 'draft',
      // "Customised" means the template is user-owned rather than a pristine
      // seed. Editing a seeded template flips it (existing doc + edit); a
      // brand-new template is PgM-authored, so it's customised from day 1.
      customised: true,
    };
    if (!exists) {
      payload.createdAt = nowIso();
      payload.createdBy = ctx.uid;
      payload.version = 1;
      // `originStarterId` is only honoured on create. If caller didn't send
      // one (Blank template flow), default to null.
      if (typeof payload.originStarterId !== 'string') {
        payload.originStarterId = null;
      }
    } else {
      // Never let an existing template's origin be rewritten.
      delete payload.originStarterId;
    }
    await ref.set(payload, { merge: true });
    const latest = (await ref.get()).data();
    return res.status(200).json({
      success: true,
      template: { _id: ref.id, ...latest },
    });
  } catch (e: any) {
    console.error('[governanceUpsertTemplate] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Save failed.',
      code: 'SAVE_FAILED',
    });
  }
}

// ── Publish template (transactional version bump + snapshot) ──────────────

async function governancePublishTemplate(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can publish templates.',
        code: 'FORBIDDEN',
      });
    }
    const { templateId } = req.body ?? {};
    if (!TEMPLATE_ID_RE.test(templateId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'templateId required.',
        code: 'INVALID_INPUT',
      });
    }
    const ref = ctx.db.collection('reportTemplates').doc(templateDocId(ctx, templateId));

    const nextVersion = await ctx.db.runTransaction(async (txn) => {
      const snap = await txn.get(ref);
      if (!snap.exists) throw new Error('Template not found.');
      const data = snap.data() ?? {};
      if (data.clientId !== ctx.primaryUid) {
        throw new Error('Template belongs to another workspace.');
      }
      const current = (data.version ?? 1) as number;
      const next = current + 1;
      const ts = nowIso();
      const versionRef = ref.collection('versions').doc(String(next));
      // Snapshot the full working doc including its sections.
      txn.set(versionRef, {
        at: ts,
        by: ctx.uid,
        previousVersion: current,
        content: { ...data, _id: ref.id },
      });
      txn.set(
        ref,
        {
          version: next,
          status: 'published',
          publishedAt: ts,
          publishedBy: ctx.uid,
          updatedAt: ts,
        },
        { merge: true },
      );
      return next;
    });

    return res.status(200).json({ success: true, version: nextVersion });
  } catch (e: any) {
    console.error('[governancePublishTemplate] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Publish failed.',
      code: 'PUBLISH_FAILED',
    });
  }
}

// ── Duplicate template ────────────────────────────────────────────────────

async function governanceDuplicateTemplate(req: any, res: any, ctx: ApiContext) {
  try {
    if (!ctx.isClientAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Only Client Admin can duplicate templates.',
        code: 'FORBIDDEN',
      });
    }
    const { templateId, newId } = req.body ?? {};
    if (!TEMPLATE_ID_RE.test(templateId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'templateId required.',
        code: 'INVALID_INPUT',
      });
    }
    if (!TEMPLATE_ID_RE.test(newId ?? '')) {
      return res.status(400).json({
        success: false,
        error: 'newId must be 1–80 chars, letters / digits / underscore / hyphen.',
        code: 'INVALID_INPUT',
      });
    }
    if (newId === templateId) {
      return res.status(400).json({
        success: false,
        error: 'newId must differ from templateId.',
        code: 'INVALID_INPUT',
      });
    }

    const srcRef = ctx.db.collection('reportTemplates').doc(templateDocId(ctx, templateId));
    const dstRef = ctx.db.collection('reportTemplates').doc(templateDocId(ctx, newId));

    const duplicated = await ctx.db.runTransaction(async (txn) => {
      const [srcSnap, dstSnap] = await Promise.all([txn.get(srcRef), txn.get(dstRef)]);
      if (!srcSnap.exists) throw new Error('Source template not found.');
      const srcData = srcSnap.data() ?? {};
      if (srcData.clientId !== ctx.primaryUid) {
        throw new Error('Source template belongs to another workspace.');
      }
      if (dstSnap.exists) {
        throw new Error('A template with that ID already exists — pick a different name.');
      }
      const ts = nowIso();
      const next = {
        ...srcData,
        id: newId,
        clientId: ctx.primaryUid,
        title: `${srcData.title ?? 'Untitled'} (copy)`,
        version: 1,
        status: 'draft',
        customised: true,
        originStarterId: srcData.originStarterId ?? templateId,
        createdAt: ts,
        createdBy: ctx.uid,
        updatedAt: ts,
        publishedAt: null,
        publishedBy: null,
        seeded: false,
      };
      txn.set(dstRef, next);
      return next;
    });

    return res.status(200).json({
      success: true,
      template: { _id: dstRef.id, ...duplicated },
    });
  } catch (e: any) {
    console.error('[governanceDuplicateTemplate] failed:', e);
    return res.status(400).json({
      success: false,
      error: e?.message ?? 'Duplicate failed.',
      code: 'DUPLICATE_FAILED',
    });
  }
}

// ── AI recommendation (rule-based stub; Gemini wires in Phase 12) ─────────

async function governanceAiRecommendTemplate(req: any, res: any, ctx: ApiContext) {
  try {
    const { intake } = req.body ?? {};
    const text = typeof intake === 'string' ? intake.toLowerCase().trim() : '';
    // Ensure templates are seeded so the recommendation lookup works on
    // brand-new tenants.
    await seedTemplatesIfMissing(ctx);

    // Simple heuristic: scan the intake for keywords, map to a template code.
    // Deliberately rule-based — Phase 12 swaps this body for a Gemini call.
    const rules: Array<{ match: RegExp; templateId: string; reason: string }> = [
      { match: /\b(gw1|outline case|soc)\b/i, templateId: 'gw1', reason: 'Mentions strategic outline case / GW1.' },
      { match: /\b(gw2|procurement strategy|otr|tender strategy)\b/i, templateId: 'gw2', reason: 'Mentions procurement strategy / GW2 / OJEU.' },
      { match: /\b(gw3|contract award|award|tenderer)\b/i, templateId: 'gw3', reason: 'Mentions contract award / GW3.' },
      { match: /\b(hrb|building safety|golden thread|bsa)\b/i, templateId: 'km4', reason: 'HRB / Building Safety Act keywords — pair with GW2/GW3.' },
      { match: /\b(lesson|retrospective|post[-\s]?completion)\b/i, templateId: 'km6', reason: 'Lessons learned / post-completion review.' },
      { match: /\b(handover|snagging|practical completion)\b/i, templateId: 'km5', reason: 'Practical completion / handover.' },
      { match: /\b(start on site|mobilis(e|ation)|sos)\b/i, templateId: 'km1', reason: 'Start on site / mobilisation.' },
      { match: /\b(shareholder|almo|lhc|trading compan)/i, templateId: 'shld', reason: 'Shareholder / trading company.' },
      { match: /\b(budget|finance|forecast|outturn|s151)\b/i, templateId: 'fin2', reason: 'Finance / budget / forecast.' },
      { match: /\b(cabinet|policy|consultation)\b/i, templateId: 'cabrep', reason: 'Cabinet paper / policy / consultation.' },
    ];

    let pick: { templateId: string; reason: string } = {
      templateId: 'other',
      reason: 'No strong keyword match — OTHER is a safe fallback.',
    };
    for (const r of rules) {
      if (r.match.test(text)) {
        pick = { templateId: r.templateId, reason: r.reason };
        break;
      }
    }

    const snap = await ctx.db
      .collection('reportTemplates')
      .doc(templateDocId(ctx, pick.templateId))
      .get();
    const recommended = snap.exists ? { _id: snap.id, ...snap.data() } : null;

    // Supplementary: GW2/GW3 paired with KM4 for HRB works.
    const supplementaryIds: string[] = [];
    if (/\b(hrb|building safety|bsa)\b/i.test(text) && pick.templateId !== 'km4') {
      supplementaryIds.push('km4');
    }
    const supplementary = await Promise.all(
      supplementaryIds.map(async (id) => {
        const s = await ctx.db.collection('reportTemplates').doc(templateDocId(ctx, id)).get();
        return s.exists ? { _id: s.id, ...s.data() } : null;
      }),
    );

    return res.status(200).json({
      success: true,
      recommended,
      supplementary: supplementary.filter(Boolean),
      reason: pick.reason,
      source: 'rule-based (Phase 4 stub; Gemini in Phase 12)',
    });
  } catch (e: any) {
    console.error('[governanceAiRecommendTemplate] failed:', e);
    return res.status(500).json({
      success: false,
      error: e?.message ?? 'Recommendation failed.',
      code: 'AI_FAILED',
    });
  }
}

export const governanceTemplatesRoutes: Record<string, any> = {
  governanceListTemplates,
  governanceGetTemplate,
  governanceUpsertTemplate,
  governancePublishTemplate,
  governanceDuplicateTemplate,
  governanceAiRecommendTemplate,
};

import { useCallback, useMemo, useState } from 'react';
import type { JSONContent } from '@tiptap/react';
import { motion } from 'motion/react';
import { FlaskConical, FileDown, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { GovernanceEditor } from '../../components/governance/editor/GovernanceEditor';
import { GovernancePDFViewer } from '../../components/governance/PDFViewer';
import { useGovernanceAssets } from '../../components/governance/useGovernanceAssets';
import { api } from '../../lib/api';

const SANDBOX_SECTION_ID = 'phase1-sandbox-section-1';

// Initial content showcases every custom node so the test page exercises the
// full surface area in one shot.
const INITIAL_CONTENT: JSONContent = {
  type: 'doc',
  content: [
    { type: 'councilLogo' },
    {
      type: 'headerMetadataTable',
      attrs: {
        decisionTaker: 'Strategic Director — Housing',
        date: '2026-05-12',
        reportTitle: 'GW2 — Supply of Building Materials Framework',
        wards: 'All wards',
        classification: 'Open',
        reasonForLateness: 'N/A',
        from: 'Director of Housing',
      },
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Recommendations' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text:
            'It is recommended that Cabinet approves the award of the framework agreement to the suppliers listed in Appendix 1 ',
        },
        {
          type: 'regulationCitation',
          attrs: {
            code: 'PCR 2015 reg.33',
            title: 'Public Contracts Regulations 2015 — Regulation 33',
          },
        },
        { type: 'text', text: ' subject to the call-in period.' },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Background' }],
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text:
            'This framework consolidates building-materials supply across the housing maintenance programme, replacing 12 individual agreements that expire in Q3 2026.',
        },
      ],
    },
    {
      type: 'officerAdviceBlock',
      attrs: { officerTitle: 'Section 151 Officer', refCode: 'S151/2026/044' },
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text:
                'The estimated annual spend of £4.2m falls within the agreed capital envelope. No additional revenue impact is forecast.',
            },
          ],
        },
      ],
    },
    {
      type: 'backgroundDocumentsTable',
      attrs: {
        rows: [
          { title: 'GW1 — Strategic Outline Case (March 2026)', url: 'https://example.gov.uk/gw1' },
          { title: 'Procurement Strategy 2025–28', url: 'https://example.gov.uk/proc-strategy' },
        ],
      },
    },
    {
      type: 'appendicesTable',
      attrs: {
        rows: [
          { title: 'Appendix 1 — Tender evaluation summary', classification: 'Open' },
          { title: 'Appendix 2 — Pricing schedule', classification: 'Closed' },
        ],
      },
    },
    {
      type: 'attachment',
      attrs: {
        filename: 'tender-evaluation-summary.pdf',
        url: 'https://example.gov.uk/files/tender-evaluation-summary.pdf',
        sizeBytes: 482_000,
      },
    },
    {
      type: 'signatureBlock',
      attrs: { part: 'A', signerName: 'Hakeem Osinaike', signerDesignation: 'Strategic Director of Housing' },
    },
    {
      type: 'signatureBlock',
      attrs: { part: 'B', signerName: '', signerDesignation: '' },
    },
    {
      type: 'auditTrailFooter',
      attrs: {
        leadOfficer: 'Director of Housing',
        reportAuthor: 'Programme Manager · Materials Framework',
        version: '1.0',
        dated: '2026-05-12',
        keyDecision: 'Yes',
        consultation: 'Cabinet Member · S151 · MO',
      },
    },
  ],
};

export function GovernanceEditorSandboxPage() {
  const [content, setContent] = useState<JSONContent>(INITIAL_CONTENT);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [renderingPdf, setRenderingPdf] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const { assets, loading: assetsLoading } = useGovernanceAssets();

  const handleAutoSave = useCallback(async (json: JSONContent, wordCount: number) => {
    try {
      await api.governanceSandboxSaveSection(SANDBOX_SECTION_ID, json, wordCount);
    } catch (err: any) {
      toast.error(err?.message ?? 'Auto-save failed', { duration: 3500 });
      throw err;
    }
  }, []);

  const handleChange = useCallback((json: JSONContent) => {
    setContent(json);
  }, []);

  const handleRenderPdf = useCallback(async () => {
    if (renderingPdf) return;
    setRenderingPdf(true);
    try {
      const res = await api.governanceRenderSandboxPdf(content, {
        meta: {
          leadOfficer: 'Director of Housing',
          reportAuthor: 'Sandbox author',
          version: 'sandbox',
          dated: new Date().toISOString().slice(0, 10),
          keyDecision: 'Yes',
          consultation: 'Editor sandbox test',
        },
      });
      const dataUrl = `data:application/pdf;base64,${res.pdfBase64}`;
      setPdfUrl(dataUrl);
      toast.success('PDF rendered');
    } catch (err: any) {
      console.error('[EditorSandbox] render failed', err);
      toast.error(err?.message ?? 'Render failed');
    } finally {
      setRenderingPdf(false);
    }
  }, [content, renderingPdf]);

  const headerCopy = useMemo(
    () => ({
      title: 'Editor sandbox',
      subtitle:
        'Standalone test surface — exercises every custom node, auto-save, mobile menus and the server-side PDF renderer end-to-end.',
    }),
    [],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6"
    >
      <header className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300">
            <FlaskConical className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Programme Governance · Editor Sandbox
            </p>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100">
              {headerCopy.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
              {headerCopy.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReadOnly((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {readOnly ? (
              <>
                <Eye className="h-3.5 w-3.5" /> Edit
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" /> Read-only
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleRenderPdf}
            disabled={renderingPdf}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FileDown className="h-3.5 w-3.5" />
            {renderingPdf ? 'Rendering…' : 'Render PDF'}
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <section aria-label="Editor">
          {assetsLoading ? (
            <div className="flex h-100 animate-pulse items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-400 dark:border-slate-700 dark:bg-slate-800">
              Loading branding assets…
            </div>
          ) : (
            <GovernanceEditor
              initialContent={INITIAL_CONTENT}
              editable={!readOnly}
              onChange={handleChange}
              onAutoSave={handleAutoSave}
              assets={assets}
            />
          )}
        </section>
        <section aria-label="PDF preview" className="lg:sticky lg:top-4 lg:h-fit">
          <GovernancePDFViewer src={pdfUrl} height="80vh" />
        </section>
      </div>
    </motion.div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Plus, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface InsertNodeMenuProps {
  editor: Editor;
}

interface NodeOption {
  label: string;
  description: string;
  run: () => void;
}

export function InsertNodeMenu({ editor }: InsertNodeMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const options: NodeOption[] = [
    {
      label: 'Council logo',
      description: 'Resolves to the council crest at the top of the report.',
      run: () => editor.chain().focus().insertCouncilLogo().run(),
    },
    {
      label: 'Header metadata table',
      description: 'Decision Taker, Date, Wards, Classification, etc.',
      run: () => editor.chain().focus().insertHeaderMetadataTable().run(),
    },
    {
      label: 'Officer advice block',
      description: 'Repeatable supplementary advice (S151, MO, HoP).',
      run: () => editor.chain().focus().insertOfficerAdviceBlock().run(),
    },
    {
      label: 'Signature block · Part A',
      description: "Strategic Director's sign-off block.",
      run: () => editor.chain().focus().insertSignatureBlock({ part: 'A' }).run(),
    },
    {
      label: 'Signature block · Part B',
      description: 'Conflicts declaration sign-off block.',
      run: () => editor.chain().focus().insertSignatureBlock({ part: 'B' }).run(),
    },
    {
      label: 'Background documents table',
      description: 'Links to prior reports referenced by this paper.',
      run: () =>
        editor
          .chain()
          .focus()
          .insertBackgroundDocumentsTable([
            { title: 'GW1 — Strategic Outline Case', url: 'https://example.gov.uk/gw1' },
          ])
          .run(),
    },
    {
      label: 'Appendices table',
      description: 'List of attachments with Open / Closed classification.',
      run: () =>
        editor
          .chain()
          .focus()
          .insertAppendicesTable([
            { title: 'Appendix 1 — Tender summary', classification: 'Open' },
            { title: 'Appendix 2 — Pricing schedule', classification: 'Closed' },
          ])
          .run(),
    },
    {
      label: 'Audit trail footer',
      description: 'Auto-populated footer · do not edit by hand.',
      run: () => editor.chain().focus().insertAuditTrailFooter().run(),
    },
    {
      label: 'Regulation citation',
      description: 'Inline pill citing a regulation from the library.',
      run: () =>
        editor
          .chain()
          .focus()
          .insertRegulationCitation({
            code: 'BSA 2022 s.31',
            title: 'Building Safety Act 2022 — Section 31',
          })
          .run(),
    },
    {
      label: 'Attachment chip',
      description: 'Inline file chip (PDF / DOCX / XLSX).',
      run: () =>
        editor.chain().focus().insertAttachment({
          filename: 'tender-evaluation.pdf',
          url: 'https://example.gov.uk/files/tender-evaluation.pdf',
          sizeBytes: 482_000,
        }).run(),
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        Insert
        <ChevronDown
          className={clsx('h-3 w-3 transition-transform', open && 'rotate-180')}
          strokeWidth={2.5}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-30 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <ul className="max-h-80 overflow-y-auto py-1">
            {options.map((o) => (
              <li key={o.label}>
                <button
                  type="button"
                  onClick={() => {
                    o.run();
                    setOpen(false);
                  }}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {o.label}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {o.description}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

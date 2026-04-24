import { useEffect, useRef, useState } from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Pencil } from 'lucide-react';
import { textInputCls } from './nodeViewUi';

// Inline regulation citation pill. Click to open a tiny popover with inputs
// for the regulation code, full title, and external URL. Phase 6 will swap
// the manual inputs for a regulation-library picker — the render here
// doesn't change when that happens.

export function RegulationCitationView({ node, updateAttributes, editor }: NodeViewProps) {
  const isEditable = editor.isEditable;
  const code = (node.attrs.code as string) || '';
  const title = (node.attrs.title as string) || '';
  const url = (node.attrs.url as string) || '';

  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <NodeViewWrapper
      as="span"
      data-cedar-node="regulation-citation"
      className="relative inline-block align-middle"
    >
      <button
        type="button"
        onClick={() => isEditable && setOpen((v) => !v)}
        title={title || code}
        className="inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-200"
      >
        § {code || 'regulation'}
        {isEditable && <Pencil className="h-3 w-3 opacity-60" />}
      </button>
      {open && (
        <div
          ref={popoverRef}
          className="absolute left-0 top-6 z-40 w-72 space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
        >
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Code
            <input
              type="text"
              value={code}
              onChange={(e) => updateAttributes({ code: e.target.value })}
              placeholder="BSA 2022 s.31"
              className={textInputCls + ' mt-1 normal-case tracking-normal'}
            />
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => updateAttributes({ title: e.target.value })}
              placeholder="Building Safety Act 2022 — Section 31"
              className={textInputCls + ' mt-1 normal-case tracking-normal'}
            />
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            URL
            <input
              type="url"
              value={url}
              onChange={(e) => updateAttributes({ url: e.target.value })}
              placeholder="https://www.legislation.gov.uk/…"
              className={textInputCls + ' mt-1 normal-case tracking-normal'}
            />
          </label>
        </div>
      )}
    </NodeViewWrapper>
  );
}

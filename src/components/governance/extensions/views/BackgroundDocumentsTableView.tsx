import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Plus, Trash2 } from 'lucide-react';
import {
  addRowBtnCls,
  dangerBtnCls,
  sectionCaptionCls,
  textInputCls,
} from './nodeViewUi';

interface Row {
  title: string;
  url: string;
  reportId?: string;
}

export function BackgroundDocumentsTableView({ node, updateAttributes, editor }: NodeViewProps) {
  const isEditable = editor.isEditable;
  const rows: Row[] = Array.isArray(node.attrs.rows) ? (node.attrs.rows as Row[]) : [];

  const update = (next: Row[]) => updateAttributes({ rows: next });

  const addRow = () => update([...rows, { title: '', url: '' }]);
  const removeRow = (idx: number) => update(rows.filter((_, i) => i !== idx));
  const patchRow = (idx: number, patch: Partial<Row>) =>
    update(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <NodeViewWrapper data-cedar-node="background-documents-table" className="my-4">
      <p className={sectionCaptionCls + ' mb-2'}>Background documents</p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-400">
          No background documents · add the first below.
        </p>
      ) : (
        <table className="w-full border-collapse overflow-hidden rounded-lg border border-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-2/5 border-b border-slate-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Title
              </th>
              <th className="border-b border-slate-200 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                URL
              </th>
              <th className="w-14 border-b border-slate-200" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-b border-slate-200 last:border-b-0">
                <td className="px-2 py-1 align-middle">
                  <input
                    type="text"
                    value={r.title}
                    onChange={(e) => patchRow(idx, { title: e.target.value })}
                    placeholder="GW1 — Strategic Outline Case"
                    disabled={!isEditable}
                    className={textInputCls}
                  />
                </td>
                <td className="px-2 py-1 align-middle">
                  <input
                    type="url"
                    value={r.url}
                    onChange={(e) => patchRow(idx, { url: e.target.value })}
                    placeholder="https://…"
                    disabled={!isEditable}
                    className={textInputCls}
                  />
                </td>
                <td className="px-2 py-1 text-right align-middle">
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    disabled={!isEditable}
                    aria-label="Remove row"
                    className={dangerBtnCls}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {isEditable && (
        <button type="button" onClick={addRow} className={addRowBtnCls + ' mt-2'}>
          <Plus className="h-3.5 w-3.5" /> Add document
        </button>
      )}
    </NodeViewWrapper>
  );
}

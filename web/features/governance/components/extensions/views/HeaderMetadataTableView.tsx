import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { textInputCls, labelCellCls, valueCellCls } from './nodeViewUi';

// 7-field fixed-shape metadata table — the author types each value directly.
// Classification is a dropdown because it only has two valid values.

const FIELDS: Array<{
  key: 'decisionTaker' | 'date' | 'reportTitle' | 'wards' | 'classification' | 'reasonForLateness' | 'from';
  label: string;
  type?: 'text' | 'date' | 'select';
  options?: string[];
  placeholder?: string;
}> = [
  { key: 'decisionTaker', label: 'Decision Taker', placeholder: 'e.g. Strategic Director — Housing' },
  { key: 'date', label: 'Date', type: 'date' },
  { key: 'reportTitle', label: 'Report Title', placeholder: 'e.g. GW2 — Supply of Building Materials' },
  { key: 'wards', label: 'Wards', placeholder: 'All wards · or list wards' },
  { key: 'classification', label: 'Classification', type: 'select', options: ['Open', 'Closed', 'Part 1 and 2'] },
  { key: 'reasonForLateness', label: 'Reason for lateness', placeholder: 'N/A' },
  { key: 'from', label: 'From', placeholder: 'Directorate issuing the paper' },
];

export function HeaderMetadataTableView({ node, updateAttributes, editor }: NodeViewProps) {
  const isEditable = editor.isEditable;

  return (
    <NodeViewWrapper
      data-cedar-node="header-metadata-table"
      className="my-4 overflow-hidden rounded-lg border border-slate-200"
    >
      <table className="w-full border-collapse">
        <tbody>
          {FIELDS.map((f) => {
            const value = String((node.attrs as any)?.[f.key] ?? '');
            return (
              <tr key={f.key}>
                <th className={labelCellCls}>{f.label}</th>
                <td className={valueCellCls}>
                  {f.type === 'select' ? (
                    <select
                      value={value || (f.options?.[0] ?? '')}
                      onChange={(e) => updateAttributes({ [f.key]: e.target.value })}
                      disabled={!isEditable}
                      className={textInputCls}
                    >
                      {f.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type ?? 'text'}
                      value={value}
                      onChange={(e) => updateAttributes({ [f.key]: e.target.value })}
                      placeholder={f.placeholder}
                      disabled={!isEditable}
                      className={textInputCls}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </NodeViewWrapper>
  );
}

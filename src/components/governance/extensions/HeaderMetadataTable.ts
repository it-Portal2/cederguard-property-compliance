import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { HeaderMetadataTableView } from './views/HeaderMetadataTableView';

// HeaderMetadataTable — fixed 6-row table at the top of every report.
// Rows are mandatory and ordered: Decision Taker · Date · Report Title · Wards
// · Classification · Reason for lateness · From. Values stored as attributes.

export interface HeaderMetadataTableOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headerMetadataTable: {
      insertHeaderMetadataTable: (attrs?: Partial<HeaderMetadataAttrs>) => ReturnType;
    };
  }
}

export interface HeaderMetadataAttrs {
  decisionTaker: string;
  date: string;
  reportTitle: string;
  wards: string;
  classification: string;
  reasonForLateness: string;
  from: string;
}

const FIELDS: Array<{ key: keyof HeaderMetadataAttrs; label: string }> = [
  { key: 'decisionTaker', label: 'Decision Taker' },
  { key: 'date', label: 'Date' },
  { key: 'reportTitle', label: 'Report Title' },
  { key: 'wards', label: 'Wards' },
  { key: 'classification', label: 'Classification' },
  { key: 'reasonForLateness', label: 'Reason for lateness' },
  { key: 'from', label: 'From' },
];

export const HeaderMetadataTable = Node.create<HeaderMetadataTableOptions>({
  name: 'headerMetadataTable',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      decisionTaker: { default: '' },
      date: { default: '' },
      reportTitle: { default: '' },
      wards: { default: '' },
      classification: { default: 'Open' },
      reasonForLateness: { default: '' },
      from: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'table[data-cedar-node="header-metadata-table"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const rows = FIELDS.map((f) => [
      'tr',
      {},
      [
        'th',
        {
          class:
            'border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide w-48',
        },
        f.label,
      ],
      [
        'td',
        { class: 'border border-slate-200 px-3 py-2 text-sm text-slate-900' },
        String((node.attrs as any)[f.key] ?? '') || '—',
      ],
    ]);
    return [
      'table',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-cedar-node': 'header-metadata-table',
        class: 'w-full border-collapse my-4 rounded-lg overflow-hidden',
      }),
      ['tbody', {}, ...rows],
    ];
  },

  addCommands() {
    return {
      insertHeaderMetadataTable:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attrs ?? {} }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(HeaderMetadataTableView);
  },
});

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { AppendicesTableView } from './views/AppendicesTableView';

// AppendicesTable — list of attachments with Open / Closed (Part 2) classification.
// Closed appendices are stripped from public/FOI exports per business rule §15 + §17.

export interface AppendicesTableOptions {
  HTMLAttributes: Record<string, any>;
}

export interface AppendixRow {
  title: string;
  classification: 'Open' | 'Closed';
  fileUrl?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    appendicesTable: {
      insertAppendicesTable: (rows?: AppendixRow[]) => ReturnType;
    };
  }
}

export const AppendicesTable = Node.create<AppendicesTableOptions>({
  name: 'appendicesTable',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      rows: {
        default: [] as AppendixRow[],
        parseHTML: (el) => {
          const raw = el.getAttribute('data-rows');
          if (!raw) return [];
          try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        },
        renderHTML: (attrs) => ({
          'data-rows': JSON.stringify(attrs.rows ?? []),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'table[data-cedar-node="appendices-table"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const rows = (node.attrs.rows as AppendixRow[]) ?? [];
    const bodyRows = rows.length
      ? rows.map((r) => {
          const isClosed = r.classification === 'Closed';
          return [
            'tr',
            {},
            [
              'td',
              {
                class:
                  'border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900',
              },
              r.title || 'Untitled appendix',
            ],
            [
              'td',
              {
                class:
                  'border border-slate-200 px-3 py-2 text-xs font-semibold ' +
                  (isClosed
                    ? 'text-rose-700 bg-rose-50'
                    : 'text-emerald-700 bg-emerald-50'),
              },
              r.classification,
            ],
          ];
        })
      : [
          [
            'tr',
            {},
            [
              'td',
              {
                colspan: '2',
                class:
                  'border border-dashed border-slate-200 px-3 py-3 text-sm text-slate-400 text-center',
              },
              'No appendices added',
            ],
          ],
        ];
    return [
      'table',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-cedar-node': 'appendices-table',
        class: 'w-full border-collapse my-4 rounded-lg overflow-hidden',
      }),
      [
        'caption',
        {
          class:
            'text-left text-xs font-semibold uppercase tracking-widest text-slate-400 pb-2',
        },
        'Appendices',
      ],
      ['tbody', {}, ...bodyRows],
    ];
  },

  addCommands() {
    return {
      insertAppendicesTable:
        (rows) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { rows: rows ?? [] },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(AppendicesTableView);
  },
});

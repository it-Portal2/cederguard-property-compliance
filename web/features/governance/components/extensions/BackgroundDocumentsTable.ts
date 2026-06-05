import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { BackgroundDocumentsTableView } from './views/BackgroundDocumentsTableView';

// BackgroundDocumentsTable — links to prior reports referenced by this report
// (e.g. a GW2 references its preceding GW1). Each row carries title + url +
// optional reportId for in-app linking.

export interface BackgroundDocumentsTableOptions {
  HTMLAttributes: Record<string, any>;
}

export interface BackgroundDocumentRow {
  title: string;
  url: string;
  reportId?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    backgroundDocumentsTable: {
      insertBackgroundDocumentsTable: (rows?: BackgroundDocumentRow[]) => ReturnType;
    };
  }
}

export const BackgroundDocumentsTable = Node.create<BackgroundDocumentsTableOptions>({
  name: 'backgroundDocumentsTable',
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
        default: [] as BackgroundDocumentRow[],
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
    return [{ tag: 'table[data-cedar-node="background-documents-table"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const rows = (node.attrs.rows as BackgroundDocumentRow[]) ?? [];
    const bodyRows = rows.length
      ? rows.map((r) => [
          'tr',
          {},
          [
            'td',
            {
              class:
                'border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900',
            },
            r.title || 'Untitled document',
          ],
          [
            'td',
            { class: 'border border-slate-200 px-3 py-2 text-sm text-indigo-600' },
            r.url || '—',
          ],
        ])
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
              'No background documents added',
            ],
          ],
        ];
    return [
      'table',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-cedar-node': 'background-documents-table',
        class: 'w-full border-collapse my-4 rounded-lg overflow-hidden',
      }),
      [
        'caption',
        {
          class:
            'text-left text-xs font-semibold uppercase tracking-widest text-slate-400 pb-2',
        },
        'Background documents',
      ],
      ['tbody', {}, ...bodyRows],
    ];
  },

  addCommands() {
    return {
      insertBackgroundDocumentsTable:
        (rows) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { rows: rows ?? [] },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(BackgroundDocumentsTableView);
  },
});

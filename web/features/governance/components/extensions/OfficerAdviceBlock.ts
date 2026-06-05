import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { OfficerAdviceBlockView } from './views/OfficerAdviceBlockView';

// OfficerAdviceBlock — repeatable supplementary-advice section for S151,
// Head of Procurement, Monitoring Officer etc. Carries officer title +
// reference code; the body content is editable inline (numbered paras).

export interface OfficerAdviceBlockOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    officerAdviceBlock: {
      insertOfficerAdviceBlock: (attrs?: { officerTitle?: string; refCode?: string }) => ReturnType;
    };
  }
}

export const OfficerAdviceBlock = Node.create<OfficerAdviceBlockOptions>({
  name: 'officerAdviceBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      officerTitle: {
        default: 'Section 151 Officer',
        parseHTML: (el) => el.getAttribute('data-officer-title') || 'Section 151 Officer',
        renderHTML: (attrs) => ({ 'data-officer-title': attrs.officerTitle }),
      },
      refCode: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-ref-code') || '',
        renderHTML: (attrs) =>
          attrs.refCode ? { 'data-ref-code': attrs.refCode } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'section[data-cedar-node="officer-advice-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'section',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-cedar-node': 'officer-advice-block',
        class:
          'border-l-4 border-indigo-300 bg-indigo-50/40 rounded-r-lg px-4 py-3 my-4',
      }),
      [
        'div',
        {
          class:
            'flex items-baseline gap-2 mb-2 text-xs font-semibold uppercase tracking-widest text-indigo-700',
        },
        node.attrs.officerTitle as string,
        node.attrs.refCode
          ? ['span', { class: 'text-slate-400 normal-case tracking-normal' }, ` · ${node.attrs.refCode}`]
          : '',
      ],
      ['div', { class: 'prose prose-sm max-w-none text-slate-800' }, 0],
    ];
  },

  addCommands() {
    return {
      insertOfficerAdviceBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              officerTitle: attrs?.officerTitle ?? 'Section 151 Officer',
              refCode: attrs?.refCode ?? '',
            },
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Officer advice goes here…' }] },
            ],
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(OfficerAdviceBlockView);
  },
});

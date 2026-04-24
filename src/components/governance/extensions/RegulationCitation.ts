import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { RegulationCitationView } from './views/RegulationCitationView';

// RegulationCitation — inline pill that cites a regulation/policy from the
// regulation library. Renders inline (not block-level) so it can sit inside
// a paragraph: "...as required by [HSWA s.2(1)] this report ...".

export interface RegulationCitationOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    regulationCitation: {
      insertRegulationCitation: (attrs: { code: string; title?: string; url?: string }) => ReturnType;
    };
  }
}

export const RegulationCitation = Node.create<RegulationCitationOptions>({
  name: 'regulationCitation',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      code: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-code') || '',
        renderHTML: (attrs) => ({ 'data-code': attrs.code }),
      },
      title: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-title') || '',
        renderHTML: (attrs) => (attrs.title ? { 'data-title': attrs.title } : {}),
      },
      url: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-url') || '',
        renderHTML: (attrs) => (attrs.url ? { 'data-url': attrs.url } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-cedar-node="regulation-citation"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-cedar-node': 'regulation-citation',
        class:
          'inline-flex items-center gap-1 rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 align-middle',
        title: (node.attrs.title as string) || (node.attrs.code as string),
      }),
      `§ ${node.attrs.code as string}`,
    ];
  },

  addCommands() {
    return {
      insertRegulationCitation:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { code: attrs.code, title: attrs.title ?? '', url: attrs.url ?? '' },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(RegulationCitationView);
  },
});

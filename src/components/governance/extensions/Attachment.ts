import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { AttachmentView } from './views/AttachmentView';

// Attachment — block-level chip referencing an evidence document (PDF / DOCX / XLSX).
// Stores filename + url + sizeBytes; the render is a chip the reader can click
// in the viewer (resolves to a signed URL on render).

export interface AttachmentOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachment: {
      insertAttachment: (attrs: { filename: string; url: string; sizeBytes?: number }) => ReturnType;
    };
  }
}

const formatSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const Attachment = Node.create<AttachmentOptions>({
  name: 'attachment',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      filename: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-filename') || '',
        renderHTML: (attrs) => ({ 'data-filename': attrs.filename }),
      },
      url: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-url') || '',
        renderHTML: (attrs) => ({ 'data-url': attrs.url }),
      },
      sizeBytes: {
        default: 0,
        parseHTML: (el) => Number(el.getAttribute('data-size-bytes') || 0),
        renderHTML: (attrs) =>
          attrs.sizeBytes ? { 'data-size-bytes': String(attrs.sizeBytes) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-cedar-node="attachment"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const sizeLabel = formatSize(node.attrs.sizeBytes as number);
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-cedar-node': 'attachment',
        class:
          'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 my-2 shadow-sm text-sm text-slate-800',
      }),
      ['span', { class: 'font-semibold text-slate-900' }, (node.attrs.filename as string) || 'Attachment'],
      sizeLabel ? ['span', { class: 'text-xs text-slate-500' }, ` · ${sizeLabel}`] : '',
    ];
  },

  addCommands() {
    return {
      insertAttachment:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: {
              filename: attrs.filename,
              url: attrs.url,
              sizeBytes: attrs.sizeBytes ?? 0,
            },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView);
  },
});

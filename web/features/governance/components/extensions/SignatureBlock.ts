import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { SignatureBlockView } from './views/SignatureBlockView';

// SignatureBlock — placeholder that resolves to a signed officer's signature image,
// name, designation and date during PDF render. AI is forbidden from drafting Part A/B
// signature content per business rule #32.

export interface SignatureBlockOptions {
  HTMLAttributes: Record<string, any>;
  /**
   * Resolved signature URLs keyed by part. `A` is the current user's
   * signature; `B` is optional (typically the counter-signer, resolved at
   * actual sign-off time). `null`/missing = render placeholder.
   */
  signatureUrls: Partial<Record<SignaturePart, string | null>>;
}

export type SignaturePart = 'A' | 'B';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    signatureBlock: {
      insertSignatureBlock: (attrs?: { part?: SignaturePart }) => ReturnType;
    };
  }
}

export const SignatureBlock = Node.create<SignatureBlockOptions>({
  name: 'signatureBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { HTMLAttributes: {}, signatureUrls: {} };
  },

  addAttributes() {
    return {
      part: {
        default: 'A' as SignaturePart,
        parseHTML: (el) => (el.getAttribute('data-part') as SignaturePart) || 'A',
        renderHTML: (attrs) => ({ 'data-part': attrs.part }),
      },
      signerName: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-signer-name') || '',
        renderHTML: (attrs) =>
          attrs.signerName ? { 'data-signer-name': attrs.signerName } : {},
      },
      signerDesignation: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-signer-designation') || '',
        renderHTML: (attrs) =>
          attrs.signerDesignation
            ? { 'data-signer-designation': attrs.signerDesignation }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-cedar-node="signature-block"]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const part = (node.attrs.part as SignaturePart) || 'A';
    const signerName = (node.attrs.signerName as string) || '';
    const signerDesignation = (node.attrs.signerDesignation as string) || '';
    const signatureUrl = this.options.signatureUrls?.[part] ?? null;

    if (signatureUrl) {
      const children: any[] = [
        [
          'div',
          { class: 'text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2' },
          `Part ${part} · signature`,
        ],
        [
          'img',
          {
            src: signatureUrl,
            alt: `Part ${part} signature`,
            class: 'h-16 object-contain',
            draggable: 'false',
          },
        ],
      ];
      if (signerName) {
        children.push(['div', { class: 'mt-2 text-sm font-bold text-slate-900' }, signerName]);
      }
      if (signerDesignation) {
        children.push([
          'div',
          { class: 'text-[11px] italic text-slate-500' },
          signerDesignation,
        ]);
      }
      return [
        'div',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          'data-cedar-node': 'signature-block',
          class: 'rounded-lg border border-slate-200 bg-white px-4 py-4 my-4 shadow-sm',
        }),
        ...children,
      ];
    }

    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-cedar-node': 'signature-block',
        class:
          'rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-4 py-5 my-4 text-amber-800 text-sm',
      }),
      `Part ${part} signature · upload one in Profile Settings`,
    ];
  },

  addCommands() {
    return {
      insertSignatureBlock:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { part: attrs?.part ?? 'A' },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(SignatureBlockView);
  },
});

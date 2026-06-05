import { Node, mergeAttributes } from '@tiptap/core';

// CouncilLogo — single-instance placeholder at the top of every report.
// When the editor is configured with `logoUrl`, the uploaded crest renders
// inline in the editor (and in the server-side PDF). If no logo is configured,
// a dashed placeholder makes the missing-asset state obvious.

export interface CouncilLogoOptions {
  HTMLAttributes: Record<string, any>;
  /** Public URL of the council's uploaded logo. `null` = show placeholder. */
  logoUrl: string | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    councilLogo: {
      insertCouncilLogo: () => ReturnType;
    };
  }
}

export const CouncilLogo = Node.create<CouncilLogoOptions>({
  name: 'councilLogo',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { HTMLAttributes: {}, logoUrl: null };
  },

  parseHTML() {
    return [{ tag: 'div[data-cedar-node="council-logo"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const logoUrl = this.options.logoUrl;
    if (logoUrl) {
      return [
        'div',
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          'data-cedar-node': 'council-logo',
          class: 'my-4 flex items-center justify-center rounded-lg bg-white py-4',
        }),
        [
          'img',
          {
            src: logoUrl,
            alt: 'Council logo',
            class: 'max-h-20 object-contain',
            draggable: 'false',
          },
        ],
      ];
    }
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-cedar-node': 'council-logo',
        class:
          'flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[11px] font-medium uppercase tracking-widest text-slate-400 my-4',
      }),
      'Council logo · upload in Workspace Settings → Branding',
    ];
  },

  addCommands() {
    return {
      insertCouncilLogo:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});

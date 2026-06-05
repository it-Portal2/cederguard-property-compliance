import { Node, mergeAttributes } from '@tiptap/core';

// AuditTrailFooter — auto-populated from report metadata. NEVER hand-editable.
// Renders as a read-only table at the very bottom of every report.
// Fields: Lead Officer · Report Author · Version · Dated · Key Decision · Consultation summary.

export interface AuditTrailFooterOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    auditTrailFooter: {
      insertAuditTrailFooter: (attrs?: Partial<AuditTrailFooterAttrs>) => ReturnType;
    };
  }
}

export interface AuditTrailFooterAttrs {
  leadOfficer: string;
  reportAuthor: string;
  version: string;
  dated: string;
  keyDecision: 'Yes' | 'No';
  consultation: string;
}

const FIELDS: Array<{ key: keyof AuditTrailFooterAttrs; label: string }> = [
  { key: 'leadOfficer', label: 'Lead Officer' },
  { key: 'reportAuthor', label: 'Report Author' },
  { key: 'version', label: 'Version' },
  { key: 'dated', label: 'Dated' },
  { key: 'keyDecision', label: 'Key Decision?' },
  { key: 'consultation', label: 'Consultation' },
];

export const AuditTrailFooter = Node.create<AuditTrailFooterOptions>({
  name: 'auditTrailFooter',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      leadOfficer: { default: '' },
      reportAuthor: { default: '' },
      version: { default: '1.0' },
      dated: { default: '' },
      keyDecision: { default: 'No' as 'Yes' | 'No' },
      consultation: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'table[data-cedar-node="audit-trail-footer"]' }];
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
        'data-cedar-node': 'audit-trail-footer',
        class: 'w-full border-collapse my-4 rounded-lg overflow-hidden',
      }),
      [
        'caption',
        {
          class:
            'text-left text-xs font-semibold uppercase tracking-widest text-slate-400 pb-2',
        },
        'Audit trail · auto-populated',
      ],
      ['tbody', {}, ...rows],
    ];
  },

  addCommands() {
    return {
      insertAuditTrailFooter:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attrs ?? {} }),
    };
  },
});

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { inlineInputCls, textInputCls } from './nodeViewUi';

// Signature block with editable signer name + designation + Part A/B toggle.
// The image itself resolves from the editor's `signatureUrls` option on
// the extension (uploaded in Profile Settings → Signature). Author cannot
// upload from inside the node — that's per plan §17.

type Part = 'A' | 'B';

interface Options {
  signatureUrls: Partial<Record<Part, string | null>>;
}

export function SignatureBlockView({ node, updateAttributes, editor, extension }: NodeViewProps) {
  const isEditable = editor.isEditable;
  const part = (node.attrs.part as Part) || 'A';
  const signerName = (node.attrs.signerName as string) || '';
  const signerDesignation = (node.attrs.signerDesignation as string) || '';
  const signatureUrls = (extension.options as Options).signatureUrls ?? {};
  const signatureUrl = signatureUrls[part] ?? null;

  return (
    <NodeViewWrapper
      data-cedar-node="signature-block"
      className={
        'my-4 rounded-lg px-4 py-4 ' +
        (signatureUrl
          ? 'border border-slate-200 bg-white shadow-sm'
          : 'border border-dashed border-amber-300 bg-amber-50/50')
      }
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          <span>Signature</span>
          <select
            value={part}
            onChange={(e) => updateAttributes({ part: e.target.value as Part })}
            disabled={!isEditable}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
          >
            <option value="A">Part A</option>
            <option value="B">Part B</option>
          </select>
        </div>
      </div>

      {signatureUrl ? (
        <img
          src={signatureUrl}
          alt={`Part ${part} signature`}
          className="h-16 object-contain"
          draggable={false}
        />
      ) : (
        <p className="text-sm text-amber-800">
          No signature uploaded · upload one in Profile Settings → Signature.
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Signer name
          <input
            type="text"
            value={signerName}
            onChange={(e) => updateAttributes({ signerName: e.target.value })}
            placeholder="Full name"
            disabled={!isEditable}
            className={textInputCls + ' mt-1 normal-case tracking-normal text-slate-900'}
          />
        </label>
        <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          Designation
          <input
            type="text"
            value={signerDesignation}
            onChange={(e) => updateAttributes({ signerDesignation: e.target.value })}
            placeholder="Role / title"
            disabled={!isEditable}
            className={textInputCls + ' mt-1 normal-case tracking-normal text-slate-900'}
          />
        </label>
      </div>
    </NodeViewWrapper>
  );
}

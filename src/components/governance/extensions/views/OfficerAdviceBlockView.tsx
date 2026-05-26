import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { inlineInputCls } from './nodeViewUi';

// OfficerAdviceBlock — the body is editable (ProseMirror content), the
// officer title and ref code live as editable attrs at the top.

export function OfficerAdviceBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const isEditable = editor.isEditable;
  const officerTitle = (node.attrs.officerTitle as string) || 'Section 151 Officer';
  const refCode = (node.attrs.refCode as string) || '';

  return (
    <NodeViewWrapper
      data-cedar-node="officer-advice-block"
      className="my-4 rounded-r-lg border-l-4 border-indigo-300 bg-indigo-50/40 px-4 py-3"
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={officerTitle}
          onChange={(e) => updateAttributes({ officerTitle: e.target.value })}
          placeholder="Officer title"
          disabled={!isEditable}
          className={
            inlineInputCls +
            'font-mono  text-xs font-semibold uppercase tracking-wide text-indigo-700'
          }
        />
        <input
          type="text"
          value={refCode}
          onChange={(e) => updateAttributes({ refCode: e.target.value })}
          placeholder="Ref code (optional)"
          disabled={!isEditable}
          className={inlineInputCls + ' text-xs italic text-slate-500'}
        />
      </div>
      <NodeViewContent className="prose prose-sm max-w-none text-slate-800 focus:outline-none" />
    </NodeViewWrapper>
  );
}

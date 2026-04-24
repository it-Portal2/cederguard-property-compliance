import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { FileText, Trash2 } from 'lucide-react';
import { inlineInputCls } from './nodeViewUi';

// Attachment chip. Editable: filename + url. Remove via the trash button.
// The file itself is chosen at insert time (Phase 6 adds a proper picker).

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentView({ node, updateAttributes, deleteNode, editor }: NodeViewProps) {
  const isEditable = editor.isEditable;
  const filename = (node.attrs.filename as string) || '';
  const url = (node.attrs.url as string) || '';
  const size = formatSize(node.attrs.sizeBytes as number);

  return (
    <NodeViewWrapper
      data-cedar-node="attachment"
      className="my-2 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm"
    >
      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
      <input
        type="text"
        value={filename}
        onChange={(e) => updateAttributes({ filename: e.target.value })}
        placeholder="filename.pdf"
        disabled={!isEditable}
        className={inlineInputCls + ' font-semibold text-slate-900 min-w-[8rem]'}
      />
      <input
        type="url"
        value={url}
        onChange={(e) => updateAttributes({ url: e.target.value })}
        placeholder="https://…"
        disabled={!isEditable}
        className={inlineInputCls + ' text-slate-500 min-w-[12rem]'}
      />
      {size && <span className="text-xs text-slate-500">· {size}</span>}
      {isEditable && (
        <button
          type="button"
          onClick={() => deleteNode()}
          aria-label="Remove attachment"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </NodeViewWrapper>
  );
}

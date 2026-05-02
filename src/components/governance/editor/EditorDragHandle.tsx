import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { DragHandle } from '@tiptap/extension-drag-handle-react';
import { GripVertical, Trash2 } from 'lucide-react';
import type { Node as PMNode } from '@tiptap/pm/model';
import { motion, AnimatePresence } from 'motion/react';

interface EditorDragHandleProps {
  editor: Editor;
}

// Floats next to whichever block the user is hovering / has selected.
// Click-and-hold the grip to drag; click the trash to delete the block.
// Works for every block-level node including all custom governance nodes.
export function EditorDragHandle({ editor }: EditorDragHandleProps) {
  // Tracks the current node the drag handle is targeting so the trash
  // button knows what to delete. `pos` is the absolute ProseMirror position
  // of the node's opening boundary.
  const [target, setTarget] = useState<{ node: PMNode; pos: number } | null>(null);

  const handleDelete = () => {
    if (!target) return;
    const from = target.pos;
    const to = target.pos + target.node.nodeSize;
    editor.chain().focus().deleteRange({ from, to }).run();
    setTarget(null);
  };

  return (
    <DragHandle
      editor={editor}
      onNodeChange={({ node, pos }) => {
        setTarget(node ? { node, pos } : null);
      }}
      // Mobile: hide entirely (no hover, no room in the gutter). Desktop:
      // float above the sidebar so it's never clipped by the rail — matches
      // the BubbleMenu / FloatingMenu rule.
      className="hidden md:block md:z-60"
    >
      <AnimatePresence>
        {target && editor.isEditable && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
            // Negative offset sized to land INSIDE the editor's desktop
            // left-padding gutter (md:pl-14 = 56px). Keeps handles within
            // the white card, never over the sidebar.
            className="-ml-12 flex items-center gap-0.5"
          >
            <button
              type="button"
              aria-label="Drag block"
              className="flex h-7 w-6 cursor-grab items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <GripVertical className="h-4 w-4" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              aria-label="Delete block"
              onClick={handleDelete}
              className="flex h-7 w-6 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </DragHandle>
  );
}

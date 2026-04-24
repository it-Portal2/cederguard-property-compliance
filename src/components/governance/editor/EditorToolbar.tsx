import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Table as TableIcon,
  Undo2,
  Redo2,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import { InsertNodeMenu } from './InsertNodeMenu';
import { AIDraftActions } from './AIDraftActions';

interface EditorToolbarProps {
  editor: Editor;
}

interface ToolButton {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const buttons: ToolButton[] = [
    {
      icon: Bold,
      label: 'Bold',
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      icon: Italic,
      label: 'Italic',
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      icon: Heading2,
      label: 'Heading 2',
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
    },
    {
      icon: Heading3,
      label: 'Heading 3',
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
    },
    {
      icon: List,
      label: 'Bullet list',
      onClick: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
    },
    {
      icon: ListOrdered,
      label: 'Ordered list',
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
    },
    {
      icon: Quote,
      label: 'Blockquote',
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
    },
    {
      icon: Minus,
      label: 'Horizontal rule',
      onClick: () => editor.chain().focus().setHorizontalRule().run(),
    },
    {
      icon: TableIcon,
      label: 'Insert table',
      // Smart insertion:
      //   • Cursor in a textblock (paragraph/heading)     → split at cursor
      //   • NodeSelection on an atom (signatureBlock etc) → insert just after
      //   • Anything else                                 → fallback to selection.to
      // This keeps the table near where the user is editing instead of always
      // dumping it at the end of the document.
      onClick: () => {
        const { selection } = editor.state;
        const $from = selection.$from;
        const insertPos =
          selection.empty && $from.parent.isTextblock && !$from.parent.isAtom
            ? selection.from
            : selection.to;

        editor
          .chain()
          .focus()
          .insertContentAt(insertPos, [
            { type: 'paragraph' },
            {
              type: 'table',
              content: [
                {
                  type: 'tableRow',
                  content: [
                    { type: 'tableHeader', content: [{ type: 'paragraph' }] },
                    { type: 'tableHeader', content: [{ type: 'paragraph' }] },
                    { type: 'tableHeader', content: [{ type: 'paragraph' }] },
                  ],
                },
                {
                  type: 'tableRow',
                  content: [
                    { type: 'tableCell', content: [{ type: 'paragraph' }] },
                    { type: 'tableCell', content: [{ type: 'paragraph' }] },
                    { type: 'tableCell', content: [{ type: 'paragraph' }] },
                  ],
                },
                {
                  type: 'tableRow',
                  content: [
                    { type: 'tableCell', content: [{ type: 'paragraph' }] },
                    { type: 'tableCell', content: [{ type: 'paragraph' }] },
                    { type: 'tableCell', content: [{ type: 'paragraph' }] },
                  ],
                },
              ],
            },
          ])
          .run();
      },
    },
  ];

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-t-xl border-b border-slate-100 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-800">
      {buttons.map((b) => (
        <ToolbarButton key={b.label} button={b} />
      ))}
      <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <ToolbarButton
        button={{
          icon: Undo2,
          label: 'Undo',
          onClick: () => editor.chain().focus().undo().run(),
          disabled: !editor.can().undo(),
        }}
      />
      <ToolbarButton
        button={{
          icon: Redo2,
          label: 'Redo',
          onClick: () => editor.chain().focus().redo().run(),
          disabled: !editor.can().redo(),
        }}
      />
      <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <InsertNodeMenu editor={editor} />
      <div className="ml-auto">
        <AIDraftActions editor={editor} />
      </div>
    </div>
  );
}

function ToolbarButton({ button }: { button: ToolButton }) {
  const Icon = button.icon;
  return (
    <button
      type="button"
      onClick={button.onClick}
      disabled={button.disabled}
      title={button.label}
      aria-label={button.label}
      className={clsx(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors',
        'hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
        button.isActive && 'bg-slate-900 text-white hover:bg-slate-800',
        button.disabled && 'opacity-40 cursor-not-allowed hover:bg-transparent',
      )}
    >
      <Icon className="h-4 w-4" strokeWidth={2.25} />
    </button>
  );
}

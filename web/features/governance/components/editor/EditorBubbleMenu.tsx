import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Bold, Italic, Strikethrough, Code } from 'lucide-react';
import { clsx } from 'clsx';

interface EditorBubbleMenuProps {
  editor: Editor;
}

// Mobile-first inline formatting bubble — appears over selected text.
// Touch-target ≥ 44 px per §22 mobile rules.
export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  const items = [
    {
      icon: Bold,
      label: 'Bold',
      onClick: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
    },
    {
      icon: Italic,
      label: 'Italic',
      onClick: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
    },
    {
      icon: Strikethrough,
      label: 'Strike',
      onClick: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive('strike'),
    },
    {
      icon: Code,
      label: 'Inline code',
      onClick: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive('code'),
    },
  ];

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ editor, from, to }) => from !== to && editor.isEditable}
      // Mobile: sit below the slide-in sidebar (z-50). Desktop (md+): float
      // above the sidebar so the inline tools never get clipped by the rail.
      className="z-40 md:z-60"
    >
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.isActive();
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              title={item.label}
              aria-label={item.label}
              className={clsx(
                'inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 transition-colors md:h-9 md:w-9',
                'hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
                active && 'bg-slate-900 text-white hover:bg-slate-800',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
            </button>
          );
        })}
      </div>
    </BubbleMenu>
  );
}

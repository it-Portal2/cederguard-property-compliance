import type { Editor } from '@tiptap/react';
import { FloatingMenu } from '@tiptap/react/menus';
import { Heading2, Heading3, List, ListOrdered, Quote } from 'lucide-react';

interface EditorFloatingMenuProps {
  editor: Editor;
}

// FloatingMenu — pops up next to an empty paragraph so the author can
// switch the block type with one tap. Mobile-friendly.
export function EditorFloatingMenu({ editor }: EditorFloatingMenuProps) {
  const items = [
    {
      icon: Heading2,
      label: 'Heading 2',
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: Heading3,
      label: 'Heading 3',
      onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      icon: List,
      label: 'Bullet list',
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      label: 'Ordered list',
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: Quote,
      label: 'Quote',
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <FloatingMenu
      editor={editor}
      // Always sit centered above the cursor so the menu stays close to the
      // caret regardless of where the user clicked. Avoids the menu pushing
      // off-screen left and overlapping the sidebar on wide layouts.
      options={{ placement: 'top', offset: 8 }}
      shouldShow={({ editor }) => {
        if (!editor.isEditable) return false;
        const { $from } = editor.state.selection;
        const isEmpty = $from.parent.content.size === 0;
        const isParagraph = $from.parent.type.name === 'paragraph';
        return isEmpty && isParagraph;
      }}
      // Mobile: sit below the slide-in sidebar (z-50). Desktop (md+): float
      // above the sidebar so the inline tools never get clipped by the rail.
      className="z-40 md:z-60"
    >
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              title={item.label}
              aria-label={item.label}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Icon className="h-4 w-4" strokeWidth={2.25} />
            </button>
          );
        })}
      </div>
    </FloatingMenu>
  );
}

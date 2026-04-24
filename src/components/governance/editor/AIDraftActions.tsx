import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Lightbulb } from 'lucide-react';

interface AIDraftActionsProps {
  editor: Editor;
}

// Phase 1 stub: inserts a clearly-marked placeholder paragraph.
// Phase 12 (Automation) wires this to the Gemini service per business rule §31
// (AI suggestions; never persist without explicit accept).
export function AIDraftActions({ editor }: AIDraftActionsProps) {
  const [busy, setBusy] = useState(false);

  const handleDraft = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Simulate an AI-suggestion flow: fake latency, insert a clearly-marked
      // suggestion the author has already "accepted" by clicking the button.
      await new Promise((r) => setTimeout(r, 350));
      editor
        .chain()
        .focus()
        .insertContent({
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text:
                '[AI draft] This section will be drafted by Gemini in Phase 12 — author always accepts before persistence.',
            },
          ],
        })
        .run();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDraft}
      disabled={busy || !editor.isEditable}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-100 px-2.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Lightbulb className="h-3.5 w-3.5" strokeWidth={2.5} />
      {busy ? 'Drafting…' : 'Draft with AI'}
    </button>
  );
}

// Phase 12 — opens the `AIDraftModal` so the author can give the model
// a free-text instruction (e.g. "write 10 bullet points covering …")
// alongside the auto-extracted document context.  Per business rule §31
// + §54 — AI never persists without explicit user accept; the modal's
// "Insert at cursor" button is the explicit accept.

import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { Lightbulb } from 'lucide-react';
import { AIDraftModal } from './AIDraftModal';

interface AIDraftActionsProps {
  editor: Editor;
  /** Optional document-level context forwarded to the modal so the
   * Gemini prompt can be tailored (e.g. "Cabinet KM4 — Recommendations
   * section" or "DPB · May 2026 minutes · agenda: …"). */
  aiContext?: string;
}

export function AIDraftActions({ editor, aiContext }: AIDraftActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => editor.isEditable && setIsOpen(true)}
        disabled={!editor.isEditable}
        title="Open the AI drafting assistant"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-100 px-2.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Lightbulb className="h-3.5 w-3.5" strokeWidth={2.5} />
        Draft with AI
      </button>
      <AIDraftModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        editor={editor}
        aiContext={aiContext}
      />
    </>
  );
}

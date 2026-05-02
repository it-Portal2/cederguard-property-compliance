// Phase 12 — AI Draft modal.
//
// Click "Draft with AI" → opens this modal.
//   1. Context preview (top, read-only) shows what the AI will see —
//      page-supplied `aiContext` + last ~600 chars of editor.
//   2. User types a free-text instruction ("write 10 bullet points
//      explaining …", "summarise as 3 sentences", "add a risks
//      table" — whatever).
//   3. Generate → call Gemini through `aiRoutes.geminiPrompt` (lesson
//      #113) with system instruction + context + user instruction.
//   4. Result preview appears below the input. User can Regenerate,
//      Insert at cursor, or Cancel. Per business rule §31 — AI never
//      persists without explicit accept; the Insert button is the
//      explicit accept.
//
// All state lives in this component. Insert handler dispatches paragraphs
// + bullet lists + ordered lists into the editor as italic suggestion
// nodes the user can edit/delete after acceptance.

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Lightbulb, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';

interface AIDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  editor: Editor;
  aiContext?: string;
}

const SYSTEM_INSTRUCTION = `You are assisting a UK local authority Programme Manager or Project Manager drafting a governance document. Output plain text in British English suitable for council Cabinet papers / minutes / governance logs. Reference UK regulatory framing (Localism Act 2011, Local Government Act 1972, Building Safety Act 2022) only when genuinely relevant; never invent regulation citations or numbers. No greetings, no markdown headers. If the user asks for bullet points, output one item per line prefixed with "- ". If the user asks for a numbered list, output one item per line prefixed with "1. ", "2. ", etc.`;

const SUGGESTED_PROMPTS = [
  'Draft 5 recommendations as bullet points',
  'Summarise the context above in 3 short sentences',
  'List the key risks as bullet points with one-line mitigation each',
  'Write a Reasons for Decision paragraph (4-5 sentences)',
  'Draft Section 151 financial commentary in formal tone',
];

function paragraphsToTiptapNodes(text: string): any[] {
  const nodes: any[] = [];
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const isBulletList =
      lines.length > 1 && lines.every((l) => /^[-*•]\s+/.test(l));
    const isOrderedList =
      lines.length > 1 && lines.every((l) => /^\d+[.)]\s+/.test(l));

    if (isBulletList) {
      nodes.push({
        type: 'bulletList',
        content: lines.map((l) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  marks: [{ type: 'italic' }],
                  text: l.replace(/^[-*•]\s+/, ''),
                },
              ],
            },
          ],
        })),
      });
      continue;
    }
    if (isOrderedList) {
      nodes.push({
        type: 'orderedList',
        content: lines.map((l) => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  marks: [{ type: 'italic' }],
                  text: l.replace(/^\d+[.)]\s+/, ''),
                },
              ],
            },
          ],
        })),
      });
      continue;
    }
    // Plain paragraph
    nodes.push({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          marks: [{ type: 'italic' }],
          text: block.replace(/\n/g, ' '),
        },
      ],
    });
  }
  return nodes;
}

export function AIDraftModal({
  isOpen,
  onClose,
  editor,
  aiContext,
}: AIDraftModalProps) {
  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Read editor context once on each open so the preview reflects
  // the current document state.
  const [editorContext, setEditorContext] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    setInstruction('');
    setResult(null);
    setBusy(false);
    try {
      const slice = editor.state.doc.textBetween(
        0,
        editor.state.doc.content.size,
        '\n',
      );
      setEditorContext(slice.slice(-800).trim());
    } catch {
      setEditorContext('');
    }
    // Focus the textarea after the open animation settles.
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen, editor]);

  if (!isOpen) return null;

  const generate = async () => {
    if (busy) return;
    const userInstruction = instruction.trim();
    if (!userInstruction) {
      toast.error('Tell the AI what you want it to draft.');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setResult(null);

    const promptParts = [SYSTEM_INSTRUCTION];
    if (aiContext) promptParts.push(`Document context: ${aiContext}.`);
    if (editorContext) {
      promptParts.push(
        `Existing draft text (continue from this; do not repeat it verbatim unless the user asks):\n${editorContext}`,
      );
    }
    promptParts.push(`User instruction:\n${userInstruction}`);
    const prompt = promptParts.join('\n\n');

    try {
      const res: any = await api.testGemini(prompt);
      if (!res?.success) {
        throw new Error(res?.error ?? 'AI engine returned no draft.');
      }
      const text = typeof res.result === 'string' ? res.result.trim() : '';
      if (!text) throw new Error('Empty AI response.');
      setResult(text);
    } catch (e: any) {
      console.error('[AIDraftModal] Gemini draft failed', e);
      toast.error(e?.message ?? 'AI draft failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const insert = () => {
    if (!result) return;
    try {
      const nodes = paragraphsToTiptapNodes(result);
      if (nodes.length === 0) {
        toast.error('Nothing to insert.');
        return;
      }
      editor.chain().focus().insertContent(nodes).run();
      toast.success('Inserted as italic suggestion. Edit or delete as needed.');
      onClose();
    } catch (e: any) {
      console.error('[AIDraftModal] insert failed', e);
      toast.error('Could not insert into the editor.');
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.15 }}
          className="relative flex max-h-[min(92vh,800px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-slate-200"
        >
          {/* Header */}
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                <Lightbulb className="h-5 w-5" strokeWidth={2.4} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Draft with AI
                </h2>
                <p className="text-xs text-slate-500">
                  Tell the AI what to draft. It uses the document context below + your instruction.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {/* Context preview */}
            <section className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Context the AI will see
              </p>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {aiContext && (
                  <p className="font-medium text-slate-800">{aiContext}</p>
                )}
                {editorContext ? (
                  <p
                    className={
                      'whitespace-pre-wrap text-slate-600 ' +
                      (aiContext ? 'mt-1.5' : '')
                    }
                  >
                    {editorContext.length > 360
                      ? `…${editorContext.slice(-360)}`
                      : editorContext}
                  </p>
                ) : (
                  !aiContext && (
                    <p className="italic text-slate-400">
                      No prior text in the editor — the AI will draft from your instruction alone.
                    </p>
                  )
                )}
              </div>
            </section>

            {/* User instruction */}
            <section className="mt-4 space-y-1.5">
              <label
                htmlFor="ai-instruction"
                className="text-[11px] font-semibold uppercase tracking-wide text-slate-500"
              >
                What do you want the AI to draft?
              </label>
              <textarea
                id="ai-instruction"
                ref={inputRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    generate();
                  }
                }}
                rows={4}
                disabled={busy}
                placeholder="e.g. Write 10 bullet points covering the headline risks for this scheme."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setInstruction(p)}
                    disabled={busy}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <p className="pt-1 text-[10px] text-slate-400">
                Tip: ⌘/Ctrl + Enter to generate.
              </p>
            </section>

            {/* Result preview */}
            {result && (
              <section className="mt-4 space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
                  AI draft (preview)
                </p>
                <div className="whitespace-pre-wrap rounded-lg border border-indigo-200 bg-indigo-50/40 px-3 py-2.5 text-sm italic text-slate-800">
                  {result}
                </div>
                <p className="text-[10px] text-slate-400">
                  Inserts at the cursor as italic suggestions you can edit or delete before saving.
                </p>
              </section>
            )}
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            {result && !busy && (
              <button
                type="button"
                onClick={generate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            )}
            {!result ? (
              <button
                type="button"
                onClick={generate}
                disabled={busy || !instruction.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Lightbulb className="h-3.5 w-3.5" strokeWidth={2.4} />
                )}
                {busy ? 'Drafting…' : 'Generate'}
              </button>
            ) : (
              <button
                type="button"
                onClick={insert}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Insert at cursor
              </button>
            )}
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

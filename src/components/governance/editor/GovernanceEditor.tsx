import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { Placeholder } from '@tiptap/extension-placeholder';
import { CharacterCount } from '@tiptap/extension-character-count';
import {
  CouncilLogo,
  SignatureBlock,
  HeaderMetadataTable,
  AuditTrailFooter,
  BackgroundDocumentsTable,
  AppendicesTable,
  OfficerAdviceBlock,
  RegulationCitation,
  Attachment,
} from '../extensions';
import type { GovernanceAssets } from '../useGovernanceAssets';
import { EditorToolbar } from './EditorToolbar';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { EditorFloatingMenu } from './EditorFloatingMenu';
import { EditorDragHandle } from './EditorDragHandle';

// Auto-save debounce window (ms). Locked at 30s per business rule §34.
const AUTOSAVE_DEBOUNCE_MS = 30_000;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface GovernanceEditorProps {
  initialContent: JSONContent | string;
  editable?: boolean;
  placeholder?: string;
  onAutoSave?: (json: JSONContent, wordCount: number) => Promise<void>;
  onChange?: (json: JSONContent) => void;
  onEditorReady?: (editor: Editor) => void;
  className?: string;
  /**
   * Resolved branding assets. When present, the CouncilLogo / SignatureBlock
   * nodes render the actual uploaded images inside the editor, and the
   * Stamp extension exposes the uploaded stamps to the insert menu.
   */
  assets?: GovernanceAssets;
  /**
   * Forwarded to the toolbar's "Draft with AI" action so the Gemini
   * prompt is context-aware (e.g. "Cabinet KM4 — Recommendations
   * section" or "DPB · May 2026 minutes"). Optional; the AI button
   * still works without it but produces more generic prose.
   */
  aiContext?: string;
}

export function GovernanceEditor({
  initialContent,
  editable = true,
  placeholder = 'Start typing — AI suggestions appear in the side panel.',
  onAutoSave,
  onChange,
  onEditorReady,
  className,
  assets,
  aiContext,
}: GovernanceEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAutoSaveRef = useRef(onAutoSave);
  onAutoSaveRef.current = onAutoSave;

  const extensions = useMemo(
    () => [
      // Tailwind v4 ships without typography plugin in this repo, so we attach
      // explicit utility classes to each block/inline so headings, lists and
      // blockquote render with proper visual hierarchy inside the editor.
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
          HTMLAttributes: {
            class: 'cedar-heading font-bold tracking-tight text-slate-900 mt-6 mb-3',
          },
        },
        bulletList: {
          HTMLAttributes: { class: 'list-disc pl-6 my-3 space-y-1 marker:text-slate-400' },
        },
        orderedList: {
          HTMLAttributes: { class: 'list-decimal pl-6 my-3 space-y-1 marker:text-slate-400' },
        },
        listItem: {
          HTMLAttributes: { class: 'pl-1' },
        },
        blockquote: {
          HTMLAttributes: {
            class: 'border-l-4 border-indigo-300 bg-indigo-50/40 pl-4 pr-3 py-2 my-3 italic text-slate-700 rounded-r-lg',
          },
        },
        horizontalRule: {
          HTMLAttributes: { class: 'my-6 border-slate-200' },
        },
        paragraph: {
          HTMLAttributes: { class: 'my-2' },
        },
        bold: {
          HTMLAttributes: { class: 'font-semibold text-slate-900' },
        },
        italic: {
          HTMLAttributes: { class: 'italic' },
        },
        code: {
          HTMLAttributes: {
            class: 'rounded bg-slate-100 px-1.5 py-0.5 text-[0.85em] text-rose-600 font-mono',
          },
        },
      }),
      Table.configure({
        resizable: false,
        HTMLAttributes: { class: 'w-full border-collapse my-3 text-sm' },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: { class: 'border border-slate-200 px-3 py-2 align-top' },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700',
        },
      }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      CouncilLogo.configure({ logoUrl: assets?.logoUrl ?? null }),
      SignatureBlock.configure({
        signatureUrls: { A: assets?.signatureUrl ?? null },
      }),
      HeaderMetadataTable,
      AuditTrailFooter,
      BackgroundDocumentsTable,
      AppendicesTable,
      OfficerAdviceBlock,
      RegulationCitation,
      Attachment,
    ],
    [placeholder, assets?.logoUrl, assets?.signatureUrl],
  );

  const triggerAutoSave = useCallback(
    async (editor: Editor) => {
      const fn = onAutoSaveRef.current;
      if (!fn) return;
      try {
        setSaveStatus('saving');
        setSaveError(null);
        const json = editor.getJSON();
        const wordCount = editor.storage.characterCount?.words?.() ?? 0;
        await fn(json, wordCount);
        setSaveStatus('saved');
        setLastSavedAt(new Date());
      } catch (err: any) {
        const msg = err?.message || 'Auto-save failed. Your draft is held in the browser — try again.';
        console.error('[GovernanceEditor] auto-save failed:', err);
        setSaveStatus('error');
        setSaveError(msg);
      }
    },
    [],
  );

  const editor = useEditor(
    {
      extensions,
      content: initialContent,
      editable,
      editorProps: {
        attributes: {
          // Extra left padding on desktop (md:pl-14) creates a gutter for
          // the drag-handle + trash buttons so they sit INSIDE the editor
          // card, not in the page margin. Mobile keeps normal padding
          // because the drag handle is hidden there (no hover target).
          class:
            'cedar-editor max-w-none min-h-[400px] focus:outline-none px-4 py-6 md:pl-14 md:pr-8 md:py-8 text-[15px] leading-relaxed text-slate-800',
        },
      },
      onUpdate: ({ editor }) => {
        if (onChange) onChange(editor.getJSON());
        if (!editable || !onAutoSaveRef.current) return;
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        setSaveStatus('idle');
        debounceTimer.current = setTimeout(() => {
          void triggerAutoSave(editor);
        }, AUTOSAVE_DEBOUNCE_MS);
      },
    },
    [extensions.length, editable, assets?.logoUrl, assets?.signatureUrl],
  );

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  // On unmount, flush any pending auto-save attempt so we don't lose work.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        if (editor && editor.isEditable && onAutoSaveRef.current) {
          void triggerAutoSave(editor);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const wordCount = editor?.storage.characterCount?.words?.() ?? 0;
  const charCount = editor?.storage.characterCount?.characters?.() ?? 0;

  return (
    <div
      className={
        'rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 ' +
        (className ?? '')
      }
    >
      {editable && editor && <EditorToolbar editor={editor} aiContext={aiContext} />}
      {editable && editor && <EditorBubbleMenu editor={editor} />}
      {editable && editor && <EditorFloatingMenu editor={editor} />}
      {editable && editor && <EditorDragHandle editor={editor} />}
      <style>{`
        .cedar-editor h1.cedar-heading { font-size: 1.5rem; line-height: 2rem; }
        .cedar-editor h2.cedar-heading { font-size: 1.25rem; line-height: 1.75rem; }
        .cedar-editor h3.cedar-heading { font-size: 1.0625rem; line-height: 1.5rem; }
        .cedar-editor a { color: rgb(79, 70, 229); text-decoration: underline; }
        .cedar-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: rgb(148, 163, 184);
          float: left;
          height: 0;
          pointer-events: none;
        }
      `}</style>
      <EditorContent editor={editor} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <SaveStatusBadge status={saveStatus} error={saveError} lastSavedAt={lastSavedAt} />
        <div className="tabular-nums">
          {wordCount.toLocaleString()} words · {charCount.toLocaleString()} chars
        </div>
      </div>
    </div>
  );
}

function SaveStatusBadge({
  status,
  error,
  lastSavedAt,
}: {
  status: SaveStatus;
  error: string | null;
  lastSavedAt: Date | null;
}) {
  if (status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        Saving…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Saved {lastSavedAt ? formatRelative(lastSavedAt) : ''}
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 font-medium text-rose-600" title={error ?? ''}>
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        Save failed · retry will fire on next edit
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-slate-400">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
      Auto-save active · 30s after last edit
    </span>
  );
}

function formatRelative(d: Date): string {
  const diffMs = Date.now() - d.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  return d.toLocaleTimeString();
}

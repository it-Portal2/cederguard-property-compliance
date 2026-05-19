import { useRef, useState, type ReactNode, type DragEvent } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface AssetDropZoneProps {
  /** MIME types accepted (mirrors the server-side allow-list). */
  accept: string[];
  /** Called once a single valid file is dropped or picked. */
  onFile: (file: File) => void | Promise<void>;
  /** Set true while the parent is processing the upload. */
  busy?: boolean;
  /** Headline copy shown above the icon. */
  title: string;
  /** Smaller help text shown below the icon. */
  helper?: string;
  /** Slot for a current-asset preview rendered above the drop zone. */
  children?: ReactNode;
  /** Optional className for the outer wrapper. */
  className?: string;
}

// Reusable drop zone for governance branding assets. Handles drag-over
// styling, click-to-browse, basic validation messaging, and a busy state.
// Surrounding component owns the file → base64 → API plumbing.
export function AssetDropZone({
  accept,
  onFile,
  busy = false,
  title,
  helper,
  children,
  className,
}: AssetDropZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handlePick = (file: File | null | undefined) => {
    if (!file || busy) return;
    void onFile(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handlePick(e.dataTransfer.files?.[0]);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!busy) setDragOver(true);
  };

  return (
    <div className={clsx('space-y-3', className)}>
      {children}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragOver(false)}
        className={clsx(
          'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-8 text-center transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40',
          busy
            ? 'cursor-wait border-slate-200 bg-slate-50 text-slate-400'
            : dragOver
            ? 'border-indigo-400 bg-indigo-50/60 text-indigo-700'
            : 'border-slate-200 bg-slate-50/60 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 cursor-pointer',
        )}
      >
        {busy ? (
          <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2.25} />
        ) : (
          <UploadCloud className="h-6 w-6" strokeWidth={2.25} />
        )}
        <p className="text-sm font-semibold">{title}</p>
        {helper && <p className="text-[11px] text-slate-400">{helper}</p>}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={accept.join(',')}
          onChange={(e) => handlePick(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

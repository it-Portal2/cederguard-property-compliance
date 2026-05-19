import { useMemo, useState } from 'react';
import { Plus, Trash2, Scale, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import DynamicTable from '../../table/DynamicTable';
import type { ColumnDef, RowAction } from '../../table/types';
import type { FrameworkThreshold } from './types';
import { ThresholdBandModal } from './ThresholdBandModal';

interface AuthorityThresholdsEditorProps {
  thresholds: FrameworkThreshold[];
  editMode: boolean;
  onChange: (next: FrameworkThreshold[]) => void;
}

// Format a threshold band from min/max. Nulls = open-ended ("Over £X" or
// "Any value"). Keeps the HRB-style row readable alongside numeric bands.
function formatBand(t: FrameworkThreshold): string {
  if (t.bandMin == null && t.bandMax == null) return 'Any value';
  if (t.bandMin == null) return `Up to £${(t.bandMax as number).toLocaleString()}`;
  if (t.bandMax == null) return `Over £${t.bandMin.toLocaleString()}`;
  return `£${t.bandMin.toLocaleString()} – £${t.bandMax.toLocaleString()}`;
}

export function AuthorityThresholdsEditor({
  thresholds,
  editMode,
  onChange,
}: AuthorityThresholdsEditorProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FrameworkThreshold | null>(null);

  const sorted = useMemo(() => {
    // Keep HRB-style "any value" rows last; otherwise sort by lower bound.
    return [...thresholds].sort((a, b) => {
      const aOpen = a.bandMin == null && a.bandMax == null ? 1 : 0;
      const bOpen = b.bandMin == null && b.bandMax == null ? 1 : 0;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return (a.bandMin ?? 0) - (b.bandMin ?? 0);
    });
  }, [thresholds]);

  const handleOpenAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (row: FrameworkThreshold) => {
    setEditing(row);
    setModalOpen(true);
  };

  const handleSaved = (row: FrameworkThreshold) => {
    const idx = thresholds.findIndex((t) => t.id === row.id);
    if (idx >= 0) {
      const next = [...thresholds];
      next[idx] = { ...next[idx], ...row };
      onChange(next);
    } else {
      onChange([...thresholds, row]);
    }
  };

  const handleDelete = async (row: FrameworkThreshold) => {
    try {
      await api.governanceDeleteThreshold(row.id);
      onChange(thresholds.filter((t) => t.id !== row.id));
      toast.success('Band removed');
    } catch (e: any) {
      console.error('[AuthorityThresholdsEditor] delete failed', e);
      toast.error(e?.message ?? 'Delete failed.');
    }
  };

  const columns: ColumnDef<FrameworkThreshold>[] = [
    {
      key: 'bandLabel',
      label: 'Band',
      sortable: true,
      render: (_v, row) => (
        <span className="text-sm font-semibold text-slate-900">{row.bandLabel}</span>
      ),
      exportValue: (_v, row) => row.bandLabel ?? '',
    },
    {
      key: 'range',
      label: 'Range',
      render: (_v, row) => <span className="text-xs text-slate-600">{formatBand(row)}</span>,
      exportValue: (_v, row) => formatBand(row),
    },
    {
      key: 'decisionRoute',
      label: 'Decision route',
      render: (_v, row) => <span className="text-sm text-slate-800">{row.decisionRoute}</span>,
      exportValue: (_v, row) => row.decisionRoute ?? '',
    },
    {
      key: 'reportTypes',
      label: 'Report types',
      render: (_v, row) => {
        const list = row.reportTypes ?? [];
        if (list.length === 0) return <span className="text-xs text-slate-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {list.map((rt) => (
              <span
                key={rt}
                className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
              >
                {rt}
              </span>
            ))}
          </div>
        );
      },
      exportValue: (_v, row) => (row.reportTypes ?? []).join(', '),
    },
    {
      key: 'notes',
      label: 'Notes',
      width: '260px',
      className: 'whitespace-normal align-top',
      render: (_v, row) =>
        row.notes ? (
          <p
            className="max-w-60 text-xs leading-snug text-slate-500 whitespace-normal wrap-break-word"
            title={row.notes}
          >
            {row.notes}
          </p>
        ) : (
          <span className="text-xs text-slate-300">—</span>
        ),
      exportValue: (_v, row) => row.notes ?? '',
    },
  ];

  const rowActions: RowAction<FrameworkThreshold>[] = editMode
    ? [
        {
          key: 'edit',
          label: 'Edit band',
          icon: Pencil,
          onClick: handleOpenEdit,
        },
        {
          key: 'delete',
          label: 'Remove band',
          icon: Trash2,
          isDanger: true,
          onClick: handleDelete,
          requireConfirm: {
            title: (row) => `Remove ${(row as FrameworkThreshold).bandLabel}?`,
            message:
              'This removes the authority band from the framework. Any projects routed through this band will fall back to the next best match.',
            confirmLabel: 'Remove band',
            variant: 'danger',
            isDanger: true,
          },
        },
      ]
    : [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Scale className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Authority thresholds</h3>
            <p className="text-[11px] text-slate-500">
              Decision route by project value. Drives template auto-pick + key-decision flagging.
            </p>
          </div>
        </div>
      </header>

      <div className="p-2">
        <DynamicTable<FrameworkThreshold>
          data={sorted}
          columns={columns}
          rowActions={rowActions}
          getRowId={(r) => r.id}
          headerVariant="light"
          searchable
          searchPlaceholder="Search bands…"
          searchFields={['bandLabel', 'decisionRoute', 'notes'] as (keyof FrameworkThreshold)[]}
          emptyState={{
            icon: Scale,
            title: 'No authority bands yet',
            description: editMode
              ? 'Add the first band using the button above.'
              : 'Enable edit mode to add a band.',
          }}
          toolbarActions={
            editMode ? (
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add band
              </button>
            ) : null
          }
        />
      </div>

      <ThresholdBandModal
        isOpen={modalOpen}
        editing={editing}
        existingIds={thresholds.map((t) => t.id)}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
      />
    </section>
  );
}

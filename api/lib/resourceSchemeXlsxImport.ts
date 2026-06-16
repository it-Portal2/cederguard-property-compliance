// Resource Planner — scheme spreadsheet importer.
//
// Mirrors the governance forward-plan importer: auto-detects the header row,
// maps columns to scheme fields by fuzzy match, parses Excel serial dates to
// ISO, and surfaces flags so the user can review a dry-run preview before
// committing. Never writes on its own — the commit route does that.

import * as XLSX from 'xlsx';

export type ImportFlagSeverity = 'error' | 'warning';

export interface ImportFlag {
  severity: ImportFlagSeverity;
  field: string;
  message: string;
}

/** Plain scheme shape produced by the importer (matches the web ResourceScheme fields). */
export interface ParsedScheme {
  id: string;
  name: string;
  status?: string;
  programme?: string;
  batch?: string;
  deliveryRoute?: string;
  complexityRaw?: string;
  councilHomes?: number;
  intermediateHomes?: number;
  privateHomes?: number;
  allHomes?: number;
  demolitionStart?: string | null;
  sosDate?: string | null;
  handoverDate?: string | null;
  eodDate?: string | null;
  planningSubmitted?: string | null;
  planningAchieved?: string | null;
  projectCode?: string;
  strategicLead?: string;
  seniorPM?: string;
  projectManager?: string;
  assistantPM?: string;
  defectsPM?: string;
}

export interface ParsedSchemeRow {
  sheetRow: number;
  item: ParsedScheme;
  flags: ImportFlag[];
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  headerRowIndex: number;
  unmappedColumns: string[];
}

export interface ParseResult {
  rows: ParsedSchemeRow[];
  summary: ImportSummary;
}

type StringField =
  | 'name'
  | 'status'
  | 'programme'
  | 'batch'
  | 'deliveryRoute'
  | 'complexityRaw'
  | 'projectCode'
  | 'strategicLead'
  | 'seniorPM'
  | 'projectManager'
  | 'assistantPM'
  | 'defectsPM';
type NumberField = 'councilHomes' | 'intermediateHomes' | 'privateHomes' | 'allHomes';
type DateField =
  | 'demolitionStart'
  | 'sosDate'
  | 'handoverDate'
  | 'eodDate'
  | 'planningSubmitted'
  | 'planningAchieved';
type Field = StringField | NumberField | DateField;

const STRING_FIELDS = new Set<Field>([
  'name', 'status', 'programme', 'batch', 'deliveryRoute', 'complexityRaw',
  'projectCode', 'strategicLead', 'seniorPM', 'projectManager', 'assistantPM', 'defectsPM',
]);
const NUMBER_FIELDS = new Set<Field>([
  'councilHomes', 'intermediateHomes', 'privateHomes', 'allHomes',
]);
const DATE_FIELDS = new Set<Field>([
  'demolitionStart', 'sosDate', 'handoverDate', 'eodDate', 'planningSubmitted', 'planningAchieved',
]);

// Fuzzy header → scheme field. Matching is case-insensitive, whitespace-tolerant.
const FIELD_ALIASES: Record<string, Field> = {
  'scheme name': 'name',
  scheme: 'name',
  name: 'name',
  'current stage': 'status',
  status: 'status',
  programme: 'programme',
  batch: 'batch',
  'delivery route': 'deliveryRoute',
  'council homes': 'councilHomes',
  'intermediate homes': 'intermediateHomes',
  'private homes': 'privateHomes',
  'all homes': 'allHomes',
  'demolition start day': 'demolitionStart',
  'demolition start': 'demolitionStart',
  'sos date': 'sosDate',
  sos: 'sosDate',
  'start on site': 'sosDate',
  'handover date': 'handoverDate',
  handover: 'handoverDate',
  'eod date': 'eodDate',
  eod: 'eodDate',
  'end of defects': 'eodDate',
  complexity: 'complexityRaw',
  'planning submitted date': 'planningSubmitted',
  'planning submitted': 'planningSubmitted',
  'planning achieved date': 'planningAchieved',
  'planning achieved': 'planningAchieved',
  'sc project code': 'projectCode',
  'project code': 'projectCode',
  'strategic lead': 'strategicLead',
  'senior project manager': 'seniorPM',
  'project manager': 'projectManager',
  'assistant project manager/ supporting project manager': 'assistantPM',
  'assistant project manager': 'assistantPM',
  'defects project manager': 'defectsPM',
};

function normaliseHeader(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function slugifyId(text: string, fallback: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  const suffix = Math.floor(Math.random() * 36 ** 5).toString(36);
  return `rp-${base.length > 0 ? base : fallback}-${suffix}`;
}

// Excel serial → ISO date (handles the 1900 leap-year artefact via the 25569 epoch offset).
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseCellDate(cell: unknown): string | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') return excelSerialToIso(cell);
  if (cell instanceof Date) return Number.isNaN(cell.getTime()) ? null : cell.toISOString().slice(0, 10);
  if (typeof cell === 'string') {
    const t = cell.trim();
    if (!t) return null;
    const iso = Date.parse(t);
    if (!Number.isNaN(iso)) return new Date(iso).toISOString().slice(0, 10);
    const m = t.match(/^(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      const dt = new Date(year, Number(mo) - 1, Number(d));
      if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }
    return null;
  }
  return null;
}

function parseCellNumber(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell === 'string') {
    const cleaned = cell.replace(/[,\s]/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseCellString(cell: unknown): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell.trim();
  if (typeof cell === 'number' || typeof cell === 'boolean') return String(cell);
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return '';
}

// Scan the first 12 rows for the header (the one carrying "scheme name").
function detectHeaderRow(grid: unknown[][]): number {
  for (let i = 0; i < Math.min(grid.length, 12); i += 1) {
    const tokens = (grid[i] ?? []).map((c) => normaliseHeader(c));
    if (tokens.some((t) => t === 'scheme name' || t === 'scheme' || t === 'name')) return i;
  }
  return -1;
}

function buildColumnMap(headerRow: unknown[]): {
  fieldColumns: Map<number, Field>;
  unmapped: string[];
} {
  const fieldColumns = new Map<number, Field>();
  const unmapped: string[] = [];
  for (let idx = 0; idx < headerRow.length; idx += 1) {
    const norm = normaliseHeader(headerRow[idx]);
    if (!norm) continue;
    const field = FIELD_ALIASES[norm];
    if (field) fieldColumns.set(idx, field);
    else unmapped.push(parseCellString(headerRow[idx]));
  }
  return { fieldColumns, unmapped };
}

function parseRow(
  row: unknown[],
  sheetRow: number,
  fieldColumns: Map<number, Field>,
  takenIds: Set<string>,
): ParsedSchemeRow | null {
  const nonEmpty = row.filter((c) => c !== null && c !== undefined && c !== '').length;
  if (nonEmpty === 0) return null;

  const item: ParsedScheme = { id: '', name: '' };
  const flags: ImportFlag[] = [];

  for (const [colIdx, field] of fieldColumns) {
    const cell = row[colIdx];
    if (STRING_FIELDS.has(field)) {
      (item as any)[field] = parseCellString(cell);
    } else if (NUMBER_FIELDS.has(field)) {
      const n = parseCellNumber(cell);
      if (n !== null) (item as any)[field] = n;
    } else if (DATE_FIELDS.has(field)) {
      const d = parseCellDate(cell);
      if (d) (item as any)[field] = d;
      else if (cell !== null && cell !== undefined && cell !== '') {
        flags.push({
          severity: 'warning',
          field,
          message: `Couldn't parse "${parseCellString(cell)}" as a date — left blank.`,
        });
      }
    }
  }

  if (!item.name) {
    flags.push({ severity: 'error', field: 'name', message: 'Scheme name is required.' });
  }
  if (!item.complexityRaw) {
    flags.push({
      severity: 'warning',
      field: 'complexityRaw',
      message: 'Complexity is blank — this scheme will contribute 0 FTE until set.',
    });
  }

  if (item.name) {
    let id = slugifyId(item.name, `row${sheetRow}`);
    while (takenIds.has(id)) id = slugifyId(item.name, `row${sheetRow}`);
    takenIds.add(id);
    item.id = id;
  }

  return { sheetRow, item, flags };
}

/** Parse an uploaded workbook (first visible sheet) into scheme rows + a summary. */
export function parseResourceSchemeXlsx(buffer: ArrayBuffer | Buffer): ParseResult {
  const empty: ImportSummary = {
    totalRows: 0, validRows: 0, errorRows: 0, warningRows: 0, headerRowIndex: -1, unmappedColumns: [],
  };
  const wb = XLSX.read(buffer as any, { type: 'buffer', cellDates: false });
  const firstVisible =
    wb.SheetNames.find((n) => {
      const info = (wb.Workbook?.Sheets ?? []).find((s: any) => s.name === n);
      return !info || info.Hidden === 0 || info.Hidden === undefined;
    }) ?? wb.SheetNames[0];
  const sheet = firstVisible ? wb.Sheets[firstVisible] : undefined;
  if (!sheet) return { rows: [], summary: empty };

  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });
  const headerRowIndex = detectHeaderRow(grid);
  if (headerRowIndex === -1) return { rows: [], summary: empty };

  const { fieldColumns, unmapped } = buildColumnMap(grid[headerRowIndex] ?? []);
  const rows: ParsedSchemeRow[] = [];
  const takenIds = new Set<string>();
  for (let i = headerRowIndex + 1; i < grid.length; i += 1) {
    const parsed = parseRow(grid[i] ?? [], i + 1, fieldColumns, takenIds);
    if (parsed) rows.push(parsed);
  }

  let errorRows = 0;
  let warningRows = 0;
  for (const r of rows) {
    if (r.flags.some((f) => f.severity === 'error')) errorRows += 1;
    else if (r.flags.some((f) => f.severity === 'warning')) warningRows += 1;
  }

  return {
    rows,
    summary: {
      totalRows: rows.length,
      validRows: rows.length - errorRows,
      errorRows,
      warningRows,
      headerRowIndex,
      unmappedColumns: unmapped,
    },
  };
}

// Forward Plan Excel import — parses a Southwark-style .xlsx sheet into
// structured ForwardPlanItem rows with per-row validation flags.
//
// The importer is deliberately forgiving: it tries to auto-detect the
// header row, maps columns by short fuzzy match, and surfaces flags so
// the user can review the dry-run preview before committing. Never
// commits on its own — the route `governanceImportForwardPlanCommit`
// does the actual writes after the user confirms.

import * as XLSX from 'xlsx';

// ───── Public types ──────────────────────────────────────────────────────

export type ImportFlagSeverity = 'error' | 'warning';

export interface ImportFlag {
  severity: ImportFlagSeverity;
  field: string;
  message: string;
}

// A parsed row — `item` holds the fields destined for the Firestore write.
// `flags.errors.length === 0` rows are commitable; rows with errors are
// shown in the preview but skipped on commit.
export interface ParsedRow {
  sheetRow: number;               // 1-based Excel row (for UI errors)
  item: ParsedItem;
  flags: ImportFlag[];
}

export interface ParsedItem {
  id: string;                     // generated from the title slug
  title: string;
  scheme: string;
  reportType: string;
  typeOfEntry: 'New' | 'Change' | 'Delete';
  classification: 'Open' | 'Closed' | 'Part 1 and 2';
  isHRB: boolean;
  wards: string[];
  value: number;
  targetDecisionDate: string;     // ISO yyyy-MM-dd
  decisionRoute: string;
  routingMode: 'sequential' | 'parallel';
  // boardGates keyed by the body's Firestore composite id (`body._id`) —
  // the same shape the modal writes, so the downstream code path stays
  // untouched.
  boardGates: Record<string, { targetDate: string; status: 'scheduled' }>;
  strategicLead: string;
  reportAuthor: string;
  representingOfficer: string;
  decisionMaker: string;
  otherMeetings: string;
  comments: string;
  fileLink: string;
  decisionLink: string;
  status: 'Draft' | 'Published';
}

export interface ImportSummary {
  totalRows: number;
  validRows: number;              // commitable
  errorRows: number;
  warningRows: number;
  unknownBodyColumns: string[];   // body columns we couldn't resolve to framework bodies
  headerRowIndex: number;         // 0-based; for debug
}

export interface FrameworkBodyLite {
  _id: string;
  id?: string;
  name?: string;
  tier?: string;
}

// ───── Canonical field map ───────────────────────────────────────────────

// Maps fuzzy header text → canonical field name on ParsedItem. Matching is
// case-insensitive and whitespace-tolerant. Anything not in the map falls
// through to the body-column resolver (which tries to match against the
// framework body short-codes).
const FIELD_ALIASES: Record<string, keyof ParsedItem> = {
  scheme: 'scheme',
  'report type': 'reportType',
  type: 'reportType',
  'type of entry': 'typeOfEntry',
  'entry type': 'typeOfEntry',
  classification: 'classification',
  'report title': 'title',
  title: 'title',
  'est report value': 'value',
  value: 'value',
  'est value': 'value',
  'strategic lead': 'strategicLead',
  'report author': 'reportAuthor',
  'representing officer': 'representingOfficer',
  'decision maker': 'decisionMaker',
  'other meetings': 'otherMeetings',
  comments: 'comments',
  comment: 'comments',
  'link to the file': 'fileLink',
  'link to file': 'fileLink',
  'file link': 'fileLink',
  'link to decision': 'decisionLink',
  'decision link': 'decisionLink',
  'target decision date': 'targetDecisionDate',
  'decision date': 'targetDecisionDate',
  wards: 'wards',
  ward: 'wards',
  hrb: 'isHRB',
  'high-rise': 'isHRB',
  'decision route': 'decisionRoute',
  'routing mode': 'routingMode',
};

// Header tokens that should be recognised as body-date columns even if
// they don't exactly match a framework body short-code. We'll still try to
// resolve each one; if we can't, it becomes an unknown-body flag.
const BODY_COLUMN_MARKERS = [
  ' date',
  ' approval',
  ' sign off',
  ' sign-off',
];

function normaliseHeader(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
}

function shortenBodyName(fullName: string | undefined): string {
  if (!fullName) return '';
  const idx = fullName.indexOf(' · ');
  return (idx > 0 ? fullName.slice(0, idx) : fullName).trim().toLowerCase();
}

function slugifyId(text: string, fallback: string): string {
  const base = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const suffix = Math.floor(Math.random() * 36 ** 4).toString(36);
  return base.length > 0 ? `${base}-${suffix}` : `${fallback}-${suffix}`;
}

// Excel serial dates: integer days since 1899-12-30 (Excel's buggy
// 1900-leap-year epoch). Anything ≥ 60 is offset by 1 to compensate.
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function parseCellDate(cell: unknown): string | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') return excelSerialToIso(cell);
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return null;
    return cell.toISOString().slice(0, 10);
  }
  if (typeof cell === 'string') {
    const trimmed = cell.trim();
    if (!trimmed) return null;
    // Try ISO first.
    const iso = Date.parse(trimmed);
    if (!Number.isNaN(iso)) return new Date(iso).toISOString().slice(0, 10);
    // Try DD/MM/YYYY (UK convention).
    const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      const iso2 = new Date(year, Number(mo) - 1, Number(d));
      if (!Number.isNaN(iso2.getTime())) {
        return iso2.toISOString().slice(0, 10);
      }
    }
    return null;
  }
  return null;
}

function parseCellNumber(cell: unknown): number | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  if (typeof cell === 'string') {
    const cleaned = cell.replace(/[£$,\s]/g, '');
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

function parseWards(cell: unknown): string[] {
  const s = parseCellString(cell);
  if (!s) return [];
  return s
    .split(/[,;|\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseClassification(cell: unknown): ParsedItem['classification'] {
  const s = parseCellString(cell).toLowerCase();
  if (s.includes('closed')) return 'Closed';
  if (s.includes('part 1 and 2') || s.includes('part 1&2') || s.includes('both'))
    return 'Part 1 and 2';
  return 'Open';
}

function parseEntryType(cell: unknown): ParsedItem['typeOfEntry'] {
  const s = parseCellString(cell).toLowerCase();
  if (s.startsWith('change') || s.startsWith('amend')) return 'Change';
  if (s.startsWith('delete') || s.startsWith('remove')) return 'Delete';
  return 'New';
}

function parseBool(cell: unknown): boolean {
  const s = parseCellString(cell).toLowerCase();
  return (
    s === 'y' ||
    s === 'yes' ||
    s === 'true' ||
    s === '1' ||
    s === 'hrb' ||
    s === 'high-rise' ||
    s === 'high rise'
  );
}

// ───── Header-row auto-detect ───────────────────────────────────────────

// Real Southwark sheets put metadata in rows 1-3 and the column header
// row at row 4. We scan the first 10 rows looking for a row that contains
// BOTH "scheme" AND a title-like header. Return the 0-based index.
function detectHeaderRow(grid: unknown[][]): number {
  for (let i = 0; i < Math.min(grid.length, 10); i += 1) {
    const row = grid[i] ?? [];
    const tokens = row.map((c) => normaliseHeader(c));
    const hasScheme = tokens.some((t) => t === 'scheme');
    const hasTitle = tokens.some(
      (t) => t === 'report title' || t === 'title',
    );
    if (hasScheme && hasTitle) return i;
  }
  return -1;
}

// ───── Column mapping ────────────────────────────────────────────────────

interface ColumnMap {
  // Map column index (0-based) → canonical field name
  fieldColumns: Map<number, keyof ParsedItem>;
  // Map column index → resolved framework body _id (for boardGates)
  bodyColumns: Map<number, { bodyId: string; shortName: string; rawHeader: string }>;
  // Column indices whose header matched a body-like pattern but couldn't
  // be resolved to a framework body.
  unknownBodyColumns: { index: number; rawHeader: string }[];
}

function buildColumnMap(
  headerRow: unknown[],
  bodies: FrameworkBodyLite[],
): ColumnMap {
  const fieldColumns = new Map<number, keyof ParsedItem>();
  const bodyColumns = new Map<
    number,
    { bodyId: string; shortName: string; rawHeader: string }
  >();
  const unknownBodyColumns: { index: number; rawHeader: string }[] = [];

  // Index framework bodies by short-code (lowercased) for quick lookup.
  const bodyByShort = new Map<string, FrameworkBodyLite>();
  for (const b of bodies) {
    const short = shortenBodyName(b.name);
    if (short) bodyByShort.set(short, b);
    // Also index full name (lowercased) for exact-name match.
    const full = (b.name ?? '').trim().toLowerCase();
    if (full) bodyByShort.set(full, b);
  }

  for (let idx = 0; idx < headerRow.length; idx += 1) {
    const raw = headerRow[idx];
    const norm = normaliseHeader(raw);
    if (!norm) continue;

    // First: canonical field match.
    if (norm in FIELD_ALIASES) {
      fieldColumns.set(idx, FIELD_ALIASES[norm]);
      continue;
    }

    // Second: body-column resolution. Strip trailing " date" / " approval"
    // / " sign off" to extract the body short code, then look it up.
    const looksLikeBodyCol = BODY_COLUMN_MARKERS.some((marker) =>
      norm.includes(marker),
    );
    if (!looksLikeBodyCol) continue;

    let bodyToken = norm;
    for (const marker of BODY_COLUMN_MARKERS) {
      if (bodyToken.endsWith(marker)) {
        bodyToken = bodyToken.slice(0, -marker.length).trim();
        break;
      }
    }
    // Drop the word "of" / "to" noise e.g. "date of cmt" → "cmt".
    bodyToken = bodyToken.replace(/^(date of|date|dated?)\s*/, '').trim();

    const match = bodyByShort.get(bodyToken);
    if (match) {
      bodyColumns.set(idx, {
        bodyId: match._id,
        shortName: shortenBodyName(match.name),
        rawHeader: parseCellString(raw),
      });
    } else if (bodyToken) {
      unknownBodyColumns.push({ index: idx, rawHeader: parseCellString(raw) });
    }
  }

  return { fieldColumns, bodyColumns, unknownBodyColumns };
}

// ───── Row parser ────────────────────────────────────────────────────────

function parseRow(
  row: unknown[],
  sheetRow: number,
  colMap: ColumnMap,
  takenIds: Set<string>,
): ParsedRow | null {
  const flags: ImportFlag[] = [];

  // Early-skip blank / section-separator rows.
  const nonEmptyCount = row.filter((c) => c !== null && c !== undefined && c !== '').length;
  if (nonEmptyCount === 0) return null;

  const item: ParsedItem = {
    id: '',
    title: '',
    scheme: '',
    reportType: '',
    typeOfEntry: 'New',
    classification: 'Open',
    isHRB: false,
    wards: [],
    value: 0,
    targetDecisionDate: '',
    decisionRoute: '',
    routingMode: 'sequential',
    boardGates: {},
    strategicLead: '',
    reportAuthor: '',
    representingOfficer: '',
    decisionMaker: '',
    otherMeetings: '',
    comments: '',
    fileLink: '',
    decisionLink: '',
    status: 'Draft',
  };

  // Apply field columns.
  for (const [colIdx, field] of colMap.fieldColumns) {
    const cell = row[colIdx];
    switch (field) {
      case 'title':
      case 'scheme':
      case 'reportType':
      case 'decisionRoute':
      case 'strategicLead':
      case 'reportAuthor':
      case 'representingOfficer':
      case 'decisionMaker':
      case 'otherMeetings':
      case 'comments':
      case 'fileLink':
      case 'decisionLink':
        item[field] = parseCellString(cell);
        break;
      case 'wards':
        item.wards = parseWards(cell);
        break;
      case 'value': {
        const n = parseCellNumber(cell);
        if (n !== null) item.value = n;
        break;
      }
      case 'isHRB':
        item.isHRB = parseBool(cell);
        break;
      case 'classification':
        item.classification = parseClassification(cell);
        break;
      case 'typeOfEntry':
        item.typeOfEntry = parseEntryType(cell);
        break;
      case 'routingMode': {
        const s = parseCellString(cell).toLowerCase();
        item.routingMode = s === 'parallel' ? 'parallel' : 'sequential';
        break;
      }
      case 'targetDecisionDate': {
        const d = parseCellDate(cell);
        if (d) item.targetDecisionDate = d;
        else if (cell) {
          flags.push({
            severity: 'warning',
            field: 'targetDecisionDate',
            message: `Couldn't parse decision date "${parseCellString(cell)}".`,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  // Apply body columns → boardGates.
  for (const [colIdx, body] of colMap.bodyColumns) {
    const cell = row[colIdx];
    if (cell === null || cell === undefined || cell === '') continue;
    const iso = parseCellDate(cell);
    if (iso) {
      item.boardGates[body.bodyId] = { targetDate: iso, status: 'scheduled' };
    } else {
      flags.push({
        severity: 'warning',
        field: body.shortName,
        message: `${body.shortName} date "${parseCellString(cell)}" unparseable; skipped.`,
      });
    }
  }

  // Required-field validation.
  if (!item.title) {
    flags.push({
      severity: 'error',
      field: 'title',
      message: 'Title is required.',
    });
  }
  if (!item.scheme) {
    flags.push({
      severity: 'warning',
      field: 'scheme',
      message: 'Scheme is blank.',
    });
  }

  // Derive an ID from the title (stable-ish within this import). Collisions
  // are guarded by a taken-set so the same-title rows get unique suffixes.
  if (item.title) {
    let id = slugifyId(item.title, `row${sheetRow}`);
    while (takenIds.has(id)) id = slugifyId(item.title, `row${sheetRow}`);
    takenIds.add(id);
    item.id = id;
  }

  return { sheetRow, item, flags };
}

// ───── Top-level entry ───────────────────────────────────────────────────

export interface ParseResult {
  rows: ParsedRow[];
  summary: ImportSummary;
}

export function parseForwardPlanXlsx(
  buffer: ArrayBuffer | Buffer,
  bodies: FrameworkBodyLite[],
): ParseResult {
  const wb = XLSX.read(buffer as any, { type: 'buffer', cellDates: false });
  // Prefer the first visible sheet (Southwark template has hidden workings).
  const firstVisibleName =
    wb.SheetNames.find((n) => {
      const info = (wb.Workbook?.Sheets ?? []).find((s: any) => s.name === n);
      return !info || info.Hidden === 0 || info.Hidden === undefined;
    }) ?? wb.SheetNames[0];
  const sheet = wb.Sheets[firstVisibleName];
  if (!sheet) {
    return {
      rows: [],
      summary: {
        totalRows: 0,
        validRows: 0,
        errorRows: 0,
        warningRows: 0,
        unknownBodyColumns: [],
        headerRowIndex: -1,
      },
    };
  }
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  const headerRowIndex = detectHeaderRow(grid);
  if (headerRowIndex === -1) {
    return {
      rows: [],
      summary: {
        totalRows: 0,
        validRows: 0,
        errorRows: 0,
        warningRows: 0,
        unknownBodyColumns: [],
        headerRowIndex: -1,
      },
    };
  }
  const headerRow = grid[headerRowIndex] ?? [];
  const colMap = buildColumnMap(headerRow, bodies);

  const rows: ParsedRow[] = [];
  const takenIds = new Set<string>();
  for (let i = headerRowIndex + 1; i < grid.length; i += 1) {
    const parsed = parseRow(grid[i] ?? [], i + 1, colMap, takenIds);
    if (parsed) rows.push(parsed);
  }

  let errorRows = 0;
  let warningRows = 0;
  for (const r of rows) {
    const hasErr = r.flags.some((f) => f.severity === 'error');
    const hasWarn = r.flags.some((f) => f.severity === 'warning');
    if (hasErr) errorRows += 1;
    else if (hasWarn) warningRows += 1;
  }

  return {
    rows,
    summary: {
      totalRows: rows.length,
      validRows: rows.length - errorRows,
      errorRows,
      warningRows,
      unknownBodyColumns: colMap.unknownBodyColumns.map((c) => c.rawHeader),
      headerRowIndex,
    },
  };
}

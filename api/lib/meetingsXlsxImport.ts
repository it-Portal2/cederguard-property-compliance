// Phase 5.5a — Meetings Excel import.
//
// Mirrors the Phase 5c FP import shape but with a simpler clean
// canonical column set (Q6 = a). PgM downloads a template, fills it,
// uploads. Server re-parses on commit (lesson #55) — never trusts
// client-held parsed rows.
//
// Canonical columns:
//   • Body            — matches `governanceBody.name` (fuzzy, case-insensitive)
//   • Date            — Excel serial / ISO / DD/MM/YYYY
//   • Time Start      — HH:mm 24-hour
//   • Time End        — HH:mm 24-hour
//   • Location        — free text
//   • Chair           — free text
//   • Attendees       — optional, semicolon-separated list of "Name · Role"

import * as XLSX from 'xlsx';

// ───── Public types ─────────────────────────────────────────────────────

export type MeetingImportFlagSeverity = 'error' | 'warning';

export interface MeetingImportFlag {
  severity: MeetingImportFlagSeverity;
  field: string;
  message: string;
}

export interface ParsedMeetingRow {
  sheetRow: number;                 // 1-based Excel row
  meeting: ParsedMeeting;
  flags: MeetingImportFlag[];
}

export interface ParsedMeeting {
  id: string;                       // generated from body + date slug
  governanceBodyId: string | null;  // resolved from Body column; null if unresolved
  governanceBodyLabel: string;      // either matched body name OR raw header text
  date: string;                     // ISO yyyy-MM-dd
  timeStart: string;                // HH:mm
  timeEnd: string;                  // HH:mm
  location: string;
  chairLabel: string;
  attendees: Array<{ uid: null; label: string }>;
}

export interface MeetingImportSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  unknownBodies: string[];          // body labels we couldn't match to framework
  headerRowIndex: number;           // 0-based; for debug
}

export interface FrameworkBodyLite {
  _id: string;
  id?: string;
  name?: string;
}

// ───── Canonical column map ─────────────────────────────────────────────

type FieldName =
  | 'body'
  | 'date'
  | 'timeStart'
  | 'timeEnd'
  | 'location'
  | 'chair'
  | 'attendees';

const FIELD_ALIASES: Record<string, FieldName> = {
  body: 'body',
  'governance body': 'body',
  board: 'body',
  date: 'date',
  'meeting date': 'date',
  'time start': 'timeStart',
  start: 'timeStart',
  'start time': 'timeStart',
  from: 'timeStart',
  'time end': 'timeEnd',
  end: 'timeEnd',
  'end time': 'timeEnd',
  to: 'timeEnd',
  location: 'location',
  venue: 'location',
  room: 'location',
  chair: 'chair',
  chairperson: 'chair',
  attendees: 'attendees',
  members: 'attendees',
};

// ───── Tiny helpers (intentionally duplicated from forwardPlanXlsxImport
// to keep the modules independent — they will diverge over time as
// each format gets council-specific tweaks) ───────────────────────────

function normaliseHeader(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase().replace(/\s+/g, ' ');
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
    const iso = Date.parse(trimmed);
    if (!Number.isNaN(iso)) return new Date(iso).toISOString().slice(0, 10);
    const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const [, d, mo, y] = m;
      const year = y.length === 2 ? 2000 + Number(y) : Number(y);
      const out = new Date(year, Number(mo) - 1, Number(d));
      if (!Number.isNaN(out.getTime())) {
        return out.toISOString().slice(0, 10);
      }
    }
    return null;
  }
  return null;
}

// Excel time fractions: 0.0 = midnight, 0.5 = noon. Returns HH:mm.
function excelFractionToTime(frac: number): string | null {
  if (!Number.isFinite(frac) || frac < 0 || frac >= 1) return null;
  const totalMins = Math.round(frac * 24 * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseCellTime(cell: unknown): string | null {
  if (cell === null || cell === undefined || cell === '') return null;
  if (typeof cell === 'number') {
    if (cell < 1) return excelFractionToTime(cell);
    // Excel cell could be `1.5` (1.5 days) or a pure HH.MM number — try
    // the fraction-of-day interpretation first.
    return excelFractionToTime(cell - Math.floor(cell));
  }
  if (cell instanceof Date) {
    if (Number.isNaN(cell.getTime())) return null;
    const h = cell.getUTCHours();
    const m = cell.getUTCMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (typeof cell === 'string') {
    const t = cell.trim();
    if (!t) return null;
    // Match HH:mm, H:mm, HHmm, H.mm, with optional AM/PM.
    const m = t.match(/^(\d{1,2})[:.]?(\d{2})\s*(am|pm)?$/i);
    if (!m) return null;
    let h = Number(m[1]);
    const min = Number(m[2]);
    const meridiem = m[3]?.toLowerCase();
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
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

function parseAttendees(cell: unknown): Array<{ uid: null; label: string }> {
  const s = parseCellString(cell);
  if (!s) return [];
  return s
    .split(/[;|\n]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((label) => ({ uid: null, label }));
}

// ───── Header-row auto-detect ───────────────────────────────────────────

function detectHeaderRow(grid: unknown[][]): number {
  for (let i = 0; i < Math.min(grid.length, 10); i += 1) {
    const row = grid[i] ?? [];
    const tokens = row.map((c) => normaliseHeader(c));
    const hasBody = tokens.some((t) => t === 'body' || t === 'board');
    const hasDate = tokens.some((t) => t === 'date' || t === 'meeting date');
    if (hasBody && hasDate) return i;
  }
  return -1;
}

// ───── Column mapping ───────────────────────────────────────────────────

function buildColumnMap(
  headerRow: unknown[],
): Map<number, FieldName> {
  const map = new Map<number, FieldName>();
  for (let idx = 0; idx < headerRow.length; idx += 1) {
    const norm = normaliseHeader(headerRow[idx]);
    if (norm && norm in FIELD_ALIASES) {
      map.set(idx, FIELD_ALIASES[norm]);
    }
  }
  return map;
}

// ───── Public entry point ───────────────────────────────────────────────

export interface ParseResult {
  rows: ParsedMeetingRow[];
  summary: MeetingImportSummary;
}

export function parseMeetingsXlsx(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  bodies: FrameworkBodyLite[],
): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      summary: {
        totalRows: 0,
        validRows: 0,
        errorRows: 0,
        warningRows: 0,
        unknownBodies: [],
        headerRowIndex: -1,
      },
    };
  }
  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
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
        unknownBodies: [],
        headerRowIndex: -1,
      },
    };
  }

  const columnMap = buildColumnMap(grid[headerRowIndex] ?? []);

  // Index bodies by lowercased name + lowercased short code (segment
  // before " · ") for fuzzy matching the Body column.
  const bodyByLabel = new Map<string, FrameworkBodyLite>();
  for (const b of bodies) {
    const full = (b.name ?? '').trim().toLowerCase();
    if (full) bodyByLabel.set(full, b);
    const idx = (b.name ?? '').indexOf(' · ');
    const short = (idx > 0 ? (b.name ?? '').slice(0, idx) : '')
      .trim()
      .toLowerCase();
    if (short) bodyByLabel.set(short, b);
  }

  const rows: ParsedMeetingRow[] = [];
  const unknownBodies = new Set<string>();
  let validRows = 0;
  let errorRows = 0;
  let warningRows = 0;

  for (let r = headerRowIndex + 1; r < grid.length; r += 1) {
    const rawRow = grid[r] ?? [];
    if (rawRow.every((c) => c === null || c === undefined || c === '')) continue;

    const flags: MeetingImportFlag[] = [];
    const cellAt = (field: FieldName): unknown => {
      for (const [idx, f] of columnMap.entries()) {
        if (f === field) return rawRow[idx];
      }
      return null;
    };

    const bodyLabel = parseCellString(cellAt('body'));
    const matchedBody = bodyByLabel.get(bodyLabel.toLowerCase());
    if (!matchedBody && bodyLabel) {
      unknownBodies.add(bodyLabel);
      flags.push({
        severity: 'warning',
        field: 'body',
        message: `Body "${bodyLabel}" doesn't match any framework body — meeting will save without a body link.`,
      });
    }

    const date = parseCellDate(cellAt('date'));
    if (!date) {
      flags.push({
        severity: 'error',
        field: 'date',
        message: 'Date is required and could not be parsed.',
      });
    }

    const timeStart = parseCellTime(cellAt('timeStart')) ?? '10:00';
    const timeEnd = parseCellTime(cellAt('timeEnd')) ?? '12:00';

    if (!cellAt('timeStart')) {
      flags.push({
        severity: 'warning',
        field: 'timeStart',
        message: `Start time missing — defaulted to ${timeStart}.`,
      });
    }
    if (!cellAt('timeEnd')) {
      flags.push({
        severity: 'warning',
        field: 'timeEnd',
        message: `End time missing — defaulted to ${timeEnd}.`,
      });
    }

    const location = parseCellString(cellAt('location'));
    const chairLabel = parseCellString(cellAt('chair'));
    const attendees = parseAttendees(cellAt('attendees'));

    const meeting: ParsedMeeting = {
      id: slugifyId(`${bodyLabel}-${date ?? 'no-date'}`, 'mtg'),
      governanceBodyId: matchedBody?.id ?? null,
      governanceBodyLabel: matchedBody?.name ?? bodyLabel,
      date: date ?? '',
      timeStart,
      timeEnd,
      location,
      chairLabel,
      attendees,
    };

    rows.push({ sheetRow: r + 1, meeting, flags });

    if (flags.some((f) => f.severity === 'error')) errorRows += 1;
    else if (flags.some((f) => f.severity === 'warning')) warningRows += 1;
    else validRows += 1;
  }

  return {
    rows,
    summary: {
      totalRows: rows.length,
      validRows,
      errorRows,
      warningRows,
      unknownBodies: Array.from(unknownBodies),
      headerRowIndex,
    },
  };
}

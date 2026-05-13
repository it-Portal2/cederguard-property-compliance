// One-shot parser to dump every sheet of the client's two Risk Register
// spec Excel files. Output goes to stdout as readable markdown so we can
// audit cell-by-cell against the codebase.
//
// Run with: npx tsx scripts/parseClientSpec.ts

import * as XLSX from "xlsx";
import { readFileSync } from "fs";
import { join } from "path";

const DIR = join(process.cwd(), "docs/client-spec");
const FILES = [
  "Project Risk Register.xlsx",
  "Programme Risk Register.xlsm.xlsx",
];

function dumpSheet(wb: XLSX.WorkBook, sheetName: string) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return;
  const ref = ws["!ref"];
  console.log(`\n### Sheet: ${sheetName}  (range: ${ref ?? "empty"})`);

  // Use sheet_to_json with header:1 to get raw rows including blanks
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  });

  if (!rows.length) {
    console.log("(empty)");
    return;
  }

  // Cap display to keep output manageable; show first 60 rows and last 5
  const MAX = 60;
  if (rows.length <= MAX) {
    rows.forEach((r, i) => {
      console.log(`R${i + 1}:`, JSON.stringify(r));
    });
  } else {
    rows.slice(0, MAX).forEach((r, i) =>
      console.log(`R${i + 1}:`, JSON.stringify(r)),
    );
    console.log(`... (${rows.length - MAX - 5} rows omitted) ...`);
    rows.slice(-5).forEach((r, i) =>
      console.log(`R${rows.length - 4 + i}:`, JSON.stringify(r)),
    );
  }

  // Also dump cell-level formulas if any (xlsx preserves them under `.f`)
  const formulas: string[] = [];
  for (const k of Object.keys(ws)) {
    if (k.startsWith("!")) continue;
    const cell = ws[k] as any;
    if (cell?.f) formulas.push(`  ${k}: =${cell.f}  → ${cell.v ?? ""}`);
  }
  if (formulas.length) {
    console.log(`\nFormulas in ${sheetName} (${formulas.length}):`);
    formulas.slice(0, 30).forEach((f) => console.log(f));
    if (formulas.length > 30) console.log(`... +${formulas.length - 30} more`);
  }
}

for (const file of FILES) {
  console.log(`\n\n══════════════════════════════════════════════════`);
  console.log(`FILE: ${file}`);
  console.log(`══════════════════════════════════════════════════`);
  const buf = readFileSync(join(DIR, file));
  const wb = XLSX.read(buf, { type: "buffer", cellFormula: true });
  console.log(`Sheets (${wb.SheetNames.length}): ${wb.SheetNames.join(" · ")}`);
  for (const name of wb.SheetNames) {
    dumpSheet(wb, name);
  }
}

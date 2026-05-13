// Comment cleanup tool — strips audit-banned tokens from comments without
// touching code or string literals. Lines that collapse to an empty comment
// marker are removed entirely.
//
// Run: cat file-list.txt | npx tsx scripts/cleanComments.ts

import { readFileSync, writeFileSync } from "fs";

interface Rule {
  re: RegExp;
  with: string;
}

// Strip-rules apply within comment text only. Ordered most-specific first so
// compound matches (e.g. "RSC-A — Phase 4") collapse in a single pass.
const STRIP_RULES: Rule[] = [
  // Parenthesised provenance: "(Anthony 13.05.2026)" / "(per client 2026-05-03)"
  { re: /\(\s*Anthony[^)]*\)/gi, with: "" },
  { re: /\(\s*per\s+client[^)]*\)/gi, with: "" },
  { re: /\(\s*\d{1,2}\.\d{1,2}\.20\d{2}\s*[^)]*\)/g, with: "" },
  { re: /\(\s*20\d{2}-\d{1,2}-\d{1,2}\s*[^)]*\)/g, with: "" },

  // Phase tags: "RSC-A: " / "RSC-A — " / "HR-3 — " / "Phase 6b — "
  { re: /\bRSC-[A-E][a-z']*\s*[:—\-·]\s*/g, with: "" },
  { re: /\bRSC-[A-E][a-z']*\b/g, with: "" },
  { re: /\bHR-\d+[a-z]?\s*[:—\-·]\s*/g, with: "" },
  { re: /\bHR-\d+[a-z]?\b/g, with: "" },
  { re: /\bHRC\s+HR-\d+\b/g, with: "" },
  { re: /\bHRC\b/g, with: "" },
  { re: /\bPhase\s+\d+(?:\.\d+)?[a-z']*\s*[:—\-·]\s*/g, with: "" },
  { re: /\bPhase\s+\d+(?:\.\d+)?[a-z']*\b/g, with: "" },
  // Orphans left over from earlier strips: leading ".5e —", ".5b ·" etc.
  { re: /^\s*\.\d+[a-z']*\s*[—\-·:]\s*/g, with: "" },
  { re: /\s\.\d+[a-z']*\s*[—\-·:]\s*/g, with: " " },

  // Q-locks
  { re: /\bper\s+Q\d+\s*=\s*[A-Z]\b(?:\s+locked)?/gi, with: "" },
  { re: /\bQ\d+\s*=\s*[A-Z]\s+locked\b/g, with: "" },
  { re: /\bQ\d+\s*=\s*[A-Z]\b/g, with: "" },

  // Lesson refs
  { re: /\(\s*l(?:esson)?\s*#\s*\d+[^)]*\)/gi, with: "" },
  { re: /\bL?esson\s*#\s*\d+\b/gi, with: "" },

  // Bare date stamps
  { re: /\b\d{1,2}\.\d{1,2}\.20\d{2}\b/g, with: "" },
  { re: /\b20\d{2}-\d{1,2}-\d{1,2}\b/g, with: "" },

  // Provenance phrases — strip the phrase but keep the surrounding sentence
  { re: /\bper\s+client\s+confirmation\b/gi, with: "" },
  { re: /\bper\s+client\s+directive\b/gi, with: "" },
  { re: /\bper\s+client\s+spec(?:ification)?\b/gi, with: "" },
  { re: /\bper\s+client\s+PDF\b/gi, with: "" },
  { re: /\bper\s+the\s+client(?:'s)?(?:\s+PDF|\s+spec)?\b/gi, with: "" },
  { re: /\bper\s+client\b/gi, with: "" },
  { re: /\bclient\s+PDF\b/gi, with: "" },
  { re: /\bclient\s+spec(?:ification)?\b/gi, with: "" },
  { re: /\bclient\s+directive\b/gi, with: "" },
  { re: /\bAnthony(?:'s)?\b/g, with: "" },

  // Excel spec-tab references (only when paired with "sheet"/"tab")
  { re: /\bExcel\s+RAD\s+(?:Data|data)\s+(?:sheet|tab)\b/gi, with: "" },
  { re: /\bExcel\s+Financial\s+Ratings\s+(?:sheet|tab)\b/gi, with: "" },
  { re: /\bExcel\s+Risk\s+Matrix\s+(?:sheet|tab)\b/gi, with: "" },
  { re: /\bRAD\s+Data\s+(?:sheet|tab)\b/gi, with: "" },
  { re: /\bRAD\s+data\s+(?:sheet|tab)\b/gi, with: "" },
  { re: /\bFinancial\s+Ratings\s+(?:sheet|tab)\b/gi, with: "" },
  { re: /\bRisk\s+Matrix\s+(?:sheet|tab)\b/gi, with: "" },
  // Southwark-specific provenance ("Real Southwark sheets", "Southwark cells",
  // "the real Southwark Forward Plan sheet" etc.). The implementation
  // generality remains true without naming the source council.
  { re: /\b(?:the\s+)?real\s+Southwark\s+(?:sheet|sheets|cells|FP\s+sheet|Forward\s+Plan(?:\s+sheet)?|template|calendar|board\s+column\s+order)\b/gi, with: "the sheet" },
  { re: /\bSouthwark(?:'s)?\s+(?:canonical|calendar|template|sheet|cells|FP|Forward\s+Plan|Construction)\b/gi, with: "canonical" },
  { re: /\bSouthwark-style\b/gi, with: "the supported" },
  { re: /\bSouthwark(?:'s)?\b/gi, with: "" },
];

// Post-strip clean-up rules applied within a comment line/body only.
const TIDY_RULES: Rule[] = [
  { re: /\(\s+([^)]*?)\s*\)/g, with: "($1)" },   // trim inner padding "( x )" → "(x)"
  { re: /\(\s*\)/g, with: "" },                  // empty parens
  { re: /\[\s*\]/g, with: "" },                  // empty brackets
  { re: /\s+\.(?=\s|$)/g, with: "." },           // " ." → "."
  { re: /\s+,(?=\s|$)/g, with: "," },            // " ," → ","
  { re: /\s+;/g, with: ";" },
  { re: /\s+:\s+/g, with: ": " },
  { re: /,\s*,/g, with: "," },                   // double commas
  { re: /\.\s*\./g, with: "." },                 // double periods
  { re: /\s+([—–\-·])\s+(?=$)/g, with: "" },     // trailing punctuation
  { re: /^\s*([—–\-·,;:])\s*/g, with: "" },      // leading orphan punctuation (only at body start)
  { re: /[ \t]{2,}/g, with: " " },               // collapse runs of internal whitespace
  { re: /[ \t]+$/g, with: "" },                  // strip trailing whitespace
];

// Returns true when the body (with comment markers stripped) is empty or
// composed only of stray punctuation. Drives full-line removal.
function isEmptyBody(body: string): boolean {
  return body.replace(/[\s—–\-:·,;.()*\[\]]/g, "").length === 0;
}

function applyStripsToBody(body: string): string {
  let t = body;
  for (const { re, with: rep } of STRIP_RULES) {
    t = t.replace(re, rep);
  }
  for (const { re, with: rep } of TIDY_RULES) {
    t = t.replace(re, rep);
  }
  return t;
}

interface Replacement {
  start: number;
  end: number;
  next: string;
}

function rewriteComments(src: string): string {
  const replacements: Replacement[] = [];
  const len = src.length;
  let i = 0;

  while (i < len) {
    const ch = src[i];
    const next = src[i + 1];

    // Skip string literals to avoid touching code.
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < len) {
        if (src[i] === "\\") {
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          i++;
          break;
        }
        if (quote === "`" && src[i] === "$" && src[i + 1] === "{") {
          let depth = 1;
          i += 2;
          while (i < len && depth > 0) {
            if (src[i] === "{") depth++;
            else if (src[i] === "}") depth--;
            i++;
          }
          continue;
        }
        i++;
      }
      continue;
    }

    // Single-line // comment.
    if (ch === "/" && next === "/") {
      const lineStart = i;
      while (i < len && src[i] !== "\n") i++;
      const lineEnd = i;
      // Trim trailing \r to handle CRLF line endings consistently; the \r
      // stays in the file because we replace within [lineStart, lineEnd).
      const lineText = src.slice(lineStart, lineEnd).replace(/\r$/, "");
      // Split marker + body: `//`, optional whitespace, body.
      const m = lineText.match(/^(\/\/\s*)(.*)$/);
      if (m) {
        const marker = m[1];
        const body = m[2];
        const newBody = applyStripsToBody(body);
        if (newBody !== body) {
          if (isEmptyBody(newBody)) {
            // Strip the entire line including any leading indent and trailing newline.
            let s = lineStart;
            while (s > 0 && /[ \t]/.test(src[s - 1])) s--;
            let e = lineEnd;
            if (e < len && src[e] === "\n") e++;
            replacements.push({ start: s, end: e, next: "" });
          } else {
            // Preserve the original marker prefix; only the body changes.
            // Trim trailing whitespace from the new body for cleanliness, then
            // re-attach the original line's `\r` if the file uses CRLF.
            const cleaned = newBody.replace(/\s+$/, "");
            const hadCR = src[lineEnd - 1] === "\r";
            replacements.push({
              start: lineStart,
              end: lineEnd,
              next: `${marker}${cleaned}${hadCR ? "\r" : ""}`,
            });
          }
        }
      }
      continue;
    }

    // Block /* ... */ or JSX {/* ... */}.
    const isJsx =
      ch === "{" && next === "/" && src[i + 2] === "*";
    const isBlock = ch === "/" && next === "*";
    if (isJsx || isBlock) {
      const blockStart = i;
      const open = isJsx ? "{/*" : "/*";
      const close = isJsx ? "*/}" : "*/";
      i += open.length;
      while (i < len) {
        if (
          src[i] === "*" &&
          src[i + 1] === "/" &&
          (!isJsx || src[i + 2] === "}")
        ) {
          i += close.length;
          break;
        }
        i++;
      }
      const blockEnd = i;
      const block = src.slice(blockStart, blockEnd);
      const inner = block.slice(open.length, block.length - close.length);
      const rawLines = inner.split("\n");
      // Normalise CRLF: strip trailing \r for regex matching, remember which
      // lines had it so we can re-attach on output.
      const lines = rawLines.map((ln) => ln.replace(/\r$/, ""));
      const hadCR = rawLines.map((ln) => /\r$/.test(ln));
      const newLines: string[] = [];
      let mutated = false;
      const lastIdx = lines.length - 1;
      for (let idx = 0; idx < lines.length; idx++) {
        const ln = lines[idx];
        const cr = hadCR[idx] ? "\r" : "";
        const isClosingIndent = idx === lastIdx && /^\s*$/.test(ln);
        if (isClosingIndent) {
          newLines.push(ln + cr);
          continue;
        }
        const bodyMatch = ln.match(/^(\s*\*\s*)(.*)$/);
        if (bodyMatch) {
          const marker = bodyMatch[1];
          const body = bodyMatch[2];
          const cleaned = applyStripsToBody(body).replace(/\s+$/, "");
          if (cleaned !== body) mutated = true;
          if (isEmptyBody(cleaned) && idx > 0 && idx < lastIdx) {
            continue;
          }
          newLines.push(`${marker}${cleaned}${cr}`);
        } else {
          const cleaned = applyStripsToBody(ln).replace(/\s+$/, "");
          if (cleaned !== ln) mutated = true;
          newLines.push(cleaned + cr);
        }
      }
      if (mutated) {
        const innerOut = newLines.join("\n");
        const blockOut = open + innerOut + close;
        // If the whole block reduced to marker-only content, drop the block + line.
        const stripped = innerOut.replace(/[\s*]/g, "");
        if (stripped.length === 0) {
          let s = blockStart;
          while (s > 0 && /[ \t]/.test(src[s - 1])) s--;
          let e = blockEnd;
          if (e < len && src[e] === "\n") e++;
          replacements.push({ start: s, end: e, next: "" });
        } else {
          replacements.push({ start: blockStart, end: blockEnd, next: blockOut });
        }
      }
      continue;
    }

    i++;
  }

  if (replacements.length === 0) return src;
  replacements.sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const r of replacements) {
    out += src.slice(cursor, r.start);
    out += r.next;
    cursor = r.end;
  }
  out += src.slice(cursor);
  return out;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

(async () => {
  const input = await readStdin();
  const paths = input
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let touched = 0;
  for (const p of paths) {
    try {
      const src = readFileSync(p, "utf-8");
      const out = rewriteComments(src);
      if (out !== src) {
        writeFileSync(p, out, "utf-8");
        touched++;
      }
    } catch (err) {
      console.error(`[clean] failed on ${p}:`, (err as Error).message);
    }
  }
  console.log(`[clean] rewrote ${touched}/${paths.length} files`);
})();

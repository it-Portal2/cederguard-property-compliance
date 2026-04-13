/**
 * Strips common markdown formatting from a string so that
 * AI-generated content displays cleanly in plain text areas.
 *
 * Removes:
 *  - **bold**   → bold
 *  - *italic*   → italic
 *  - __bold__   → bold
 *  - _italic_   → italic
 *  - `code`     → code
 *  - ### Heading → Heading  (h1–h6)
 *  - > blockquote → blockquote
 *  - [label](url) → label
 */
export function stripMarkdown(text: string): string {
    if (!text) return '';
    if (typeof text !== 'string') return String(text);
    return text
        // Remove heading markers (# ## ### etc.)
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold ** or __ (greedy match)
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        // Remove italic * or _
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // Remove inline code backticks
        .replace(/`([^`]+)`/g, '$1')
        // Remove blockquote >
        .replace(/^>\s*/gm, '')
        // Remove markdown links [label](url) → label
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Collapse 3+ blank lines to 2
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function parseAISuggestion(text: string) {
    if (!text) return [];
    
    // Split by the markers and keep them
    const parts = text.split(/\b(WHAT:|WHO:|WHEN:|HOW:|WHERE:|WHY:)/g).filter(Boolean);
    const result: { label?: string; content: string }[] = [];
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part.match(/^(WHAT|WHO|WHEN|HOW|WHERE|WHY):$/)) {
            const content = (parts[i + 1] || "").trim();
            result.push({ label: part, content });
            i++; // Skip the next part as we just used it as content
        } else if (part) {
            // If it doesn't match a label, it's just raw content before any label
            result.push({ content: part });
        }
    }
    return result;
}

export function generateId(prefix: string): string {
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${random}`;
}

/**
 * Safely format distance to now without throwing RangeError for invalid dates.
 */
export function safeFormatDistanceToNow(dateInput: any, formatDistanceToNowFn: any): string {
  try {
    if (!dateInput) return 'Just now';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return 'Just now';
    return formatDistanceToNowFn(date, { addSuffix: true });
  } catch (e) {
    console.error('Date formatting error:', e);
    return 'Just now';
  }
}

/**
 * Check if a string is a valid ISO date.
 */
export function isValidDateString(dateString: any): boolean {
  if (!dateString || typeof dateString !== 'string') return false;
  const d = new Date(dateString);
  return !isNaN(d.getTime());
}

/**
 * Trigger a browser download of a string content as a file.
 */
export function downloadFile(content: string, fileName: string, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format compliance item history (updates) into a CSV string.
 */
export function exportComplianceToCSV(item: any) {
  if (!item || !item.updates || item.updates.length === 0) return '';

  const headers = ['Requirement ID', 'Date', 'Author', 'Content'];
  const rows = item.updates.map((u: any) => [
    item.id,
    new Date(u.date).toISOString(),
    `"${(u.author || '').replace(/"/g, '""')}"`,
    `"${(u.content || '').replace(/"/g, '""')}"`
  ]);

  return [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');
}

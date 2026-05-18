import type { DuplicateHighlight, TextRange } from "./types.js";

export function normalizeRange(range: TextRange): TextRange | null {
  if (!Number.isFinite(range.start) || !Number.isFinite(range.end)) {
    return null;
  }

  const start = Math.max(0, Math.min(range.start, range.end));
  const end = Math.max(start, Math.max(range.start, range.end));

  if (start === end) {
    return null;
  }

  return {
    ...range,
    start,
    end
  };
}

export function normalizeRanges(ranges: TextRange[]): TextRange[] {
  return ranges
    .map(normalizeRange)
    .filter((range): range is TextRange => Boolean(range))
    .sort((a, b) => a.start - b.start || a.end - b.end);
}

export function filterHighlightsForDocument(
  highlights: DuplicateHighlight[],
  documentId: string
): DuplicateHighlight[] {
  return highlights
    .filter((highlight) => highlight.documentId === documentId)
    .map((highlight) => ({
      ...highlight,
      ranges: normalizeRanges(highlight.ranges)
    }))
    .filter((highlight) => highlight.ranges.length > 0);
}

export function plainTextFromHtml(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  }

  const element = document.createElement("div");
  element.innerHTML = html;
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

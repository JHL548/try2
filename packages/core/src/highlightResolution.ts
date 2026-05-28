import { normalizeRange, normalizeRanges } from "./ranges.js";
import type { DuplicateHighlight, TextRange } from "./types.js";

export interface ResolvedPlainTextRange {
  start: number;
  end: number;
  matchedText: string;
  source: "direct" | "fallback";
}

function findClosestTextIndex(text: string, target: string, preferredIndex: number): number {
  if (!target) {
    return -1;
  }

  let closestIndex = -1;
  let closestDistance = Number.POSITIVE_INFINITY;
  let searchIndex = text.indexOf(target);

  while (searchIndex >= 0) {
    const distance = Math.abs(searchIndex - preferredIndex);
    if (distance < closestDistance) {
      closestIndex = searchIndex;
      closestDistance = distance;
    }

    searchIndex = text.indexOf(target, searchIndex + 1);
  }

  return closestIndex;
}

export function resolveTextRangeInPlainText(
  plainText: string,
  range: TextRange,
  expectedText = range.matchedText
): ResolvedPlainTextRange | null {
  const normalizedRange = normalizeRange(range);
  if (!normalizedRange) {
    return null;
  }

  const directText = plainText.slice(normalizedRange.start, normalizedRange.end);
  const isDirectRangeInBounds = normalizedRange.end <= plainText.length && directText.length > 0;
  if (isDirectRangeInBounds && (!expectedText || directText === expectedText)) {
    return {
      start: normalizedRange.start,
      end: normalizedRange.end,
      matchedText: expectedText || directText,
      source: "direct"
    };
  }

  if (!expectedText) {
    return null;
  }

  const fallbackStart = findClosestTextIndex(plainText, expectedText, normalizedRange.start);
  if (fallbackStart < 0) {
    return null;
  }

  return {
    start: fallbackStart,
    end: fallbackStart + expectedText.length,
    matchedText: expectedText,
    source: "fallback"
  };
}

export function isTextRangeResolvableInPlainText(
  plainText: string,
  range: TextRange,
  expectedText = range.matchedText
): boolean {
  return Boolean(resolveTextRangeInPlainText(plainText, range, expectedText));
}

export function hasResolvableHighlightInPlainText(
  plainText: string,
  highlight: DuplicateHighlight
): boolean {
  return normalizeRanges(highlight.ranges).some((range) =>
    isTextRangeResolvableInPlainText(plainText, range, range.matchedText)
  );
}

import { buildPlainTextPositionMap } from "./tiptapDuplicateHighlight.js";
import type { RangeMapEntry, TextRange } from "./types.js";

export interface SelectionRangeInfo {
  selectedText: string;
  from: number;
  to: number;
  empty: boolean;
  plainTextOffset: { start: number; end: number } | null;
  selectedRange: TextRange | null;
}

export function getSelectionRangeInfo(editor: {
  state: {
    selection: { from: number; to: number; empty: boolean };
    doc: { textBetween: (from: number, to: number, separator: string | null, leafText?: string | null | ((leafNode: unknown) => string)) => string };
  };
}): SelectionRangeInfo {
  const { from, to, empty } = editor.state.selection;
  const selectedText = editor.state.doc.textBetween(from, to, "\n");

  let plainTextOffset: { start: number; end: number } | null = null;
  let selectedRange: TextRange | null = null;

  if (!empty) {
    const positions = buildPlainTextPositionMap(editor.state.doc as any);

    const startIdx = positions.indexOf(from);
    const lastIdx = positions.lastIndexOf(to - 1);

    if (startIdx !== -1 && lastIdx !== -1 && lastIdx >= startIdx) {
      const endIdx = lastIdx + 1;
      plainTextOffset = { start: startIdx, end: endIdx };

      selectedRange = {
        start: startIdx,
        end: endIdx,
        matchedText: selectedText
      };
    }
  }

  return {
    selectedText,
    from,
    to,
    empty,
    plainTextOffset,
    selectedRange
  };
}

export function findOverlappingRangeMapEntries(
  rangeMap: RangeMapEntry[],
  plainTextOffset: { start: number; end: number }
): RangeMapEntry[] {
  return rangeMap.filter((entry) => {
    const entryStart = entry.textStart;
    const entryEnd = entry.textEnd;
    const selStart = plainTextOffset.start;
    const selEnd = plainTextOffset.end;

    return selStart < entryEnd && selEnd > entryStart;
  });
}
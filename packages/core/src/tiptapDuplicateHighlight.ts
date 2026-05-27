import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { createHighlightClass } from "./colors.js";
import { normalizeRange, normalizeRanges } from "./ranges.js";
import type { DuplicateHighlight, TextRange } from "./types.js";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    duplicateHighlight: {
      setDuplicateHighlights: (highlights: DuplicateHighlight[]) => ReturnType;
    };
  }
}

interface MappedRange {
  from: number;
  to: number;
}

interface HighlightAnchor extends MappedRange {
  key: string;
  attrs: Record<string, string | undefined>;
  expectedText?: string;
  valid: boolean;
}

interface DuplicateHighlightState {
  decorations: DecorationSet;
  anchors: Record<string, HighlightAnchor>;
  activeKeys: string[];
}

interface PlainTextSnapshot {
  text: string;
  positions: number[];
}

export interface ResolvedPlainTextRange {
  start: number;
  end: number;
  matchedText: string;
  source: "direct" | "fallback";
}

export const duplicateHighlightPluginKey = new PluginKey<DuplicateHighlightState>("duplicate-highlight");

export function buildPlainTextSnapshot(doc: ProseMirrorNode): PlainTextSnapshot {
  const textParts: string[] = [];
  const positions: number[] = [];

  doc.forEach((blockNode, blockOffset, blockIndex) => {
    // 后端 plainText 以换行分隔块级节点，这里补齐同样的偏移，避免第二段以后定位偏移。
    if (blockIndex > 0) {
      textParts.push("\n");
      positions.push(blockOffset);
    }

    blockNode.descendants((node, relativePos) => {
      if (!node.isText) {
        return true;
      }

      const text = node.text ?? "";
      const absolutePos = blockOffset + 1 + relativePos;

      for (let index = 0; index < text.length; index += 1) {
        textParts.push(text[index] ?? "");
        positions.push(absolutePos + index);
      }

      return true;
    });
  });

  return {
    text: textParts.join(""),
    positions
  };
}

export function buildPlainTextPositionMap(doc: ProseMirrorNode): number[] {
  return buildPlainTextSnapshot(doc).positions;
}

export function mapTextRangeToDocPositions(
  positions: number[],
  range: TextRange
): MappedRange | null {
  const from = positions[range.start];
  const lastIncludedPosition = positions[Math.max(range.start, range.end - 1)];

  if (from === undefined || lastIncludedPosition === undefined) {
    return null;
  }

  const to = lastIncludedPosition + 1;
  return to > from ? { from, to } : null;
}

function getRangeText(doc: ProseMirrorNode, range: MappedRange): string {
  return doc.textBetween(range.from, range.to, "\n", "");
}

function rangeStillMatches(doc: ProseMirrorNode, range: MappedRange, text?: string): boolean {
  if (!text) {
    return true;
  }

  return getRangeText(doc, range) === text;
}

function getExpectedText(doc: ProseMirrorNode, range: MappedRange, text?: string): string | undefined {
  return text || getRangeText(doc, range) || undefined;
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

function getRangeKey(highlight: DuplicateHighlight, range: TextRange, index: number): string {
  return [
    highlight.documentId,
    highlight.duplicateId,
    range.blockId ?? "unknown-block",
    range.start,
    range.end,
    index
  ].join("::");
}

function getDecorationAttrs(
  highlight: DuplicateHighlight,
  range: TextRange
): Record<string, string | undefined> {
  return {
    class: createHighlightClass(highlight.similarity, highlight.active, highlight.ignored),
    "data-duplicate-id": highlight.duplicateId,
    "data-section-path": highlight.sectionPath?.join(" / ") ?? range.sectionPath?.join(" / "),
    "data-region": highlight.region ?? range.region,
    "data-semantic-type": highlight.semanticType ?? range.semanticType,
    "data-noise-reason": highlight.noiseReason,
    "data-table-id": highlight.tableContext?.tableId ?? range.tableContext?.tableId
  };
}

function createAnchor(
  doc: ProseMirrorNode,
  snapshot: PlainTextSnapshot,
  highlight: DuplicateHighlight,
  range: TextRange,
  index: number,
  expectedText = range.matchedText
): HighlightAnchor | null {
  const mappedRange = mapTextRangeToDocPositions(snapshot.positions, range);
  if (mappedRange && rangeStillMatches(doc, mappedRange, expectedText)) {
    return {
      key: getRangeKey(highlight, range, index),
      from: mappedRange.from,
      to: mappedRange.to,
      attrs: getDecorationAttrs(highlight, range),
      expectedText: getExpectedText(doc, mappedRange, expectedText),
      valid: true
    };
  }

  const fallbackStart = findClosestTextIndex(snapshot.text, expectedText ?? "", range.start);
  const fallbackRange =
    fallbackStart >= 0 && expectedText
      ? mapTextRangeToDocPositions(snapshot.positions, {
          ...range,
          start: fallbackStart,
          end: fallbackStart + expectedText.length
        })
      : null;

  if (!fallbackRange || !rangeStillMatches(doc, fallbackRange, expectedText)) {
    return null;
  }

  return {
    key: getRangeKey(highlight, range, index),
    from: fallbackRange.from,
    to: fallbackRange.to,
    attrs: getDecorationAttrs(highlight, range),
    expectedText: getExpectedText(doc, fallbackRange, expectedText),
    valid: true
  };
}

function buildDecorations(doc: ProseMirrorNode, anchors: HighlightAnchor[], activeKeys: string[]): DecorationSet {
  const activeKeySet = new Set(activeKeys);
  const decorations = anchors
    .filter((anchor) => anchor.valid && activeKeySet.has(anchor.key) && anchor.to > anchor.from)
    .map((anchor) => Decoration.inline(anchor.from, anchor.to, anchor.attrs));

  return DecorationSet.create(doc, decorations);
}

function buildHighlightState(
  doc: ProseMirrorNode,
  highlights: DuplicateHighlight[],
  previousAnchors: Record<string, HighlightAnchor> = {}
): DuplicateHighlightState {
  const snapshot = buildPlainTextSnapshot(doc);
  const anchors = { ...previousAnchors };
  const activeKeys: string[] = [];

  for (const highlight of highlights) {
    const ranges = normalizeRanges(highlight.ranges);

    for (const [index, range] of ranges.entries()) {
      const key = getRangeKey(highlight, range, index);
      const previousAnchor = anchors[key];
      activeKeys.push(key);

      if (previousAnchor && !previousAnchor.valid) {
        const restoredAnchor = createAnchor(doc, snapshot, highlight, range, index, previousAnchor.expectedText);
        if (restoredAnchor) {
          anchors[key] = restoredAnchor;
        } else {
          anchors[key] = {
            ...previousAnchor,
            attrs: getDecorationAttrs(highlight, range)
          };
        }
        continue;
      }

      if (previousAnchor) {
        const updatedAnchor = {
          ...previousAnchor,
          attrs: getDecorationAttrs(highlight, range)
        };
        if (rangeStillMatches(doc, updatedAnchor, updatedAnchor.expectedText)) {
          anchors[key] = updatedAnchor;
        } else {
          anchors[key] =
            createAnchor(doc, snapshot, highlight, range, index, updatedAnchor.expectedText) ?? {
              ...updatedAnchor,
              valid: false
            };
        }
        continue;
      }

      const anchor = createAnchor(doc, snapshot, highlight, range, index);
      if (anchor) {
        anchors[key] = anchor;
      }
    }
  }

  return {
    decorations: buildDecorations(doc, Object.values(anchors), activeKeys),
    anchors,
    activeKeys
  };
}

function mapAnchors(
  doc: ProseMirrorNode,
  anchors: Record<string, HighlightAnchor>,
  activeKeys: string[],
  trMapping: Parameters<DecorationSet["map"]>[0]
): Record<string, HighlightAnchor> {
  const nextAnchors: Record<string, HighlightAnchor> = {};
  const activeKeySet = new Set(activeKeys);

  for (const [key, anchor] of Object.entries(anchors)) {
    if (!activeKeySet.has(key)) {
      nextAnchors[key] = anchor;
      continue;
    }

    if (!anchor.valid) {
      nextAnchors[key] = anchor;
      continue;
    }

    const fromResult = trMapping.mapResult(anchor.from, 1);
    const toResult = trMapping.mapResult(anchor.to, -1);
    const from = fromResult.pos;
    const to = toResult.pos;
    const wasDeleted = fromResult.deleted || toResult.deleted || to <= from;
    const mappedAnchor = {
      ...anchor,
      from,
      to
    };
    const textChanged = !rangeStillMatches(doc, mappedAnchor, anchor.expectedText);

    nextAnchors[key] = {
      ...mappedAnchor,
      valid: !wasDeleted && to > from && to <= doc.content.size && !textChanged
    };
  }

  return nextAnchors;
}

export const DuplicateHighlightExtension = Extension.create({
  name: "duplicateHighlight",

  addStorage() {
    return {
      highlights: [] as DuplicateHighlight[]
    };
  },

  addCommands() {
    return {
      setDuplicateHighlights:
        (highlights) =>
        ({ tr, dispatch }) => {
          this.storage.highlights = highlights;

          if (dispatch) {
            dispatch(tr.setMeta(duplicateHighlightPluginKey, { highlights }));
          }

          return true;
        }
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: duplicateHighlightPluginKey,
        state: {
          init: (_, state) => buildHighlightState(state.doc, this.storage.highlights),
          apply: (tr, pluginState, _oldState, newState) => {
            const meta = tr.getMeta(duplicateHighlightPluginKey) as
              | { highlights?: DuplicateHighlight[] }
              | undefined;

            if (meta?.highlights) {
              return buildHighlightState(newState.doc, meta.highlights, pluginState.anchors);
            }

            const anchors = mapAnchors(newState.doc, pluginState.anchors, pluginState.activeKeys, tr.mapping);
            return {
              ...pluginState,
              decorations: buildDecorations(newState.doc, Object.values(anchors), pluginState.activeKeys),
              anchors
            };
          }
        },
        props: {
          decorations(state) {
            return duplicateHighlightPluginKey.getState(state)?.decorations;
          }
        }
      })
    ];
  }
});

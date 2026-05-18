import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { createHighlightClass } from "./colors.js";
import { normalizeRanges } from "./ranges.js";
import type { DuplicateHighlight, TextRange } from "./types.js";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    duplicateHighlight: {
      setDuplicateHighlights: (highlights: DuplicateHighlight[]) => ReturnType;
    };
  }
}

export const duplicateHighlightPluginKey = new PluginKey<DecorationSet>("duplicate-highlight");

export function buildPlainTextPositionMap(doc: ProseMirrorNode): number[] {
  const positions: number[] = [];

  doc.forEach((blockNode, blockOffset, blockIndex) => {
    // 后端 plainText 以换行分隔块级节点，这里补齐同样的偏移，避免第二段以后定位偏移。
    if (blockIndex > 0) {
      positions.push(blockOffset);
    }

    blockNode.descendants((node, relativePos) => {
      if (!node.isText) {
        return true;
      }

      const text = node.text ?? "";
      const absolutePos = blockOffset + 1 + relativePos;

      for (let index = 0; index < text.length; index += 1) {
        positions.push(absolutePos + index);
      }

      return true;
    });
  });

  return positions;
}

export function mapTextRangeToDocPositions(
  positions: number[],
  range: TextRange
): { from: number; to: number } | null {
  const from = positions[range.start];
  const lastIncludedPosition = positions[Math.max(range.start, range.end - 1)];

  if (from === undefined || lastIncludedPosition === undefined) {
    return null;
  }

  const to = lastIncludedPosition + 1;
  return to > from ? { from, to } : null;
}

function buildDecorations(doc: ProseMirrorNode, highlights: DuplicateHighlight[]): DecorationSet {
  const decorations: Decoration[] = [];
  const positions = buildPlainTextPositionMap(doc);

  for (const highlight of highlights) {
    const ranges = normalizeRanges(highlight.ranges);

    for (const range of ranges) {
      const mappedRange = mapTextRangeToDocPositions(positions, range);
      if (!mappedRange) {
        continue;
      }

      decorations.push(
        Decoration.inline(mappedRange.from, mappedRange.to, {
          class: createHighlightClass(highlight.similarity, highlight.active, highlight.ignored),
          "data-duplicate-id": highlight.duplicateId,
          "data-section-path": highlight.sectionPath?.join(" / ") ?? range.sectionPath?.join(" / "),
          "data-region": highlight.region ?? range.region,
          "data-semantic-type": highlight.semanticType ?? range.semanticType,
          "data-noise-reason": highlight.noiseReason,
          "data-table-id": highlight.tableContext?.tableId ?? range.tableContext?.tableId
        })
      );
    }
  }

  return DecorationSet.create(doc, decorations);
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
          init: (_, state) => buildDecorations(state.doc, this.storage.highlights),
          apply: (tr, decorationSet, _oldState, newState) => {
            const meta = tr.getMeta(duplicateHighlightPluginKey) as
              | { highlights?: DuplicateHighlight[] }
              | undefined;

            if (meta?.highlights) {
              return buildDecorations(newState.doc, meta.highlights);
            }

            return decorationSet.map(tr.mapping, tr.doc);
          }
        },
        props: {
          decorations(state) {
            return duplicateHighlightPluginKey.getState(state);
          }
        }
      })
    ];
  }
});

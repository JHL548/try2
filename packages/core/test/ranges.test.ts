import { Schema } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";
import { normalizeRange, normalizeRanges } from "../src/ranges";
import { buildPlainTextPositionMap, mapTextRangeToDocPositions } from "../src/tiptapDuplicateHighlight";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: {
      group: "block",
      content: "text*",
      toDOM: () => ["p", 0],
      parseDOM: [{ tag: "p" }]
    },
    table: {
      group: "block",
      content: "tableRow+",
      toDOM: () => ["table", ["tbody", 0]],
      parseDOM: [{ tag: "table" }]
    },
    tableRow: {
      content: "tableCell+",
      toDOM: () => ["tr", 0],
      parseDOM: [{ tag: "tr" }]
    },
    tableCell: {
      content: "paragraph+",
      toDOM: () => ["td", 0],
      parseDOM: [{ tag: "td" }]
    },
    text: { group: "inline" }
  }
});

describe("range normalization", () => {
  it("normalizes reversed ranges and drops empty or invalid ranges", () => {
    expect(normalizeRange({ start: 8, end: 3 })).toEqual({ start: 3, end: 8 });
    expect(normalizeRange({ start: 4, end: 4 })).toBeNull();
    expect(normalizeRange({ start: Number.NaN, end: 8 })).toBeNull();
  });

  it("sorts normalized ranges by start and end", () => {
    expect(
      normalizeRanges([
        { start: 10, end: 12 },
        { start: 3, end: 8 },
        { start: 3, end: 5 }
      ])
    ).toEqual([
      { start: 3, end: 5 },
      { start: 3, end: 8 },
      { start: 10, end: 12 }
    ]);
  });
});

describe("plain text position mapping", () => {
  it("keeps the synthetic newline offset between block nodes", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("Hello")),
      schema.node("paragraph", null, schema.text("World"))
    ]);

    const positions = buildPlainTextPositionMap(doc);

    expect(positions).toEqual([1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12]);
    expect(mapTextRangeToDocPositions(positions, { start: 6, end: 11 })).toEqual({ from: 8, to: 13 });
  });

  it("returns null when a range cannot be mapped into the current document", () => {
    const doc = schema.node("doc", null, [schema.node("paragraph", null, schema.text("Short"))]);
    const positions = buildPlainTextPositionMap(doc);

    expect(mapTextRangeToDocPositions(positions, { start: 99, end: 120 })).toBeNull();
  });

  it("maps ranges inside nested table-like blocks", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("概述")),
      schema.node("table", null, [
        schema.node("tableRow", null, [
          schema.node("tableCell", null, [schema.node("paragraph", null, schema.text("投标"))]),
          schema.node("tableCell", null, [schema.node("paragraph", null, schema.text("报价"))])
        ])
      ])
    ]);

    const positions = buildPlainTextPositionMap(doc);
    const mappedTableRange = mapTextRangeToDocPositions(positions, { start: 3, end: 5 });

    expect(positions).toHaveLength("概述\n投标报价".length);
    expect(mappedTableRange).not.toBeNull();
    expect(mappedTableRange?.to).toBeGreaterThan(mappedTableRange?.from ?? 0);
  });

  it("keeps later block offsets stable for Chinese punctuation", () => {
    const doc = schema.node("doc", null, [
      schema.node("paragraph", null, schema.text("第一章：资格审查。")),
      schema.node("paragraph", null, schema.text("投标人须提供资质证书。")),
      schema.node("paragraph", null, schema.text("结束"))
    ]);

    const positions = buildPlainTextPositionMap(doc);

    expect(positions).toHaveLength("第一章：资格审查。\n投标人须提供资质证书。\n结束".length);
    expect(mapTextRangeToDocPositions(positions, { start: 10, end: 21 })).not.toBeNull();
  });
});

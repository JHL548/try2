export type DocumentRole = "main" | "slave";
export type DocumentRegion = "body" | "header" | "footer" | "table" | "caption" | "unknown";
export type DuplicateSeverity = "noise" | "low" | "medium" | "high";
export type TenderSemanticType =
  | "qualification"
  | "priceTable"
  | "deviationTable"
  | "personnel"
  | "performance"
  | "schedule"
  | "technical"
  | "business"
  | "projectInfo"
  | "unknown";

export interface TableCellContext {
  tableId: string;
  rowIndex: number;
  cellIndex: number;
  headerText?: string;
  rowHeaderText?: string;
}

export interface TextRange {
  start: number;
  end: number;
  matchedText?: string;
  blockId?: string;
  sectionPath?: string[];
  region?: DocumentRegion;
  tableContext?: TableCellContext;
  confidence?: number;
  semanticType?: TenderSemanticType;
}

export interface RangeMapEntry {
  blockId: string;
  textStart: number;
  textEnd: number;
  selector?: string;
  sectionPath?: string[];
  region?: DocumentRegion;
  listMarker?: string;
  tableContext?: TableCellContext;
  semanticType?: TenderSemanticType;
}

export interface DocumentAsset {
  id: string;
  url: string;
  type: "image" | "font" | "other";
}

export interface NormalizedDocument {
  documentId: string;
  role: DocumentRole;
  fileName: string;
  html: string;
  plainText: string;
  rangeMap: RangeMapEntry[];
  assets?: DocumentAsset[];
  meta?: Record<string, unknown>;
}

export interface DuplicateHighlight {
  duplicateId: string;
  documentId: string;
  similarity: number;
  ranges: TextRange[];
  active?: boolean;
  label?: string;
  reason?: string;
  ignored?: boolean;
  severity?: DuplicateSeverity;
  sectionPath?: string[];
  region?: DocumentRegion;
  semanticType?: TenderSemanticType;
  noiseReason?: string;
  tableContext?: TableCellContext;
}

export interface DuplicatePoint {
  duplicateId: string;
  groupId?: string;
  similarity: number;
  label?: string;
  summary?: string;
  reason?: string;
  ignored?: boolean;
  severity?: DuplicateSeverity;
  semanticType?: TenderSemanticType;
  region?: DocumentRegion;
  noiseReason?: string;
  main: {
    documentId: string;
    ranges: TextRange[];
  };
  slaves: Array<{
    documentId: string;
    ranges: TextRange[];
  }>;
}

export interface EditorChangePayload {
  documentId: string;
  html: string;
  plainText: string;
  json?: unknown;
}

export interface DocumentSelectionChangePayload {
  documentId: string;
  selectedText: string;
  from: number;
  to: number;
  empty: boolean;
  plainTextOffset: { start: number; end: number } | null;
  selectedRange: TextRange | null;
}

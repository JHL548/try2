import DuplicateDocumentEditor from "./DuplicateDocumentEditor.vue";
import type { EditorChangePayload } from "@jhl548/duplicate-doc-core";

export { DuplicateDocumentEditor };
export interface DuplicateDocumentEditorRef {
  getSnapshot: () => EditorChangePayload;
  getHTML: () => string;
  getPlainText: () => string;
  focus: () => void;
}
export * from "@jhl548/duplicate-doc-core";

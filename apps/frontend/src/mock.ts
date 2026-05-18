import type { AnalyzeResponse, ProjectDemoViewData } from "./api/documents";
import type { DocumentRole, NormalizedDocument, RangeMapEntry } from "@jhl548/duplicate-doc-vue";

interface Block {
  id: string;
  tag?: "h1" | "h2" | "p";
  text: string;
}

function buildDocument(documentId: string, role: DocumentRole, fileName: string, blocks: Block[]): NormalizedDocument {
  let cursor = 0;
  const plainParts: string[] = [];
  const rangeMap: RangeMapEntry[] = [];

  const html = blocks
    .map((block, index) => {
      if (index > 0) {
        plainParts.push("\n");
        cursor += 1;
      }

      const start = cursor;
      plainParts.push(block.text);
      cursor += block.text.length;

      rangeMap.push({
        blockId: block.id,
        textStart: start,
        textEnd: cursor,
        selector: `[data-dupdoc-block="${block.id}"]`,
        region: "body",
        semanticType: "technical"
      });

      const tag = block.tag ?? "p";
      return `<${tag} data-dupdoc-block="${block.id}">${block.text}</${tag}>`;
    })
    .join("\n");

  return {
    documentId,
    role,
    fileName,
    html,
    plainText: plainParts.join(""),
    rangeMap,
    meta: { source: "mock" }
  };
}

function rangeOf(documentModel: NormalizedDocument, blockId: string) {
  const blockRange = documentModel.rangeMap.find((item) => item.blockId === blockId);

  if (!blockRange) {
    return { start: 0, end: 0, blockId };
  }

  return {
    start: blockRange.textStart,
    end: blockRange.textEnd,
    blockId,
    region: blockRange.region,
    semanticType: blockRange.semanticType
  };
}

const repeatedText = "The implementation plan uses an AI assisted document workflow with unified data contracts.";

const mainDocument = buildDocument("main-demo", "main", "main-demo.docx", [
  { id: "m-title", tag: "h1", text: "Main Tender Document" },
  { id: "m-intro", text: "This mock document is used to verify the editor, highlight, and scroll behavior." },
  { id: "m-duplicate", text: repeatedText },
  { id: "m-summary", text: "The edited HTML and plain text can be submitted back to the backend service." }
]);

const slaveDocument = buildDocument("slave-a", "slave", "slave-a.docx", [
  { id: "s-title", tag: "h2", text: "Technical Response" },
  { id: "s-duplicate", text: repeatedText },
  { id: "s-extra", text: "The slave document lets the demo switch related files for the active duplicate point." }
]);

const mockAnalyzeResponse: AnalyzeResponse = {
  mainDocumentId: mainDocument.documentId,
  documents: [mainDocument, slaveDocument],
  duplicates: [
    {
      duplicateId: "dup-1",
      groupId: "group-1",
      similarity: 0.93,
      label: "No.1",
      summary: repeatedText,
      reason: "The same implementation plan appears in both documents.",
      severity: "high",
      semanticType: "technical",
      region: "body",
      main: {
        documentId: mainDocument.documentId,
        ranges: [rangeOf(mainDocument, "m-duplicate")]
      },
      slaves: [
        {
          documentId: slaveDocument.documentId,
          ranges: [rangeOf(slaveDocument, "s-duplicate")]
        }
      ]
    }
  ]
};

export const mockProjectViewData: ProjectDemoViewData = {
  project: {
    projectId: "project-demo",
    name: "Built-in Mock Duplicate Project",
    mainDocumentId: mockAnalyzeResponse.mainDocumentId
  },
  ...mockAnalyzeResponse,
  activeDefaults: {
    duplicateId: mockAnalyzeResponse.duplicates[0]?.duplicateId ?? null,
    slaveDocumentId: mockAnalyzeResponse.duplicates[0]?.slaves[0]?.documentId ?? null
  },
  stats: {
    documentTotal: mockAnalyzeResponse.documents.length,
    duplicateTotal: mockAnalyzeResponse.duplicates.length,
    rangeMapTotal: mockAnalyzeResponse.documents.reduce((total, documentModel) => total + documentModel.rangeMap.length, 0),
    plainTextTotal: mockAnalyzeResponse.documents.reduce((total, documentModel) => total + documentModel.plainText.length, 0)
  },
  capabilities: {
    supportedFileTypes: ["DOCX", "DOC"],
    supportedContentTypes: ["Heading", "Paragraph", "Duplicate highlight", "Editable snapshot"]
  },
  actions: {
    analyze: {
      method: "POST",
      url: "/api/projects/analyze-view",
      description: "Upload one main document and one or more slave documents."
    },
    exportDocx: {
      method: "POST",
      url: "/api/documents/export-docx",
      description: "Export the edited HTML as DOCX."
    },
    editSnapshot: {
      method: "POST",
      url: "/api/documents/edit-snapshot",
      description: "Submit the current editor snapshot."
    }
  }
};

import type { DuplicatePoint, NormalizedDocument } from "@jhl548/duplicate-doc-vue";
import type { EditorChangePayload } from "@jhl548/duplicate-doc-vue";

export interface AnalyzeResponse {
  mainDocumentId: string;
  documents: NormalizedDocument[];
  duplicates: DuplicatePoint[];
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  meta?: {
    traceId?: string;
    timestamp?: string;
  };
}

export interface ProjectDemoViewData extends AnalyzeResponse {
  project: {
    projectId: string;
    name: string;
    mainDocumentId: string;
  };
  activeDefaults: {
    duplicateId?: string | null;
    slaveDocumentId?: string | null;
  };
  stats: {
    documentTotal: number;
    duplicateTotal: number;
    rangeMapTotal: number;
    plainTextTotal: number;
  };
  capabilities: {
    supportedFileTypes: string[];
    supportedContentTypes: string[];
  };
  actions: Record<
    string,
    {
      method: string;
      url: string;
      description: string;
    }
  >;
}

export interface EditSnapshotRequest extends EditorChangePayload {
  fileName: string;
}

export interface EditSnapshotResponse {
  documentId: string;
  fileName: string;
  htmlLength: number;
  plainTextLength: number;
  accepted: boolean;
}

export async function analyzeDocuments(mainFile: File, slaveFiles: File[]): Promise<ProjectDemoViewData> {
  const formData = new FormData();
  formData.append("main_file", mainFile);
  for (const file of slaveFiles) {
    formData.append("slave_files", file);
  }

  const response = await fetch("/api/projects/analyze-view", {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const result = (await response.json()) as ApiResponse<ProjectDemoViewData>;
  if (result.code !== 0) {
    throw new Error(result.message || "分析失败");
  }

  return result.data;
}

export async function exportDocx(documentId: string, fileName: string, html: string): Promise<void> {
  const response = await fetch("/api/documents/export-docx", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ documentId, fileName, html })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = fileName.endsWith(".docx") ? fileName : `${fileName}.docx`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function submitEditedSnapshot(payload: EditSnapshotRequest): Promise<EditSnapshotResponse> {
  const response = await fetch("/api/documents/edit-snapshot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<EditSnapshotResponse>;
}

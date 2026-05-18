<script setup lang="ts">
import {
  DuplicateDocumentEditor,
  type DuplicateHighlight,
  type DuplicatePoint,
  type EditorChangePayload,
  type NormalizedDocument
} from "@jhl548/duplicate-doc-vue";
import VueJsonPretty from "vue-json-pretty";
import "vue-json-pretty/lib/styles.css";
import { computed, ref, watch } from "vue";
import { analyzeDocuments, exportDocx, submitEditedSnapshot, type ProjectDemoViewData } from "./api/documents";
import { mockProjectViewData } from "./mock";

const projectView = ref<ProjectDemoViewData>(mockProjectViewData);
const activeDuplicateId = ref(projectView.value.activeDefaults.duplicateId ?? "");
const activeSlaveDocumentId = ref(projectView.value.activeDefaults.slaveDocumentId ?? "");
const editedHtmlByDocumentId = ref<Record<string, string>>({});
const loading = ref(false);
const exportingDocumentId = ref("");
const submittingDocumentId = ref("");
const message = ref("当前使用单接口结构化 Mock 数据，可上传 Word 文档验证后端转换链路。");
const messageTone = ref<"info" | "success" | "error">("info");
const mainEditorRef = ref<EditorSnapshotReader | null>(null);
const slaveEditorRef = ref<EditorSnapshotReader | null>(null);
const semanticTypeLabels: Record<string, string> = {
  qualification: "资格审查",
  priceTable: "报价表",
  deviationTable: "偏离表",
  personnel: "人员配置",
  performance: "类似业绩",
  schedule: "进度计划",
  technical: "技术部分",
  business: "商务部分",
  projectInfo: "项目信息",
  unknown: "未知类型"
};
const regionLabels: Record<string, string> = {
  body: "正文",
  header: "页眉",
  footer: "页脚",
  table: "表格",
  caption: "题注",
  unknown: "未知区域"
};
const severityLabels: Record<string, string> = {
  noise: "建议忽略",
  low: "低风险",
  medium: "中风险",
  high: "高风险"
};

interface EditorSnapshotReader {
  getSnapshot: () => EditorChangePayload;
}

const project = computed(() => projectView.value);
const supportedFileTypes = computed(() => projectView.value.capabilities.supportedFileTypes);
const supportedContentTypes = computed(() => projectView.value.capabilities.supportedContentTypes);
const projectStats = computed(() => projectView.value.stats);

const mainDocument = computed(() =>
  project.value.documents.find((document) => document.documentId === project.value.mainDocumentId)
);

const slaveDocuments = computed(() =>
  project.value.documents.filter((document) => document.role === "slave")
);

const activeDuplicate = computed(() =>
  project.value.duplicates.find((duplicate) => duplicate.duplicateId === activeDuplicateId.value)
);

const relatedSlaveDocuments = computed(() => {
  const duplicate = activeDuplicate.value;
  if (!duplicate) {
    return slaveDocuments.value;
  }

  const ids = new Set(duplicate.slaves.map((item) => item.documentId));
  return slaveDocuments.value.filter((document) => ids.has(document.documentId));
});

const activeSlaveDocument = computed(() =>
  project.value.documents.find((document) => document.documentId === activeSlaveDocumentId.value)
);

const mainDocumentForEditor = computed(() => withEditedHtml(mainDocument.value));
const slaveDocumentForEditor = computed(() => withEditedHtml(activeSlaveDocument.value));
const exchangeContractSnapshot = computed(() => ({
  pageDataRequest: {
    method: "POST",
    url: projectView.value.actions.analyze?.url ?? "/api/projects/analyze-view",
    contentType: "multipart/form-data",
    description: projectView.value.actions.analyze?.description,
    fields: {
      main_file: "File(doc/docx)",
      slave_files: "File[](doc/docx)"
    }
  },
  singleStructuredResponse: {
    project: project.value.project,
    mainDocumentId: project.value.mainDocumentId,
    documents: project.value.documents.map(summarizeDocumentForJson),
    duplicates: project.value.duplicates,
    activeDefaults: project.value.activeDefaults,
    stats: project.value.stats,
    capabilities: project.value.capabilities,
    actions: project.value.actions
  },
  currentPluginInput: {
    mainEditor: {
      documentModel: mainDocumentForEditor.value ? summarizeDocumentForJson(mainDocumentForEditor.value) : null,
      highlights: mainHighlights.value
    },
    slaveEditor: {
      documentModel: slaveDocumentForEditor.value ? summarizeDocumentForJson(slaveDocumentForEditor.value) : null,
      highlights: slaveHighlights.value
    }
  },
  exportRequest: {
    method: projectView.value.actions.exportDocx?.method ?? "POST",
    url: projectView.value.actions.exportDocx?.url ?? "/api/documents/export-docx",
    description: projectView.value.actions.exportDocx?.description,
    body: {
      documentId: activeSlaveDocument.value?.documentId ?? mainDocument.value?.documentId ?? "",
      fileName: activeSlaveDocument.value?.fileName ?? mainDocument.value?.fileName ?? "edited-document.docx",
      html: "当前编辑器 HTML 字符串"
    }
  },
  editSnapshotRequest: {
    method: projectView.value.actions.editSnapshot?.method ?? "POST",
    url: projectView.value.actions.editSnapshot?.url ?? "/api/documents/edit-snapshot",
    description: projectView.value.actions.editSnapshot?.description,
    body: {
      documentId: activeSlaveDocument.value?.documentId ?? mainDocument.value?.documentId ?? "",
      fileName: activeSlaveDocument.value?.fileName ?? mainDocument.value?.fileName ?? "edited-document.docx",
      html: "当前编辑器 HTML 字符串",
      plainText: "当前编辑器纯文本",
      json: "当前编辑器 Tiptap JSON"
    }
  }
}));

const mainHighlights = computed<DuplicateHighlight[]>(() => {
  const duplicate = activeDuplicate.value;
  if (!duplicate || !mainDocument.value) {
    return [];
  }

  const firstRange = duplicate.main.ranges[0];
  return [
    {
      duplicateId: duplicate.duplicateId,
      documentId: mainDocument.value.documentId,
      similarity: duplicate.similarity,
      ranges: duplicate.main.ranges,
      active: true,
      label: duplicate.label,
      reason: duplicate.reason,
      ignored: duplicate.ignored,
      severity: duplicate.severity,
      sectionPath: firstRange?.sectionPath,
      region: duplicate.region ?? firstRange?.region,
      semanticType: duplicate.semanticType ?? firstRange?.semanticType,
      noiseReason: duplicate.noiseReason,
      tableContext: firstRange?.tableContext
    }
  ];
});

const slaveHighlights = computed<DuplicateHighlight[]>(() => {
  const duplicate = activeDuplicate.value;
  const slaveDocument = activeSlaveDocument.value;
  if (!duplicate || !slaveDocument) {
    return [];
  }

  const ranges = duplicate.slaves.find((item) => item.documentId === slaveDocument.documentId)?.ranges ?? [];
  const firstRange = ranges[0];
  return [
    {
      duplicateId: duplicate.duplicateId,
      documentId: slaveDocument.documentId,
      similarity: duplicate.similarity,
      ranges,
      active: true,
      label: duplicate.label,
      reason: duplicate.reason,
      ignored: duplicate.ignored,
      severity: duplicate.severity,
      sectionPath: firstRange?.sectionPath,
      region: duplicate.region ?? firstRange?.region,
      semanticType: duplicate.semanticType ?? firstRange?.semanticType,
      noiseReason: duplicate.noiseReason,
      tableContext: firstRange?.tableContext
    }
  ];
});

function getDuplicateSectionPath(duplicate: DuplicatePoint): string {
  return duplicate.main.ranges[0]?.sectionPath?.join(" / ") ?? "";
}

function getDuplicateSemanticLabel(duplicate: DuplicatePoint): string {
  const semanticType = duplicate.semanticType ?? duplicate.main.ranges[0]?.semanticType;
  return semanticType ? semanticTypeLabels[semanticType] ?? semanticType : "";
}

function getDuplicateRegionLabel(duplicate: DuplicatePoint): string {
  const region = duplicate.region ?? duplicate.main.ranges[0]?.region;
  return region ? regionLabels[region] ?? region : "";
}

function getDuplicateTableLabel(duplicate: DuplicatePoint): string {
  const tableContext = duplicate.main.ranges[0]?.tableContext;
  if (!tableContext) {
    return "";
  }

  const header = tableContext.headerText ? ` · ${tableContext.headerText}` : "";
  return `表格 R${tableContext.rowIndex + 1}C${tableContext.cellIndex + 1}${header}`;
}

function summarizeDocumentForJson(documentModel: NormalizedDocument) {
  return {
    documentId: documentModel.documentId,
    role: documentModel.role,
    fileName: documentModel.fileName,
    html: truncateForJson(documentModel.html, 220),
    plainText: truncateForJson(documentModel.plainText, 220),
    rangeMap: documentModel.rangeMap.slice(0, 8),
    rangeMapTotal: documentModel.rangeMap.length,
    assets: documentModel.assets ?? [],
    meta: documentModel.meta ?? {}
  };
}

function truncateForJson(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...（已截断，共 ${value.length} 字符）`;
}

function withEditedHtml(documentModel: NormalizedDocument | undefined): NormalizedDocument | undefined {
  if (!documentModel) {
    return undefined;
  }

  return {
    ...documentModel,
    html: editedHtmlByDocumentId.value[documentModel.documentId] ?? documentModel.html
  };
}

function selectDuplicate(duplicate: DuplicatePoint) {
  activeDuplicateId.value = duplicate.duplicateId;
  activeSlaveDocumentId.value = duplicate.slaves[0]?.documentId ?? activeSlaveDocumentId.value;
}

function handleEditorChange(payload: EditorChangePayload) {
  editedHtmlByDocumentId.value[payload.documentId] = payload.html;
}

function setMessage(nextMessage: string, tone: "info" | "success" | "error" = "info") {
  message.value = nextMessage;
  messageTone.value = tone;
}

async function handleAnalyze(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  const [mainFile, ...slaveFiles] = files;

  if (!mainFile || slaveFiles.length === 0) {
    setMessage("请选择至少 1 个主文档和 1 个从文档；第一个文件会作为主文档。", "error");
    return;
  }

  loading.value = true;
  setMessage("正在上传并验证后端转换与重复点流程...", "info");

  try {
    projectView.value = await analyzeDocuments(mainFile, slaveFiles);
    editedHtmlByDocumentId.value = {};
    activeDuplicateId.value = project.value.activeDefaults.duplicateId ?? "";
    activeSlaveDocumentId.value = project.value.activeDefaults.slaveDocumentId ?? slaveDocuments.value[0]?.documentId ?? "";
    setMessage("后端已返回完整结构化页面数据，转换与模拟 agent 分析完成。", "success");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "分析失败，请确认后端服务已启动。", "error");
  } finally {
    loading.value = false;
    input.value = "";
  }
}

async function exportCurrentDocument(documentModel: NormalizedDocument | undefined) {
  if (!documentModel) {
    return;
  }

  exportingDocumentId.value = documentModel.documentId;
  setMessage(`正在导出 ${documentModel.fileName}...`, "info");
  try {
    const snapshot = getDocumentSnapshot(documentModel);
    await exportDocx(documentModel.documentId, documentModel.fileName, snapshot.html);
    setMessage(`已开始下载 ${documentModel.fileName}。`, "success");
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "导出 DOCX 失败，请确认后端服务已启动。", "error");
  } finally {
    exportingDocumentId.value = "";
  }
}

async function submitCurrentDocument(documentModel: NormalizedDocument | undefined) {
  if (!documentModel) {
    return;
  }

  submittingDocumentId.value = documentModel.documentId;
  setMessage(`正在提交 ${documentModel.fileName} 的编辑快照...`, "info");
  try {
    const snapshot = getDocumentSnapshot(documentModel);
    const result = await submitEditedSnapshot({
      ...snapshot,
      fileName: documentModel.fileName
    });
    setMessage(
      `已提交 ${result.fileName} 的最新编辑快照：HTML ${result.htmlLength} 字符，纯文本 ${result.plainTextLength} 字符。`,
      "success"
    );
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "提交编辑快照失败，请确认后端服务已启动。", "error");
  } finally {
    submittingDocumentId.value = "";
  }
}

function getDocumentSnapshot(documentModel: NormalizedDocument): EditorChangePayload {
  const snapshot = getEditorSnapshot(documentModel.documentId);
  if (snapshot) {
    return snapshot;
  }

  return {
    documentId: documentModel.documentId,
    html: editedHtmlByDocumentId.value[documentModel.documentId] ?? documentModel.html,
    plainText: documentModel.plainText
  };
}

function getEditorSnapshot(documentId: string): EditorChangePayload | null {
  if (documentId === mainDocumentForEditor.value?.documentId) {
    return mainEditorRef.value?.getSnapshot() ?? null;
  }

  if (documentId === slaveDocumentForEditor.value?.documentId) {
    return slaveEditorRef.value?.getSnapshot() ?? null;
  }

  return null;
}

watch(activeDuplicate, (duplicate) => {
  if (!duplicate) {
    return;
  }

  const containsCurrentSlave = duplicate.slaves.some((item) => item.documentId === activeSlaveDocumentId.value);
  if (!containsCurrentSlave) {
    activeSlaveDocumentId.value = duplicate.slaves[0]?.documentId ?? activeSlaveDocumentId.value;
  }
});
</script>

<template>
  <main class="app-shell">
    <section class="hero">
      <div>
        <p class="eyebrow">Word 重复点技术验证</p>
        <h1>{{ project.project.name }}</h1>
        <p class="hero__desc">
          单接口返回页面所需结构化数据，前端只负责渲染、主从文档交互、插件高亮定位和编辑回写。
        </p>
        <div class="capability-tags" aria-label="当前 Demo 支持能力">
          <span v-for="item in supportedFileTypes" :key="item">输入 {{ item }}</span>
          <span v-for="item in supportedContentTypes" :key="item">结构 {{ item }}</span>
        </div>
      </div>

      <label class="upload-card">
        <input type="file" multiple accept=".doc,.docx" :disabled="loading" @change="handleAnalyze" />
        <span>{{ loading ? "处理中..." : "上传主文档和从文档" }}</span>
        <small>仅支持 DOCX / DOC，第一个文件作为主文档</small>
      </label>
    </section>

    <p class="message" :class="`message--${messageTone}`">{{ message }}</p>

    <section class="project-stats" aria-label="当前查重项目统计">
      <span>文档 {{ projectStats.documentTotal }} 个</span>
      <span>重复点 {{ projectStats.duplicateTotal }} 个</span>
      <span>结构块 {{ projectStats.rangeMapTotal }} 个</span>
      <span>纯文本 {{ projectStats.plainTextTotal }} 字</span>
    </section>

    <section class="duplicate-strip">
      <button
        v-for="duplicate in project.duplicates"
        :key="duplicate.duplicateId"
        class="duplicate-chip"
        :class="{ 'duplicate-chip--active': duplicate.duplicateId === activeDuplicateId }"
        type="button"
        @click="selectDuplicate(duplicate)"
      >
        <span>{{ duplicate.label ?? duplicate.duplicateId }}</span>
        <strong>{{ Math.round(duplicate.similarity * 100) }}%</strong>
        <small>{{ duplicate.summary }}</small>
        <div class="duplicate-chip__meta">
          <em v-if="duplicate.severity" :class="`duplicate-chip__severity duplicate-chip__severity--${duplicate.severity}`">
            {{ severityLabels[duplicate.severity] ?? duplicate.severity }}
          </em>
          <em v-if="getDuplicateSemanticLabel(duplicate)">{{ getDuplicateSemanticLabel(duplicate) }}</em>
          <em v-if="getDuplicateRegionLabel(duplicate)">{{ getDuplicateRegionLabel(duplicate) }}</em>
          <em v-if="getDuplicateTableLabel(duplicate)">{{ getDuplicateTableLabel(duplicate) }}</em>
          <em v-if="duplicate.ignored" class="duplicate-chip__meta-warning">建议忽略</em>
        </div>
        <small v-if="getDuplicateSectionPath(duplicate)" class="duplicate-chip__section">
          {{ getDuplicateSectionPath(duplicate) }}
        </small>
        <small v-if="duplicate.noiseReason" class="duplicate-chip__noise">
          {{ duplicate.noiseReason }}
        </small>
      </button>
    </section>

    <section class="workspace-grid">
      <article class="document-panel document-panel--main">
        <header>
          <div>
            <span>主文档</span>
            <h2>{{ mainDocument?.fileName }}</h2>
          </div>
          <button type="button" :disabled="exportingDocumentId === mainDocumentForEditor?.documentId" @click="exportCurrentDocument(mainDocumentForEditor)">
            {{ exportingDocumentId === mainDocumentForEditor?.documentId ? "导出中..." : "导出 DOCX" }}
          </button>
          <button type="button" :disabled="submittingDocumentId === mainDocumentForEditor?.documentId" @click="submitCurrentDocument(mainDocumentForEditor)">
            {{ submittingDocumentId === mainDocumentForEditor?.documentId ? "提交中..." : "提交编辑数据" }}
          </button>
        </header>
        <DuplicateDocumentEditor
          v-if="mainDocumentForEditor"
          ref="mainEditorRef"
          :document-model="mainDocumentForEditor"
          :highlights="mainHighlights"
          @change="handleEditorChange"
        />
      </article>

      <article class="document-panel document-panel--slave">
        <header>
          <div>
            <span>从文档 · 当前重复点关联 {{ relatedSlaveDocuments.length }} 个文档</span>
            <h2>{{ activeSlaveDocument?.fileName }}</h2>
          </div>
          <select v-model="activeSlaveDocumentId">
            <option
              v-for="document in relatedSlaveDocuments"
              :key="document.documentId"
              :value="document.documentId"
            >
              {{ document.fileName }}
            </option>
          </select>
          <button type="button" :disabled="exportingDocumentId === slaveDocumentForEditor?.documentId" @click="exportCurrentDocument(slaveDocumentForEditor)">
            {{ exportingDocumentId === slaveDocumentForEditor?.documentId ? "导出中..." : "导出 DOCX" }}
          </button>
          <button type="button" :disabled="submittingDocumentId === slaveDocumentForEditor?.documentId" @click="submitCurrentDocument(slaveDocumentForEditor)">
            {{ submittingDocumentId === slaveDocumentForEditor?.documentId ? "提交中..." : "提交编辑数据" }}
          </button>
        </header>
        <DuplicateDocumentEditor
          v-if="slaveDocumentForEditor"
          ref="slaveEditorRef"
          :document-model="slaveDocumentForEditor"
          :highlights="slaveHighlights"
          @change="handleEditorChange"
        />
      </article>
    </section>

    <section class="json-contract-panel">
      <header>
        <div>
          <span>前后端数据契约</span>
          <h2>接口响应与插件入参结构</h2>
        </div>
        <p>使用 vue-json-pretty 渲染；长文本仅截断展示，不改变真实接口数据。</p>
      </header>
      <VueJsonPretty
        class="json-contract-panel__viewer"
        :data="exchangeContractSnapshot"
        :deep="3"
        :show-length="true"
        :show-line="true"
        :show-line-number="true"
        :show-icon="true"
      />
    </section>
  </main>
</template>

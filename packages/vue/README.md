# @jhl548/duplicate-doc-vue

面向 Vue 3 的 Word 文档重复点编辑与高亮插件。插件只负责单个标准化文档的渲染、编辑、重复点高亮、滚动定位和编辑快照输出；主从文档编排、上传分析、导出回写、权限审批等业务流程由宿主项目处理。

## 安装

```bash
npm install @jhl548/duplicate-doc-vue
```

在应用入口导入样式：

```ts
import { createApp } from "vue";
import App from "./App.vue";
import "@jhl548/duplicate-doc-vue/style.css";

createApp(App).mount("#app");
```

## 基础用法

```vue
<script setup lang="ts">
import {
  DuplicateDocumentEditor,
  type DuplicateHighlight,
  type EditorChangePayload,
  type NormalizedDocument
} from "@jhl548/duplicate-doc-vue";
import { computed, ref } from "vue";

const documentModel = ref<NormalizedDocument>({
  documentId: "main-001",
  role: "main",
  fileName: "main.docx",
  html: '<h1 data-dupdoc-block="b-0">项目计划书</h1><p data-dupdoc-block="b-1">这是一段需要高亮的重复内容。</p>',
  plainText: "项目计划书\n这是一段需要高亮的重复内容。",
  rangeMap: [
    {
      blockId: "b-0",
      textStart: 0,
      textEnd: 5,
      selector: '[data-dupdoc-block="b-0"]'
    },
    {
      blockId: "b-1",
      textStart: 6,
      textEnd: 20,
      selector: '[data-dupdoc-block="b-1"]'
    }
  ]
});

const highlights = computed<DuplicateHighlight[]>(() => [
  {
    duplicateId: "dup-001",
    documentId: "main-001",
    similarity: 0.92,
    active: true,
    label: "重复点 1",
    ranges: [{ start: 6, end: 20, blockId: "b-1" }]
  }
]);

function handleChange(payload: EditorChangePayload) {
  console.log("editor snapshot", payload);
}
</script>

<template>
  <DuplicateDocumentEditor
    :document-model="documentModel"
    :highlights="highlights"
    :editable="true"
    :autofocus-highlight="true"
    @change="handleChange"
  />
</template>
```

## 组件 API

### Props

- `documentModel: NormalizedDocument`：当前编辑器要渲染的标准化文档，必填。
- `highlights?: DuplicateHighlight[]`：当前文档需要展示的重复点高亮，默认为空数组。
- `editable?: boolean`：是否允许编辑，默认为 `true`。
- `autofocusHighlight?: boolean`：高亮变化后是否自动滚动到当前高亮位置，默认为 `true`。

### Events

- `change(payload: EditorChangePayload)`：编辑器内容变化时触发，包含 `documentId`、`html`、`plainText` 和可选 `json`。
- `ready()`：编辑器初始化完成时触发。

### Ref

```ts
interface DuplicateDocumentEditorRef {
  getSnapshot: () => EditorChangePayload;
  getHTML: () => string;
  getPlainText: () => string;
  focus: () => void;
}
```

## 数据结构约定

后端或宿主应用需要把 Word 文档转换为插件可消费的标准模型：

```ts
interface NormalizedDocument {
  documentId: string;
  role: "main" | "slave";
  fileName: string;
  html: string;
  plainText: string;
  rangeMap: RangeMapEntry[];
  assets?: DocumentAsset[];
  meta?: Record<string, unknown>;
}
```

关键要求：

- `html` 应是 Tiptap 可解析的标准 HTML。
- 建议为每个块级节点添加稳定的 `data-dupdoc-block`。
- `plainText` 必须与算法计算重复点范围时使用的文本一致。
- `rangeMap` 负责把结构块和纯文本偏移关联起来，便于联调和问题排查。
- `DuplicateHighlight.ranges[].start/end` 使用基于 `plainText` 的左闭右开区间。

## Word 转 HTML 建议

推荐后端优先使用 LibreOffice headless 转换 Word。没有 LibreOffice 时，可以对 `.docx` 使用 `python-docx` 做基础文本兜底，但复杂样式、表格、图片可能丢失。

推荐转换流程：

1. 将 Word 转为 HTML。
2. 清理 Word 导出的无关样式壳。
3. 按 `h1`、`h2`、`p`、`table`、`ul`、`ol`、`blockquote` 等块级结构生成稳定 `blockId`。
4. 为 HTML 节点补充 `data-dupdoc-block`。
5. 同步生成 `plainText` 和 `rangeMap`。
6. 将查重结果转换为 `DuplicatePoint[]` 或当前编辑器需要的 `DuplicateHighlight[]`。

## 高亮定位规则

高亮是否准确主要取决于三件事：

- 后端 `plainText` 的生成规则。
- 后端 `DuplicatePoint.ranges[].start/end` 的计算规则。
- 前端 Tiptap 文档中实际文本的顺序。

建议统一以下规则：

- 每个块级节点之间使用一个 `\n` 拼接。
- 块内文本按视觉阅读顺序提取。
- 表格按行、列顺序提取单元格文本。
- 空块尽量不参与 `plainText`，除非业务需要保留。
- `start/end` 使用 JavaScript 字符串下标语义，也就是 UTF-16 code unit 偏移。

如果后端使用 Python 计算偏移，需要注意 emoji、生僻字和组合字符可能造成 Python 字符下标与浏览器 UTF-16 下标不一致。业务文档可能包含这类字符时，建议统一使用 UTF-16 code unit 规则计算偏移，或增加前后端契约测试。

## 样式和子路径

插件样式通过子路径导出：

```ts
import "@jhl548/duplicate-doc-vue/style.css";
```

如果宿主项目存在全局 CSS reset 或 scoped 样式覆盖，请检查 `.dupdoc-editor`、`.dupdoc-editor__toolbar`、`.dupdoc-highlight` 等 class 是否被覆盖。

## 发布前校验

本包发布前应在仓库根目录执行：

```bash
npm run verify:publish
```

该命令会执行编码检查、类型检查、构建和 `npm pack --dry-run`。编码检查会拦截替换字符、常见中文错码片段和 Latin-1 错码片段，避免乱码 README 或源码被再次发布到 npm。

发布到 npm 后再执行：

```bash
npm run verify:npm
```

该命令会从 npm registry 拉取最新包，并让 demo 以 npm 模式完成类型检查和构建，避免 Vite alias 或 TypeScript paths 回退到本地源码。

## 联调检查清单

- 应用入口已导入 `@jhl548/duplicate-doc-vue/style.css`。
- `documentModel.documentId` 与 `highlights[].documentId` 一致。
- `TextRange.start/end` 不越界。
- `rangeMap.textStart/textEnd` 与 `plainText` 对齐。
- 后端块级换行规则与插件映射规则一致。
- 表格、列表、标题、图片在 HTML 中仍是 Tiptap 可解析结构。
- 编辑器 `change` 事件能返回最新 `html` 和 `plainText`。
- 导出 DOCX 时后端能接受前端回传的 HTML。

## 常见问题

### 高亮位置偏移怎么办？

优先检查后端 `plainText` 是否和插件渲染后的文本顺序一致。常见原因包括表格单元格分隔符、列表项换行、空段落、HTML 实体、Word 导出冗余节点导致偏移不一致。

### 能否只传 HTML？

不建议。插件可以只用 HTML 渲染编辑器，但重复点高亮依赖 `plainText` 偏移和后端算法输出。缺少 `plainText` 和 `rangeMap` 会让联调和问题排查变得困难。

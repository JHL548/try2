# 后端与 Agent 数据契约说明

本文档用于说明当前 Demo 中「Word 转换规则」与「重复点定位高亮」的协作方式，方便后端服务和 agent 侧按统一结构输出数据。

## 1. 整体链路

当前系统链路如下：

```text
Word 文件
  -> 后端转换为 HTML
  -> 后端生成 NormalizedDocument
  -> Agent 基于 plainText / rangeMap 生成 DuplicatePoint
  -> 前端将 DuplicatePoint 转为 DuplicateHighlight
  -> Tiptap 插件根据 start/end 高亮并滚动定位
```

后端负责把上传文档转换成统一文档模型 `NormalizedDocument`。Agent 负责基于这些文档模型生成重复点 `DuplicatePoint`。前端插件不直接理解 Word，只消费 HTML、纯文本偏移和重复点 ranges。

## 2. 转换规则

### 2.1 Word 到 HTML

当前 Demo 优先使用 LibreOffice：

```bash
soffice --headless --convert-to html input.docx
```

如果本机没有 LibreOffice，并且输入是 `.docx`，则使用 `python-docx` 做兜底转换。兜底模式只保留段落纯文本，格式损失较大。

### 2.2 HTML 标准化

后端拿到 HTML 后，会抽取可定位的块级节点，并生成统一结构：

- `html`：给前端编辑器渲染的 HTML。
- `plainText`：给 agent 做查重和偏移计算的纯文本。
- `rangeMap`：记录每个文档块在 `plainText` 中的起止位置。
- `data-dupdoc-block`：写入 HTML 的块 ID，用于调试和定位。
- `sectionPath`：根据标题或章节文本推断的章节路径。
- `region`：内容区域，例如 `body`、`table`、`header`、`footer`。
- `semanticType`：语义类型，例如 `technical`、`priceTable`、`projectInfo`。
- `tableContext`：表格单元格上下文。

块级节点之间在 `plainText` 中使用 `\n` 拼接。因此 `rangeMap.textStart/textEnd` 和 agent 输出的 `ranges.start/end` 都必须基于同一份 `plainText` 计算。

## 3. 后端输出：NormalizedDocument

每个文档必须输出一个 `NormalizedDocument`：

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

其中 `rangeMap` 的结构是：

```ts
interface RangeMapEntry {
  blockId: string;
  textStart: number;
  textEnd: number;
  selector?: string;
  sectionPath?: string[];
  region?: "body" | "header" | "footer" | "table" | "caption" | "unknown";
  listMarker?: string;
  tableContext?: TableCellContext;
  semanticType?: TenderSemanticType;
}
```

关键约定：

- `textStart` 包含当前字符。
- `textEnd` 不包含当前字符，即 `[textStart, textEnd)`。
- `textStart/textEnd` 必须基于 `plainText` 下标。
- `plainText` 使用 JavaScript/TypeScript 字符串下标语义，普通中文字符按 1 个长度计算。
- 多个块之间的换行符 `\n` 也占 1 个字符位置。
- `selector` 推荐使用 `[data-dupdoc-block="xxx"]`。

## 4. Agent 输出：DuplicatePoint

Agent 应输出重复点数组 `duplicates: DuplicatePoint[]`：

```ts
interface DuplicatePoint {
  duplicateId: string;
  groupId?: string;
  similarity: number;
  label?: string;
  summary?: string;
  reason?: string;
  ignored?: boolean;
  severity?: "noise" | "low" | "medium" | "high";
  semanticType?: TenderSemanticType;
  region?: "body" | "header" | "footer" | "table" | "caption" | "unknown";
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
```

其中 `TextRange` 的结构是：

```ts
interface TextRange {
  start: number;
  end: number;
  blockId?: string;
  sectionPath?: string[];
  region?: DocumentRegion;
  tableContext?: TableCellContext;
  confidence?: number;
  semanticType?: TenderSemanticType;
}
```

关键约定：

- `start/end` 必须基于对应文档的 `plainText`。
- `start` 包含，`end` 不包含，即 `[start, end)`。
- 一个重复点可以在主文档和多个从文档中出现。
- 一个文档内同一个重复点可以有多个 `ranges`，用于表示跨多个片段的重复内容。
- `blockId/sectionPath/region/tableContext/semanticType` 建议从 `rangeMap` 中按 `start` 所在块补齐。
- `similarity` 范围为 `0` 到 `1`。
- `ignored = true` 表示该重复点默认被视为噪声，但前端仍可展示和高亮。

## 5. 前端插件如何使用这些数据

前端不会把完整 `DuplicatePoint` 直接传给插件，而是会根据当前选中的重复点和文档，转换成 `DuplicateHighlight[]`：

```ts
interface DuplicateHighlight {
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
```

插件内部会：

1. 读取当前 Tiptap 文档。
2. 构造编辑器文档的纯文本位置映射。
3. 将 `ranges.start/end` 映射为 ProseMirror 文档位置。
4. 生成 inline decoration。
5. 根据 `similarity` 添加高亮等级 class。
6. 根据 `active` 自动滚动到当前重复点。

高亮颜色等级：

- `similarity >= 0.85`：高风险。
- `0.65 <= similarity < 0.85`：中风险。
- `similarity < 0.65`：低风险。

## 6. 完整示例数据

以下示例模拟 `/api/projects/analyze-view` 返回值。

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "project": {
      "projectId": "project-demo-001",
      "name": "上传文档查重分析",
      "mainDocumentId": "main-doc-001"
    },
    "mainDocumentId": "main-doc-001",
    "documents": [
      {
        "documentId": "main-doc-001",
        "role": "main",
        "fileName": "主文档.docx",
        "html": "<h1 data-dupdoc-block=\"m-title\">项目计划书</h1>\n<p data-dupdoc-block=\"m-dup-1\">我们将采用增强人工智能在各个领域的应用，越来越广泛，并通过统一的数据契约保障文档处理流程稳定。</p>\n<table data-dupdoc-block=\"m-price-table\" data-dupdoc-table=\"main-price-table\"><tbody><tr><th>报价项</th><th>金额</th></tr><tr><td>软件平台</td><td>120000</td></tr></tbody></table>",
        "plainText": "项目计划书\n我们将采用增强人工智能在各个领域的应用，越来越广泛，并通过统一的数据契约保障文档处理流程稳定。\n报价项 金额 软件平台 120000",
        "rangeMap": [
          {
            "blockId": "m-title",
            "textStart": 0,
            "textEnd": 5,
            "selector": "[data-dupdoc-block=\"m-title\"]",
            "sectionPath": ["项目计划书"],
            "region": "body",
            "semanticType": "projectInfo"
          },
          {
            "blockId": "m-dup-1",
            "textStart": 6,
            "textEnd": 57,
            "selector": "[data-dupdoc-block=\"m-dup-1\"]",
            "sectionPath": ["第二章 技术部分", "实施方案"],
            "region": "body",
            "semanticType": "technical"
          },
          {
            "blockId": "m-price-table",
            "textStart": 58,
            "textEnd": 77,
            "selector": "[data-dupdoc-block=\"m-price-table\"]",
            "sectionPath": ["第三章 报价部分", "报价明细表"],
            "region": "table",
            "semanticType": "priceTable",
            "tableContext": {
              "tableId": "main-price-table",
              "rowIndex": 1,
              "cellIndex": 0,
              "headerText": "报价项"
            }
          }
        ],
        "assets": [],
        "meta": {
          "sourceFileName": "主文档.docx",
          "converter": "libreoffice-or-python-fallback",
          "formatLossExpected": true
        }
      },
      {
        "documentId": "slave-doc-a",
        "role": "slave",
        "fileName": "从文档A.docx",
        "html": "<h1 data-dupdoc-block=\"s-title\">技术响应文件</h1>\n<p data-dupdoc-block=\"s-dup-1\">我们将采用增强人工智能在各个领域的应用，越来越广泛，并通过统一的数据契约保障文档处理流程稳定。</p>\n<table data-dupdoc-block=\"s-price-table\" data-dupdoc-table=\"slave-price-table\"><tbody><tr><th>报价项</th><th>金额</th></tr><tr><td>软件平台</td><td>120000</td></tr></tbody></table>",
        "plainText": "技术响应文件\n我们将采用增强人工智能在各个领域的应用，越来越广泛，并通过统一的数据契约保障文档处理流程稳定。\n报价项 金额 软件平台 120000",
        "rangeMap": [
          {
            "blockId": "s-title",
            "textStart": 0,
            "textEnd": 6,
            "selector": "[data-dupdoc-block=\"s-title\"]",
            "sectionPath": ["技术响应文件"],
            "region": "body",
            "semanticType": "technical"
          },
          {
            "blockId": "s-dup-1",
            "textStart": 7,
            "textEnd": 58,
            "selector": "[data-dupdoc-block=\"s-dup-1\"]",
            "sectionPath": ["技术响应文件", "实施方案"],
            "region": "body",
            "semanticType": "technical"
          },
          {
            "blockId": "s-price-table",
            "textStart": 59,
            "textEnd": 78,
            "selector": "[data-dupdoc-block=\"s-price-table\"]",
            "sectionPath": ["报价文件", "报价明细表"],
            "region": "table",
            "semanticType": "priceTable",
            "tableContext": {
              "tableId": "slave-price-table",
              "rowIndex": 1,
              "cellIndex": 0,
              "headerText": "报价项"
            }
          }
        ],
        "assets": [],
        "meta": {
          "sourceFileName": "从文档A.docx",
          "converter": "libreoffice-or-python-fallback",
          "formatLossExpected": true
        }
      }
    ],
    "duplicates": [
      {
        "duplicateId": "dup-technical-001",
        "groupId": "group-technical-001",
        "similarity": 0.93,
        "label": "No.1",
        "summary": "我们将采用增强人工智能在各个领域的应用，越来越广泛，并通过统一的数据契约保障文档处理流程稳定。",
        "reason": "主文档与从文档 A 的实施方案描述高度相似。",
        "ignored": false,
        "severity": "high",
        "semanticType": "technical",
        "region": "body",
        "main": {
          "documentId": "main-doc-001",
          "ranges": [
            {
              "start": 6,
              "end": 57,
              "blockId": "m-dup-1",
              "sectionPath": ["第二章 技术部分", "实施方案"],
              "region": "body",
              "confidence": 0.96,
              "semanticType": "technical"
            }
          ]
        },
        "slaves": [
          {
            "documentId": "slave-doc-a",
            "ranges": [
              {
                "start": 7,
                "end": 58,
                "blockId": "s-dup-1",
                "sectionPath": ["技术响应文件", "实施方案"],
                "region": "body",
                "confidence": 0.95,
                "semanticType": "technical"
              }
            ]
          }
        ]
      },
      {
        "duplicateId": "dup-price-001",
        "groupId": "group-price-001",
        "similarity": 0.89,
        "label": "No.2",
        "summary": "报价项 金额 软件平台 120000",
        "reason": "报价表结构和金额相同，需要人工核对是否为模板复用或实质重复。",
        "ignored": false,
        "severity": "high",
        "semanticType": "priceTable",
        "region": "table",
        "main": {
          "documentId": "main-doc-001",
          "ranges": [
            {
              "start": 58,
              "end": 77,
              "blockId": "m-price-table",
              "sectionPath": ["第三章 报价部分", "报价明细表"],
              "region": "table",
              "confidence": 0.91,
              "semanticType": "priceTable",
              "tableContext": {
                "tableId": "main-price-table",
                "rowIndex": 1,
                "cellIndex": 0,
                "headerText": "报价项"
              }
            }
          ]
        },
        "slaves": [
          {
            "documentId": "slave-doc-a",
            "ranges": [
              {
                "start": 59,
                "end": 78,
                "blockId": "s-price-table",
                "sectionPath": ["报价文件", "报价明细表"],
                "region": "table",
                "confidence": 0.9,
                "semanticType": "priceTable",
                "tableContext": {
                  "tableId": "slave-price-table",
                  "rowIndex": 1,
                  "cellIndex": 0,
                  "headerText": "报价项"
                }
              }
            ]
          }
        ]
      }
    ],
    "activeDefaults": {
      "duplicateId": "dup-technical-001",
      "slaveDocumentId": "slave-doc-a"
    },
    "stats": {
      "documentTotal": 2,
      "duplicateTotal": 2,
      "rangeMapTotal": 6,
      "plainTextTotal": 156
    },
    "capabilities": {
      "supportedFileTypes": ["DOCX", "DOC"],
      "supportedContentTypes": ["标题层级", "段落", "表格", "图片", "列表", "引用", "代码块"]
    },
    "actions": {
      "analyze": {
        "method": "POST",
        "url": "/api/projects/analyze-view",
        "description": "上传主文档和从文档，返回页面渲染所需的完整结构化数据"
      },
      "exportDocx": {
        "method": "POST",
        "url": "/api/documents/export-docx",
        "description": "将当前编辑器 HTML 导出为 DOCX"
      },
      "editSnapshot": {
        "method": "POST",
        "url": "/api/documents/edit-snapshot",
        "description": "提交当前编辑器 HTML、纯文本和 Tiptap JSON 快照"
      }
    }
  },
  "meta": {
    "traceId": "0e4a6db6-6f0a-4a3d-a739-1a2b3c4d5e6f",
    "timestamp": "2026-05-15T01:20:00.000Z"
  }
}
```

## 7. Offset 计算示例

示例主文档：

```text
项目计划书
我们将采用增强人工智能在各个领域的应用，越来越广泛，并通过统一的数据契约保障文档处理流程稳定。
```

对应下标：

```text
0..4   -> 项目计划书
5      -> \n
6..56  -> 我们将采用增强人工智能...流程稳定。
```

所以重复段的 range 应该是：

```json
{
  "start": 6,
  "end": 57,
  "blockId": "m-dup-1"
}
```

注意 `end` 是开区间，因此最后一个字符的位置是 `end - 1`。

## 8. 对接检查清单

后端侧：

- 确保 `html` 和 `plainText` 来源一致。
- 确保块之间只插入一个 `\n`，并计入偏移。
- 确保每个可定位块都有稳定的 `data-dupdoc-block`。
- 确保 `rangeMap.textStart/textEnd` 与 `plainText` 完全对齐。
- 表格、列表、标题等结构尽量保留在 HTML 中。

Agent 侧：

- 只基于 `documents[].plainText` 计算 `start/end`。
- 不要基于原始 Word、未标准化 HTML 或另一个文本版本计算 offset。
- 输出 `DuplicatePoint.main.documentId` 必须等于主文档 ID。
- 输出 `DuplicatePoint.slaves[].documentId` 必须能在 `documents` 中找到。
- `ranges` 尽量补齐 `blockId/sectionPath/region/semanticType/tableContext`。
- 噪声重复点可保留，但应设置 `ignored: true` 和 `noiseReason`。

前端插件侧：

- 插件消费的是前端转换后的 `DuplicateHighlight[]`。
- 高亮成功的核心前提是 `ranges.start/end` 与当前编辑器文档的纯文本顺序一致。
- 如果用户编辑后文档结构大幅变化，旧 offset 可能不再准确，需要后端或 agent 重新分析。

import type { AnalyzeResponse, ProjectDemoViewData } from "./api/documents";
import type {
  DocumentRegion,
  DocumentRole,
  NormalizedDocument,
  RangeMapEntry,
  TableCellContext,
  TenderSemanticType
} from "@jhl548/duplicate-doc-vue";

interface Block {
  id: string;
  tag?: "h1" | "h2" | "h3" | "p" | "blockquote" | "ul" | "ol";
  text: string;
  html?: string;
  sectionPath?: string[];
  region?: DocumentRegion;
  semanticType?: TenderSemanticType;
  tableContext?: TableCellContext;
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
        sectionPath: block.sectionPath,
        region: block.region ?? "body",
        tableContext: block.tableContext,
        semanticType: block.semanticType ?? "unknown"
      });

      const tag = block.tag ?? "p";
      return `<${tag} data-dupdoc-block="${block.id}">${block.html ?? block.text}</${tag}>`;
    })
    .join("\n");

  return {
    documentId,
    role,
    fileName,
    html,
    plainText: plainParts.join(""),
    rangeMap,
    meta: {
      source: "rich-mock",
      converter: "frontend-built-in",
      note: "用于 npm 包与本地源码 demo 的一致性验证"
    }
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
    matchedText: documentModel.plainText.slice(blockRange.textStart, blockRange.textEnd),
    blockId,
    sectionPath: blockRange.sectionPath,
    region: blockRange.region,
    tableContext: blockRange.tableContext,
    semanticType: blockRange.semanticType,
    confidence: 0.92
  };
}

const sharedTechnicalPlan =
  "本项目采用 AI 辅助文档查重流程，统一上传、解析、范围映射、高亮定位和编辑回传的数据契约，确保主从文档可以在同一页面完成联动核查。";
const sharedQualification =
  "投标人须提供有效营业执照、信息安全管理体系认证证书、近三年类似项目业绩证明，并承诺所提交材料真实、完整、可追溯。";
const sharedSchedule =
  "项目实施周期为合同签订后 60 个自然日内完成系统部署、数据初始化、联调测试、用户培训和最终验收。";
const sharedTableCell = "移动端适配、复杂表格解析、图片资源回写、编辑痕迹保留";
const sharedFooter = "项目名称：智慧文档查重与协同编辑平台，招标编号：ZB-2026-DOC-001";
const sharedDataSecurity =
  "系统应对上传文件、转换中间产物、编辑快照和导出结果进行分级存储，默认启用访问鉴权、操作审计、脱敏展示和过期清理策略。";
const sharedAcceptance =
  "验收阶段需提交部署报告、测试报告、用户培训记录、问题整改清单和最终验收申请，所有材料经双方确认后进入质保期。";
const sharedTraining =
  "培训服务覆盖管理员、业务经办人和审计人员三类角色，内容包括文档上传、重复点复核、从文档切换、忽略原因维护和导出归档。";
const sharedOperation =
  "运维服务提供工作日 8 小时响应、重大故障 2 小时内到场支持、版本升级评估和季度巡检报告，确保系统长期稳定运行。";

const mainChapterBlocks: Block[] = [
  {
    id: "m-background",
    text: "随着项目文件数量增加，传统人工核对方式难以及时识别跨章节、跨附件和跨版本的重复内容，需要通过结构化解析和可视化高亮降低审阅成本。",
    sectionPath: ["第一章 项目概况", "建设背景"],
    region: "body",
    semanticType: "projectInfo"
  },
  {
    id: "m-scope",
    text: "本次建设范围包括文档上传、Word 转 HTML、主从文档编排、重复点定位、在线编辑、编辑快照保存、DOCX 导出和审计记录管理。",
    sectionPath: ["第一章 项目概况", "建设范围"],
    region: "body",
    semanticType: "business"
  },
  {
    id: "m-ui-list",
    tag: "ul",
    text: "支持主文档和从文档并排展示支持重复点列表快速切换支持按风险等级筛选支持忽略原因展示",
    html: "<li>支持主文档和从文档并排展示</li><li>支持重复点列表快速切换</li><li>支持按风险等级筛选</li><li>支持忽略原因展示</li>",
    sectionPath: ["第二章 技术要求", "页面能力"],
    region: "body",
    semanticType: "technical"
  },
  {
    id: "m-security",
    text: sharedDataSecurity,
    html: `系统应对上传文件、转换中间产物、编辑快照和导出结果进行分级存储，默认启用 <strong>访问鉴权</strong>、操作审计、脱敏展示和过期清理策略。`,
    sectionPath: ["第二章 技术要求", "安全要求"],
    region: "body",
    semanticType: "technical"
  },
  {
    id: "m-editor-toolbar",
    text: "编辑器需支持标题、加粗、斜体、删除线、上下标、颜色、高亮、引用、列表、表格、撤销重做和定位当前重复点等常用操作。",
    sectionPath: ["第二章 技术要求", "编辑能力"],
    region: "body",
    semanticType: "technical"
  },
  {
    id: "m-quote",
    tag: "blockquote",
    text: "投标人应充分考虑文档格式损失、表格合并单元格、图片资源引用和浏览器编辑差异带来的交付风险。",
    sectionPath: ["第二章 技术要求", "注意事项"],
    region: "body",
    semanticType: "technical"
  }
];

const mainLaterBlocks: Block[] = [
  {
    id: "m-training",
    text: sharedTraining,
    sectionPath: ["第七章 培训服务"],
    region: "body",
    semanticType: "personnel"
  },
  {
    id: "m-acceptance",
    text: sharedAcceptance,
    sectionPath: ["第八章 验收要求"],
    region: "body",
    semanticType: "business"
  },
  {
    id: "m-operation",
    text: sharedOperation,
    sectionPath: ["第九章 运维服务"],
    region: "body",
    semanticType: "business"
  },
  {
    id: "m-long-tail-1",
    text: "系统上线后应保留不少于十二个月的操作日志，日志内容包括上传人、上传时间、文件摘要、重复点处理动作、导出记录和异常重试信息。",
    sectionPath: ["第十章 审计留痕"],
    region: "body",
    semanticType: "business"
  },
  {
    id: "m-long-tail-2",
    text: "当用户调整重复点状态时，页面应立即反馈当前处理结果，并在结构化数据面板中展示最新的插件入参、编辑快照和接口请求示例。",
    sectionPath: ["第十一章 交互要求"],
    region: "body",
    semanticType: "technical"
  },
  {
    id: "m-long-tail-3",
    text: "若文档包含图片、表格、编号列表或批注痕迹，后端转换服务应尽量保留可编辑语义，并在 meta 字段中标记可能发生格式损失的位置。",
    sectionPath: ["第十二章 转换要求"],
    region: "body",
    semanticType: "technical"
  },
  {
    id: "m-long-tail-4",
    text: "为验证长文档滚动定位，本段故意放在主文档靠后位置。切换重复点时，编辑器应自动滚动到对应高亮范围附近，而不是停留在顶部。",
    sectionPath: ["第十三章 定位验证"],
    region: "body",
    semanticType: "technical"
  }
];

const technicalExtraBlocks: Block[] = [
  {
    id: "s1-architecture",
    text: "技术方案采用前后端分离架构，前端负责编辑器渲染和交互状态，后端负责文档转换、范围映射、查重结果生成和导出任务处理。",
    sectionPath: ["二、系统架构"],
    region: "body",
    semanticType: "technical"
  },
  {
    id: "s1-security",
    text: sharedDataSecurity,
    sectionPath: ["五、安全设计"],
    region: "body",
    semanticType: "technical"
  },
  {
    id: "s1-training",
    text: sharedTraining,
    sectionPath: ["六、培训计划"],
    region: "body",
    semanticType: "personnel"
  },
  {
    id: "s1-long-scroll",
    text: "本段用于拉长技术响应文件内容，方便检查从文档编辑器在不同重复点之间切换时的滚动行为和高亮刷新是否稳定。",
    sectionPath: ["七、滚动测试"],
    region: "body",
    semanticType: "technical"
  }
];

const businessExtraBlocks: Block[] = [
  {
    id: "s2-service",
    text: sharedOperation,
    sectionPath: ["五、售后服务"],
    region: "body",
    semanticType: "business"
  },
  {
    id: "s2-acceptance",
    text: sharedAcceptance,
    sectionPath: ["六、验收承诺"],
    region: "body",
    semanticType: "business"
  },
  {
    id: "s2-payment",
    text: "付款节点建议按合同签订、系统上线、终验通过和质保期结束分阶段设置，供应商应提供等额合法有效发票。",
    sectionPath: ["七、付款条件"],
    region: "body",
    semanticType: "business"
  },
  {
    id: "s2-risk",
    text: "商务响应中应明确项目经理、实施人员、质保联系人和升级投诉渠道，避免交付过程中的责任边界不清。",
    sectionPath: ["八、商务风险"],
    region: "body",
    semanticType: "business"
  }
];

const appendixExtraBlocks: Block[] = [
  {
    id: "s3-training",
    text: sharedTraining,
    sectionPath: ["二、培训安排"],
    region: "body",
    semanticType: "personnel"
  },
  {
    id: "s3-acceptance",
    text: sharedAcceptance,
    sectionPath: ["四、验收材料"],
    region: "body",
    semanticType: "business"
  },
  {
    id: "s3-operation",
    text: sharedOperation,
    sectionPath: ["五、运维计划"],
    region: "body",
    semanticType: "business"
  },
  {
    id: "s3-ordered-list",
    tag: "ol",
    text: "完成环境确认完成数据初始化完成账号权限配置完成用户验收培训",
    html: "<li>完成环境确认</li><li>完成数据初始化</li><li>完成账号权限配置</li><li>完成用户验收培训</li>",
    sectionPath: ["六、实施步骤"],
    region: "body",
    semanticType: "schedule"
  }
];

const mainDocument = buildDocument("main-demo", "main", "主文档-招标文件.docx", [
  {
    id: "m-title",
    tag: "h1",
    text: "智慧文档查重与协同编辑平台招标文件",
    sectionPath: ["封面"],
    region: "body",
    semanticType: "projectInfo"
  },
  {
    id: "m-footer",
    text: sharedFooter,
    sectionPath: ["页脚信息"],
    region: "footer",
    semanticType: "projectInfo"
  },
  {
    id: "m-overview",
    tag: "h2",
    text: "第一章 项目概况",
    sectionPath: ["第一章 项目概况"],
    region: "body",
    semanticType: "projectInfo"
  },
  ...mainChapterBlocks,
  {
    id: "m-tech-plan",
    text: sharedTechnicalPlan,
    html: `本项目采用 <strong>AI 辅助文档查重流程</strong>，统一上传、解析、范围映射、高亮定位和编辑回传的数据契约，确保主从文档可以在同一页面完成联动核查。`,
    sectionPath: ["第二章 技术要求", "总体方案"],
    region: "body",
    semanticType: "technical"
  },
  {
    id: "m-qualification",
    text: sharedQualification,
    sectionPath: ["第三章 资格审查", "资质要求"],
    region: "body",
    semanticType: "qualification"
  },
  {
    id: "m-schedule",
    text: sharedSchedule,
    sectionPath: ["第四章 实施计划", "交付周期"],
    region: "body",
    semanticType: "schedule"
  },
  {
    id: "m-price-table",
    text: sharedTableCell,
    html: `<span style="color: #2563eb">${sharedTableCell}</span>`,
    sectionPath: ["第五章 报价要求", "功能报价表"],
    region: "table",
    semanticType: "priceTable",
    tableContext: {
      tableId: "main-price-table",
      rowIndex: 2,
      cellIndex: 1,
      headerText: "功能模块",
      rowHeaderText: "增值服务"
    }
  },
  {
    id: "m-risk",
    text: "系统应支持重复点忽略、噪声标记、主从文档切换和导出前预览，避免页眉页脚、项目名称等自然重复内容干扰业务判断。",
    sectionPath: ["第六章 风险控制"],
    region: "body",
    semanticType: "business"
  },
  ...mainLaterBlocks
]);

const technicalResponse = buildDocument("slave-technical", "slave", "从文档A-技术响应.docx", [
  {
    id: "s1-title",
    tag: "h2",
    text: "技术响应文件",
    sectionPath: ["技术响应文件"],
    region: "body",
    semanticType: "technical"
  },
  {
    id: "s1-tech-plan",
    text: sharedTechnicalPlan,
    html: `本项目采用 <mark>AI 辅助文档查重流程</mark>，统一上传、解析、范围映射、高亮定位和编辑回传的数据契约，确保主从文档可以在同一页面完成联动核查。`,
    sectionPath: ["一、总体技术方案"],
    region: "body",
    semanticType: "technical"
  },
  {
    id: "s1-schedule",
    text: sharedSchedule,
    sectionPath: ["三、项目进度计划"],
    region: "body",
    semanticType: "schedule"
  },
  {
    id: "s1-extra",
    text: "针对大文件上传和多从文档比对场景，系统将提供分片上传、任务队列和失败重试机制。",
    sectionPath: ["四、稳定性设计"],
    region: "body",
    semanticType: "technical"
  },
  ...technicalExtraBlocks
]);

const businessResponse = buildDocument("slave-business", "slave", "从文档B-商务响应.docx", [
  {
    id: "s2-title",
    tag: "h2",
    text: "商务响应文件",
    sectionPath: ["商务响应文件"],
    region: "body",
    semanticType: "business"
  },
  {
    id: "s2-footer",
    text: sharedFooter,
    sectionPath: ["页脚信息"],
    region: "footer",
    semanticType: "projectInfo"
  },
  {
    id: "s2-qualification",
    text: sharedQualification,
    sectionPath: ["二、资格证明材料"],
    region: "body",
    semanticType: "qualification"
  },
  {
    id: "s2-price-table",
    text: sharedTableCell,
    sectionPath: ["四、分项报价表"],
    region: "table",
    semanticType: "priceTable",
    tableContext: {
      tableId: "business-price-table",
      rowIndex: 4,
      cellIndex: 2,
      headerText: "服务内容",
      rowHeaderText: "可选服务"
    }
  },
  ...businessExtraBlocks
]);

const appendixDocument = buildDocument("slave-appendix", "slave", "从文档C-实施附件.docx", [
  {
    id: "s3-title",
    tag: "h2",
    text: "实施服务附件",
    sectionPath: ["实施服务附件"],
    region: "body",
    semanticType: "schedule"
  },
  {
    id: "s3-schedule",
    text: sharedSchedule,
    sectionPath: ["一、交付计划"],
    region: "body",
    semanticType: "schedule"
  },
  {
    id: "s3-noise",
    text: sharedFooter,
    sectionPath: ["页脚信息"],
    region: "footer",
    semanticType: "projectInfo"
  },
  {
    id: "s3-note",
    text: "附件还包含培训签到表、验收报告模板和运维联系人清单，方便演示编辑器的滚动和长文档阅读效果。",
    sectionPath: ["三、附件说明"],
    region: "body",
    semanticType: "business"
  },
  ...appendixExtraBlocks
]);

const documents = [mainDocument, technicalResponse, businessResponse, appendixDocument];

const mockAnalyzeResponse: AnalyzeResponse = {
  mainDocumentId: mainDocument.documentId,
  documents,
  duplicates: [
    {
      duplicateId: "dup-tech-plan",
      groupId: "group-technical",
      similarity: 0.94,
      label: "No.1",
      summary: sharedTechnicalPlan,
      reason: "技术方案整段与技术响应文件高度一致，需要确认是否为允许复用的标准方案。",
      severity: "high",
      semanticType: "technical",
      region: "body",
      main: {
        documentId: mainDocument.documentId,
        ranges: [rangeOf(mainDocument, "m-tech-plan")]
      },
      slaves: [
        {
          documentId: technicalResponse.documentId,
          ranges: [rangeOf(technicalResponse, "s1-tech-plan")]
        }
      ]
    },
    {
      duplicateId: "dup-qualification",
      groupId: "group-qualification",
      similarity: 0.88,
      label: "No.2",
      summary: sharedQualification,
      reason: "资格要求在商务响应中原样出现，适合验证中高风险重复点定位。",
      severity: "high",
      semanticType: "qualification",
      region: "body",
      main: {
        documentId: mainDocument.documentId,
        ranges: [rangeOf(mainDocument, "m-qualification")]
      },
      slaves: [
        {
          documentId: businessResponse.documentId,
          ranges: [rangeOf(businessResponse, "s2-qualification")]
        }
      ]
    },
    {
      duplicateId: "dup-schedule",
      groupId: "group-schedule",
      similarity: 0.79,
      label: "No.3",
      summary: sharedSchedule,
      reason: "交付周期同时出现在技术响应和实施附件中，用于验证一个重复点关联多个从文档。",
      severity: "medium",
      semanticType: "schedule",
      region: "body",
      main: {
        documentId: mainDocument.documentId,
        ranges: [rangeOf(mainDocument, "m-schedule")]
      },
      slaves: [
        {
          documentId: technicalResponse.documentId,
          ranges: [rangeOf(technicalResponse, "s1-schedule")]
        },
        {
          documentId: appendixDocument.documentId,
          ranges: [rangeOf(appendixDocument, "s3-schedule")]
        }
      ]
    },
    {
      duplicateId: "dup-price-table",
      groupId: "group-price",
      similarity: 0.72,
      label: "No.4",
      summary: sharedTableCell,
      reason: "报价表单元格内容相似，用于验证表格区域、行列上下文和样式展示。",
      severity: "medium",
      semanticType: "priceTable",
      region: "table",
      main: {
        documentId: mainDocument.documentId,
        ranges: [rangeOf(mainDocument, "m-price-table")]
      },
      slaves: [
        {
          documentId: businessResponse.documentId,
          ranges: [rangeOf(businessResponse, "s2-price-table")]
        }
      ]
    },
    {
      duplicateId: "dup-security",
      groupId: "group-security",
      similarity: 0.84,
      label: "No.5",
      summary: sharedDataSecurity,
      reason: "安全存储与审计要求在技术响应中重复，可用于验证文档中部高亮定位。",
      severity: "medium",
      semanticType: "technical",
      region: "body",
      main: {
        documentId: mainDocument.documentId,
        ranges: [rangeOf(mainDocument, "m-security")]
      },
      slaves: [
        {
          documentId: technicalResponse.documentId,
          ranges: [rangeOf(technicalResponse, "s1-security")]
        }
      ]
    },
    {
      duplicateId: "dup-training",
      groupId: "group-training",
      similarity: 0.81,
      label: "No.6",
      summary: sharedTraining,
      reason: "培训服务同时出现在主文档、技术响应和实施附件中，可验证多个从文档切换。",
      severity: "medium",
      semanticType: "personnel",
      region: "body",
      main: {
        documentId: mainDocument.documentId,
        ranges: [rangeOf(mainDocument, "m-training")]
      },
      slaves: [
        {
          documentId: technicalResponse.documentId,
          ranges: [rangeOf(technicalResponse, "s1-training")]
        },
        {
          documentId: appendixDocument.documentId,
          ranges: [rangeOf(appendixDocument, "s3-training")]
        }
      ]
    },
    {
      duplicateId: "dup-acceptance",
      groupId: "group-acceptance",
      similarity: 0.86,
      label: "No.7",
      summary: sharedAcceptance,
      reason: "验收材料要求在文档靠后章节重复，可用于验证长距离滚动定位。",
      severity: "high",
      semanticType: "business",
      region: "body",
      main: {
        documentId: mainDocument.documentId,
        ranges: [rangeOf(mainDocument, "m-acceptance")]
      },
      slaves: [
        {
          documentId: businessResponse.documentId,
          ranges: [rangeOf(businessResponse, "s2-acceptance")]
        },
        {
          documentId: appendixDocument.documentId,
          ranges: [rangeOf(appendixDocument, "s3-acceptance")]
        }
      ]
    },
    {
      duplicateId: "dup-operation",
      groupId: "group-operation",
      similarity: 0.74,
      label: "No.8",
      summary: sharedOperation,
      reason: "运维承诺在商务响应和附件中重复，适合验证低中风险重复点样式。",
      severity: "medium",
      semanticType: "business",
      region: "body",
      main: {
        documentId: mainDocument.documentId,
        ranges: [rangeOf(mainDocument, "m-operation")]
      },
      slaves: [
        {
          documentId: businessResponse.documentId,
          ranges: [rangeOf(businessResponse, "s2-service")]
        },
        {
          documentId: appendixDocument.documentId,
          ranges: [rangeOf(appendixDocument, "s3-operation")]
        }
      ]
    },
    {
      duplicateId: "dup-footer-noise",
      groupId: "group-noise",
      similarity: 0.66,
      label: "No.9",
      summary: sharedFooter,
      reason: "页脚中的项目名称和招标编号自然重复，默认标记为建议忽略。",
      ignored: true,
      severity: "noise",
      semanticType: "projectInfo",
      region: "footer",
      noiseReason: "项目名称、招标编号、页脚信息属于自然重复内容，通常不作为核心风险。",
      main: {
        documentId: mainDocument.documentId,
        ranges: [rangeOf(mainDocument, "m-footer")]
      },
      slaves: [
        {
          documentId: businessResponse.documentId,
          ranges: [rangeOf(businessResponse, "s2-footer")]
        },
        {
          documentId: appendixDocument.documentId,
          ranges: [rangeOf(appendixDocument, "s3-noise")]
        }
      ]
    }
  ]
};

export const mockProjectViewData: ProjectDemoViewData = {
  project: {
    projectId: "project-demo",
    name: "内置 Mock 招投标查重项目",
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
    supportedContentTypes: [
      "标题层级",
      "段落",
      "加粗/斜体/下划线/删除线",
      "颜色/高亮",
      "上标/下标",
      "链接",
      "图片",
      "有序/无序列表",
      "任务列表",
      "引用",
      "代码块",
      "分割线",
      "基础表格",
      "重复点忽略",
      "表格上下文",
      "多从文档联动"
    ]
  },
  actions: {
    analyze: {
      method: "POST",
      url: "/api/projects/analyze-view",
      description: "上传主文档和从文档，返回页面渲染所需的完整结构化数据。"
    },
    exportDocx: {
      method: "POST",
      url: "/api/documents/export-docx",
      description: "将当前编辑器 HTML 导出为 DOCX。"
    },
    editSnapshot: {
      method: "POST",
      url: "/api/documents/edit-snapshot",
      description: "提交当前编辑器 HTML、纯文本和 Tiptap JSON 快照。"
    }
  }
};

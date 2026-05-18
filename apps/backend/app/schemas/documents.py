from typing import Any, Literal

from pydantic import BaseModel, Field


DocumentRegion = Literal["body", "header", "footer", "table", "caption", "unknown"]
DuplicateSeverity = Literal["noise", "low", "medium", "high"]
TenderSemanticType = Literal[
    "qualification",
    "priceTable",
    "deviationTable",
    "personnel",
    "performance",
    "schedule",
    "technical",
    "business",
    "projectInfo",
    "unknown",
]


class TableCellContext(BaseModel):
    tableId: str
    rowIndex: int = Field(ge=0)
    cellIndex: int = Field(ge=0)
    headerText: str | None = None
    rowHeaderText: str | None = None


class TextRange(BaseModel):
    start: int = Field(ge=0)
    end: int = Field(ge=0)
    blockId: str | None = None
    sectionPath: list[str] | None = None
    region: DocumentRegion | None = None
    tableContext: TableCellContext | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    semanticType: TenderSemanticType | None = None


class RangeMapEntry(BaseModel):
    blockId: str
    textStart: int = Field(ge=0)
    textEnd: int = Field(ge=0)
    selector: str | None = None
    sectionPath: list[str] | None = None
    region: DocumentRegion | None = None
    listMarker: str | None = None
    tableContext: TableCellContext | None = None
    semanticType: TenderSemanticType | None = None


class DocumentAsset(BaseModel):
    id: str
    url: str
    type: Literal["image", "font", "other"] = "other"


class NormalizedDocument(BaseModel):
    documentId: str
    role: Literal["main", "slave"]
    fileName: str
    html: str
    plainText: str
    rangeMap: list[RangeMapEntry]
    assets: list[DocumentAsset] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)


class DuplicateDocumentRanges(BaseModel):
    documentId: str
    ranges: list[TextRange]


class DuplicatePoint(BaseModel):
    duplicateId: str
    groupId: str | None = None
    similarity: float = Field(ge=0, le=1)
    label: str | None = None
    summary: str | None = None
    reason: str | None = None
    ignored: bool | None = None
    severity: DuplicateSeverity | None = None
    semanticType: TenderSemanticType | None = None
    region: DocumentRegion | None = None
    noiseReason: str | None = None
    main: DuplicateDocumentRanges
    slaves: list[DuplicateDocumentRanges]


class AnalyzeResponse(BaseModel):
    mainDocumentId: str
    documents: list[NormalizedDocument]
    duplicates: list[DuplicatePoint]


class ProjectInfo(BaseModel):
    projectId: str
    name: str
    mainDocumentId: str


class ActiveDefaults(BaseModel):
    duplicateId: str | None = None
    slaveDocumentId: str | None = None


class ProjectStats(BaseModel):
    documentTotal: int
    duplicateTotal: int
    rangeMapTotal: int
    plainTextTotal: int


class ProjectCapabilities(BaseModel):
    supportedFileTypes: list[str]
    supportedContentTypes: list[str]


class ProjectAction(BaseModel):
    method: str
    url: str
    description: str


class ProjectDemoViewData(BaseModel):
    project: ProjectInfo
    mainDocumentId: str
    documents: list[NormalizedDocument]
    duplicates: list[DuplicatePoint]
    activeDefaults: ActiveDefaults
    stats: ProjectStats
    capabilities: ProjectCapabilities
    actions: dict[str, ProjectAction]


class ApiMeta(BaseModel):
    traceId: str | None = None
    timestamp: str | None = None


class ProjectDemoViewResponse(BaseModel):
    code: int = 0
    message: str = "ok"
    data: ProjectDemoViewData
    meta: ApiMeta = Field(default_factory=ApiMeta)


class ExportRequest(BaseModel):
    documentId: str
    fileName: str = "edited-document.docx"
    html: str


class EditSnapshotRequest(BaseModel):
    documentId: str
    fileName: str = "edited-document.docx"
    html: str
    plainText: str
    json: Any | None = None


class EditSnapshotResponse(BaseModel):
    documentId: str
    fileName: str
    htmlLength: int
    plainTextLength: int
    accepted: bool = True

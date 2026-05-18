from datetime import datetime, timezone
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.schemas.documents import (
    ActiveDefaults,
    AnalyzeResponse,
    ApiMeta,
    EditSnapshotRequest,
    EditSnapshotResponse,
    ExportRequest,
    ProjectAction,
    ProjectCapabilities,
    ProjectDemoViewData,
    ProjectDemoViewResponse,
    ProjectInfo,
    ProjectStats,
)
from app.services.agent import build_mock_duplicates
from app.services.converter import html_to_docx_file, upload_to_normalized_document

app = FastAPI(title="Word Duplicate Demo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/projects/analyze", response_model=AnalyzeResponse)
async def analyze_documents(
    main_file: UploadFile = File(...),
    slave_files: list[UploadFile] = File(default_factory=list),
) -> AnalyzeResponse:
    if not slave_files:
        raise HTTPException(status_code=400, detail="至少需要上传一个从文档")

    main_document = await upload_to_normalized_document(main_file, "main")
    slave_documents = [
        await upload_to_normalized_document(slave_file, "slave")
        for slave_file in slave_files
    ]
    duplicates = build_mock_duplicates(main_document, slave_documents)

    return AnalyzeResponse(
        mainDocumentId=main_document.documentId,
        documents=[main_document, *slave_documents],
        duplicates=duplicates,
    )


@app.post("/api/projects/analyze-view", response_model=ProjectDemoViewResponse)
async def analyze_documents_view(
    main_file: UploadFile = File(...),
    slave_files: list[UploadFile] = File(default_factory=list),
) -> ProjectDemoViewResponse:
    if not slave_files:
        raise HTTPException(status_code=400, detail="至少需要上传一个从文档")

    main_document = await upload_to_normalized_document(main_file, "main")
    slave_documents = [
        await upload_to_normalized_document(slave_file, "slave")
        for slave_file in slave_files
    ]
    documents = [main_document, *slave_documents]
    duplicates = build_mock_duplicates(main_document, slave_documents)

    return build_project_view_response(
        main_document_id=main_document.documentId,
        documents=documents,
        duplicates=duplicates,
        project_name="上传文档查重分析",
    )


@app.post("/api/documents/export-docx")
async def export_docx(payload: ExportRequest) -> FileResponse:
    output_path = html_to_docx_file(payload.html, payload.fileName)

    return FileResponse(
        output_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=output_path.name,
    )


@app.post("/api/documents/edit-snapshot", response_model=EditSnapshotResponse)
async def accept_edit_snapshot(payload: EditSnapshotRequest) -> EditSnapshotResponse:
    return EditSnapshotResponse(
        documentId=payload.documentId,
        fileName=payload.fileName,
        htmlLength=len(payload.html),
        plainTextLength=len(payload.plainText),
    )


def build_project_view_response(
    *,
    main_document_id: str,
    documents,
    duplicates,
    project_name: str,
) -> ProjectDemoViewResponse:
    first_duplicate = duplicates[0] if duplicates else None
    first_slave = first_duplicate.slaves[0] if first_duplicate and first_duplicate.slaves else None

    data = ProjectDemoViewData(
        project=ProjectInfo(
            projectId=f"project-{uuid4()}",
            name=project_name,
            mainDocumentId=main_document_id,
        ),
        mainDocumentId=main_document_id,
        documents=documents,
        duplicates=duplicates,
        activeDefaults=ActiveDefaults(
            duplicateId=first_duplicate.duplicateId if first_duplicate else None,
            slaveDocumentId=first_slave.documentId if first_slave else None,
        ),
        stats=ProjectStats(
            documentTotal=len(documents),
            duplicateTotal=len(duplicates),
            rangeMapTotal=sum(len(document.rangeMap) for document in documents),
            plainTextTotal=sum(len(document.plainText) for document in documents),
        ),
        capabilities=ProjectCapabilities(
            supportedFileTypes=["DOCX", "DOC"],
            supportedContentTypes=[
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
            ],
        ),
        actions={
            "analyze": ProjectAction(
                method="POST",
                url="/api/projects/analyze-view",
                description="上传主文档和从文档，返回页面渲染所需的完整结构化数据",
            ),
            "exportDocx": ProjectAction(
                method="POST",
                url="/api/documents/export-docx",
                description="将当前编辑器 HTML 导出为 DOCX",
            ),
            "editSnapshot": ProjectAction(
                method="POST",
                url="/api/documents/edit-snapshot",
                description="提交当前编辑器 HTML、纯文本和 Tiptap JSON 快照",
            ),
        },
    )

    return ProjectDemoViewResponse(
        data=data,
        meta=ApiMeta(
            traceId=str(uuid4()),
            timestamp=datetime.now(timezone.utc).isoformat(),
        ),
    )

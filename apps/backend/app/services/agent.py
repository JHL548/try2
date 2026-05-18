import re

from app.schemas.documents import DuplicateDocumentRanges, DuplicatePoint, NormalizedDocument, TextRange


def build_mock_duplicates(main_document: NormalizedDocument, slave_documents: list[NormalizedDocument]) -> list[DuplicatePoint]:
    duplicates: list[DuplicatePoint] = []
    main_candidates = extract_candidates(main_document.plainText)

    for slave_document in slave_documents:
        for candidate in main_candidates:
            slave_start = slave_document.plainText.find(candidate)
            if slave_start < 0:
                continue

            main_start = main_document.plainText.find(candidate)
            if main_start < 0:
                continue

            duplicate_index = len(duplicates) + 1
            main_range = build_text_range(main_document, main_start, len(candidate))
            slave_range = build_text_range(slave_document, slave_start, len(candidate))
            duplicates.append(
                DuplicatePoint(
                    duplicateId=f"dup-{duplicate_index}",
                    groupId=f"group-{duplicate_index}",
                    similarity=score_similarity(candidate),
                    label=f"No.{duplicate_index}",
                    summary=candidate[:80],
                    severity=infer_duplicate_severity(candidate),
                    ignored=is_noise_text(candidate),
                    noiseReason=infer_noise_reason(candidate),
                    semanticType=main_range.semanticType or slave_range.semanticType,
                    region=main_range.region or slave_range.region,
                    main=DuplicateDocumentRanges(
                        documentId=main_document.documentId,
                        ranges=[main_range],
                    ),
                    slaves=[
                        DuplicateDocumentRanges(
                            documentId=slave_document.documentId,
                            ranges=[slave_range],
                        )
                    ],
                )
            )

    if duplicates:
        return duplicates

    return fallback_duplicate(main_document, slave_documents)


def extract_candidates(text: str) -> list[str]:
    parts = [
        part.strip()
        for part in re.split(r"[。！？!?；;\n]+", text)
        if len(part.strip()) >= 12
    ]

    if parts:
        return parts[:20]

    compact = text.strip()
    if len(compact) >= 12:
        return [compact[: min(80, len(compact))]]

    return []


def score_similarity(candidate: str) -> float:
    if len(candidate) >= 60:
        return 0.92
    if len(candidate) >= 30:
        return 0.78
    return 0.64


def find_block_id(document: NormalizedDocument, offset: int) -> str | None:
    for item in document.rangeMap:
        if item.textStart <= offset <= item.textEnd:
            return item.blockId
    return None


def find_range_entry(document: NormalizedDocument, offset: int):
    for item in document.rangeMap:
        if item.textStart <= offset <= item.textEnd:
            return item
    return None


def build_text_range(document: NormalizedDocument, start: int, length: int) -> TextRange:
    entry = find_range_entry(document, start)
    return TextRange(
        start=start,
        end=start + length,
        blockId=entry.blockId if entry else None,
        sectionPath=entry.sectionPath if entry else None,
        region=entry.region if entry else None,
        tableContext=entry.tableContext if entry else None,
        semanticType=entry.semanticType if entry else None,
        confidence=0.8 if entry else None,
    )


def is_noise_text(text: str) -> bool:
    return infer_noise_reason(text) is not None


def infer_noise_reason(text: str) -> str | None:
    noise_keywords = {
        "项目名称": "项目名称类内容通常会在招投标文件中自然重复",
        "招标编号": "招标编号类内容通常会在页眉、页脚或封面中自然重复",
        "采购编号": "采购编号类内容通常会在页眉、页脚或封面中自然重复",
        "投标人": "投标人名称可能在多个固定位置自然重复",
        "日期": "日期字段可能是模板内容重复",
        "页码": "页码或页脚信息不建议作为核心重复点",
    }
    for keyword, reason in noise_keywords.items():
        if keyword in text:
            return reason
    return None


def infer_duplicate_severity(text: str) -> str:
    if is_noise_text(text):
        return "noise"
    if len(text) >= 60:
        return "high"
    if len(text) >= 30:
        return "medium"
    return "low"


def fallback_duplicate(main_document: NormalizedDocument, slave_documents: list[NormalizedDocument]) -> list[DuplicatePoint]:
    if not main_document.plainText or not slave_documents:
        return []

    slave_document = slave_documents[0]
    length = min(40, len(main_document.plainText), len(slave_document.plainText))
    if length <= 0:
        return []

    return [
        DuplicatePoint(
            duplicateId="dup-demo",
            groupId="group-demo",
            similarity=0.72,
            label="No.1",
            summary=main_document.plainText[:length],
            main=DuplicateDocumentRanges(
                documentId=main_document.documentId,
                ranges=[build_text_range(main_document, 0, length)],
            ),
            slaves=[
                DuplicateDocumentRanges(
                    documentId=slave_document.documentId,
                    ranges=[build_text_range(slave_document, 0, length)],
                )
            ],
        )
    ]

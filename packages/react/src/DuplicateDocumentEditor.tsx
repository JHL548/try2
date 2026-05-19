import {
  DuplicateHighlightExtension,
  plainTextFromHtml,
  scrollToActiveHighlight,
  type DuplicateHighlight,
  type EditorChangePayload,
  type NormalizedDocument
} from "@jhl548/duplicate-doc-core";
import { Color } from "@tiptap/extension-color";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { ChangeEvent } from "react";

export interface DuplicateDocumentEditorProps {
  documentModel: NormalizedDocument;
  highlights?: DuplicateHighlight[];
  editable?: boolean;
  autofocusHighlight?: boolean;
  onChange?: (payload: EditorChangePayload) => void;
  onReady?: () => void;
}

export interface DuplicateDocumentEditorRef {
  getSnapshot: () => EditorChangePayload;
  getHTML: () => string;
  getPlainText: () => string;
  focus: () => void;
}

export const DuplicateDocumentEditor = forwardRef<DuplicateDocumentEditorRef, DuplicateDocumentEditorProps>(function DuplicateDocumentEditor({
  documentModel,
  highlights = [],
  editable = true,
  autofocusHighlight = true,
  onChange,
  onReady
}: DuplicateDocumentEditorProps, ref) {
  const editorShellRef = useRef<HTMLDivElement | null>(null);
  const lastHighlightSignatureRef = useRef("");
  const highlightSignature = useMemo(() => getHighlightsSignature(highlights), [highlights]);

  const editor = useEditor({
    content: documentModel.html,
    editable,
    extensions: [
      StarterKit,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Image.configure({ inline: false, allowBase64: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      DuplicateHighlightExtension
    ],
    editorProps: {
      attributes: {
        class: "dupdoc-editor__content"
      }
    },
    onCreate: ({ editor: createdEditor }) => {
      createdEditor.commands.setDuplicateHighlights(highlights);
      onReady?.();
    },
    onUpdate: ({ editor: updatedEditor }) => {
      onChange?.(buildSnapshot(documentModel, updatedEditor));
    }
  });

  useImperativeHandle(
    ref,
    () => ({
      getSnapshot: () => buildSnapshot(documentModel, editor),
      getHTML: () => editor?.getHTML() ?? documentModel.html,
      getPlainText: () => editor?.getText() ?? plainTextFromHtml(documentModel.html),
      focus: () => {
        editor?.commands.focus();
      }
    }),
    [documentModel, editor]
  );

  useEffect(() => {
    if (!editor) {
      return;
    }

    const shouldForceHighlights = editor.getHTML() !== documentModel.html;
    if (editor.getHTML() !== documentModel.html) {
      editor.commands.setContent(documentModel.html, { emitUpdate: false });
    }
    const shouldApplyHighlights = shouldForceHighlights || highlightSignature !== lastHighlightSignatureRef.current;
    if (shouldApplyHighlights) {
      editor.commands.setDuplicateHighlights(highlights);
      lastHighlightSignatureRef.current = highlightSignature;
    }
    if (shouldApplyHighlights && autofocusHighlight && highlightSignature) {
      window.requestAnimationFrame(() => scrollToActiveHighlight(editorShellRef.current));
    }
  }, [autofocusHighlight, documentModel.documentId, documentModel.html, editor, highlightSignature, highlights]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  const currentBlockType = editor?.isActive("heading", { level: 1 })
    ? "heading-1"
    : editor?.isActive("heading", { level: 2 })
      ? "heading-2"
      : editor?.isActive("heading", { level: 3 })
        ? "heading-3"
        : "paragraph";
  const toolbarDisabled = !editable || !editor;

  function setBlockType(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    const chain = editor?.chain().focus();

    if (!chain) {
      return;
    }

    if (value === "paragraph") {
      chain.setParagraph().run();
      return;
    }

    const level = Number(value.replace("heading-", "")) as 1 | 2 | 3;
    chain.toggleHeading({ level }).run();
  }

  function setTextColor(event: ChangeEvent<HTMLInputElement>) {
    editor?.chain().focus().setColor(event.target.value).run();
  }

  function setHighlightColor(event: ChangeEvent<HTMLInputElement>) {
    editor?.chain().focus().toggleHighlight({ color: event.target.value }).run();
  }

  function insertBasicTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  return (
    <div ref={editorShellRef} className="dupdoc-editor">
      <div className="dupdoc-editor__toolbar" aria-label="文档编辑工具">
        <div className="dupdoc-editor__toolbar-group dupdoc-editor__toolbar-group--select">
          <select value={currentBlockType} disabled={toolbarDisabled} aria-label="选择文本层级" onChange={setBlockType}>
            <option value="paragraph">P</option>
            <option value="heading-1">H1</option>
            <option value="heading-2">H2</option>
            <option value="heading-3">H3</option>
          </select>
        </div>

        <div className="dupdoc-editor__toolbar-group" aria-label="基础文字样式">
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive("bold") ? "active" : ""}`} data-tooltip="加粗" aria-label="加粗" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().toggleBold().run()}><span className="dupdoc-toolbar-icon">B</span></button>
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive("italic") ? "active" : ""}`} data-tooltip="斜体" aria-label="斜体" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().toggleItalic().run()}><span className="dupdoc-toolbar-icon dupdoc-toolbar-icon--italic">I</span></button>
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive("strike") ? "active" : ""}`} data-tooltip="删除线" aria-label="删除线" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().toggleStrike().run()}><span className="dupdoc-toolbar-icon dupdoc-toolbar-icon--strike">S</span></button>
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive("code") ? "active" : ""}`} data-tooltip="行内代码" aria-label="行内代码" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().toggleCode().run()}><span className="dupdoc-toolbar-icon">&lt;&gt;</span></button>
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive("subscript") ? "active" : ""}`} data-tooltip="下标" aria-label="下标" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().toggleSubscript().run()}><span className="dupdoc-toolbar-icon">X2</span></button>
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive("superscript") ? "active" : ""}`} data-tooltip="上标" aria-label="上标" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().toggleSuperscript().run()}><span className="dupdoc-toolbar-icon">X²</span></button>
        </div>

        <div className="dupdoc-editor__toolbar-group" aria-label="颜色">
          <label className="dupdoc-toolbar-color" data-tooltip="文字颜色" aria-label="文字颜色">
            <span className="dupdoc-toolbar-icon">A</span>
            <input type="color" disabled={toolbarDisabled} defaultValue="#dc2626" onChange={setTextColor} />
          </label>
          <label className="dupdoc-toolbar-color" data-tooltip="高亮颜色" aria-label="高亮颜色">
            <span className="dupdoc-toolbar-icon">H</span>
            <input type="color" disabled={toolbarDisabled} defaultValue="#fef08a" onChange={setHighlightColor} />
          </label>
        </div>

        <div className="dupdoc-editor__toolbar-group" aria-label="段落对齐">
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive({ textAlign: "left" }) ? "active" : ""}`} data-tooltip="左对齐" aria-label="左对齐" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().setTextAlign("left").run()}><span className="dupdoc-toolbar-icon">L</span></button>
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive({ textAlign: "center" }) ? "active" : ""}`} data-tooltip="居中对齐" aria-label="居中对齐" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().setTextAlign("center").run()}><span className="dupdoc-toolbar-icon">C</span></button>
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive({ textAlign: "right" }) ? "active" : ""}`} data-tooltip="右对齐" aria-label="右对齐" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().setTextAlign("right").run()}><span className="dupdoc-toolbar-icon">R</span></button>
        </div>

        <div className="dupdoc-editor__toolbar-group" aria-label="列表与结构">
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive("bulletList") ? "active" : ""}`} data-tooltip="无序列表" aria-label="无序列表" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().toggleBulletList().run()}><span className="dupdoc-toolbar-icon">UL</span></button>
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive("orderedList") ? "active" : ""}`} data-tooltip="有序列表" aria-label="有序列表" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><span className="dupdoc-toolbar-icon">1.</span></button>
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive("taskList") ? "active" : ""}`} data-tooltip="任务列表" aria-label="任务列表" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().toggleTaskList().run()}><span className="dupdoc-toolbar-icon">TL</span></button>
          <button type="button" className={`dupdoc-toolbar-button ${editor?.isActive("blockquote") ? "active" : ""}`} data-tooltip="引用" aria-label="引用" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><span className="dupdoc-toolbar-icon">Q</span></button>
          <button type="button" className="dupdoc-toolbar-button" data-tooltip="插入分割线" aria-label="插入分割线" disabled={toolbarDisabled} onClick={() => editor?.chain().focus().setHorizontalRule().run()}><span className="dupdoc-toolbar-icon">HR</span></button>
          <button type="button" className="dupdoc-toolbar-button dupdoc-toolbar-button--add" data-tooltip="插入基础表格" aria-label="插入基础表格" disabled={toolbarDisabled} onClick={insertBasicTable}>
            <span className="dupdoc-toolbar-icon">T</span>
            <span className="dupdoc-toolbar-text">Add</span>
          </button>
        </div>

        <div className="dupdoc-editor__toolbar-group dupdoc-editor__toolbar-group--action" aria-label="查重定位">
          <button type="button" className="dupdoc-toolbar-button dupdoc-toolbar-button--primary" data-tooltip="定位当前重复点" aria-label="定位当前重复点" onClick={() => scrollToActiveHighlight(editorShellRef.current)}><span className="dupdoc-toolbar-icon">Go</span></button>
        </div>
      </div>
      <div className="dupdoc-editor__body">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

function buildSnapshot(
  documentModel: NormalizedDocument,
  editor: ReturnType<typeof useEditor>
): EditorChangePayload {
  return {
    documentId: documentModel.documentId,
    html: editor?.getHTML() ?? documentModel.html,
    plainText: editor?.getText() ?? plainTextFromHtml(documentModel.html),
    json: editor?.getJSON()
  };
}

export function getFallbackPlainText(documentModel: NormalizedDocument): string {
  return plainTextFromHtml(documentModel.html);
}

function getHighlightsSignature(highlights: DuplicateHighlight[]): string {
  return highlights
    .map((highlight) =>
      [
        highlight.documentId,
        highlight.duplicateId,
        highlight.similarity,
        highlight.active ? "active" : "",
        highlight.ignored ? "ignored" : "",
        highlight.region,
        highlight.semanticType,
        highlight.noiseReason,
        highlight.tableContext?.tableId,
        highlight.ranges
          .map((range) => [range.blockId, range.start, range.end, range.matchedText].join(":"))
          .join("|")
      ].join("::")
    )
    .join(";;");
}

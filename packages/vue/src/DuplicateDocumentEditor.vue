<script setup lang="ts">
import {
  DuplicateHighlightExtension,
  findOverlappingRangeMapEntries,
  getSelectionRangeInfo,
  calcSelectionPopupPosition,
  getDomSelectionRect,
  isDomSelectionInsideContainer,
  plainTextFromHtml,
  scrollToActiveHighlight,
  type DocumentSelectionChangePayload,
  type DuplicateHighlight,
  type EditorChangePayload,
  type NormalizedDocument,
  type PopupPosition,
  type RangeMapEntry,
  type SelectionRangeInfo
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
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import alignCenterIcon from "./icons/align-center.svg?raw";
import alignLeftIcon from "./icons/align-left.svg?raw";
import alignRightIcon from "./icons/align-right.svg?raw";
import boldIcon from "./icons/bold.svg?raw";
import bulletListIcon from "./icons/bullet-list.svg?raw";
import codeIcon from "./icons/code.svg?raw";
import dividerIcon from "./icons/divider.svg?raw";
import highlightColorIcon from "./icons/highlight-color.svg?raw";
import italicIcon from "./icons/italic.svg?raw";
import locateIcon from "./icons/locate.svg?raw";
import orderedListIcon from "./icons/ordered-list.svg?raw";
import quoteIcon from "./icons/quote.svg?raw";
import redoIcon from "./icons/redo.svg?raw";
import strikeIcon from "./icons/strike.svg?raw";
import subscriptIcon from "./icons/subscript.svg?raw";
import superscriptIcon from "./icons/superscript.svg?raw";
import tableIcon from "./icons/table.svg?raw";
import taskListIcon from "./icons/task-list.svg?raw";
import textColorIcon from "./icons/text-color.svg?raw";
import undoIcon from "./icons/undo.svg?raw";

const props = withDefaults(
  defineProps<{
    documentModel: NormalizedDocument;
    highlights?: DuplicateHighlight[];
    editable?: boolean;
    autofocusHighlight?: boolean;
  }>(),
  {
    highlights: () => [],
    editable: true,
    autofocusHighlight: true
  }
);

const emit = defineEmits<{
  change: [payload: EditorChangePayload];
  ready: [];
  "selection-change": [payload: DocumentSelectionChangePayload];
}>();

const slots = defineSlots<{
  "selection-popup"?: (props: {
    documentId: string;
    selection: DocumentSelectionChangePayload;
    overlappingEntries: RangeMapEntry[];
    visible: boolean;
    position: PopupPosition;
  }) => unknown;
}>();

const editorShellRef = ref<HTMLElement | null>(null);
const editorBodyRef = ref<HTMLElement | null>(null);
const popupRef = ref<HTMLElement | null>(null);
const popupVisible = ref(false);
const popupPosition = ref<PopupPosition>({ top: 0, left: 0, placement: "below" });
const popupSelection = ref<DocumentSelectionChangePayload | null>(null);
const popupOverlappingEntries = ref<RangeMapEntry[]>([]);
const lastHighlightSignature = ref("");
const toolbarDisabled = computed(() => !props.editable || !editor.value);
const toolbarIcons = {
  alignCenter: alignCenterIcon,
  alignLeft: alignLeftIcon,
  alignRight: alignRightIcon,
  bold: boldIcon,
  bulletList: bulletListIcon,
  code: codeIcon,
  divider: dividerIcon,
  highlightColor: highlightColorIcon,
  italic: italicIcon,
  locate: locateIcon,
  orderedList: orderedListIcon,
  quote: quoteIcon,
  redo: redoIcon,
  strike: strikeIcon,
  subscript: subscriptIcon,
  superscript: superscriptIcon,
  table: tableIcon,
  taskList: taskListIcon,
  textColor: textColorIcon,
  undo: undoIcon
};

const currentBlockType = computed(() => {
  if (editor.value?.isActive("heading", { level: 1 })) {
    return "heading-1";
  }
  if (editor.value?.isActive("heading", { level: 2 })) {
    return "heading-2";
  }
  if (editor.value?.isActive("heading", { level: 3 })) {
    return "heading-3";
  }
  return "paragraph";
});

const editor = useEditor({
  content: props.documentModel.html,
  editable: props.editable,
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
    createdEditor.commands.setDuplicateHighlights(props.highlights);
    emit("ready");
  },
  onUpdate: ({ editor: updatedEditor }) => {
    emit("change", getSnapshot(updatedEditor));
  },
  onSelectionUpdate: ({ editor: updatedEditor }) => {
    const rangeInfo = getSelectionRangeInfo(updatedEditor);

    emit("selection-change", {
      documentId: props.documentModel.documentId,
      ...rangeInfo
    });

    if (rangeInfo.empty) {
      hidePopup();
    } else {
      showPopup(rangeInfo);
    }
  },
});

interface SnapshotSource {
  getHTML: () => string;
  getText: () => string;
  getJSON: () => unknown;
}

function getSnapshot(targetEditor?: SnapshotSource): EditorChangePayload {
  const source = targetEditor ?? editor.value;

  return {
    documentId: props.documentModel.documentId,
    html: source?.getHTML() ?? props.documentModel.html,
    plainText: source?.getText() ?? plainTextFromHtml(props.documentModel.html),
    json: source?.getJSON()
  };
}

function setBlockType(event: Event) {
  const value = (event.target as HTMLSelectElement).value;
  const chain = editor.value?.chain().focus();

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

function setTextColor(event: Event) {
  const color = (event.target as HTMLInputElement).value;
  editor.value?.chain().focus().setColor(color).run();
}

function setHighlightColor(event: Event) {
  const color = (event.target as HTMLInputElement).value;
  editor.value?.chain().focus().toggleHighlight({ color }).run();
}

function insertBasicTable() {
  editor.value?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
}

function undoChange() {
  if (toolbarDisabled.value || !editor.value?.can().undo()) {
    return;
  }

  editor.value.chain().focus().undo().run();
}

function redoChange() {
  if (toolbarDisabled.value || !editor.value?.can().redo()) {
    return;
  }

  editor.value.chain().focus().redo().run();
}

function focusHighlight() {
  nextTick(() => {
    scrollToActiveHighlight(editorShellRef.value);
  });
}

function getHighlightsSignature(highlights = props.highlights): string {
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

function showPopup(rangeInfo: SelectionRangeInfo) {
  const selRect = getDomSelectionRect();
  if (!selRect) {
    return;
  }

  const bodyEl = editorBodyRef.value;
  if (!bodyEl || !isDomSelectionInsideContainer(bodyEl)) {
    return;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const position = calcSelectionPopupPosition(selRect, viewportWidth, viewportHeight);

  const withDocumentId: DocumentSelectionChangePayload = {
    documentId: props.documentModel.documentId,
    ...rangeInfo
  };

  popupSelection.value = withDocumentId;
  popupPosition.value = position;

  if (rangeInfo.plainTextOffset) {
    popupOverlappingEntries.value = findOverlappingRangeMapEntries(
      props.documentModel.rangeMap,
      rangeInfo.plainTextOffset
    );
  } else {
    popupOverlappingEntries.value = [];
  }

  popupVisible.value = true;

  nextTick(() => {
    adjustPopupPosition();
  });
}

function repositionPopup() {
  const selRect = getDomSelectionRect();
  const bodyEl = editorBodyRef.value;
  if (!selRect || !bodyEl) {
    hidePopup();
    return;
  }

  if (!isDomSelectionInsideContainer(bodyEl)) {
    hidePopup();
    return;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const position = calcSelectionPopupPosition(selRect, viewportWidth, viewportHeight);

  popupPosition.value = position;

  nextTick(() => {
    adjustPopupPosition();
  });
}

let scrollRafId = 0;
function throttledRepositionPopup() {
  if (scrollRafId) {
    return;
  }
  scrollRafId = window.requestAnimationFrame(() => {
    scrollRafId = 0;
    repositionPopup();
  });
}

function hidePopup() {
  popupVisible.value = false;
  popupSelection.value = null;
  popupOverlappingEntries.value = [];
}

function adjustPopupPosition() {
  const popupEl = popupRef.value;
  if (!popupEl) {
    return;
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const rect = popupEl.getBoundingClientRect();
  let { top, left } = popupPosition.value;

  if (left + rect.width > viewportWidth) {
    left = viewportWidth - rect.width - 8;
  }
  if (top + rect.height > viewportHeight) {
    top = viewportHeight - rect.height - 8;
  }

  left = Math.max(8, left);
  top = Math.max(8, top);

  popupPosition.value = { ...popupPosition.value, top, left };
}

function handlePopupClick(event: MouseEvent) {
  const popupEl = popupRef.value;
  if (!popupVisible.value || !popupEl) {
    return;
  }

  const target = event.target as Node;
  if (!popupEl.contains(target)) {
    hidePopup();
  }
}

function handlePopupKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && popupVisible.value) {
    hidePopup();
  }
}

if (typeof window !== "undefined") {
  onBeforeUnmount(() => {
    window.removeEventListener("mousedown", handlePopupClick);
    window.removeEventListener("keydown", handlePopupKeydown);
    window.removeEventListener("scroll", throttledRepositionPopup, true);
    window.removeEventListener("resize", throttledRepositionPopup);
  });
}

watch(popupVisible, (visible) => {
  if (visible) {
    window.addEventListener("mousedown", handlePopupClick);
    window.addEventListener("keydown", handlePopupKeydown);
    window.addEventListener("scroll", throttledRepositionPopup, true);
    window.addEventListener("resize", throttledRepositionPopup);
  } else {
    window.removeEventListener("mousedown", handlePopupClick);
    window.removeEventListener("keydown", handlePopupKeydown);
    window.removeEventListener("scroll", throttledRepositionPopup, true);
    window.removeEventListener("resize", throttledRepositionPopup);
  }
});

function applyHighlights(shouldScroll = props.autofocusHighlight, force = false) {
  const signature = getHighlightsSignature();
  if (!force && signature === lastHighlightSignature.value) {
    return;
  }

  editor.value?.commands.setDuplicateHighlights(props.highlights);
  lastHighlightSignature.value = signature;

  if (!shouldScroll) {
    return;
  }

  nextTick(() => {
    scrollToActiveHighlight(editorShellRef.value);
  });
}

watch(
  () => [props.documentModel.documentId, props.documentModel.html] as const,
  ([documentId], [previousDocumentId]) => {
    if (!editor.value) {
      return;
    }

    const isSameDocument = documentId === previousDocumentId;
    if (editor.value.getHTML() !== props.documentModel.html) {
      editor.value.commands.setContent(props.documentModel.html, { emitUpdate: false });
      applyHighlights(!isSameDocument && props.autofocusHighlight, true);
      return;
    }

    if (!isSameDocument) {
      applyHighlights(props.autofocusHighlight, true);
    }
  }
);

watch(
  () => getHighlightsSignature(),
  () => applyHighlights(),
);

watch(
  () => props.editable,
  (editable) => editor.value?.setEditable(editable)
);

onBeforeUnmount(() => {
  editor.value?.destroy();
});

defineExpose({
  getSnapshot,
  getHTML: () => editor.value?.getHTML() ?? props.documentModel.html,
  getPlainText: () => editor.value?.getText() ?? plainTextFromHtml(props.documentModel.html),
  focus: () => editor.value?.commands.focus()
});
</script>

<template>
  <div ref="editorShellRef" class="dupdoc-editor">
    <div class="dupdoc-editor__toolbar" aria-label="文档编辑工具">
      <div class="dupdoc-editor__toolbar-group dupdoc-editor__toolbar-group--history" aria-label="历史操作">
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="撤销" aria-label="撤销" :aria-disabled="toolbarDisabled || !editor?.can().undo()" :class="{ 'is-disabled': toolbarDisabled || !editor?.can().undo() }" @click="undoChange"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.undo"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="重做" aria-label="重做" :aria-disabled="toolbarDisabled || !editor?.can().redo()" :class="{ 'is-disabled': toolbarDisabled || !editor?.can().redo() }" @click="redoChange"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.redo"></span></button>
      </div>

      <div class="dupdoc-editor__toolbar-group dupdoc-editor__toolbar-group--select">
        <select :value="currentBlockType" :disabled="toolbarDisabled" aria-label="选择文本层级" @change="setBlockType">
          <option value="paragraph">P</option>
          <option value="heading-1">H1</option>
          <option value="heading-2">H2</option>
          <option value="heading-3">H3</option>
        </select>
      </div>

      <div class="dupdoc-editor__toolbar-group" aria-label="基础文字样式">
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="加粗" aria-label="加粗" :disabled="toolbarDisabled" :class="{ active: editor?.isActive('bold') }" @click="editor?.chain().focus().toggleBold().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.bold"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="斜体" aria-label="斜体" :disabled="toolbarDisabled" :class="{ active: editor?.isActive('italic') }" @click="editor?.chain().focus().toggleItalic().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.italic"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="删除线" aria-label="删除线" :disabled="toolbarDisabled" :class="{ active: editor?.isActive('strike') }" @click="editor?.chain().focus().toggleStrike().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.strike"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="行内代码" aria-label="行内代码" :disabled="toolbarDisabled" :class="{ active: editor?.isActive('code') }" @click="editor?.chain().focus().toggleCode().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.code"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="下标" aria-label="下标" :disabled="toolbarDisabled" :class="{ active: editor?.isActive('subscript') }" @click="editor?.chain().focus().toggleSubscript().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.subscript"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="上标" aria-label="上标" :disabled="toolbarDisabled" :class="{ active: editor?.isActive('superscript') }" @click="editor?.chain().focus().toggleSuperscript().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.superscript"></span></button>
      </div>

      <div class="dupdoc-editor__toolbar-group" aria-label="颜色">
        <label class="dupdoc-toolbar-color" data-tooltip="文字颜色" aria-label="文字颜色">
          <span class="dupdoc-toolbar-icon" v-html="toolbarIcons.textColor"></span>
          <input type="color" :disabled="toolbarDisabled" value="#dc2626" @input="setTextColor" />
        </label>
        <label class="dupdoc-toolbar-color" data-tooltip="高亮颜色" aria-label="高亮颜色">
          <span class="dupdoc-toolbar-icon" v-html="toolbarIcons.highlightColor"></span>
          <input type="color" :disabled="toolbarDisabled" value="#fef08a" @input="setHighlightColor" />
        </label>
      </div>

      <div class="dupdoc-editor__toolbar-group" aria-label="段落对齐">
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="左对齐" aria-label="左对齐" :disabled="toolbarDisabled" :class="{ active: editor?.isActive({ textAlign: 'left' }) }" @click="editor?.chain().focus().setTextAlign('left').run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.alignLeft"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="居中对齐" aria-label="居中对齐" :disabled="toolbarDisabled" :class="{ active: editor?.isActive({ textAlign: 'center' }) }" @click="editor?.chain().focus().setTextAlign('center').run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.alignCenter"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="右对齐" aria-label="右对齐" :disabled="toolbarDisabled" :class="{ active: editor?.isActive({ textAlign: 'right' }) }" @click="editor?.chain().focus().setTextAlign('right').run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.alignRight"></span></button>
      </div>

      <div class="dupdoc-editor__toolbar-group" aria-label="列表与结构">
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="无序列表" aria-label="无序列表" :disabled="toolbarDisabled" :class="{ active: editor?.isActive('bulletList') }" @click="editor?.chain().focus().toggleBulletList().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.bulletList"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="有序列表" aria-label="有序列表" :disabled="toolbarDisabled" :class="{ active: editor?.isActive('orderedList') }" @click="editor?.chain().focus().toggleOrderedList().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.orderedList"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="任务列表" aria-label="任务列表" :disabled="toolbarDisabled" :class="{ active: editor?.isActive('taskList') }" @click="editor?.chain().focus().toggleTaskList().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.taskList"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="引用" aria-label="引用" :disabled="toolbarDisabled" :class="{ active: editor?.isActive('blockquote') }" @click="editor?.chain().focus().toggleBlockquote().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.quote"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="插入分割线" aria-label="插入分割线" :disabled="toolbarDisabled" @click="editor?.chain().focus().setHorizontalRule().run()"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.divider"></span></button>
        <button type="button" class="dupdoc-toolbar-button" data-tooltip="插入基础表格" aria-label="插入基础表格" :disabled="toolbarDisabled" @click="insertBasicTable"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.table"></span></button>
      </div>

      <div class="dupdoc-editor__toolbar-group dupdoc-editor__toolbar-group--action" aria-label="查重定位">
        <button type="button" class="dupdoc-toolbar-button dupdoc-toolbar-button--primary" data-tooltip="定位当前重复点" aria-label="定位当前重复点" @click="focusHighlight"><span class="dupdoc-toolbar-icon" v-html="toolbarIcons.locate"></span></button>
      </div>
    </div>
    <div ref="editorBodyRef" class="dupdoc-editor__body">
      <EditorContent v-if="editor" :editor="editor" />
      <Teleport to="body">
        <div
          v-if="popupVisible && popupSelection && slots['selection-popup']"
          ref="popupRef"
          class="dupdoc-selection-popup"
          :style="{
            position: 'fixed',
            top: popupPosition.top + 'px',
            left: popupPosition.left + 'px',
            maxWidth: '100vw',
            maxHeight: '100vh',
            width: 'auto',
            height: 'auto'
          }"
        >
          <slot
            name="selection-popup"
            :document-id="props.documentModel.documentId"
            :selection="popupSelection"
            :overlapping-entries="popupOverlappingEntries"
            :visible="popupVisible"
            :position="popupPosition"
          />
        </div>
      </Teleport>
    </div>
  </div>
</template>

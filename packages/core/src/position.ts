import type { DocumentSelectionChangePayload, RangeMapEntry } from "./types.js";

export interface PopupPosition {
  top: number;
  left: number;
  placement: "above" | "below";
}

export interface SelectionPopupData {
  documentId: string;
  selection: DocumentSelectionChangePayload;
  overlappingEntries: RangeMapEntry[];
}

export function calcSelectionPopupPosition(
  selRect: { top: number; bottom: number; left: number; right: number; height: number },
  viewportWidth: number,
  viewportHeight: number,
  popupRect?: { width: number; height: number }
): PopupPosition {
  const GAP = 8;
  const popupWidth = popupRect?.width ?? 360;
  const popupHeight = popupRect?.height ?? 200;

  let left = selRect.left + (selRect.right - selRect.left) / 2 - popupWidth / 2;
  left = Math.max(8, Math.min(left, viewportWidth - popupWidth - 8));

  let top: number;
  let placement: "above" | "below";

  const spaceBelow = viewportHeight - selRect.bottom;
  const spaceAbove = selRect.top;

  if (spaceBelow >= popupHeight + GAP || spaceBelow >= spaceAbove) {
    placement = "below";
    top = selRect.bottom + GAP;
  } else {
    placement = "above";
    top = selRect.top - popupHeight - GAP;
  }

  return { top, left, placement };
}

export function getDomSelectionRect(): { top: number; bottom: number; left: number; right: number; height: number } | null {
  const domSelection = window.getSelection();
  if (!domSelection || domSelection.isCollapsed || domSelection.rangeCount === 0) {
    return null;
  }

  const domRange = domSelection.getRangeAt(0);
  const rect = domRange.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  return {
    top: rect.top,
    bottom: rect.bottom,
    left: rect.left,
    right: rect.right,
    height: rect.height
  };
}

export function isDomSelectionInsideContainer(containerElement: HTMLElement): boolean {
  const domSelection = window.getSelection();
  if (!domSelection || domSelection.isCollapsed || domSelection.rangeCount === 0) {
    return false;
  }

  const domRange = domSelection.getRangeAt(0);
  const containerRect = containerElement.getBoundingClientRect();

  if (domRange.startContainer) {
    const node = domRange.startContainer;
    if (!containerElement.contains(node.nodeType === Node.TEXT_NODE ? node.parentNode : node)) {
      return false;
    }
  } else {
    return false;
  }

  const rect = domRange.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }

  const isHorizontallyVisible = rect.right > containerRect.left && rect.left < containerRect.right;
  const isVerticallyVisible = rect.bottom > containerRect.top && rect.top < containerRect.bottom;

  return isHorizontallyVisible && isVerticallyVisible;
}
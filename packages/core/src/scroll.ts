export interface ScrollToHighlightOptions {
  behavior?: ScrollBehavior;
  block?: ScrollLogicalPosition;
  selector?: string;
}

export function scrollToActiveHighlight(
  root: HTMLElement | null | undefined,
  options: ScrollToHighlightOptions = {}
): boolean {
  if (!root) {
    return false;
  }

  const selector = options.selector ?? ".dupdoc-highlight--active, .dupdoc-highlight";
  const target = root.querySelector<HTMLElement>(selector);

  if (!target) {
    return false;
  }

  const scrollContainer = findNearestScrollContainer(root, target);
  const containerRect = scrollContainer.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const block = options.block ?? "center";
  const topDelta = targetRect.top - containerRect.top;
  const nextTop = getNextScrollTop(scrollContainer, topDelta, targetRect.height, block);

  scrollContainer.scrollTo({
    top: nextTop,
    left: getNextScrollLeft(scrollContainer, targetRect, containerRect),
    behavior: options.behavior ?? "smooth"
  });

  return true;
}

function findNearestScrollContainer(root: HTMLElement, target: HTMLElement): HTMLElement {
  let current: HTMLElement | null = target.parentElement;

  while (current && current !== root) {
    if (isScrollable(current)) {
      return current;
    }
    current = current.parentElement;
  }

  return isScrollable(root) ? root : root.querySelector<HTMLElement>(".dupdoc-editor__body") ?? root;
}

function isScrollable(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);
  return canScrollY && element.scrollHeight > element.clientHeight;
}

function getNextScrollTop(
  scrollContainer: HTMLElement,
  topDelta: number,
  targetHeight: number,
  block: ScrollLogicalPosition
): number {
  if (block === "start") {
    return scrollContainer.scrollTop + topDelta;
  }

  if (block === "end") {
    return scrollContainer.scrollTop + topDelta - scrollContainer.clientHeight + targetHeight;
  }

  if (block === "nearest" && topDelta >= 0 && topDelta + targetHeight <= scrollContainer.clientHeight) {
    return scrollContainer.scrollTop;
  }

  return scrollContainer.scrollTop + topDelta - scrollContainer.clientHeight / 2 + targetHeight / 2;
}

function getNextScrollLeft(
  scrollContainer: HTMLElement,
  targetRect: DOMRect,
  containerRect: DOMRect
): number {
  if (targetRect.left < containerRect.left) {
    return scrollContainer.scrollLeft + targetRect.left - containerRect.left;
  }

  if (targetRect.right > containerRect.right) {
    return scrollContainer.scrollLeft + targetRect.right - containerRect.right;
  }

  return scrollContainer.scrollLeft;
}

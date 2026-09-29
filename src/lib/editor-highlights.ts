import { getHighlightColor, highlightColorFromBackground, type HighlightColor } from '@/lib/highlight-colors';

function elementColor(element: HTMLElement) {
  return highlightColorFromBackground(element.style.backgroundColor)
    ?? (element.tagName === 'MARK' ? getHighlightColor(element.dataset.highlightColor) : undefined);
}

export function prepareEditorHighlights(root: HTMLElement) {
  // Native highlight commands can split and recolor CSS spans and support Undo.
  root.querySelectorAll('mark').forEach((mark) => {
    const span = document.createElement('span');
    span.style.backgroundColor = elementColor(mark)!.background;
    span.append(...Array.from(mark.childNodes));
    mark.replaceWith(span);
  });
}

export function normalizeHighlightsForMarkdown(root: HTMLElement) {
  const originals = Array.from(root.querySelectorAll<HTMLElement>('mark, span')).filter(elementColor);
  if (!originals.length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments: { node: Text; color: HighlightColor }[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    for (let element = node.parentElement; element && element !== root; element = element.parentElement) {
      const color = elementColor(element);
      if (color) { segments.push({ node, color: color.id }); break; }
    }
  }
  // Flatten nested browser spans using the closest (visible) color.
  for (const { node, color } of segments) {
    const mark = document.createElement('mark');
    mark.dataset.highlightColor = color;
    node.replaceWith(mark);
    mark.append(node);
  }
  for (const element of originals) {
    element.style.removeProperty('background-color');
    if (element.tagName === 'MARK' || !element.getAttribute('style')) element.replaceWith(...Array.from(element.childNodes));
  }

  // Keep a continuous highlight around inline formatting, without nested == delimiters.
  const merge = (element: Element) => {
    for (const child of Array.from(element.children)) merge(child);
    for (const child of Array.from(element.children)) {
      if (child.tagName === 'MARK' || !/^(STRONG|B|EM|I|S|DEL|A|CODE|SPAN)$/.test(child.tagName)) continue;
      const children = Array.from(child.childNodes);
      const first = children[0];
      if (first instanceof HTMLElement && first.tagName === 'MARK'
        && children.every((item) => item instanceof HTMLElement && item.tagName === 'MARK' && item.dataset.highlightColor === first.dataset.highlightColor)) {
        const mark = first.cloneNode(false) as HTMLElement;
        for (const inner of children as HTMLElement[]) inner.replaceWith(...Array.from(inner.childNodes));
        child.replaceWith(mark);
        mark.append(child);
      }
    }
    for (const child of Array.from(element.children)) {
      if (!(child instanceof HTMLElement) || child.tagName !== 'MARK') continue;
      while (child.nextSibling instanceof HTMLElement && child.nextSibling.tagName === 'MARK'
        && child.nextSibling.dataset.highlightColor === child.dataset.highlightColor) {
        const next = child.nextSibling;
        child.append(...Array.from(next.childNodes));
        next.remove();
      }
    }
  };
  merge(root);
}

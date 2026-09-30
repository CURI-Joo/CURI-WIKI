import { textColorFromStyle, type TextColor } from '@/lib/text-colors';

function elementColor(element: HTMLElement) {
  return textColorFromStyle(element.style.color || (element.tagName === 'FONT' ? element.getAttribute('color') ?? '' : ''));
}

export function prepareEditorTextColors(root: HTMLElement) {
  for (const element of root.querySelectorAll<HTMLElement>('[style], font, [data-text-color]')) {
    // Code block contents are literal source, not rich text formatting.
    if (element.closest('pre')) continue;
    const color = elementColor(element);
    if (color) element.dataset.textColor = color.id;
    else delete element.dataset.textColor;
  }
}

/** Flatten browser-created color spans on a clone while retaining highlight and inline formatting. */
export function normalizeTextColorsForMarkdown(root: HTMLElement) {
  const originals = Array.from(root.querySelectorAll<HTMLElement>('[style], font, [data-text-color]'))
    .filter(element => !element.closest('pre') && elementColor(element));
  if (!originals.length) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments: { node: Text; color: TextColor }[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.parentElement?.closest('pre')) continue;
    for (let element = node.parentElement; element && element !== root; element = element.parentElement) {
      const color = elementColor(element);
      if (color) { segments.push({ node, color: color.id }); break; }
    }
  }
  for (const { node, color } of segments) {
    const span = document.createElement('span');
    span.dataset.textColor = color;
    node.replaceWith(span);
    span.append(node);
  }
  for (const element of originals) {
    element.style.removeProperty('color');
    element.removeAttribute('color');
    delete element.dataset.textColor;
    if ((element.tagName === 'SPAN' || element.tagName === 'FONT') && !element.getAttribute('style')) {
      element.replaceWith(...Array.from(element.childNodes));
    }
  }
  const isColor = (node: Node | null | undefined): node is HTMLElement =>
    node instanceof HTMLElement && !!node.dataset.textColor;
  const merge = (element: Element) => {
    for (const child of Array.from(element.children)) merge(child);
    for (const child of Array.from(element.children)) {
      if (isColor(child) || !/^(STRONG|B|EM|I|S|DEL|A|CODE|SPAN|MARK)$/.test(child.tagName)) continue;
      const children = Array.from(child.childNodes);
      const first = children[0];
      if (isColor(first) && children.every(node => isColor(node) && node.dataset.textColor === first.dataset.textColor)) {
        const span = first.cloneNode(false) as HTMLElement;
        for (const inner of children as HTMLElement[]) inner.replaceWith(...Array.from(inner.childNodes));
        child.replaceWith(span);
        span.append(child);
      }
    }
    for (const child of Array.from(element.children)) {
      if (!isColor(child)) continue;
      while (isColor(child.nextSibling) && child.nextSibling.dataset.textColor === child.dataset.textColor) {
        const next = child.nextSibling;
        child.append(...Array.from(next.childNodes));
        next.remove();
      }
    }
  };
  merge(root);
}

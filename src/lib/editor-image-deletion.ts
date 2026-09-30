const isImageFigure = (node: Node | undefined | null): node is HTMLElement =>
  node instanceof HTMLElement && node.matches('figure[data-kind="image"], figure[data-kind="video"]');

/** Find an explicitly selected image, or the image directly beside an empty caret boundary. */
export function imageAtDeletePosition(root: HTMLElement, range: Range, backward: boolean): HTMLElement | null {
  if (!root.contains(range.commonAncestorContainer)) return null;
  if (!range.collapsed) {
    const node = range.startContainer.childNodes[range.startOffset];
    return range.startContainer === range.endContainer && range.endOffset === range.startOffset + 1 && isImageFigure(node)
      ? node : null;
  }

  let node: Node = range.startContainer;
  const element = node instanceof Element ? node : node.parentElement;
  // Captions remain ordinary editable text, including at their start/end.
  if (element?.closest('figure[data-kind="image"], figure[data-kind="video"]')) return null;
  let offset = range.startOffset;
  for (;;) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (offset !== (backward ? 0 : node.textContent?.length)) return null;
    } else {
      let index = backward ? offset - 1 : offset;
      while (index >= 0 && index < node.childNodes.length) {
        const candidate = node.childNodes[index];
        if (isImageFigure(candidate)) return candidate;
        const formattingWhitespace = node === root && candidate.nodeType === Node.TEXT_NODE && !candidate.textContent?.trim();
        const emptyParagraphBreak = candidate.nodeName === 'BR' && !node.textContent;
        if (!formattingWhitespace && !emptyParagraphBreak) return null;
        index += backward ? -1 : 1;
      }
    }
    if (node === root || node instanceof Element && node.matches('td, th, li, blockquote, pre')) return null;
    const parent = node.parentNode;
    if (!parent) return null;
    offset = Array.prototype.indexOf.call(parent.childNodes, node) + (backward ? 0 : 1);
    node = parent;
  }
}

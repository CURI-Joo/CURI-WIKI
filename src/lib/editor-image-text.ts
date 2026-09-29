export const IMAGE_TEXT_SELECTOR = '[data-kind="image-text"]';
export const IMAGE_TEXT_BODY_SELECTOR = '[data-kind="image-text-body"]';

export function emptyParagraph() {
  const paragraph = document.createElement('p');
  paragraph.append(document.createElement('br'));
  return paragraph;
}

export function createImageTextGroup(figure: HTMLElement) {
  const group = document.createElement('div');
  group.dataset.kind = 'image-text';
  const body = document.createElement('div');
  body.dataset.kind = 'image-text-body';
  figure.before(group);
  group.append(figure, body);
  // Starting side writing must not pull existing below-image content into the column.
  body.append(emptyParagraph());
  figure.dataset.wrap = 'true';
  return { group, body };
}

export function imageWritingContext(root: HTMLElement, range: Range | null) {
  if (!range || !root.contains(range.commonAncestorContainer)) return { figure: null, beside: false };
  const node = range.startContainer;
  const element = node instanceof Element ? node : node.parentElement;
  const group = element?.closest(IMAGE_TEXT_SELECTOR);
  const groupedImage = group?.querySelector<HTMLElement>(':scope > figure[data-kind="image"]');
  if (groupedImage) return { figure: groupedImage, beside: true };

  const selected = !range.collapsed && node === range.endContainer
    && range.endOffset === range.startOffset + 1 ? node.childNodes[range.startOffset] : null;
  const figure = selected instanceof HTMLElement && selected.matches('figure[data-kind="image"]')
    ? selected : element?.closest<HTMLElement>('figure[data-kind="image"]');
  if (figure) return { figure, beside: !!figure.closest(IMAGE_TEXT_SELECTOR) };

  let block = element;
  while (block?.parentElement && block.parentElement !== root) block = block.parentElement;
  let previous = node === root ? root.childNodes[range.startOffset - 1] : block?.previousSibling;
  while (previous && (!previous.textContent?.trim() && !(previous instanceof Element && previous.querySelector('img, input, hr, table')))) {
    previous = previous.previousSibling;
  }
  const previousElement = previous instanceof HTMLElement ? previous : null;
  const nearby = previousElement?.matches('figure[data-kind="image"]') ? previousElement
    : previousElement?.matches(IMAGE_TEXT_SELECTOR) ? previousElement.querySelector<HTMLElement>(':scope > figure') : null;
  return { figure: nearby ?? null, beside: false };
}

const isEmptyBlock = (node: Element) => !node.textContent?.trim()
  && !node.matches('img, input, hr, table, pre')
  && !node.querySelector('img, input, hr, table, pre');

/** Move everything after the caret out of the side column, retaining block formatting. */
export function continueBelowImageText(group: HTMLElement, caret?: Range | null): HTMLElement {
  const body = group.querySelector<HTMLElement>(`:scope > ${IMAGE_TEXT_BODY_SELECTOR}`);
  if (body && caret && body.contains(caret.startContainer)) {
    const tail = caret.cloneRange();
    tail.collapse(true);
    tail.setEnd(body, body.childNodes.length);
    const fragment = tail.extractContents();
    // Range extraction can leave an empty split heading/list/paragraph in the column.
    while (body.lastElementChild && isEmptyBlock(body.lastElementChild)) body.lastElementChild.remove();
    if (!body.firstElementChild) body.append(emptyParagraph());

    if (!fragment.firstElementChild) {
      const paragraph = emptyParagraph();
      if (fragment.textContent?.trim()) paragraph.replaceChildren(fragment);
      group.after(paragraph);
      return paragraph;
    }
    const first = fragment.firstElementChild as HTMLElement;
    if (isEmptyBlock(first)) {
      const paragraph = emptyParagraph();
      first.replaceWith(paragraph);
    }
    const target = fragment.firstElementChild as HTMLElement;
    group.after(fragment);
    return target;
  }

  const next = group.nextElementSibling;
  if (next?.tagName === 'P') return next as HTMLElement;
  const paragraph = emptyParagraph();
  group.after(paragraph);
  return paragraph;
}

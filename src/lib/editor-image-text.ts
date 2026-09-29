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
  let next = figure.nextSibling;
  figure.before(group);
  group.append(figure, body);
  // Include the existing description, but leave subsequent sections/media below.
  while (next) {
    const following = next.nextSibling;
    if (next instanceof HTMLElement) {
      if (!next.matches('p, ul, ol, blockquote') || next.querySelector('figure, img, table')) break;
    } else if (next.textContent?.trim()) break;
    body.append(next);
    next = following;
  }
  if (!body.firstElementChild) body.append(emptyParagraph());
  figure.dataset.wrap = 'true';
  return { group, body };
}

export function unwrapImageTextGroup(group: HTMLElement) {
  const figure = group.querySelector<HTMLElement>(':scope > figure');
  const body = group.querySelector<HTMLElement>(`:scope > ${IMAGE_TEXT_BODY_SELECTOR}`);
  if (!figure || !body) return;
  figure.dataset.wrap = 'false';
  group.replaceWith(figure, ...Array.from(body.childNodes));
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

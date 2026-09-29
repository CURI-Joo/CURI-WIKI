export type ImageLayout = 'left' | 'center' | 'right';

/** Keep alignment and dragging inside the available content width, including after a viewport resize. */
export function getImageLayoutStyles({
  layout, width, offset, wrap,
}: {
  layout: ImageLayout;
  width: number;
  offset: number;
  wrap: boolean;
}) {
  // Wrapped images live in an explicit two-column group, never a document-wide float.
  if (wrap) {
    return {
      width: `min(100%, ${width}px)`,
      float: 'none',
      clear: 'none',
      marginLeft: '0px',
      marginRight: '0px',
      transform: 'none',
    };
  }

  const shift = wrap ? 0 : offset;
  const position = layout === 'left' ? `${shift}px`
    : layout === 'right' ? `calc(100% - ${width}px + ${shift}px)`
      : `calc((100% - ${width}px) / 2 + ${shift}px)`;

  return {
    width: `min(100%, ${width}px)`,
    float: 'none',
    clear: 'both',
    marginLeft: `clamp(0px, ${position}, max(0px, calc(100% - ${width}px)))`,
    marginRight: '0px',
    transform: 'none',
  };
}

export function constrainImageOffset(offset: number, containerWidth: number, imageWidth: number, layout: ImageLayout) {
  const space = Math.max(0, containerWidth - imageWidth);
  if (space === 0) return 0;
  const origin = layout === 'left' ? 0 : layout === 'right' ? space : space / 2;
  return Math.max(-origin, Math.min(space - origin, offset));
}

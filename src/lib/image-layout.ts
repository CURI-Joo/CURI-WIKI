export type ImageLayout = 'left' | 'center' | 'right';

export const IMAGE_WRAP_GAP = 12;

/** Keep alignment and dragging inside the available content width, including after a viewport resize. */
export function getImageLayoutStyles({
  layout, width, offset, wrap,
}: {
  layout: ImageLayout;
  width: number;
  offset: number;
  wrap: boolean;
}) {
  if (wrap && layout !== 'center') {
    return {
      width: `min(calc(100% - ${IMAGE_WRAP_GAP}px), ${width}px)`,
      float: layout,
      clear: 'none',
      marginLeft: layout === 'right' ? `${IMAGE_WRAP_GAP}px` : '0px',
      marginRight: layout === 'left' ? `${IMAGE_WRAP_GAP}px` : '0px',
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

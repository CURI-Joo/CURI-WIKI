import { describe, expect, it } from 'vitest';
import { constrainImageOffset, type ImageLayout } from '@/lib/image-layout';

describe('image movement within the document', () => {
  it.each<ImageLayout>(['left', 'center', 'right'])('keeps %s aligned images inside every available width', (layout) => {
    for (const container of [180, 308, 814]) {
      for (const requestedWidth of [120, 320, 900, 1100]) {
        const width = Math.min(requestedWidth, container);
        const space = container - width;
        const origin = layout === 'left' ? 0 : layout === 'right' ? space : space / 2;
        for (const movement of [-280, -50, 0, 50, 280]) {
          const left = origin + constrainImageOffset(movement, container, width, layout);
          expect(left).toBeGreaterThanOrEqual(0);
          expect(left + width).toBeLessThanOrEqual(container);
        }
      }
    }
  });

  it('preserves an existing position when there is room for it', () => {
    expect(constrainImageOffset(100, 814, 320, 'center')).toBe(100);
    expect(constrainImageOffset(-100, 814, 320, 'right')).toBe(-100);
  });

  it('prevents sideways movement when the image fills the editor', () => {
    expect(constrainImageOffset(280, 308, 900, 'center')).toBe(0);
    expect(constrainImageOffset(-280, 308, 900, 'center')).toBe(0);
  });
});

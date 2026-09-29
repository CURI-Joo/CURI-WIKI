export const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: '노랑', background: '#fef08a', rgb: 'rgb(254, 240, 138)' },
  { id: 'green', label: '초록', background: '#bbf7d0', rgb: 'rgb(187, 247, 208)' },
  { id: 'blue', label: '하늘', background: '#bae6fd', rgb: 'rgb(186, 230, 253)' },
  { id: 'pink', label: '분홍', background: '#fbcfe8', rgb: 'rgb(251, 207, 232)' },
  { id: 'purple', label: '보라', background: '#ddd6fe', rgb: 'rgb(221, 214, 254)' },
] as const;

export type HighlightColor = typeof HIGHLIGHT_COLORS[number]['id'];

export function getHighlightColor(value: string | undefined) {
  return HIGHLIGHT_COLORS.find((color) => color.id === value) ?? HIGHLIGHT_COLORS[0];
}

export function highlightColorFromBackground(value: string) {
  const normalized = value.toLowerCase().replace(/\s/g, '');
  return HIGHLIGHT_COLORS.find((color) =>
    normalized === color.background || normalized === color.rgb.replace(/\s/g, ''),
  );
}

export function highlightedMarkdown(content: string, color: HighlightColor) {
  return `==${content}==${color === 'yellow' ? '' : `{${color}}`}`;
}

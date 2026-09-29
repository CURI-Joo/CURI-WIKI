export const HIGHLIGHT_COLORS = [
  // Light tints of the active CURI brand/status tokens keep body text readable.
  { id: 'curi', label: 'CURI 핑크', background: '#f2bfd5', rgb: 'rgb(242, 191, 213)' }, // --curi-pink 30% on white
  { id: 'pink', label: '분홍', background: '#fbcfe8', rgb: 'rgb(251, 207, 232)' },
  { id: 'red', label: '빨강', background: '#fbd0d0', rgb: 'rgb(251, 208, 208)' }, // --error 25% on white
  { id: 'orange', label: '주황', background: '#fcddaa', rgb: 'rgb(252, 221, 170)' }, // --warning 35% on white
  { id: 'yellow', label: '노랑', background: '#fef08a', rgb: 'rgb(254, 240, 138)' },
  { id: 'green', label: '초록', background: '#bbf7d0', rgb: 'rgb(187, 247, 208)' },
  { id: 'mint', label: '민트', background: '#c1e4e6', rgb: 'rgb(193, 228, 230)' }, // --success + --info, 30% on white
  { id: 'blue', label: '하늘', background: '#bae6fd', rgb: 'rgb(186, 230, 253)' },
  { id: 'purple', label: '보라', background: '#ddd6fe', rgb: 'rgb(221, 214, 254)' },
  { id: 'gray', label: '회색', background: '#dfe0e3', rgb: 'rgb(223, 224, 227)' }, // --text-muted 30% on white
] as const;

export type HighlightColor = typeof HIGHLIGHT_COLORS[number]['id'];
export const HIGHLIGHT_COLOR_PATTERN = HIGHLIGHT_COLORS.map((color) => color.id).join('|');

export function getHighlightColor(value: string | undefined) {
  return HIGHLIGHT_COLORS.find((color) => color.id === value)
    ?? HIGHLIGHT_COLORS.find((color) => color.id === 'yellow')!;
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

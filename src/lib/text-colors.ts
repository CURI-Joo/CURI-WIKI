// Deeper counterparts to the pastel highlighter colors, for readable text on paper.
export const TEXT_COLORS = [
  { id: 'black', label: '검정', color: '#111118' },
  { id: 'gray', label: '회색', color: '#5c5d66' },
  { id: 'curi', label: 'CURI 핑크', color: '#b51f60' },
  { id: 'red', label: '빨강', color: '#be252c' },
  { id: 'orange', label: '주황', color: '#a44a16' },
  { id: 'gold', label: '황토', color: '#80600c' },
  { id: 'green', label: '초록', color: '#287346' },
  { id: 'teal', label: '청록', color: '#176c73' },
  { id: 'blue', label: '파랑', color: '#245bbb' },
  { id: 'purple', label: '보라', color: '#7442aa' },
] as const;

export type TextColor = typeof TEXT_COLORS[number]['id'];
export const TEXT_COLOR_PATTERN = TEXT_COLORS.map(color => color.id).join('|');
const markerPattern = new RegExp(`\\{\\{color:(?:${TEXT_COLOR_PATTERN})\\}\\}|\\{\\{/color\\}\\}`, 'g');

export function getTextColor(id: string | undefined) {
  return TEXT_COLORS.find(color => color.id === id) ?? TEXT_COLORS[0];
}

export function textColorFromStyle(value: string) {
  const normalized = value.toLowerCase().replace(/\s/g, '');
  return TEXT_COLORS.find(({ color }) => {
    const rgb = color.slice(1).match(/../g)!.map(part => parseInt(part, 16)).join(',');
    return normalized === color || normalized === `rgb(${rgb})` || normalized === `rgba(${rgb},1)`;
  });
}

export function textColorMarkdown(content: string, color: TextColor) {
  return `{{color:${color}}}${content}{{/color}}`;
}

export function stripTextColorMarkup(content: string) {
  return content.replace(markerPattern, '');
}

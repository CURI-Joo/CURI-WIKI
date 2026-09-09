const LEGACY_CATEGORY_ID_MAP: Record<string, string> = {
  'cat-curi-ai': 'cat-company',
  'cat-wame': 'cat-company',
};

const LEGACY_CATEGORY_SLUG_MAP: Record<string, string> = {
  'curi-ai': 'company',
  wame: 'company',
  etc: 'guides',
};

export function normalizeCategoryId(categoryId: string): string {
  return LEGACY_CATEGORY_ID_MAP[categoryId] ?? categoryId;
}

export function normalizeCategorySlug(categorySlug: string): string {
  return LEGACY_CATEGORY_SLUG_MAP[categorySlug] ?? categorySlug;
}


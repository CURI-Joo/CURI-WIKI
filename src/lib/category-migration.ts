const LEGACY_CATEGORY_ID_MAP: Record<string, string> = {
  'cat-curi-ai': 'cat-company',
  'cat-wame': 'cat-projects',
};

const DATABASE_CATEGORY_ID_FALLBACK_MAP: Record<string, string> = {
  'cat-company': 'cat-curi-ai',
  'cat-projects': 'cat-wame',
};

const LEGACY_CATEGORY_SLUG_MAP: Record<string, string> = {
  'curi-ai': 'company',
  wame: 'projects',
  etc: 'guides',
};

export function normalizeCategoryId(categoryId: string): string {
  return LEGACY_CATEGORY_ID_MAP[categoryId] ?? categoryId;
}

export function resolveCategoryIdForDatabase(
  categoryId: string,
  availableCategoryIds?: Iterable<string>
): string {
  const normalizedCategoryId = normalizeCategoryId(categoryId);
  const fallbackCategoryId = DATABASE_CATEGORY_ID_FALLBACK_MAP[normalizedCategoryId];

  if (!availableCategoryIds) {
    return fallbackCategoryId ?? normalizedCategoryId;
  }

  const availableSet = new Set(availableCategoryIds);
  if (availableSet.has(normalizedCategoryId)) {
    return normalizedCategoryId;
  }

  if (fallbackCategoryId && availableSet.has(fallbackCategoryId)) {
    return fallbackCategoryId;
  }

  return normalizedCategoryId;
}

export function normalizeCategorySlug(categorySlug: string): string {
  return LEGACY_CATEGORY_SLUG_MAP[categorySlug] ?? categorySlug;
}

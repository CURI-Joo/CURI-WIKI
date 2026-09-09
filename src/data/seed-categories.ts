import type { Category } from '@/types';

export const seedCategories: Category[] = [
  { id: 'cat-company', name: 'Company', slug: 'company', icon: 'Building2', parent_id: null, sort_order: 0 },
  { id: 'cat-projects', name: 'Projects', slug: 'projects', icon: 'FolderKanban', parent_id: null, sort_order: 1 },
  { id: 'cat-etc', name: 'Guides', slug: 'guides', icon: 'BookOpen', parent_id: null, sort_order: 2 },
  { id: 'cat-secret', name: 'Secret', slug: 'secret', icon: 'Shield', parent_id: null, sort_order: 3 },
];

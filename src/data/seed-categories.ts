import type { Category } from '@/types';

export const seedCategories: Category[] = [
  { id: 'cat-curi-ai', name: 'CURI AI', slug: 'curi-ai', icon: 'Bot', parent_id: null, sort_order: 0 },
  { id: 'cat-projects', name: 'Projects', slug: 'projects', icon: 'FolderKanban', parent_id: 'cat-curi-ai', sort_order: 1 },
  { id: 'cat-secret', name: 'Secret', slug: 'secret', icon: 'Shield', parent_id: null, sort_order: 2 },
  { id: 'cat-wame', name: 'WAME', slug: 'wame', icon: 'MessageSquare', parent_id: null, sort_order: 3 },
  { id: 'cat-etc', name: 'ETC', slug: 'etc', icon: 'MoreHorizontal', parent_id: null, sort_order: 4 },
];

import type { Category } from '@/types';

export const seedCategories: Category[] = [
  { id: 'cat-home', name: '홈', slug: 'home', icon: 'Home', parent_id: null, sort_order: 0 },
  { id: 'cat-projects', name: '프로젝트', slug: 'projects', icon: 'FolderKanban', parent_id: null, sort_order: 1 },
  { id: 'cat-product', name: '제품', slug: 'product', icon: 'Package', parent_id: null, sort_order: 2 },
  { id: 'cat-tech-llm', name: '기술 · LLM', slug: 'tech-llm', icon: 'Cpu', parent_id: null, sort_order: 3 },
  { id: 'cat-engineering', name: '엔지니어링', slug: 'engineering', icon: 'Code2', parent_id: null, sort_order: 4 },
  { id: 'cat-qa', name: 'QA · Known Issues', slug: 'qa-known-issues', icon: 'Bug', parent_id: null, sort_order: 5 },
  { id: 'cat-design', name: '디자인 시스템', slug: 'design-system', icon: 'Palette', parent_id: null, sort_order: 6 },
  { id: 'cat-content', name: '콘텐츠 · 브랜드', slug: 'content-brand', icon: 'Megaphone', parent_id: null, sort_order: 7 },
  { id: 'cat-ops', name: '운영', slug: 'operations', icon: 'Settings', parent_id: null, sort_order: 8 },
  { id: 'cat-onboarding', name: '온보딩', slug: 'onboarding', icon: 'GraduationCap', parent_id: null, sort_order: 9 },
  { id: 'cat-curi-ai', name: 'CURI AI', slug: 'curi-ai', icon: 'Bot', parent_id: null, sort_order: 10 },
  { id: 'cat-wame', name: 'WAME', slug: 'wame', icon: 'MessageSquare', parent_id: null, sort_order: 11 },
  { id: 'cat-etc', name: 'ETC', slug: 'etc', icon: 'MoreHorizontal', parent_id: null, sort_order: 12 },
];

import type { Tag, DocumentTag, DocumentAccess, AuditLog } from '@/types';

export const seedTags: Tag[] = [
  { id: 'tag-ai', name: 'AI', slug: 'ai' },
  { id: 'tag-llm', name: 'LLM', slug: 'llm' },
  { id: 'tag-guide', name: '가이드', slug: 'guide' },
  { id: 'tag-template', name: '템플릿', slug: 'template' },
  { id: 'tag-onboarding', name: '온보딩', slug: 'onboarding' },
  { id: 'tag-design', name: '디자인', slug: 'design' },
  { id: 'tag-qa', name: 'QA', slug: 'qa' },
  { id: 'tag-brand', name: '브랜드', slug: 'brand' },
  { id: 'tag-ops', name: '운영', slug: 'ops' },
  { id: 'tag-security', name: '보안', slug: 'security' },
];

export const seedDocumentTags: DocumentTag[] = [];

export const seedDocumentAccess: DocumentAccess[] = [];

export const seedAuditLogs: AuditLog[] = [];

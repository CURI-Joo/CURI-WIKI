'use client';

import { useMemo } from 'react';
import { renderDocumentMarkdown } from '@/lib/document-markdown';

export function MarkdownRenderer({ content }: { content: string }) {
  const html = useMemo(() => renderDocumentMarkdown(content), [content]);
  return <div className="prose-curi" dangerouslySetInnerHTML={{ __html: html }} />;
}

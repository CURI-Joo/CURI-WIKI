import { marked } from 'marked';

type ImageDocument = { status?: string; category_id?: string | null; content_markdown?: string };

/** Only images actually embedded in a publicly readable document can bypass sign-in. */
export function isPublicDocumentImage(document: ImageDocument | null, id: string, origin: string) {
  if (!document || document.status !== 'Published' || !document.category_id || document.category_id === 'cat-secret') return false;
  let found = false;
  marked.walkTokens(marked.lexer(document.content_markdown ?? ''), token => {
    if (token.type !== 'image') return;
    try {
      const url = new URL(token.href, origin);
      if (url.origin === origin && url.pathname === `/api/upload/${id}/file`) found = true;
    } catch { /* Invalid Markdown destinations are not public image references. */ }
  });
  return found;
}

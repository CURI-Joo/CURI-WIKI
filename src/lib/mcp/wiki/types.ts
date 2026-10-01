/**
 * The wiki side of the server. Route handlers wire this to Supabase; tests wire
 * it to an in-memory fake. Adapt the field names here if the real `documents`
 * table differs - this interface is the only place the schema shows up.
 */

export interface WikiUser {
  id: string;
  email: string | null;
  display_name: string | null;
  approved: boolean;
  role?: string;
}

export interface WikiCategory {
  slug: string;
  name: string;
}

export interface WikiDocument {
  id: string;
  title: string;
  slug: string;
  category_slug: string;
  summary: string | null;
  content_markdown: string;
  status: string;
  tags: string[];
  source_url: string | null;
  drive_url?: string | null;
  author_id: string;
  owner_id: string | null;
  updated_at?: string;
}

export interface CreateDocumentInput {
  title: string;
  slug: string;
  category_slug: string;
  content_markdown: string;
  summary: string;
  status: string;
  tags: string[];
  source_url?: string | null;
  drive_url?: string | null;
}

export interface WikiStore {
  uploadImage(input: {
    bytes: Uint8Array;
    file_name: string;
    mime_type: string;
    document_id: string;
  }, uploaderId: string): Promise<{ id: string; markdown_url: string }>;
  getUser(userId: string): Promise<WikiUser | null>;
  listCategories(): Promise<WikiCategory[]>;
  searchDocuments(params: {
    query?: string;
    category_slug?: string;
    limit?: number;
  }): Promise<WikiDocument[]>;
  getDocument(idOrSlug: string): Promise<WikiDocument | null>;
  createDocument(input: CreateDocumentInput, authorId: string): Promise<WikiDocument>;
  updateDocument(
    idOrSlug: string,
    patch: Partial<CreateDocumentInput>,
    editorId: string,
  ): Promise<WikiDocument>;
}

// ─── Enums ───────────────────────────────────────────────
export type Role = 'ADMIN' | 'CEO' | 'MEMBER';
export type ProfileStatus = 'active' | 'inactive';
export type ProjectStatus = 'Discovery' | 'Development' | 'Testing' | 'Production' | 'Archived';
export type DocumentationStatus = 'Complete' | 'Needs Update' | 'Not Documented';
export type DocStatus = 'Draft' | 'Published' | 'Archived';
export type Visibility = 'COMPANY' | 'RESTRICTED';
export type ExternalStatus = 'INTERNAL_ONLY' | 'REVIEW_REQUIRED' | 'EXTERNAL_OK';
export type AccessLevel = 'VIEW' | 'EDIT';

export type CategorySlug =
  | 'home'
  | 'projects'
  | 'product'
  | 'tech-llm'
  | 'engineering'
  | 'qa-known-issues'
  | 'design-system'
  | 'content-brand'
  | 'operations'
  | 'onboarding'
  | 'curi-ai'
  | 'wame'
  | 'etc';

// ─── Data Models ─────────────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: Role;
  title: string;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  summary: string;
  status: ProjectStatus;
  owner_id: string;
  team: string;
  repository_url: string | null;
  stack: string[];
  documentation_status: DocumentationStatus;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: CategorySlug;
  icon: string;
  parent_id: string | null;
  sort_order: number;
}

export interface Document {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content_markdown: string;
  category_id: string;
  project_id: string | null;
  owner_id: string;
  status: DocStatus;
  visibility: Visibility;
  external_status: ExternalStatus;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface DocumentAccess {
  id: string;
  document_id: string;
  user_id: string;
  access_level: AccessLevel;
}

export interface Attachment {
  id: string;
  document_id: string;
  storage_key: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

export interface DocumentRevision {
  id: string;
  document_id: string;
  version: number;
  content_markdown: string;
  change_summary: string;
  created_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface DocumentTag {
  document_id: string;
  tag_id: string;
}

// ─── Repository Interface ────────────────────────────────
export interface Repository {
  // Profiles
  getProfile(id: string): Promise<Profile | null>;
  getProfiles(): Promise<Profile[]>;

  // Projects
  getProjects(): Promise<Project[]>;
  getProject(slug: string): Promise<Project | null>;

  // Documents
  getDocuments(filters?: DocumentFilters): Promise<Document[]>;
  getDocument(slug: string): Promise<Document | null>;
  getDocumentById(id: string): Promise<Document | null>;
  createDocument(doc: Omit<Document, 'id' | 'created_at' | 'updated_at'>): Promise<Document>;
  updateDocument(id: string, doc: Partial<Document>): Promise<Document>;

  // Categories
  getCategories(): Promise<Category[]>;

  // Tags
  getTags(): Promise<Tag[]>;
  getDocumentTags(documentId: string): Promise<Tag[]>;

  // Access
  getDocumentAccess(documentId: string): Promise<DocumentAccess[]>;
  getUserAccessibleDocIds(userId: string): Promise<string[]>;

  // Revisions
  getDocumentRevisions(documentId: string): Promise<DocumentRevision[]>;

  // Audit
  getAuditLogs(filters?: { resource_id?: string }): Promise<AuditLog[]>;
  createAuditLog(log: Omit<AuditLog, 'id' | 'created_at'>): Promise<void>;

  // Search
  search(query: string, userId: string): Promise<SearchResult[]>;
}

export interface DocumentFilters {
  category_id?: string;
  project_id?: string;
  status?: DocStatus;
  visibility?: Visibility;
  owner_id?: string;
}

export interface SearchResult {
  type: 'document' | 'project';
  id: string;
  title: string;
  summary: string;
  slug: string;
  category?: string;
  highlight?: string;
}

// ─── Issue Tracking ─────────────────────────────────────
export type IssueProject = 'Admin' | 'Healthcare' | 'Dashboard' | 'Wiki';
export type IssueStatus = '이슈 등록' | '해결 중' | '이슈 해결';
export type IssuePriority = '즉시 수정 필요' | '차차 수정 필요' | '개선 사항';
export type IssueActivityType = 'created' | 'status_changed';

export interface Issue {
  id: string;
  title: string;
  description: string;
  project: IssueProject;
  status: IssueStatus;
  priority: IssuePriority;
  reporter_id: string;
  assignee_id: string | null;
  attachments: string[];
  created_at: string;
  updated_at: string;
}

export interface IssueActivity {
  id: string;
  issue_id: string;
  actor_id: string;
  type: IssueActivityType;
  detail: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

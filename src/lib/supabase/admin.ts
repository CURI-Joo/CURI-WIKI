import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProfileStatus, Role } from '@/types';

type AttachmentRow = Record<string, unknown> & {
  id: string;
  issue_id: string | null;
  document_id: string | null;
  storage_key: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
};

type AttachmentInsert = Record<string, unknown> & {
  issue_id?: string | null;
  document_id?: string | null;
  storage_key: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  uploaded_by: string;
};

type ProfileRow = Record<string, unknown> & {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: Role;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
};

type ProfileUpdate = Record<string, unknown> & {
  status?: ProfileStatus;
  role?: Role;
  updated_at?: string;
};

type AdminDatabase = {
  public: {
    Tables: {
      attachments: {
        Row: AttachmentRow;
        Insert: AttachmentInsert;
        Update: Partial<Omit<AttachmentRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: never;
        Update: ProfileUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};

let adminClient: SupabaseClient<AdminDatabase> | null = null;

export function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin environment variables are required.');
  }

  if (!adminClient) {
    adminClient = createClient<AdminDatabase>(supabaseUrl, serviceRoleKey);
  }

  return adminClient;
}

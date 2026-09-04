import type { Repository } from '@/types';
import { mockRepository } from '@/data/mock-repository';

// In demo mode, always use mock repository.
// When Supabase is configured, swap this with SupabaseRepository.
export function getRepository(): Repository {
  return mockRepository;
}

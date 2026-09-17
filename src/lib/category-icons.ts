import {
  BookOpen,
  Building2,
  Cpu,
  FileText,
  FolderKanban,
  Lightbulb,
  Megaphone,
  Shield,
  Users,
  Wrench,
  type LucideProps,
  type LucideIcon,
} from 'lucide-react';
import { createElement } from 'react';

export const CATEGORY_ICON_OPTIONS = [
  { name: 'Building2', label: 'Company', icon: Building2 },
  { name: 'FolderKanban', label: 'Projects', icon: FolderKanban },
  { name: 'BookOpen', label: 'Guides', icon: BookOpen },
  { name: 'Shield', label: 'Security', icon: Shield },
  { name: 'Wrench', label: 'Tools', icon: Wrench },
  { name: 'Cpu', label: 'Tech', icon: Cpu },
  { name: 'Megaphone', label: 'Marketing', icon: Megaphone },
  { name: 'Users', label: 'Team', icon: Users },
  { name: 'Lightbulb', label: 'Ideas', icon: Lightbulb },
  { name: 'FileText', label: 'Docs', icon: FileText },
] as const;

export type CategoryIconName = (typeof CATEGORY_ICON_OPTIONS)[number]['name'];

const CATEGORY_ICON_MAP = new Map<string, LucideIcon>(
  CATEGORY_ICON_OPTIONS.map((option) => [option.name, option.icon])
);

export function getCategoryIconComponent(iconName?: string | null): LucideIcon {
  if (!iconName) return Building2;
  return CATEGORY_ICON_MAP.get(iconName) ?? Building2;
}

type CategoryIconProps = LucideProps & {
  iconName?: string | null;
};

export function CategoryIcon({ iconName, ...props }: CategoryIconProps) {
  const Icon = getCategoryIconComponent(iconName);
  return createElement(Icon, props);
}

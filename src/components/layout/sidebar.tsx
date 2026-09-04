'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Bot,
  MessageSquare,
  MoreHorizontal,
  AlertCircle,
  ShieldCheck,
  HeartPulse,
  LayoutDashboard,
  BookOpenText,
  LogOut,
  Menu,
  X,
  ChevronDown,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { getInitials } from '@/lib/utils';
import { issueProjects } from '@/data/issue-projects';

const issueProjectIcons: Record<string, LucideIcon> = {
  admin: ShieldCheck,
  healthcare: HeartPulse,
  dashboard: LayoutDashboard,
  wiki: BookOpenText,
  wame: MessageSquare,
};

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(true);
  const [issueOpen, setIssueOpen] = useState(true);
  const pathname = usePathname();
  const { profile, logout } = useAuth();

  useEffect(() => {
    const timer = window.setTimeout(() => setMobileOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const isHomeActive = pathname === '/home' || pathname === '/' || pathname.startsWith('/documents') || pathname.startsWith('/category/');
  const isIssueActive = pathname.startsWith('/issues');
  const isIssueRootActive = pathname === '/issues';
  const isAdminActive = pathname.startsWith('/admin');

  // Auto-expand HOME when navigating to its children
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isHomeActive) setHomeOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isHomeActive]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (isIssueActive) setIssueOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isIssueActive]);

  const subCategories = [
    { label: 'CURI AI', icon: Bot, href: '/category/curi-ai' },
    { label: 'ETC', icon: MoreHorizontal, href: '/category/etc' },
    { label: 'WAME', icon: MessageSquare, href: '/category/wame' },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Wordmark */}
      <div className="flex h-14 items-center px-4">
        <Link href="/home" className="flex items-center gap-2">
          <Image
            src="/curi-logo.png"
            alt="CURI 로고"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0"
            priority
          />
          <span className="text-base font-bold tracking-tight text-text-primary">
            CURI <span className="text-curi-pink">WIKI</span>
          </span>
        </Link>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <div className="space-y-1">
          {/* HOME section */}
          <div>
            <div className="flex items-center">
              <Link
                href="/home"
                className={cn(
                  'flex flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                  isHomeActive && !pathname.startsWith('/category/')
                    ? 'bg-curi-pink-soft text-text-primary'
                    : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                )}
              >
                <Home className={cn('h-4 w-4', isHomeActive ? 'text-curi-pink' : 'text-text-muted')} />
                HOME
              </Link>
              <button
                onClick={() => setHomeOpen(!homeOpen)}
                className="rounded-md p-1 text-text-muted hover:bg-surface-elevated hover:text-text-primary transition-colors"
                aria-label={homeOpen ? '하위 메뉴 접기' : '하위 메뉴 펼치기'}
              >
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', homeOpen ? '' : '-rotate-90')} />
              </button>
            </div>

            {/* Sub-categories */}
            {homeOpen && (
              <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {subCategories.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(item.href + '/');
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                        active
                          ? 'bg-curi-pink-soft text-text-primary'
                          : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', active ? 'text-curi-pink' : 'text-text-muted')} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Spacer */}
          <div className="h-1" />

          {/* ISSUE section */}
          <div>
            <div className="flex items-center">
              <Link
                href="/issues"
                className={cn(
                  'flex flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                  isIssueRootActive
                    ? 'bg-curi-pink-soft text-text-primary'
                    : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                )}
              >
                <AlertCircle className={cn('h-4 w-4', isIssueActive ? 'text-curi-pink' : 'text-text-muted')} />
                ISSUE
              </Link>
              <button
                onClick={() => setIssueOpen(!issueOpen)}
                className="rounded-md p-1 text-text-muted hover:bg-surface-elevated hover:text-text-primary transition-colors"
                aria-label={issueOpen ? 'ISSUE 하위 메뉴 접기' : 'ISSUE 하위 메뉴 펼치기'}
              >
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', issueOpen ? '' : '-rotate-90')} />
              </button>
            </div>

            {issueOpen && (
              <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border pl-2">
                {issueProjects.map((item) => {
                  const Icon = issueProjectIcons[item.slug];
                  const href = `/issues/${item.slug}`;
                  const active = pathname === href || pathname.startsWith(href + '/');
                  return (
                    <Link
                      key={item.slug}
                      href={href}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors',
                        active
                          ? 'bg-curi-pink-soft text-text-primary'
                          : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5', active ? 'text-curi-pink' : 'text-text-muted')} />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {profile?.role === 'admin' && (
            <>
              <div className="h-1" />
              <Link
                href="/admin/users"
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                  isAdminActive
                    ? 'bg-curi-pink-soft text-text-primary'
                    : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
                )}
              >
                <UserCog className={cn('h-4 w-4', isAdminActive ? 'text-curi-pink' : 'text-text-muted')} />
                관리
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* User */}
      <div className="border-t border-border p-3">
        {profile && (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-elevated text-[10px] font-medium text-text-secondary">
                {getInitials(profile.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-text-primary">{profile.name}</p>
                <p className="truncate text-[11px] text-text-muted">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={logout}
                className="rounded-md p-1 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
                aria-label="로그아웃"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-3.5 z-50 flex h-8 w-8 items-center justify-center rounded-md bg-surface text-text-secondary md:hidden"
        aria-label="메뉴 열기"
      >
        <Menu className="h-5 w-5" />
      </button>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-[240px] bg-surface transition-transform duration-200 md:hidden',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 rounded-md p-1 text-text-muted hover:text-text-primary" aria-label="닫기">
          <X className="h-5 w-5" />
        </button>
        {sidebarContent}
      </aside>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] border-r border-border bg-surface md:block">
        {sidebarContent}
      </aside>
    </>
  );
}

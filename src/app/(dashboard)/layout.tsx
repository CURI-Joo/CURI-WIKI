'use client';

import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CommandPalette } from '@/components/layout/command-palette';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const isToolsLanding = pathname === '/tools';
  const requiresAuth =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/issues') ||
    pathname === '/documents/new' ||
    (pathname.startsWith('/documents/') && pathname.endsWith('/edit'));

  useEffect(() => {
    if (loading) return;
    if (!session && requiresAuth) {
      router.push('/login');
      return;
    }
    if (session && profile?.status === 'pending' && requiresAuth) {
      router.push('/pending');
    } else if (session && profile?.status === 'rejected' && requiresAuth) {
      router.push('/rejected');
    }
  }, [session, profile, loading, router, requiresAuth]);

  // Global Cmd+K / Ctrl+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleOpenCommandPalette = useCallback(() => {
    setCommandPaletteOpen(true);
  }, []);

  const handleCloseCommandPalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, []);

  if (loading) return null;
  if (requiresAuth && (!session || profile?.status !== 'approved')) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      {!isToolsLanding && <Sidebar />}
      <div className={`flex-1 flex flex-col min-w-0 ${isToolsLanding ? 'ml-0' : 'ml-0 md:ml-[240px]'}`}>
        <Topbar onOpenCommandPalette={handleOpenCommandPalette} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={handleCloseCommandPalette}
      />
    </div>
  );
}

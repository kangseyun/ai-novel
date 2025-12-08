'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Loader2, Shield, Home, Users, Settings, LogOut, Megaphone, Brain, Sparkles, BookOpen, Zap } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { FloatingImageQueue } from '@/components/admin/FloatingImageQueue';

const navItems = [
  { href: '/admin', icon: Home, label: '대시보드' },
  { href: '/admin/personas', icon: Users, label: '페르소나 관리' },
  { href: '/admin/onboarding', icon: Sparkles, label: '온보딩 관리' },
  { href: '/admin/scenarios', icon: BookOpen, label: '시나리오 관리' },
  { href: '/admin/triggers', icon: Zap, label: '이벤트 트리거' },
  { href: '/admin/playground', icon: Brain, label: 'AI 튜닝 (Playground)' },
  { href: '/admin/users', icon: Settings, label: '유저 관리' },
  { href: '/admin/marketing', icon: Megaphone, label: '마케팅 컨텐츠' },
  { href: '/admin/settings', icon: Settings, label: '설정' },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAdmin() {
      try {
        // 로그인과 동일한 supabase 클라이언트 사용
        const { data: { session } } = await supabase.auth.getSession();

        console.log('[Admin] Session check:', { hasSession: !!session, userId: session?.user?.id });

        if (!session?.user) {
          console.log('[Admin] No session, redirecting to login');
          router.push('/login');
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();

        console.log('[Admin] User data:', { userData, userError });

        if (userError) {
          console.error('[Admin] User fetch error:', userError);
          router.push('/');
          return;
        }

        if (userData?.role !== 'admin') {
          console.log('[Admin] Not admin role:', userData?.role);
          router.push('/');
          return;
        }

        console.log('[Admin] Admin verified!');
        setIsAdmin(true);
      } catch (error) {
        console.error('[Admin] Check failed:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    }

    checkAdmin();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-slate-900 mx-auto mb-4" />
          <p className="text-slate-500">권한 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div
      className="min-h-screen flex"
      style={{
        '--background': 'oklch(1 0 0)',
        '--foreground': 'oklch(0.145 0 0)',
        '--card': 'oklch(1 0 0)',
        '--card-foreground': 'oklch(0.145 0 0)',
        '--primary': 'oklch(0.205 0 0)',
        '--primary-foreground': 'oklch(0.985 0 0)',
        '--secondary': 'oklch(0.97 0 0)',
        '--secondary-foreground': 'oklch(0.205 0 0)',
        '--muted': 'oklch(0.97 0 0)',
        '--muted-foreground': 'oklch(0.556 0 0)',
        '--accent': 'oklch(0.97 0 0)',
        '--accent-foreground': 'oklch(0.205 0 0)',
        '--border': 'oklch(0.922 0 0)',
        '--input': 'oklch(0.922 0 0)',
        backgroundColor: 'white',
        color: '#0f172a',
      } as React.CSSProperties}
    >
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 flex flex-col" style={{ backgroundColor: 'white' }}>
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg">
              <Shield className="w-6 h-6 text-slate-700" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Admin Panel</h1>
              <p className="text-xs text-slate-500">Luminovel AI</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== '/admin' && pathname?.startsWith(item.href));

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-3 text-slate-700 hover:bg-slate-100',
                      isActive && 'bg-slate-100 text-slate-900'
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        <Separator />

        {/* User Actions */}
        <div className="p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
            onClick={handleLogout}
          >
            <LogOut className="w-5 h-5" />
            로그아웃
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-slate-50">
        <ScrollArea className="h-screen">
          {children}
        </ScrollArea>
      </main>

      {/* Floating Image Queue Indicator */}
      <FloatingImageQueue />
    </div>
  );
}

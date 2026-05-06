'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Loader2, Shield, Home, Users, LogOut, Megaphone, Brain, Sparkles, BookOpen, Zap,
  CreditCard, DollarSign, ShieldAlert, FileText, Star, Calendar, TrendingUp, Heart,
  LineChart, ClipboardCheck, FlaskConical, UserCog, type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { FloatingImageQueue } from '@/components/admin/FloatingImageQueue';

interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** One-line description shown below the label so admins know what each page does. */
  purpose: string;
}

interface NavGroup {
  id: string;
  label: string;
  description: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'operations',
    label: '운영',
    description: '매일 모니터링 — 결제·CS·콘텐츠 안전망',
    items: [
      { href: '/admin', icon: Home, label: '대시보드', purpose: 'MRR · PASS 마일스톤 · 활동 추이' },
      { href: '/admin/users', icon: UserCog, label: '유저 관리', purpose: '검색 · 토큰 조정 · 정지 · 멤버별 진행' },
      { href: '/admin/subscriptions', icon: CreditCard, label: '구독 관리', purpose: '활성 구독 · 환불 발사 · Stripe 직접 링크' },
      { href: '/admin/moderation', icon: ShieldAlert, label: '모더레이션', purpose: 'Hard Rules 위반 큐 (확인/오탐/에스컬레이션)' },
      { href: '/admin/logs', icon: FileText, label: '로그', purpose: '에러 로그 + 사용자 활동 로그' },
    ],
  },
  {
    id: 'content',
    label: '콘텐츠',
    description: 'LUMIN IP · 시나리오 · 발행 게이트',
    items: [
      { href: '/admin/lumin', icon: Star, label: 'LUMIN 멤버', purpose: '7명 KPI · 인기 시나리오 · 단계 분포' },
      { href: '/admin/personas', icon: Users, label: '페르소나 관리', purpose: 'CRUD · AI 자동 생성 · 이미지 큐' },
      { href: '/admin/scenarios', icon: BookOpen, label: '시나리오 관리', purpose: 'static / guided / dynamic 시나리오 CRUD' },
      { href: '/admin/publish-queue', icon: ClipboardCheck, label: '발행 큐', purpose: 'Hard Rules lint + 검토 승인 게이트' },
      { href: '/admin/onboarding', icon: Sparkles, label: '온보딩 관리', purpose: '온보딩 빌더 (+ 분석 sub)' },
    ],
  },
  {
    id: 'automation',
    label: '자동화',
    description: '이벤트 트리거 · 스케줄 · LLM 튜닝',
    items: [
      { href: '/admin/triggers', icon: Zap, label: '이벤트 트리거', purpose: '룰 기반 자동 메시지 (호감도/시간/행동)' },
      { href: '/admin/events', icon: Calendar, label: '이벤트 캘린더', purpose: '멤버 생일 · 데뷔일 · 컴백 D-day' },
      { href: '/admin/playground', icon: Brain, label: 'AI 튜닝', purpose: '모델 선택 + 페르소나 응답 시뮬' },
    ],
  },
  {
    id: 'growth',
    label: '그로스 / 측정',
    description: '채널 ROI · 코호트 · 실험 · LLM 단가',
    items: [
      { href: '/admin/marketing-insights', icon: TrendingUp, label: '마케팅 어트리뷰션', purpose: '채널별 가입 → PASS 전환 + CAC' },
      { href: '/admin/marketing', icon: Megaphone, label: '마케팅 컨텐츠', purpose: '광고 이미지 · 카피 · Meta 업로드' },
      { href: '/admin/influencers', icon: Heart, label: '인플루언서', purpose: '시딩 명단 · 페이아웃 · ROAS' },
      { href: '/admin/retention', icon: LineChart, label: '리텐션', purpose: '코호트 D1 / D7 / D30 히트맵' },
      { href: '/admin/experiments', icon: FlaskConical, label: 'A/B 실험', purpose: 'sticky variant + conversion 추적' },
      { href: '/admin/llm-usage', icon: DollarSign, label: 'LLM 비용', purpose: 'OpenRouter 사용량 · 모델별 비용 · 헤비 유저' },
    ],
  },
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

        if (!session?.user) {
          router.push('/login');
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (userError) {
          console.error('[Admin] User fetch error:', userError);
          router.push('/');
          return;
        }

        if (userData?.role !== 'admin') {
          router.push('/');
          return;
        }

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
      <aside className="w-72 border-r border-slate-200 flex flex-col" style={{ backgroundColor: 'white' }}>
        {/* Logo */}
        <div className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-900 rounded-lg">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Admin Panel</h1>
              <p className="text-xs text-slate-500">Luminovel · LUMIN</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Navigation — grouped by responsibility */}
        <ScrollArea className="flex-1 px-3 py-3">
          <nav className="space-y-5">
            {NAV_GROUPS.map((group) => (
              <div key={group.id}>
                <div className="px-2 mb-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {group.label}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {group.description}
                  </div>
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href ||
                      (item.href !== '/admin' && pathname?.startsWith(item.href));
                    const Icon = item.icon;

                    return (
                      <Link key={item.href} href={item.href} title={item.purpose}>
                        <button
                          className={cn(
                            'w-full text-left px-2 py-1.5 rounded-md transition flex items-start gap-2.5 group',
                            isActive
                              ? 'bg-slate-900 text-white'
                              : 'text-slate-700 hover:bg-slate-100'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-4 h-4 mt-0.5 flex-shrink-0',
                              isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium leading-tight">{item.label}</div>
                            <div
                              className={cn(
                                'text-[10px] leading-tight mt-0.5 truncate',
                                isActive ? 'text-white/70' : 'text-slate-400'
                              )}
                            >
                              {item.purpose}
                            </div>
                          </div>
                        </button>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
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

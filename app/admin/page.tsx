'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Users, MessageSquare, DollarSign, Activity, AlertCircle, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface DashboardStats {
  totalUsers: number;
  newUsersToday: number;
  activeUsers24h: number;
  totalMessages: number;
  messagesToday: number;
  totalRevenue: number;
}

interface ChartData {
  date: string;
  users: number;
  messages: number;
  revenue: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    newUsersToday: 0,
    activeUsers24h: 0,
    totalMessages: 0,
    messagesToday: 0,
    totalRevenue: 0,
  });
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentErrors, setRecentErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const today = new Date();
        const todayStart = startOfDay(today).toISOString();
        const yesterday = subDays(today, 1).toISOString();
        const last7DaysStart = startOfDay(subDays(today, 6)).toISOString(); // 7일 전 00:00

        // 1. Basic Counts (Real DB)
        const { count: totalUsers } = await supabase.from('users').select('*', { count: 'exact', head: true });
        const { count: newUsers } = await supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', todayStart);
        
        const { count: activeUsers } = await supabase
          .from('conversation_sessions')
          .select('user_id', { count: 'exact', head: true })
          .gte('last_message_at', yesterday);

        const { count: totalMessages } = await supabase.from('conversation_messages').select('*', { count: 'exact', head: true });
        const { count: messagesToday } = await supabase.from('conversation_messages').select('*', { count: 'exact', head: true }).gte('created_at', todayStart);

        const { data: revenueData } = await supabase.from('purchases').select('amount');
        const totalRevenue = revenueData?.reduce((acc, curr) => acc + (curr.amount || 0), 0) || 0;

        setStats({
          totalUsers: totalUsers || 0,
          newUsersToday: newUsers || 0,
          activeUsers24h: activeUsers || 0,
          totalMessages: totalMessages || 0,
          messagesToday: messagesToday || 0,
          totalRevenue,
        });

        // 2. Recent Users (Real DB)
        const { data: users } = await supabase
          .from('users')
          .select('id, nickname, email, created_at, role')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentUsers(users || []);

        // 3. Recent Errors (Real DB)
        const { data: errors } = await supabase
          .from('error_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5);
        setRecentErrors(errors || []);

        // 4. Chart Data (Real DB Aggregation)
        // Fetch raw data for the last 7 days
        const { data: recentMessages } = await supabase
          .from('conversation_messages')
          .select('created_at')
          .gte('created_at', last7DaysStart);

        const { data: recentJoinedUsers } = await supabase
          .from('users')
          .select('created_at')
          .gte('created_at', last7DaysStart);

        // Group by Date
        const daysMap = new Map<string, ChartData>();
        
        // Initialize last 7 days with 0
        for (let i = 0; i < 7; i++) {
          const d = subDays(today, 6 - i);
          const dateStr = format(d, 'MM/dd');
          daysMap.set(dateStr, { date: dateStr, users: 0, messages: 0, revenue: 0 });
        }

        // Aggregate Messages
        recentMessages?.forEach(msg => {
          const dateStr = format(parseISO(msg.created_at), 'MM/dd');
          if (daysMap.has(dateStr)) {
            const entry = daysMap.get(dateStr)!;
            entry.messages++;
          }
        });

        // Aggregate Users
        recentJoinedUsers?.forEach(u => {
          const dateStr = format(parseISO(u.created_at), 'MM/dd');
          if (daysMap.has(dateStr)) {
            const entry = daysMap.get(dateStr)!;
            entry.users++;
          }
        });

        setChartData(Array.from(daysMap.values()));

      } catch (error) {
        console.error('Failed to load dashboard:', error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [supabase]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">대시보드</h1>
          <p className="text-muted-foreground">서비스 현황 및 주요 지표를 모니터링합니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/personas/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              새 페르소나
            </Button>
          </Link>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 사용자</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              {stats.newUsersToday > 0 ? (
                <span className="text-green-500 flex items-center">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  오늘 +{stats.newUsersToday}명
                </span>
              ) : (
                <span className="text-muted-foreground">오늘 신규 가입 없음</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 유저 (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers24h.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              최근 24시간 내 대화 시도
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 메시지</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
               {stats.messagesToday > 0 ? (
                <span className="text-green-500 flex items-center">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  오늘 +{stats.messagesToday}건
                </span>
               ) : (
                 <span className="text-muted-foreground">오늘 메시지 없음</span>
               )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 매출</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₩{stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              누적 결제 금액
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
        {/* Main Chart Area */}
        <Card className="col-span-1 md:col-span-4">
          <CardHeader>
            <CardTitle>주간 활동 추이</CardTitle>
            <CardDescription>최근 7일간의 메시지 발생량 및 유저 활동 (실시간)</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {loading ? (
              <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                데이터 로딩 중...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `${value}`} 
                  />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="messages" fill="#8884d8" radius={[4, 4, 0, 0]} name="메시지 수" />
                  <Bar dataKey="users" fill="#82ca9d" radius={[4, 4, 0, 0]} name="가입자 수" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Right Sidebar: Recent Activity & System Health */}
        <div className="col-span-1 md:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>최근 가입 유저</CardTitle>
              <CardDescription>
                신규 가입한 유저 5명
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentUsers.length === 0 ? (
                   <p className="text-sm text-muted-foreground text-center py-4">가입 유저가 없습니다.</p>
                ) : (
                  recentUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{user.nickname || '이름 없음'}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                      <div className="text-right">
                         <span className="text-xs text-muted-foreground">
                           {format(new Date(user.created_at), 'MM/dd HH:mm')}
                         </span>
                      </div>
                    </div>
                  ))
                )}
                <Link href="/admin/users" className="block pt-2">
                  <Button variant="outline" className="w-full text-xs">전체 보기</Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                시스템 상태 / 에러 로그
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[200px]">
                <div className="space-y-4">
                   {recentErrors.length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                       <Activity className="w-8 h-8 mb-2 opacity-20" />
                       <p className="text-sm">최근 발생한 에러가 없습니다.</p>
                       <p className="text-xs">시스템이 정상 작동 중입니다.</p>
                     </div>
                   ) : (
                     recentErrors.map((error) => (
                       <div key={error.id} className="border-l-2 border-red-500 pl-3 py-1">
                         <p className="font-medium text-xs text-red-600 truncate">{error.error_type}</p>
                         <p className="text-xs text-muted-foreground truncate w-full" title={error.error_message}>
                           {error.error_message}
                         </p>
                         <p className="text-[10px] text-muted-foreground mt-1">
                           {format(new Date(error.created_at), 'MM/dd HH:mm')}
                         </p>
                       </div>
                     ))
                   )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Eye, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type User = {
  id: string;
  email: string;
  nickname: string | null;
  role: string;
  created_at: string;
  last_active_date: string | null;
  is_premium: boolean;
  tokens: number;
  onboarding_completed: boolean;
  referral_count: number;
  streak_count: number;
  personality_type: string | null;
  user_journey_stats: {
    total_dm_sessions: number;
    total_time_spent_minutes: number;
  } | null;
};

const ITEMS_PER_PAGE = 10;

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'active'>('newest');
  
  const supabase = createClient();

  useEffect(() => {
    fetchUsers();
  }, [page, searchTerm, sortOrder]);

  async function fetchUsers() {
    setLoading(true);
    try {
      let query = supabase
        .from('users')
        .select(`
          *,
          user_journey_stats (
            total_dm_sessions,
            total_time_spent_minutes
          )
        `, { count: 'exact' });

      // 검색 필터
      if (searchTerm) {
        query = query.or(`email.ilike.%${searchTerm}%,nickname.ilike.%${searchTerm}%,id.eq.${searchTerm}`);
      }

      // 정렬
      if (sortOrder === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (sortOrder === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else if (sortOrder === 'active') {
        query = query.order('last_active_date', { ascending: false });
      }

      // 페이지네이션
      const from = (page - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      
      setUsers(data || []);
      if (count !== null) {
        setTotalUsers(count);
        setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setPage(1); // 검색 시 1페이지로 리셋
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">유저 관리</h2>
          <p className="text-muted-foreground">
            전체 유저 목록을 조회하고 관리합니다. (총 {totalUsers}명)
          </p>
        </div>
        <Button onClick={() => fetchUsers()} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="이메일, 닉네임, ID 검색..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-9"
                />
              </div>
              <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="정렬" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">최신 가입순</SelectItem>
                  <SelectItem value="oldest">오래된순</SelectItem>
                  <SelectItem value="active">최근 활동순</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Pagination Controls */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">
                Page {page} of {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>유저 정보</TableHead>
                  <TableHead>상태/멤버십</TableHead>
                  <TableHead>성향/온보딩</TableHead>
                  <TableHead>활동 지표</TableHead>
                  <TableHead>자산</TableHead>
                  <TableHead>마지막 활동</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-muted-foreground">로딩 중...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      검색 결과가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.nickname || '이름 없음'}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                          <span className="text-[10px] text-muted-foreground/50 font-mono truncate max-w-[100px]" title={user.id}>
                            {user.id}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <div className="flex gap-1">
                            {user.role === 'admin' && <Badge variant="destructive" className="text-[10px] py-0">Admin</Badge>}
                            {user.is_premium ? (
                              <Badge variant="default" className="text-[10px] py-0 bg-indigo-500">Premium</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] py-0">Free</Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            가입: {format(new Date(user.created_at), 'yyyy-MM-dd')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {user.personality_type ? (
                            <Badge variant="secondary" className="text-[10px] w-fit">
                              {user.personality_type}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {user.onboarding_completed ? '온보딩 완료' : '온보딩 미완료'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          <div className="text-muted-foreground">
                            대화 세션: <span className="font-medium text-foreground">{user.user_journey_stats?.total_dm_sessions || 0}</span>
                          </div>
                          <div className="text-muted-foreground">
                            스트릭: <span className="font-medium text-foreground">{user.streak_count || 0}일</span>
                          </div>
                          <div className="text-muted-foreground">
                            초대: <span className="font-medium text-foreground">{user.referral_count || 0}명</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">
                          {user.tokens.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">T</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.last_active_date 
                          ? <span className="text-xs">{format(new Date(user.last_active_date), 'yyyy-MM-dd')}</span>
                          : <span className="text-xs text-muted-foreground">-</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/users/${user.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

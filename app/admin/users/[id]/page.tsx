'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ArrowLeft, MessageSquare, Heart, Map, Clock, CreditCard, ShoppingBag, Brain, User as UserIcon, Database, Search, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { format } from 'date-fns';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type UserDetail = {
  id: string;
  email: string;
  nickname: string;
  role: string;
  created_at: string;
  is_premium: boolean;
  premium_expires_at: string | null;
  tokens: number;
  last_active_date: string;
  personality_type: string;
  communication_style: string;
  emotional_tendency: string;
  interests: string[];
  love_language: string;
  attachment_style: string;
  onboarding_completed: boolean;
  referral_code: string;
  referral_count: number;
  streak_count: number;
  bio: string;
  profile_image: string;
};

type ConversationSession = {
  id: string;
  persona_id: string;
  status: string;
  relationship_stage: string;
  last_message_at: string;
  persona: {
    name: string;
    role: string;
  };
};

type Message = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  sequence_number: number;
  emotion?: string;
  inner_thought?: string;
};

type UserStats = {
  total_dm_sessions: number;
  total_dm_messages_sent: number;
  total_scenarios_completed: number;
  total_time_spent_minutes: number;
  total_choices_made: number;
  total_affection_gained: number;
  max_streak_days: number;
  days_active: number;
};

type Purchase = {
  id: string;
  amount: number;
  price: number;
  currency: string;
  type: string;
  created_at: string;
  status?: string;
};

type Memory = {
  id: string;
  memory_type: string;
  summary: string;
  details: any;
  importance_score: number;
  created_at: string;
  persona_id: string;
  similarity?: number;
};

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // Memory Tab States
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memorySearchQuery, setMemorySearchQuery] = useState('');
  const [selectedPersonaForMemory, setSelectedPersonaForMemory] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Memory[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch User & Sessions
  useEffect(() => {
    async function fetchData() {
      try {
        // 1. User Info
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .single();
        
        if (userError) throw userError;
        setUser(userData);

        // 2. Stats
        const { data: statsData } = await supabase
          .from('user_journey_stats')
          .select('*')
          .eq('user_id', userId)
          .single();
        setStats(statsData);

        // 3. Sessions
        const { data: sessionData, error: sessionError } = await supabase
          .from('conversation_sessions')
          .select(`
            id,
            persona_id,
            status,
            relationship_stage,
            last_message_at,
            persona:personas(name, role)
          `)
          .eq('user_id', userId)
          .order('last_message_at', { ascending: false });

        if (sessionError) throw sessionError;
        // Supabase join 결과를 올바른 타입으로 매핑
        const mappedSessions: ConversationSession[] = (sessionData || []).map((session: {
          id: string;
          persona_id: string;
          status: string;
          relationship_stage: string;
          last_message_at: string;
          persona: { name: string; role: string } | { name: string; role: string }[] | null;
        }) => ({
          ...session,
          persona: Array.isArray(session.persona)
            ? session.persona[0] || { name: 'Unknown', role: 'unknown' }
            : session.persona || { name: 'Unknown', role: 'unknown' },
        }));
        setSessions(mappedSessions);

        if (sessionData && sessionData.length > 0) {
          setSelectedSessionId(sessionData[0].id);
          setSelectedPersonaForMemory(sessionData[0].persona_id);
        }

        // 4. Purchases
        const { data: purchaseData } = await supabase
          .from('purchases')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        
        setPurchases(purchaseData || []);

        // 5. Initial Memories (All)
        const { data: memoryData } = await supabase
          .from('persona_memories')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);
        setMemories(memoryData || []);

      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) fetchData();
  }, [userId, supabase]);

  // Fetch Messages when session changes
  useEffect(() => {
    if (!selectedSessionId) return;

    async function fetchMessages() {
      setMessagesLoading(true);
      try {
        const { data, error } = await supabase
          .from('conversation_messages')
          .select('*')
          .eq('session_id', selectedSessionId)
          .order('sequence_number', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (error) {
        console.error('Error loading messages:', error);
      } finally {
        setMessagesLoading(false);
      }
    }

    fetchMessages();
  }, [selectedSessionId, supabase]);

  // Memory Search Handler
  const handleMemorySearch = async () => {
    if (!memorySearchQuery.trim() || !selectedPersonaForMemory) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/memory-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: memorySearchQuery,
          personaId: selectedPersonaForMemory,
        }),
      });

      const data = await response.json();
      if (data.results) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <div>User not found</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="outline" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">{user.nickname || 'Unknown User'}</h1>
          <p className="text-muted-foreground text-sm flex items-center gap-2">
            {user.email} <span className="text-xs bg-muted px-1 rounded">{user.id}</span>
          </p>
        </div>
        <div className="ml-auto flex gap-2 items-center">
          {user.is_premium ? (
            <Badge className="bg-indigo-600 hover:bg-indigo-700">Premium</Badge>
          ) : (
            <Badge variant="secondary">Free Plan</Badge>
          )}
          <Badge variant="outline" className="border-primary text-primary font-bold">
            {user.tokens.toLocaleString()} Tokens
          </Badge>
          <a
            href={`https://supabase.com/dashboard/project/zwoyfqsavcghftbmijdc/editor?filter=id%3Aeq%3A${user.id}&schema=public&table=users`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-1">
              <ExternalLink className="w-3 h-3" />
              Supabase
            </Button>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: User Profile & Quick Stats */}
        <div className="space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="w-5 h-5" /> 기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground text-xs">가입일</p>
                  <p className="font-medium">{format(new Date(user.created_at), 'yyyy-MM-dd')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">최근 활동</p>
                  <p className="font-medium">
                    {user.last_active_date ? format(new Date(user.last_active_date), 'yyyy-MM-dd') : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">연속 접속 (Streak)</p>
                  <p className="font-medium flex items-center gap-1">
                    🔥 {user.streak_count}일
                    <span className="text-[10px] text-muted-foreground">(최대 {stats?.max_streak_days}일)</span>
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">초대 횟수</p>
                  <p className="font-medium">👥 {user.referral_count}명</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground text-xs mb-1">상태</p>
                <div className="flex gap-2">
                  <Badge variant={user.onboarding_completed ? 'default' : 'secondary'}>
                    {user.onboarding_completed ? '온보딩 완료' : '온보딩 중'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Traits Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" /> 성향 분석
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">MBTI / 성향</p>
                <Badge variant="outline" className="mt-1 text-sm font-bold">
                  {user.personality_type || '미설정'}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                <div>
                  <p className="text-muted-foreground text-xs">대화 스타일</p>
                  <p>{user.communication_style || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">감정 성향</p>
                  <p>{user.emotional_tendency || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">사랑의 언어</p>
                  <p>{user.love_language || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">애착 유형</p>
                  <p>{user.attachment_style || '-'}</p>
                </div>
              </div>
              {user.interests && user.interests.length > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">관심사</p>
                  <div className="flex flex-wrap gap-1">
                    {user.interests.map((i, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[10px]">{i}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Main Content */}
        <div className="md:col-span-2 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
              <TabsTrigger 
                value="overview" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                활동 통계
              </TabsTrigger>
              <TabsTrigger 
                value="chat" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                대화 모니터링
              </TabsTrigger>
              <TabsTrigger 
                value="memory" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                기억/벡터
              </TabsTrigger>
              <TabsTrigger 
                value="purchases" 
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2"
              >
                구매 내역
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">총 대화 세션</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold">{stats?.total_dm_sessions || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">메시지 수</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold">{stats?.total_dm_messages_sent || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">시나리오 완료</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold">{stats?.total_scenarios_completed || 0}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">호감도 획득</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-2xl font-bold text-pink-500">{stats?.total_affection_gained || 0}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>상세 활동 로그</CardTitle>
                  <CardDescription>유저의 여정 데이터 요약</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">총 사용 시간</TableCell>
                        <TableCell>{stats?.total_time_spent_minutes || 0}분 (약 {Math.round((stats?.total_time_spent_minutes || 0) / 60)}시간)</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">총 활동 일수</TableCell>
                        <TableCell>{stats?.days_active || 0}일</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">선택지 선택 횟수</TableCell>
                        <TableCell>{stats?.total_choices_made || 0}회</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="chat" className="mt-6 flex gap-4 h-[600px]">
              {/* Session List */}
              <Card className="w-1/3 flex flex-col">
                <CardHeader className="p-4 border-b">
                  <CardTitle className="text-sm">대화 목록</CardTitle>
                </CardHeader>
                <ScrollArea className="flex-1">
                  <div className="flex flex-col">
                    {sessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSessionId(session.id)}
                        className={`p-3 text-left hover:bg-muted/50 transition-colors border-b last:border-0 ${
                          selectedSessionId === session.id ? 'bg-muted border-l-4 border-l-primary' : ''
                        }`}
                      >
                        <div className="flex justify-between mb-1">
                          <span className="font-medium text-sm">
                            {
                              // @ts-ignore
                              session.persona?.name || session.persona_id
                            }
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(session.last_message_at), 'MM/dd')}
                          </span>
                        </div>
                        <div className="flex gap-2 items-center">
                          <Badge variant="outline" className="text-[10px] h-5 px-1">{session.relationship_stage}</Badge>
                        </div>
                      </button>
                    ))}
                    {sessions.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground text-xs">
                        대화 내역이 없습니다.
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </Card>

              {/* Chat Window */}
              <Card className="flex-1 flex flex-col">
                <CardHeader className="py-3 border-b min-h-[60px] flex justify-center">
                   <div className="flex justify-between items-center w-full">
                    <span className="font-bold">
                       {sessions.find(s => s.id === selectedSessionId)?.
                        // @ts-ignore
                        persona?.name || '대화 내용'}
                    </span>
                    {selectedSessionId && (
                      <Badge variant="secondary" className="text-[10px]">
                        {sessions.find(s => s.id === selectedSessionId)?.status}
                      </Badge>
                    )}
                   </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0 bg-slate-50/50">
                  {messagesLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScrollArea className="h-full p-4">
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex flex-col max-w-[85%] ${
                              msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
                            }`}
                          >
                            <div className="text-[10px] text-muted-foreground mb-1 px-1 flex gap-2">
                              <span>{msg.role === 'user' ? user.nickname : 'AI'}</span>
                              <span>{format(new Date(msg.created_at), 'HH:mm')}</span>
                            </div>
                            
                            {/* Inner Thought (Admin Only) */}
                            {msg.inner_thought && (
                              <div className="mb-1 text-xs bg-yellow-50 text-yellow-800 p-2 rounded border border-yellow-200 w-full whitespace-pre-wrap shadow-sm">
                                <span className="font-bold mr-1">💭 생각:</span>
                                {msg.inner_thought}
                              </div>
                            )}

                            <div
                              className={`p-3 rounded-lg text-sm whitespace-pre-wrap shadow-sm ${
                                msg.role === 'user'
                                  ? 'bg-primary text-primary-foreground rounded-tr-none'
                                  : 'bg-white border text-foreground rounded-tl-none'
                              }`}
                            >
                              {msg.content}
                            </div>
                            
                            {msg.emotion && (
                              <div className="mt-1">
                                <Badge variant="secondary" className="text-[10px] h-5">
                                  감정: {msg.emotion}
                                </Badge>
                              </div>
                            )}
                          </div>
                        ))}
                        {messages.length === 0 && selectedSessionId && (
                           <div className="text-center text-muted-foreground py-10 text-sm">
                             메시지가 없습니다.
                           </div>
                        )}
                        {!selectedSessionId && (
                          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                            <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-sm">좌측에서 대화 세션을 선택해주세요.</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="memory" className="mt-6 space-y-6">
              {/* 1. Vector Search Simulator */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" /> RAG 검색 시뮬레이터 (Vector Search)
                  </CardTitle>
                  <CardDescription>
                    AI가 사용자의 질문에 답변하기 위해 어떤 기억을 가져오는지 테스트합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 mb-6">
                    <Select value={selectedPersonaForMemory} onValueChange={setSelectedPersonaForMemory}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="페르소나 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.map((s) => (
                          <SelectItem key={s.persona_id} value={s.persona_id}>
                            {
                              // @ts-ignore
                              s.persona?.name || s.persona_id
                            }
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex-1 flex gap-2">
                      <Input
                        placeholder="테스트할 질문 입력 (예: 너 나랑 언제 처음 만났어?)"
                        value={memorySearchQuery}
                        onChange={(e) => setMemorySearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleMemorySearch()}
                      />
                      <Button onClick={handleMemorySearch} disabled={isSearching || !memorySearchQuery}>
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : '검색'}
                      </Button>
                    </div>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-4 border rounded-md p-4 bg-slate-50">
                      <h3 className="text-sm font-semibold mb-2">검색 결과 (Top 5)</h3>
                      {searchResults.map((result, idx) => (
                        <div key={idx} className="bg-white p-3 rounded border shadow-sm flex flex-col gap-1">
                           <div className="flex justify-between items-start">
                             <Badge variant="outline" className="text-[10px]">{result.memory_type}</Badge>
                             <span className="text-xs font-mono text-green-600">
                               유사도: {(result.similarity ? result.similarity * 100 : 0).toFixed(1)}%
                             </span>
                           </div>
                           <p className="text-sm mt-1">{result.summary}</p>
                           {result.details && Object.keys(result.details).length > 0 && (
                             <pre className="text-[10px] text-muted-foreground bg-slate-100 p-1 rounded mt-1 overflow-x-auto">
                               {JSON.stringify(result.details, null, 2)}
                             </pre>
                           )}
                           <div className="text-[10px] text-muted-foreground mt-1">
                             {format(new Date(result.created_at), 'yyyy-MM-dd HH:mm')}
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 2. Stored Memories List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" /> 저장된 기억 (최신순)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>유형</TableHead>
                        <TableHead>내용 (Summary)</TableHead>
                        <TableHead>중요도</TableHead>
                        <TableHead>생성일</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {memories.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            저장된 기억이 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        memories.map((mem) => (
                          <TableRow key={mem.id}>
                            <TableCell>
                              <Badge variant="outline">{mem.memory_type}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[400px]">
                              <div className="text-sm">{mem.summary}</div>
                              {mem.details && (
                                <div className="text-xs text-muted-foreground truncate mt-1">
                                  {JSON.stringify(mem.details)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              {mem.importance_score}/10
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(mem.created_at), 'yyyy-MM-dd')}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="purchases" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" /> 구매 내역
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>일시</TableHead>
                        <TableHead>상품</TableHead>
                        <TableHead>금액</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            구매 내역이 없습니다.
                          </TableCell>
                        </TableRow>
                      ) : (
                        purchases.map((purchase) => (
                          <TableRow key={purchase.id}>
                            <TableCell>{format(new Date(purchase.created_at), 'yyyy-MM-dd HH:mm')}</TableCell>
                            <TableCell className="font-medium capitalize">{purchase.type}</TableCell>
                            <TableCell>
                              {purchase.price > 0 
                                ? `${purchase.price.toLocaleString()} ${purchase.currency.toUpperCase()}`
                                : 'Free / Bonus'
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{purchase.status || 'Completed'}</Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

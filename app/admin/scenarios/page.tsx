'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Eye,
  Loader2,
  RefreshCw,
  Filter,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface ScenarioTemplate {
  id: string;
  persona_id: string;
  title: string;
  description: string | null;
  scenario_type: string;
  trigger_conditions: Record<string, unknown>;
  content: {
    scenes: unknown[];
    ending_conditions?: unknown;
  };
  sort_order: number;
  min_affection: number;
  min_relationship_stage: string;
  prerequisite_scenarios: string[];
  is_active: boolean;
  created_at: string;
  persona_core?: {
    name: string;
    profile_image_url: string | null;
  };
}

interface PersonaCore {
  id: string;
  name: string;
  profile_image_url: string | null;
}

const SCENARIO_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  first_meeting: { label: '첫 만남', color: 'bg-green-100 text-green-700' },
  onboarding: { label: '온보딩', color: 'bg-purple-100 text-purple-700' },
  story_episode: { label: '스토리 에피소드', color: 'bg-blue-100 text-blue-700' },
  dm_triggered: { label: 'DM 트리거', color: 'bg-orange-100 text-orange-700' },
  scheduled_event: { label: '예약 이벤트', color: 'bg-yellow-100 text-yellow-700' },
  milestone: { label: '마일스톤', color: 'bg-pink-100 text-pink-700' },
};

const RELATIONSHIP_STAGES = [
  'stranger',
  'acquaintance',
  'friend',
  'close',
  'intimate',
  'lover',
];

export default function ScenariosManagementPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioTemplate[]>([]);
  const [personas, setPersonas] = useState<PersonaCore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPersona, setFilterPersona] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [personaSearch, setPersonaSearch] = useState('');
  const [isPersonaDropdownOpen, setIsPersonaDropdownOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch scenarios with persona data
      const { data: scenarioData, error: scenarioError } = await supabase
        .from('scenario_templates')
        .select(`
          *,
          persona_core (
            name,
            profile_image_url
          )
        `)
        .order('persona_id')
        .order('sort_order');

      if (scenarioError) throw scenarioError;
      setScenarios(scenarioData || []);

      // Fetch personas for filter
      const { data: personaData, error: personaError } = await supabase
        .from('persona_core')
        .select('id, name, profile_image_url')
        .order('name');

      if (personaError) throw personaError;
      setPersonas(personaData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('scenario_templates')
        .update({ is_active: active })
        .eq('id', id);

      if (error) throw error;

      setScenarios(scenarios.map(s =>
        s.id === id ? { ...s, is_active: active } : s
      ));
      toast.success(active ? '활성화되었습니다' : '비활성화되었습니다');
    } catch (error) {
      console.error('Error toggling active:', error);
      toast.error('상태 변경에 실패했습니다');
    }
  };

  const handleDuplicate = async (scenario: ScenarioTemplate) => {
    try {
      const newId = `${scenario.id}_copy_${Date.now()}`;
      const { error } = await supabase
        .from('scenario_templates')
        .insert({
          id: newId,
          persona_id: scenario.persona_id,
          title: `${scenario.title} (복사본)`,
          description: scenario.description,
          scenario_type: scenario.scenario_type,
          trigger_conditions: scenario.trigger_conditions,
          content: scenario.content,
          sort_order: scenario.sort_order + 1,
          min_affection: scenario.min_affection,
          min_relationship_stage: scenario.min_relationship_stage,
          prerequisite_scenarios: scenario.prerequisite_scenarios,
          is_active: false,
        });

      if (error) throw error;

      toast.success('시나리오가 복제되었습니다');
      fetchData();
    } catch (error) {
      console.error('Error duplicating:', error);
      toast.error('복제에 실패했습니다');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    try {
      const { error } = await supabase
        .from('scenario_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setScenarios(scenarios.filter(s => s.id !== id));
      toast.success('삭제되었습니다');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('삭제에 실패했습니다');
    }
  };

  // Filter scenarios
  const filteredScenarios = scenarios.filter(s => {
    if (filterPersona !== 'all' && s.persona_id !== filterPersona) return false;
    if (filterType !== 'all' && s.scenario_type !== filterType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        s.title.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Filter personas for dropdown
  const filteredPersonas = personas.filter(p =>
    p.name.toLowerCase().includes(personaSearch.toLowerCase())
  );

  // Get selected persona info
  const selectedPersonaInfo = filterPersona !== 'all'
    ? personas.find(p => p.id === filterPersona)
    : null;

  // Group by persona with image info
  const groupedScenarios = filteredScenarios.reduce((acc, scenario) => {
    const personaId = scenario.persona_id;
    const personaName = scenario.persona_core?.name || scenario.persona_id;
    const personaImage = scenario.persona_core?.profile_image_url || null;
    const key = `${personaId}|${personaName}|${personaImage || ''}`;
    if (!acc[key]) {
      acc[key] = { name: personaName, image: personaImage, scenarios: [] };
    }
    acc[key].scenarios.push(scenario);
    return acc;
  }, {} as Record<string, { name: string; image: string | null; scenarios: ScenarioTemplate[] }>);

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">시나리오 관리</h1>
          <p className="text-slate-500 mt-1">
            온보딩, DM 트리거, 스토리 에피소드 등 모든 시나리오를 관리합니다
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/admin/scenarios/generate')}
            className="border-purple-200 text-purple-700 hover:bg-purple-50"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI 생성
          </Button>
          <Button onClick={() => router.push('/admin/scenarios/new')}>
            <Plus className="w-4 h-4 mr-2" />
            새 시나리오
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="시나리오 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setIsPersonaDropdownOpen(!isPersonaDropdownOpen)}
                className="flex items-center gap-2 h-10 w-56 px-3 py-2 rounded-md border border-input bg-background text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Filter className="w-4 h-4 text-slate-400" />
                {selectedPersonaInfo ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {selectedPersonaInfo.profile_image_url ? (
                      <img
                        src={selectedPersonaInfo.profile_image_url}
                        alt={selectedPersonaInfo.name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center text-[10px] text-white">
                        {selectedPersonaInfo.name[0]}
                      </div>
                    )}
                    <span className="truncate">{selectedPersonaInfo.name}</span>
                  </div>
                ) : (
                  <span className="text-slate-500">모든 페르소나</span>
                )}
              </button>

              {isPersonaDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setIsPersonaDropdownOpen(false);
                      setPersonaSearch('');
                    }}
                  />
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white border rounded-md shadow-lg z-50 overflow-hidden">
                    <div className="p-2 border-b">
                      <Input
                        placeholder="페르소나 검색..."
                        value={personaSearch}
                        onChange={(e) => setPersonaSearch(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                      <button
                        onClick={() => {
                          setFilterPersona('all');
                          setIsPersonaDropdownOpen(false);
                          setPersonaSearch('');
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 ${
                          filterPersona === 'all' ? 'bg-slate-100' : ''
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                          <span className="text-xs text-slate-500">All</span>
                        </div>
                        <span>모든 페르소나</span>
                      </button>
                      {filteredPersonas.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setFilterPersona(p.id);
                            setIsPersonaDropdownOpen(false);
                            setPersonaSearch('');
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-100 ${
                            filterPersona === p.id ? 'bg-slate-100' : ''
                          }`}
                        >
                          {p.profile_image_url ? (
                            <img
                              src={p.profile_image_url}
                              alt={p.name}
                              className="w-6 h-6 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-300 flex items-center justify-center text-xs text-white">
                              {p.name[0]}
                            </div>
                          )}
                          <span>{p.name}</span>
                        </button>
                      ))}
                      {filteredPersonas.length === 0 && personaSearch && (
                        <div className="px-3 py-4 text-sm text-slate-500 text-center">
                          검색 결과가 없습니다
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="타입 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 타입</SelectItem>
                {Object.entries(SCENARIO_TYPE_LABELS).map(([key, { label }]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{scenarios.length}</div>
            <p className="text-sm text-slate-500">전체 시나리오</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {scenarios.filter(s => s.is_active).length}
            </div>
            <p className="text-sm text-slate-500">활성 시나리오</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {scenarios.filter(s => s.scenario_type === 'first_meeting' || s.scenario_type === 'onboarding').length}
            </div>
            <p className="text-sm text-slate-500">온보딩/첫 만남</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {new Set(scenarios.map(s => s.persona_id)).size}
            </div>
            <p className="text-sm text-slate-500">페르소나 수</p>
          </CardContent>
        </Card>
      </div>

      {/* Scenarios List */}
      {Object.entries(groupedScenarios).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            {searchQuery || filterPersona !== 'all' || filterType !== 'all'
              ? '검색 결과가 없습니다'
              : '등록된 시나리오가 없습니다'}
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedScenarios).map(([key, { name: personaName, image: personaImage, scenarios: personaScenarios }]) => (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-center gap-3">
                {personaImage ? (
                  <img
                    src={personaImage}
                    alt={personaName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-slate-200"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-white font-semibold">
                    {personaName[0]}
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg">{personaName}</CardTitle>
                  <CardDescription>{personaScenarios.length}개의 시나리오</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>시나리오</TableHead>
                    <TableHead>타입</TableHead>
                    <TableHead>조건</TableHead>
                    <TableHead>씬 수</TableHead>
                    <TableHead>활성</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personaScenarios.map((scenario) => {
                    const typeInfo = SCENARIO_TYPE_LABELS[scenario.scenario_type] || {
                      label: scenario.scenario_type,
                      color: 'bg-slate-100 text-slate-700',
                    };

                    return (
                      <TableRow key={scenario.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{scenario.title}</p>
                            <p className="text-xs text-slate-500">{scenario.id}</p>
                            {scenario.description && (
                              <p className="text-sm text-slate-600 mt-1 line-clamp-1">
                                {scenario.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={typeInfo.color}>{typeInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1">
                            {scenario.min_affection > 0 && (
                              <div className="text-slate-600">
                                호감도 ≥ {scenario.min_affection}
                              </div>
                            )}
                            {scenario.min_relationship_stage !== 'stranger' && (
                              <div className="text-slate-600">
                                관계: {scenario.min_relationship_stage}
                              </div>
                            )}
                            {scenario.prerequisite_scenarios.length > 0 && (
                              <div className="text-slate-500">
                                선행: {scenario.prerequisite_scenarios.length}개
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {scenario.content?.scenes?.length || 0}개 씬
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={scenario.is_active}
                            onCheckedChange={(checked) => handleToggleActive(scenario.id, checked)}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/admin/scenarios/${scenario.id}`)}
                              >
                                <Edit className="w-4 h-4 mr-2" />
                                편집
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => router.push(`/admin/scenarios/${scenario.id}/preview`)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                미리보기
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(scenario)}>
                                <Copy className="w-4 h-4 mr-2" />
                                복제
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(scenario.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

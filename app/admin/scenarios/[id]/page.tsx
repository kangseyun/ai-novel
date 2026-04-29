'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Save,
  Loader2,
  MessageSquare,
  Type,
  ListChecks,
  UserCircle,
  ArrowRightLeft,
  ChevronUp,
  ChevronDown,
  Copy,
  GitBranch,
  List,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Clock,
  Target,
  AlertTriangle,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// React Flow는 SSR에서 오류가 발생하므로 dynamic import
const ScenarioFlowChart = dynamic(
  () => import('@/components/admin/ScenarioFlowChart'),
  { ssr: false, loading: () => <div className="h-[500px] flex items-center justify-center bg-slate-50 rounded-lg"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> }
);
import { toast } from 'sonner';

interface ScenarioScene {
  id: string;
  type: 'narration' | 'dialogue' | 'choice' | 'character_appear' | 'transition';
  text?: string;
  character?: string;
  expression?: string;
  inner_thought?: string;
  background?: string;
  ambient?: string;
  transition?: string;
  prompt?: string;
  choices?: ScenarioChoice[];
}

interface ScenarioChoice {
  id: string;
  text: string;
  tone?: string;
  next_scene?: string;
  affection_change?: number;
  flag?: string;
  is_premium?: boolean;
}

interface ScenarioContent {
  scenes: ScenarioScene[];
  ending_conditions?: {
    proceed_to_dm?: boolean;
    unlock_dm_chat?: boolean;
    set_relationship_stage?: string;
    initial_affection_by_choice?: Record<string, number>;
  };
}

interface ScenarioTemplate {
  id: string;
  persona_id: string;
  title: string;
  description: string | null;
  scenario_type: string;
  trigger_conditions: Record<string, unknown>;
  content: ScenarioContent;
  sort_order: number;
  min_affection: number;
  min_relationship_stage: string;
  prerequisite_scenarios: string[];
  is_active: boolean;
}

interface PersonaCore {
  id: string;
  name: string;
}

const SCENARIO_TYPES = [
  { value: 'first_meeting', label: '첫 만남' },
  { value: 'onboarding', label: '온보딩' },
  { value: 'story_episode', label: '스토리 에피소드' },
  { value: 'dm_triggered', label: 'DM 트리거' },
  { value: 'scheduled_event', label: '예약 이벤트' },
  { value: 'milestone', label: '마일스톤' },
];

const RELATIONSHIP_STAGES = [
  { value: 'stranger', label: '낯선 사람' },
  { value: 'fan', label: '팬' },
  { value: 'friend', label: '친구' },
  { value: 'close', label: '가까운 사이' },
  { value: 'heart', label: '진심' },
];

const SCENE_TYPES = [
  { value: 'narration', label: '나레이션', icon: Type },
  { value: 'dialogue', label: '대화', icon: MessageSquare },
  { value: 'choice', label: '선택지', icon: ListChecks },
  { value: 'character_appear', label: '캐릭터 등장', icon: UserCircle },
  { value: 'transition', label: '전환', icon: ArrowRightLeft },
];

const EXPRESSIONS = [
  'neutral', 'happy', 'sad', 'angry', 'surprised', 'shy', 'smirk',
  'crying', 'laughing', 'worried', 'disgusted', 'loving', 'scared',
  'intrigued', 'guarded', 'excited',
];

function generateId() {
  return `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function ScenarioEditorPage() {
  const params = useParams();
  const router = useRouter();
  const isNew = params.id === 'new';
  const scenarioId = isNew ? null : params.id as string;

  const [scenario, setScenario] = useState<ScenarioTemplate>({
    id: '',
    persona_id: '',
    title: '',
    description: null,
    scenario_type: 'story_episode',
    trigger_conditions: {},
    content: { scenes: [] },
    sort_order: 0,
    min_affection: 0,
    min_relationship_stage: 'stranger',
    prerequisite_scenarios: [],
    is_active: false,
  });
  const [personas, setPersonas] = useState<PersonaCore[]>([]);
  const [allScenarios, setAllScenarios] = useState<{ id: string; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedScenes, setExpandedScenes] = useState<string[]>([]);
  const [sceneViewMode, setSceneViewMode] = useState<'flowchart' | 'list'>('flowchart');

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch personas
      const { data: personaData, error: personaError } = await supabase
        .from('persona_core')
        .select('id, name')
        .order('name');

      if (personaError) throw personaError;
      setPersonas(personaData || []);

      // Fetch all scenarios for prerequisites
      const { data: scenarioList, error: scenarioListError } = await supabase
        .from('scenario_templates')
        .select('id, title')
        .order('title');

      if (scenarioListError) throw scenarioListError;
      setAllScenarios(scenarioList || []);

      // Fetch scenario if editing
      if (scenarioId) {
        const { data: scenarioData, error: scenarioError } = await supabase
          .from('scenario_templates')
          .select('*')
          .eq('id', scenarioId)
          .single();

        if (scenarioError) throw scenarioError;
        if (scenarioData) {
          setScenario(scenarioData);
          // Expand first scene by default
          if (scenarioData.content?.scenes?.length > 0) {
            setExpandedScenes([scenarioData.content.scenes[0].id]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSave = async () => {
    if (!scenario.id || !scenario.persona_id || !scenario.title) {
      toast.error('필수 필드를 입력해주세요');
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        const { error } = await supabase
          .from('scenario_templates')
          .insert(scenario);

        if (error) throw error;
        toast.success('시나리오가 생성되었습니다');
        router.push(`/admin/scenarios/${scenario.id}`);
      } else {
        const { error } = await supabase
          .from('scenario_templates')
          .update(scenario)
          .eq('id', scenarioId);

        if (error) throw error;
        toast.success('저장되었습니다');
      }
    } catch (error: unknown) {
      console.error('Error saving:', error);
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        toast.error('이미 존재하는 시나리오 ID입니다');
      } else {
        toast.error('저장에 실패했습니다');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const addScene = (type: ScenarioScene['type']) => {
    const newScene: ScenarioScene = {
      id: generateId(),
      type,
    };

    if (type === 'choice') {
      newScene.prompt = '';
      newScene.choices = [{
        id: `choice_${Date.now()}`,
        text: '',
        affection_change: 0,
      }];
    }

    setScenario({
      ...scenario,
      content: {
        ...scenario.content,
        scenes: [...scenario.content.scenes, newScene],
      },
    });
    setExpandedScenes([...expandedScenes, newScene.id]);
  };

  const updateScene = (sceneId: string, updates: Partial<ScenarioScene>) => {
    setScenario({
      ...scenario,
      content: {
        ...scenario.content,
        scenes: scenario.content.scenes.map(s =>
          s.id === sceneId ? { ...s, ...updates } : s
        ),
      },
    });
  };

  const deleteScene = (sceneId: string) => {
    setScenario({
      ...scenario,
      content: {
        ...scenario.content,
        scenes: scenario.content.scenes.filter(s => s.id !== sceneId),
      },
    });
  };

  const moveScene = (index: number, direction: 'up' | 'down') => {
    const newScenes = [...scenario.content.scenes];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newScenes.length) return;

    [newScenes[index], newScenes[newIndex]] = [newScenes[newIndex], newScenes[index]];
    setScenario({
      ...scenario,
      content: {
        ...scenario.content,
        scenes: newScenes,
      },
    });
  };

  const duplicateScene = (sceneId: string) => {
    const sourceScene = scenario.content.scenes.find(s => s.id === sceneId);
    if (!sourceScene) return;

    const newScene = {
      ...JSON.parse(JSON.stringify(sourceScene)),
      id: generateId(),
    };

    const sourceIndex = scenario.content.scenes.findIndex(s => s.id === sceneId);
    const newScenes = [...scenario.content.scenes];
    newScenes.splice(sourceIndex + 1, 0, newScene);

    setScenario({
      ...scenario,
      content: {
        ...scenario.content,
        scenes: newScenes,
      },
    });
    setExpandedScenes([...expandedScenes, newScene.id]);
  };

  const addChoice = (sceneId: string) => {
    const scene = scenario.content.scenes.find(s => s.id === sceneId);
    if (!scene || scene.type !== 'choice') return;

    const newChoice: ScenarioChoice = {
      id: `choice_${Date.now()}`,
      text: '',
      affection_change: 0,
    };

    updateScene(sceneId, {
      choices: [...(scene.choices || []), newChoice],
    });
  };

  const updateChoice = (sceneId: string, choiceId: string, updates: Partial<ScenarioChoice>) => {
    const scene = scenario.content.scenes.find(s => s.id === sceneId);
    if (!scene || scene.type !== 'choice') return;

    updateScene(sceneId, {
      choices: scene.choices?.map(c =>
        c.id === choiceId ? { ...c, ...updates } : c
      ),
    });
  };

  const deleteChoice = (sceneId: string, choiceId: string) => {
    const scene = scenario.content.scenes.find(s => s.id === sceneId);
    if (!scene || scene.type !== 'choice') return;

    updateScene(sceneId, {
      choices: scene.choices?.filter(c => c.id !== choiceId),
    });
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/admin/scenarios')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            목록으로
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isNew ? '새 시나리오' : '시나리오 편집'}
            </h1>
            {!isNew && (
              <p className="text-slate-500 text-sm">{scenario.id}</p>
            )}
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          저장
        </Button>
      </div>

      <Tabs defaultValue="basic" className="space-y-6">
        <TabsList>
          <TabsTrigger value="basic">기본 정보</TabsTrigger>
          <TabsTrigger value="scenes">씬 편집 ({scenario.content.scenes.length})</TabsTrigger>
          <TabsTrigger value="conditions">조건 설정</TabsTrigger>
          <TabsTrigger value="ending">엔딩 설정</TabsTrigger>
          <TabsTrigger value="rewards">보상 설정</TabsTrigger>
          <TabsTrigger value="metrics" disabled={isNew}>
            <BarChart3 className="w-4 h-4 mr-1" />
            메트릭스
          </TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>시나리오 ID *</Label>
                  <Input
                    value={scenario.id}
                    onChange={(e) => setScenario({ ...scenario, id: e.target.value })}
                    placeholder="jun_first_meeting"
                    disabled={!isNew}
                  />
                  <p className="text-xs text-slate-500">영문, 숫자, 언더스코어만 사용</p>
                </div>
                <div className="space-y-2">
                  <Label>페르소나 *</Label>
                  <Select
                    value={scenario.persona_id}
                    onValueChange={(v) => setScenario({ ...scenario, persona_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="페르소나 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {personas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>제목 *</Label>
                <Input
                  value={scenario.title}
                  onChange={(e) => setScenario({ ...scenario, title: e.target.value })}
                  placeholder="새벽 3시의 편의점"
                />
              </div>

              <div className="space-y-2">
                <Label>설명</Label>
                <Textarea
                  value={scenario.description || ''}
                  onChange={(e) => setScenario({ ...scenario, description: e.target.value })}
                  placeholder="시나리오에 대한 설명..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>시나리오 타입</Label>
                  <Select
                    value={scenario.scenario_type}
                    onValueChange={(v) => setScenario({ ...scenario, scenario_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCENARIO_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>정렬 순서</Label>
                  <Input
                    type="number"
                    value={scenario.sort_order}
                    onChange={(e) => setScenario({ ...scenario, sort_order: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label>활성화</Label>
                <Switch
                  checked={scenario.is_active}
                  onCheckedChange={(checked) => setScenario({ ...scenario, is_active: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Scenes Tab */}
        <TabsContent value="scenes" className="space-y-4">
          {/* 플로우차트 뷰 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="w-5 h-5" />
                    시나리오 플로우
                  </CardTitle>
                  <CardDescription>
                    시나리오의 분기 구조를 시각적으로 확인합니다. 노드를 클릭하면 해당 씬으로 이동합니다.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-100 rounded-lg p-1">
                    <Button
                      variant={sceneViewMode === 'flowchart' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setSceneViewMode('flowchart')}
                      className="h-7 px-2"
                    >
                      <GitBranch className="w-4 h-4 mr-1" />
                      플로우
                    </Button>
                    <Button
                      variant={sceneViewMode === 'list' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setSceneViewMode('list')}
                      className="h-7 px-2"
                    >
                      <List className="w-4 h-4 mr-1" />
                      리스트
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sceneViewMode === 'flowchart' && (
                <ScenarioFlowChart
                  scenes={scenario.content.scenes}
                  selectedSceneId={expandedScenes[0]}
                  onSceneSelect={(sceneId) => {
                    setExpandedScenes([sceneId]);
                    setSceneViewMode('list');
                  }}
                />
              )}
            </CardContent>
          </Card>

          {/* 리스트 뷰 (편집) */}
          {sceneViewMode === 'list' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>씬 편집</CardTitle>
                  <CardDescription>시나리오의 각 장면을 편집합니다</CardDescription>
                </div>
                <div className="flex gap-2">
                  {SCENE_TYPES.map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant="outline"
                      size="sm"
                      onClick={() => addScene(value as ScenarioScene['type'])}
                    >
                      <Icon className="w-4 h-4 mr-1" />
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {scenario.content.scenes.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  씬을 추가해주세요
                </div>
              ) : (
                <Accordion
                  type="multiple"
                  value={expandedScenes}
                  onValueChange={setExpandedScenes}
                  className="space-y-2"
                >
                  {scenario.content.scenes.map((scene, index) => {
                    const typeInfo = SCENE_TYPES.find(t => t.value === scene.type);
                    const Icon = typeInfo?.icon || Type;

                    return (
                      <AccordionItem
                        key={scene.id}
                        value={scene.id}
                        className="border rounded-lg px-4"
                      >
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-400 w-6">{index + 1}</span>
                            <Icon className="w-4 h-4 text-slate-500" />
                            <Badge variant="outline">{typeInfo?.label}</Badge>
                            <span className="text-sm text-slate-600 truncate max-w-md">
                              {scene.text?.slice(0, 50) || scene.prompt?.slice(0, 50) || '(내용 없음)'}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-4 pb-2">
                          <div className="space-y-4">
                            {/* Scene Type Specific Fields */}
                            {scene.type === 'narration' && (
                              <>
                                <div className="space-y-2">
                                  <Label>나레이션 텍스트</Label>
                                  <Textarea
                                    value={scene.text || ''}
                                    onChange={(e) => updateScene(scene.id, { text: e.target.value })}
                                    placeholder="새벽 3시. 잠이 오지 않아 나선 편의점."
                                    rows={3}
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="space-y-2">
                                    <Label>배경</Label>
                                    <Input
                                      value={scene.background || ''}
                                      onChange={(e) => updateScene(scene.id, { background: e.target.value })}
                                      placeholder="convenience_store_night"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>배경음</Label>
                                    <Input
                                      value={scene.ambient || ''}
                                      onChange={(e) => updateScene(scene.id, { ambient: e.target.value })}
                                      placeholder="silence"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>전환 효과</Label>
                                    <Input
                                      value={scene.transition || ''}
                                      onChange={(e) => updateScene(scene.id, { transition: e.target.value })}
                                      placeholder="slow_fade"
                                    />
                                  </div>
                                </div>
                              </>
                            )}

                            {(scene.type === 'dialogue' || scene.type === 'character_appear') && (
                              <>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>캐릭터</Label>
                                    <Input
                                      value={scene.character || ''}
                                      onChange={(e) => updateScene(scene.id, { character: e.target.value })}
                                      placeholder="jun"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>표정</Label>
                                    <Select
                                      value={scene.expression || ''}
                                      onValueChange={(v) => updateScene(scene.id, { expression: v })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="표정 선택" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {EXPRESSIONS.map((exp) => (
                                          <SelectItem key={exp} value={exp}>
                                            {exp}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>대사</Label>
                                  <Textarea
                                    value={scene.text || ''}
                                    onChange={(e) => updateScene(scene.id, { text: e.target.value })}
                                    placeholder="...뭐야, 왜 쳐다봐."
                                    rows={2}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>내면의 생각 (선택)</Label>
                                  <Input
                                    value={scene.inner_thought || ''}
                                    onChange={(e) => updateScene(scene.id, { inner_thought: e.target.value })}
                                    placeholder="또 팬이야... 근데 이 시간에?"
                                  />
                                </div>
                              </>
                            )}

                            {scene.type === 'choice' && (
                              <>
                                <div className="space-y-2">
                                  <Label>선택 프롬프트</Label>
                                  <Input
                                    value={scene.prompt || ''}
                                    onChange={(e) => updateScene(scene.id, { prompt: e.target.value })}
                                    placeholder="그 순간, 당신은..."
                                  />
                                </div>
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <Label>선택지</Label>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => addChoice(scene.id)}
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      선택지 추가
                                    </Button>
                                  </div>
                                  {scene.choices?.map((choice, choiceIndex) => (
                                    <Card key={choice.id} className="p-4">
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <Badge variant="outline">선택 {choiceIndex + 1}</Badge>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => deleteChoice(scene.id, choice.id)}
                                          >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                          </Button>
                                        </div>
                                        <div className="space-y-2">
                                          <Label>선택지 텍스트</Label>
                                          <Input
                                            value={choice.text}
                                            onChange={(e) => updateChoice(scene.id, choice.id, { text: e.target.value })}
                                            placeholder="혹시... LUMIN 준?"
                                          />
                                        </div>
                                        <div className="grid grid-cols-4 gap-2">
                                          <div className="space-y-1">
                                            <Label className="text-xs">톤</Label>
                                            <Input
                                              value={choice.tone || ''}
                                              onChange={(e) => updateChoice(scene.id, choice.id, { tone: e.target.value })}
                                              placeholder="surprised"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">다음 씬 ID</Label>
                                            <Input
                                              value={choice.next_scene || ''}
                                              onChange={(e) => updateChoice(scene.id, choice.id, { next_scene: e.target.value })}
                                              placeholder="scene_6a"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">호감도 변화</Label>
                                            <Input
                                              type="number"
                                              value={choice.affection_change || 0}
                                              onChange={(e) => updateChoice(scene.id, choice.id, { affection_change: parseInt(e.target.value) || 0 })}
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs">플래그</Label>
                                            <Input
                                              value={choice.flag || ''}
                                              onChange={(e) => updateChoice(scene.id, choice.id, { flag: e.target.value })}
                                              placeholder="recognized"
                                            />
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <Switch
                                            checked={choice.is_premium || false}
                                            onCheckedChange={(checked) => updateChoice(scene.id, choice.id, { is_premium: checked })}
                                          />
                                          <Label className="text-sm">프리미엄 선택지</Label>
                                        </div>
                                      </div>
                                    </Card>
                                  ))}
                                </div>
                              </>
                            )}

                            {scene.type === 'transition' && (
                              <div className="space-y-2">
                                <Label>전환 효과</Label>
                                <Input
                                  value={scene.transition || ''}
                                  onChange={(e) => updateScene(scene.id, { transition: e.target.value })}
                                  placeholder="fade_to_black"
                                />
                              </div>
                            )}

                            {/* Scene Actions */}
                            <div className="flex justify-between pt-4 border-t">
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveScene(index, 'up')}
                                  disabled={index === 0}
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => moveScene(index, 'down')}
                                  disabled={index === scenario.content.scenes.length - 1}
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => duplicateScene(scene.id)}
                                >
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteScene(scene.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                삭제
                              </Button>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
          )}
        </TabsContent>

        {/* Conditions Tab */}
        <TabsContent value="conditions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>시작 조건</CardTitle>
              <CardDescription>시나리오가 시작되기 위한 조건을 설정합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>최소 호감도</Label>
                  <Input
                    type="number"
                    value={scenario.min_affection}
                    onChange={(e) => setScenario({ ...scenario, min_affection: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>최소 관계 단계</Label>
                  <Select
                    value={scenario.min_relationship_stage}
                    onValueChange={(v) => setScenario({ ...scenario, min_relationship_stage: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIP_STAGES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>선행 시나리오</Label>
                <Select
                  value=""
                  onValueChange={(v) => {
                    if (!scenario.prerequisite_scenarios.includes(v)) {
                      setScenario({
                        ...scenario,
                        prerequisite_scenarios: [...scenario.prerequisite_scenarios, v],
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선행 시나리오 추가" />
                  </SelectTrigger>
                  <SelectContent>
                    {allScenarios
                      .filter(s => s.id !== scenario.id && !scenario.prerequisite_scenarios.includes(s.id))
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {scenario.prerequisite_scenarios.map((prereq) => {
                    const prereqScenario = allScenarios.find(s => s.id === prereq);
                    return (
                      <Badge key={prereq} variant="secondary" className="gap-1">
                        {prereqScenario?.title || prereq}
                        <button
                          onClick={() => setScenario({
                            ...scenario,
                            prerequisite_scenarios: scenario.prerequisite_scenarios.filter(p => p !== prereq),
                          })}
                          className="ml-1 hover:text-red-500"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>트리거 조건 (JSON)</Label>
                <Textarea
                  value={JSON.stringify(scenario.trigger_conditions, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setScenario({ ...scenario, trigger_conditions: parsed });
                    } catch {
                      // Invalid JSON, don't update
                    }
                  }}
                  placeholder='{"is_new_user": true}'
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ending Tab */}
        <TabsContent value="ending" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>엔딩 설정</CardTitle>
              <CardDescription>시나리오 완료 후 동작을 설정합니다</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>DM 채팅으로 진행</Label>
                <Switch
                  checked={scenario.content.ending_conditions?.proceed_to_dm || false}
                  onCheckedChange={(checked) => setScenario({
                    ...scenario,
                    content: {
                      ...scenario.content,
                      ending_conditions: {
                        ...scenario.content.ending_conditions,
                        proceed_to_dm: checked,
                      },
                    },
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>DM 채팅 잠금 해제</Label>
                <Switch
                  checked={scenario.content.ending_conditions?.unlock_dm_chat || false}
                  onCheckedChange={(checked) => setScenario({
                    ...scenario,
                    content: {
                      ...scenario.content,
                      ending_conditions: {
                        ...scenario.content.ending_conditions,
                        unlock_dm_chat: checked,
                      },
                    },
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>관계 단계 설정</Label>
                <Select
                  value={scenario.content.ending_conditions?.set_relationship_stage || '_none'}
                  onValueChange={(v) => setScenario({
                    ...scenario,
                    content: {
                      ...scenario.content,
                      ending_conditions: {
                        ...scenario.content.ending_conditions,
                        set_relationship_stage: v === '_none' ? undefined : v,
                      },
                    },
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="변경 안함" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">변경 안함</SelectItem>
                    {RELATIONSHIP_STAGES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>선택지별 초기 호감도 (JSON)</Label>
                <Textarea
                  value={JSON.stringify(scenario.content.ending_conditions?.initial_affection_by_choice || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setScenario({
                        ...scenario,
                        content: {
                          ...scenario.content,
                          ending_conditions: {
                            ...scenario.content.ending_conditions,
                            initial_affection_by_choice: parsed,
                          },
                        },
                      });
                    } catch {
                      // Invalid JSON
                    }
                  }}
                  placeholder='{"choice_1": 5, "choice_2": 10, "choice_3": 15}'
                  rows={4}
                  className="font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>보상 설정</CardTitle>
                  <CardDescription>시나리오 완료 시 지급할 보상을 설정합니다</CardDescription>
                </div>
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  보상 시스템 베타
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  보상은 데이터베이스 <code className="bg-amber-100 px-1 rounded">scenario_rewards</code> 테이블에서 관리됩니다.
                  현재 시나리오 ID: <code className="bg-amber-100 px-1 rounded font-mono">{scenario.id || '(미정)'}</code>
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">사용 가능한 보상 유형</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">🪙</div>
                      <div>
                        <p className="font-medium text-sm">토큰 (tokens)</p>
                        <p className="text-xs text-slate-500">LUMIN 단일 화폐</p>
                      </div>
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center">❤️</div>
                      <div>
                        <p className="font-medium text-sm">하트 (hearts)</p>
                        <p className="text-xs text-slate-500">호감도 부스터</p>
                      </div>
                    </div>
                  </div>
                  <div className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">📖</div>
                      <div>
                        <p className="font-medium text-sm">스토리 잠금해제</p>
                        <p className="text-xs text-slate-500">특별 콘텐츠 해금</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">보상 조건 유형</h3>
                <div className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">completion</Badge>
                    <span className="text-slate-600">시나리오 완료 시 항상 지급</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">first_completion</Badge>
                    <span className="text-slate-600">첫 완료 시에만 지급</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">choice_based</Badge>
                    <span className="text-slate-600">특정 선택지 선택 시 지급</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">speed_run</Badge>
                    <span className="text-slate-600">특정 시간 내 완료 시 지급</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">보상 추가 예시 (SQL)</h3>
                <pre className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs overflow-x-auto">
{`INSERT INTO scenario_rewards (scenario_id, reward_type_id, condition_type, amount)
VALUES ('${scenario.id || 'scenario_id'}', 'tokens', 'first_completion', 100);

-- 선택지 기반 보상
INSERT INTO scenario_rewards
  (scenario_id, reward_type_id, condition_type, required_choice_ids, amount)
VALUES
  ('${scenario.id || 'scenario_id'}', 'tokens', 'choice_based',
   ARRAY['choice_premium'], 10);`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metrics Tab */}
        <TabsContent value="metrics" className="space-y-6">
          <ScenarioMetricsTab scenarioId={scenarioId || ''} scenes={scenario.content.scenes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Metrics Tab Component
// ============================================

interface ScenarioMetricsTabProps {
  scenarioId: string;
  scenes: ScenarioScene[];
}

function ScenarioMetricsTab({ scenarioId, scenes }: ScenarioMetricsTabProps) {
  const [stats, setStats] = useState<{
    overview: {
      totalSessions: number;
      uniqueUsers: number;
      completedSessions: number;
      abandonedSessions: number;
      completionRate: number;
      avgProgressPercent: number;
      avgCompletionTimeSeconds: number;
      totalChoicesMade: number;
      premiumChoicesMade: number;
      totalAffectionGained: number;
    };
    dailyStats: Array<{
      date: string;
      sessions: number;
      completed: number;
      abandoned: number;
      completionRate: number;
    }>;
    choiceDistribution: Array<{
      sceneId: string;
      choiceId: string;
      choiceText: string;
      selectionCount: number;
      isPremium: boolean;
      selectionPercentage: number;
    }>;
    dropOffPoints: Array<{
      sceneId: string;
      sceneIndex: number;
      dropOffCount: number;
      dropOffRate: number;
    }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    if (!scenarioId) return;

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_scenario_stats', {
          p_scenario_id: scenarioId,
          p_days: days,
        });

        if (error) throw error;

        if (data) {
          const rawStats = data as Record<string, unknown>;
          const overview = rawStats.overview as Record<string, unknown> | null;
          const dailyStats = (rawStats.daily_stats || []) as Array<Record<string, unknown>>;
          const choiceDistribution = (rawStats.choice_distribution || []) as Array<Record<string, unknown>>;
          const dropOffPoints = (rawStats.drop_off_points || []) as Array<Record<string, unknown>>;

          setStats({
            overview: {
              totalSessions: (overview?.total_sessions as number) || 0,
              uniqueUsers: (overview?.unique_users as number) || 0,
              completedSessions: (overview?.completed_sessions as number) || 0,
              abandonedSessions: (overview?.abandoned_sessions as number) || 0,
              completionRate: (overview?.completion_rate as number) || 0,
              avgProgressPercent: (overview?.avg_progress_percent as number) || 0,
              avgCompletionTimeSeconds: (overview?.avg_completion_time_seconds as number) || 0,
              totalChoicesMade: (overview?.total_choices_made as number) || 0,
              premiumChoicesMade: (overview?.premium_choices_made as number) || 0,
              totalAffectionGained: (overview?.total_affection_gained as number) || 0,
            },
            dailyStats: dailyStats.map((d) => ({
              date: d.date as string,
              sessions: d.sessions as number,
              completed: d.completed as number,
              abandoned: d.abandoned as number,
              completionRate: d.completion_rate as number,
            })),
            choiceDistribution: choiceDistribution.map((c) => ({
              sceneId: c.scene_id as string,
              choiceId: c.choice_id as string,
              choiceText: c.choice_text as string,
              selectionCount: c.selection_count as number,
              isPremium: c.is_premium as boolean,
              selectionPercentage: c.selection_percentage as number,
            })),
            dropOffPoints: dropOffPoints.map((d) => ({
              sceneId: d.scene_id as string,
              sceneIndex: d.scene_index as number,
              dropOffCount: d.drop_off_count as number,
              dropOffRate: d.drop_off_rate as number,
            })),
          });
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [scenarioId, days]);

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}초`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}분 ${remainingSeconds}초`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-slate-500">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>아직 메트릭스 데이터가 없습니다.</p>
            <p className="text-sm mt-2">시나리오가 플레이되면 통계가 수집됩니다.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          시나리오 메트릭스
        </h2>
        <Select value={days.toString()} onValueChange={(v) => setDays(parseInt(v))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7일</SelectItem>
            <SelectItem value="14">14일</SelectItem>
            <SelectItem value="30">30일</SelectItem>
            <SelectItem value="90">90일</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">총 세션</p>
                <p className="text-2xl font-bold">{stats.overview.totalSessions}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-50" />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              유니크 유저: {stats.overview.uniqueUsers}명
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">완료율</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.overview.completionRate}%
                </p>
              </div>
              <Target className="w-8 h-8 text-green-500 opacity-50" />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              완료: {stats.overview.completedSessions} / 이탈: {stats.overview.abandonedSessions}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">평균 진행률</p>
                <p className="text-2xl font-bold text-purple-600">
                  {stats.overview.avgProgressPercent?.toFixed(1) || 0}%
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500 opacity-50" />
            </div>
            <p className="text-xs text-slate-400 mt-2">
              총 씬: {scenes.length}개
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">평균 완료 시간</p>
                <p className="text-2xl font-bold text-amber-600">
                  {formatTime(stats.overview.avgCompletionTimeSeconds || 0)}
                </p>
              </div>
              <Clock className="w-8 h-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Choice & Premium Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">총 선택 횟수</p>
            <p className="text-xl font-bold">{stats.overview.totalChoicesMade}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">프리미엄 선택 횟수</p>
            <p className="text-xl font-bold text-amber-600">{stats.overview.premiumChoicesMade}</p>
            {stats.overview.totalChoicesMade > 0 && (
              <p className="text-xs text-slate-400">
                {((stats.overview.premiumChoicesMade / stats.overview.totalChoicesMade) * 100).toFixed(1)}% 전환율
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-500">총 호감도 획득</p>
            <p className="text-xl font-bold text-pink-600">+{stats.overview.totalAffectionGained}</p>
          </CardContent>
        </Card>
      </div>

      {/* Drop-off Points */}
      {stats.dropOffPoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              이탈 포인트 TOP 10
            </CardTitle>
            <CardDescription>
              유저들이 가장 많이 이탈하는 지점입니다. 개선이 필요할 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.dropOffPoints.slice(0, 10).map((point, idx) => {
                const scene = scenes.find(s => s.id === point.sceneId);
                return (
                  <div key={point.sceneId} className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-500 w-6">#{idx + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">씬 {point.sceneIndex + 1}</Badge>
                        <span className="text-sm truncate">
                          {scene?.text?.slice(0, 40) || scene?.prompt?.slice(0, 40) || point.sceneId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-orange-500 transition-all"
                            style={{ width: `${Math.min(point.dropOffRate, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-orange-600 font-medium w-16 text-right">
                          {point.dropOffRate?.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <span className="text-sm text-slate-500">{point.dropOffCount}명 이탈</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Choice Distribution */}
      {stats.choiceDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5" />
              선택지 분포
            </CardTitle>
            <CardDescription>
              각 선택지의 선택 비율을 확인합니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Group by scene */}
              {(() => {
                const groupedByScene = stats.choiceDistribution.reduce((acc, choice) => {
                  if (!acc[choice.sceneId]) acc[choice.sceneId] = [];
                  acc[choice.sceneId].push(choice);
                  return acc;
                }, {} as Record<string, typeof stats.choiceDistribution>);

                return Object.entries(groupedByScene).map(([sceneId, choices]) => {
                  const scene = scenes.find(s => s.id === sceneId);
                  const sceneIndex = scenes.findIndex(s => s.id === sceneId);

                  return (
                    <div key={sceneId} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline">씬 {sceneIndex + 1}</Badge>
                        <span className="text-sm text-slate-600 truncate">
                          {scene?.prompt || '(프롬프트 없음)'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {choices.map((choice, idx) => (
                          <div key={choice.choiceId} className="flex items-center gap-3">
                            <span className="w-6 h-6 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-medium">
                              {idx + 1}
                            </span>
                            <span className="flex-1 text-sm truncate">
                              {choice.choiceText || '(텍스트 없음)'}
                            </span>
                            {choice.isPremium && (
                              <Badge className="bg-amber-100 text-amber-700 text-xs">PRO</Badge>
                            )}
                            <div className="w-32 bg-slate-100 rounded-full h-2 overflow-hidden">
                              <div
                                className="h-full bg-purple-500 transition-all"
                                style={{ width: `${choice.selectionPercentage || 0}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-12 text-right">
                              {choice.selectionPercentage?.toFixed(1) || 0}%
                            </span>
                            <span className="text-xs text-slate-400 w-16 text-right">
                              ({choice.selectionCount}회)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily Stats Table */}
      {stats.dailyStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              일별 통계
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 px-3 text-left font-medium text-slate-500">날짜</th>
                    <th className="py-2 px-3 text-right font-medium text-slate-500">세션</th>
                    <th className="py-2 px-3 text-right font-medium text-slate-500">완료</th>
                    <th className="py-2 px-3 text-right font-medium text-slate-500">이탈</th>
                    <th className="py-2 px-3 text-right font-medium text-slate-500">완료율</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.dailyStats.slice(0, 14).map((day) => (
                    <tr key={day.date} className="border-b hover:bg-slate-50">
                      <td className="py-2 px-3">{day.date}</td>
                      <td className="py-2 px-3 text-right">{day.sessions}</td>
                      <td className="py-2 px-3 text-right text-green-600">{day.completed}</td>
                      <td className="py-2 px-3 text-right text-red-600">{day.abandoned}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={day.completionRate >= 50 ? 'text-green-600' : 'text-orange-600'}>
                          {day.completionRate?.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {stats.overview.totalSessions === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-slate-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>아직 이 기간에 세션 데이터가 없습니다.</p>
              <p className="text-sm mt-2">시나리오가 플레이되면 통계가 수집됩니다.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

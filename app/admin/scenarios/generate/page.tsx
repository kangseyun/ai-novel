'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles,
  Loader2,
  ArrowLeft,
  Wand2,
  BookOpen,
  Compass,
  Zap,
  Save,
  Eye,
  RefreshCw,
  Check,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface PersonaCore {
  id: string;
  name: string;
  profile_image_url: string | null;
}

interface GeneratedScene {
  id: string;
  sceneNumber: number;
  sceneType: string;
  content: {
    text: string;
    speaker?: string;
    emotion?: string;
    backgroundHint?: string;
  };
  choices?: {
    id: string;
    text: string;
    tone: string;
    isPremium: boolean;
    affectionChange: number;
    nextSceneId: string;
    responseHint?: string;
  }[];
  nextSceneId?: string;
}

interface GeneratedScenario {
  id: string;
  title: string;
  description: string;
  scenes: GeneratedScene[];
  metadata: {
    theme: string;
    estimatedDuration: string;
    emotionalArc: string[];
  };
}

const RELATIONSHIP_STAGES = [
  { value: 'stranger', label: '낯선 사람' },
  { value: 'acquaintance', label: '아는 사이' },
  { value: 'friend', label: '친구' },
  { value: 'close', label: '친한 친구' },
  { value: 'intimate', label: '특별한 사이' },
  { value: 'lover', label: '연인' },
];

const THEME_SUGGESTIONS: Record<string, { theme: string; description: string }[]> = {
  stranger: [
    { theme: '우연한 만남', description: '예상치 못한 장소에서의 첫 만남' },
    { theme: '도움 요청', description: '작은 도움이 인연의 시작이 되는' },
    { theme: '오해와 화해', description: '처음엔 오해했지만 풀리는 과정' },
  ],
  acquaintance: [
    { theme: '공통 관심사', description: '같은 취미나 관심사를 발견하는' },
    { theme: '우연의 일치', description: '자꾸만 마주치게 되는 인연' },
    { theme: '작은 배려', description: '사소한 배려에서 시작되는 호감' },
  ],
  friend: [
    { theme: '비밀 공유', description: '서로만의 비밀을 나누게 되는' },
    { theme: '힘든 순간', description: '어려운 시기에 함께 있어주는' },
    { theme: '특별한 약속', description: '둘만의 특별한 약속을 만드는' },
  ],
  close: [
    { theme: '질투의 순간', description: '예상치 못한 질투심이 생기는' },
    { theme: '미래 이야기', description: '함께하는 미래를 상상하는' },
    { theme: '고백 직전', description: '마음을 전하고 싶은 순간' },
  ],
  intimate: [
    { theme: '첫 다툼', description: '처음으로 의견이 부딪히는' },
    { theme: '기념일', description: '특별한 날을 함께 보내는' },
    { theme: '시련 극복', description: '함께 어려움을 이겨내는' },
  ],
  lover: [
    { theme: '평범한 행복', description: '일상 속 소소한 행복' },
    { theme: '미래 계획', description: '함께할 미래를 구체적으로 계획하는' },
    { theme: '재확인', description: '서로의 마음을 다시 확인하는' },
  ],
};

const EMOTION_OPTIONS = [
  '설렘', '따뜻함', '행복', '슬픔', '그리움', '긴장', '두근거림', '안도', '기대', '놀라움',
];

export default function ScenarioGeneratePage() {
  const router = useRouter();
  const [personas, setPersonas] = useState<PersonaCore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [selectedPersonaId, setSelectedPersonaId] = useState('');
  const [generationType, setGenerationType] = useState<'static' | 'guided' | 'dynamic'>('static');
  const [theme, setTheme] = useState('');
  const [customTheme, setCustomTheme] = useState('');
  const [targetEmotion, setTargetEmotion] = useState('설렘');
  const [situationHint, setSituationHint] = useState('');
  const [relationshipStage, setRelationshipStage] = useState('acquaintance');
  const [minAffection, setMinAffection] = useState(0);
  const [sceneCount, setSceneCount] = useState(4);
  const [choicesPerScene, setChoicesPerScene] = useState(2);
  const [includePremiumChoice, setIncludePremiumChoice] = useState(true);

  // Generated result
  const [generatedScenario, setGeneratedScenario] = useState<GeneratedScenario | null>(null);
  const [previewSceneIndex, setPreviewSceneIndex] = useState(0);

  const fetchPersonas = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('persona_core')
        .select('id, name, profile_image_url')
        .order('name');

      if (error) throw error;
      setPersonas(data || []);

      if (data && data.length > 0) {
        setSelectedPersonaId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching personas:', error);
      toast.error('페르소나 목록을 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  const selectedPersona = personas.find(p => p.id === selectedPersonaId);
  const themeSuggestions = THEME_SUGGESTIONS[relationshipStage] || THEME_SUGGESTIONS.acquaintance;

  const handleGenerate = async () => {
    if (!selectedPersonaId) {
      toast.error('페르소나를 선택해주세요');
      return;
    }

    const finalTheme = theme === 'custom' ? customTheme : theme;
    if (!finalTheme) {
      toast.error('테마를 선택하거나 입력해주세요');
      return;
    }

    setIsGenerating(true);
    setGeneratedScenario(null);

    try {
      const response = await fetch('/api/admin/scenarios/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId: selectedPersonaId,
          scenarioType: generationType,
          theme: finalTheme,
          targetEmotion,
          situationHint,
          relationshipStage,
          minAffection,
          sceneCount,
          choicesPerScene,
          includePremiumChoice,
        }),
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const result = await response.json();
      setGeneratedScenario(result.scenario);
      setPreviewSceneIndex(0);
      toast.success('시나리오가 생성되었습니다!');
    } catch (error) {
      console.error('Error generating scenario:', error);
      toast.error('시나리오 생성에 실패했습니다');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async (asDraft: boolean = true) => {
    if (!generatedScenario) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/scenarios/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: generatedScenario,
          personaId: selectedPersonaId,
          generationMode: generationType,
          triggerConditions: {
            minAffection,
            relationshipStage,
          },
          isActive: !asDraft,
        }),
      });

      if (!response.ok) {
        throw new Error('Save failed');
      }

      const { scenarioId } = await response.json();
      toast.success(asDraft ? '임시저장되었습니다' : '저장 및 활성화되었습니다');
      router.push(`/admin/scenarios/${scenarioId}`);
    } catch (error) {
      console.error('Error saving scenario:', error);
      toast.error('저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          뒤로
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
            AI 시나리오 생성
          </h1>
          <p className="text-slate-500 mt-1">
            페르소나의 세계관과 성격을 기반으로 AI가 시나리오를 자동 생성합니다
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Configuration */}
        <div className="space-y-6">
          {/* Generation Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">생성 유형</CardTitle>
              <CardDescription>시나리오 생성 방식을 선택하세요</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={generationType} onValueChange={(v) => setGenerationType(v as 'static' | 'guided' | 'dynamic')}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="static" className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Static
                  </TabsTrigger>
                  <TabsTrigger value="guided" className="flex items-center gap-2">
                    <Compass className="w-4 h-4" />
                    Guided
                  </TabsTrigger>
                  <TabsTrigger value="dynamic" className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    Dynamic
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="static" className="mt-4">
                  <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-600">
                    <strong>Static 시나리오:</strong> 완전한 분기 구조가 사전 정의됩니다.
                    생성 후 수동으로 편집하여 세밀하게 조정할 수 있습니다.
                  </div>
                </TabsContent>
                <TabsContent value="guided" className="mt-4">
                  <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-600">
                    <strong>Guided 시나리오:</strong> 플롯 포인트만 정의하고,
                    실제 대사는 AI가 실시간으로 생성합니다.
                  </div>
                </TabsContent>
                <TabsContent value="dynamic" className="mt-4">
                  <div className="p-3 bg-orange-50 rounded-lg text-sm text-orange-600">
                    <strong>Dynamic 시나리오:</strong> 트리거 조건과 가이드라인만 설정하고,
                    전체 시나리오를 AI가 실시간 생성합니다.
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Persona Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">페르소나 선택</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedPersonaId} onValueChange={setSelectedPersonaId}>
                <SelectTrigger>
                  <SelectValue placeholder="페르소나 선택" />
                </SelectTrigger>
                <SelectContent>
                  {personas.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        {p.profile_image_url ? (
                          <img src={p.profile_image_url} alt="" className="w-6 h-6 rounded-full" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-300" />
                        )}
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Theme & Emotion */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">테마 & 감정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>관계 단계</Label>
                <Select value={relationshipStage} onValueChange={setRelationshipStage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIP_STAGES.map(stage => (
                      <SelectItem key={stage.value} value={stage.value}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>테마 선택</Label>
                <div className="grid grid-cols-1 gap-2 mt-2">
                  {themeSuggestions.map(suggestion => (
                    <button
                      key={suggestion.theme}
                      onClick={() => setTheme(suggestion.theme)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        theme === suggestion.theme
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-medium text-sm">{suggestion.theme}</div>
                      <div className="text-xs text-slate-500">{suggestion.description}</div>
                    </button>
                  ))}
                  <button
                    onClick={() => setTheme('custom')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      theme === 'custom'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-medium text-sm">직접 입력</div>
                    <div className="text-xs text-slate-500">원하는 테마를 직접 작성</div>
                  </button>
                </div>

                {theme === 'custom' && (
                  <Input
                    className="mt-2"
                    placeholder="테마를 입력하세요..."
                    value={customTheme}
                    onChange={(e) => setCustomTheme(e.target.value)}
                  />
                )}
              </div>

              <div>
                <Label>목표 감정</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {EMOTION_OPTIONS.map(emotion => (
                    <Badge
                      key={emotion}
                      variant={targetEmotion === emotion ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setTargetEmotion(emotion)}
                    >
                      {emotion}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label>상황 힌트 (선택사항)</Label>
                <Textarea
                  placeholder="예: 비 오는 저녁, 카페에서 우연히 마주침..."
                  value={situationHint}
                  onChange={(e) => setSituationHint(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Generation Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">생성 설정</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex justify-between mb-2">
                  <Label>최소 호감도</Label>
                  <span className="text-sm text-slate-500">{minAffection}</span>
                </div>
                <Slider
                  value={[minAffection]}
                  onValueChange={([v]) => setMinAffection(v)}
                  max={100}
                  step={5}
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label>씬 개수</Label>
                  <span className="text-sm text-slate-500">{sceneCount}개</span>
                </div>
                <Slider
                  value={[sceneCount]}
                  onValueChange={([v]) => setSceneCount(v)}
                  min={2}
                  max={8}
                  step={1}
                />
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <Label>씬당 선택지</Label>
                  <span className="text-sm text-slate-500">{choicesPerScene}개</span>
                </div>
                <Slider
                  value={[choicesPerScene]}
                  onValueChange={([v]) => setChoicesPerScene(v)}
                  min={1}
                  max={4}
                  step={1}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>프리미엄 선택지 포함</Label>
                <Switch
                  checked={includePremiumChoice}
                  onCheckedChange={setIncludePremiumChoice}
                />
              </div>
            </CardContent>
          </Card>

          {/* Generate Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={isGenerating || !selectedPersonaId}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                시나리오 생성
              </>
            )}
          </Button>
        </div>

        {/* Right: Preview */}
        <div className="space-y-6">
          <Card className="sticky top-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    미리보기
                  </CardTitle>
                  <CardDescription>
                    {generatedScenario
                      ? `${generatedScenario.scenes.length}개 씬 생성됨`
                      : '시나리오를 생성하면 여기에 표시됩니다'}
                  </CardDescription>
                </div>
                {generatedScenario && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleGenerate}>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      재생성
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!generatedScenario ? (
                <div className="h-[500px] flex flex-col items-center justify-center text-slate-400">
                  <Sparkles className="w-12 h-12 mb-4" />
                  <p>왼쪽에서 설정을 완료하고</p>
                  <p>&quot;시나리오 생성&quot; 버튼을 클릭하세요</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Scenario Info */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h3 className="font-bold text-lg">{generatedScenario.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{generatedScenario.description}</p>
                    <div className="flex gap-2 mt-3">
                      <Badge variant="outline">{generatedScenario.metadata.theme}</Badge>
                      <Badge variant="outline">{generatedScenario.metadata.estimatedDuration}</Badge>
                    </div>
                    <div className="flex gap-1 mt-2">
                      {generatedScenario.metadata.emotionalArc.map((emotion, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {emotion}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Scene Navigation */}
                  <div className="flex gap-1 overflow-x-auto pb-2">
                    {generatedScenario.scenes.map((scene, index) => (
                      <button
                        key={scene.id}
                        onClick={() => setPreviewSceneIndex(index)}
                        className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${
                          previewSceneIndex === index
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        씬 {scene.sceneNumber}
                      </button>
                    ))}
                  </div>

                  {/* Current Scene */}
                  {generatedScenario.scenes[previewSceneIndex] && (
                    <div className="border rounded-lg p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge>{generatedScenario.scenes[previewSceneIndex].sceneType}</Badge>
                        {generatedScenario.scenes[previewSceneIndex].content.emotion && (
                          <Badge variant="outline">
                            {generatedScenario.scenes[previewSceneIndex].content.emotion}
                          </Badge>
                        )}
                      </div>

                      <div className="p-4 bg-slate-50 rounded-lg">
                        {generatedScenario.scenes[previewSceneIndex].content.speaker && (
                          <div className="text-xs text-slate-500 mb-1">
                            {generatedScenario.scenes[previewSceneIndex].content.speaker === 'persona'
                              ? selectedPersona?.name
                              : generatedScenario.scenes[previewSceneIndex].content.speaker}
                          </div>
                        )}
                        <p className="text-slate-800">
                          {generatedScenario.scenes[previewSceneIndex].content.text}
                        </p>
                      </div>

                      {generatedScenario.scenes[previewSceneIndex].choices && (
                        <div className="space-y-2">
                          <div className="text-sm font-medium text-slate-700">선택지</div>
                          {generatedScenario.scenes[previewSceneIndex].choices?.map((choice) => (
                            <div
                              key={choice.id}
                              className={`p-3 rounded-lg border ${
                                choice.isPremium
                                  ? 'border-amber-300 bg-amber-50'
                                  : 'border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                {choice.isPremium && (
                                  <Sparkles className="w-4 h-4 text-amber-500" />
                                )}
                                <span className="text-sm">{choice.text}</span>
                              </div>
                              <div className="flex gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">{choice.tone}</Badge>
                                <Badge
                                  variant="outline"
                                  className={`text-xs ${
                                    choice.affectionChange > 0
                                      ? 'text-green-600'
                                      : choice.affectionChange < 0
                                        ? 'text-red-600'
                                        : ''
                                  }`}
                                >
                                  {choice.affectionChange > 0 ? '+' : ''}{choice.affectionChange}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Save Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSave(true)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      임시저장
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => handleSave(false)}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      저장 & 활성화
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

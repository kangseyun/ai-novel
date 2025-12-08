'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useImageGenerationQueue, useImageHistory } from '@/hooks/useImageGenerationQueue';
import { Save, ArrowLeft, Loader2, Plus, Trash2, ChevronDown, Sparkles, RefreshCw, Image as ImageIcon, MessageSquare, Clock, History, Check } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PersonaFormData {
  id: string;
  name: string;
  full_name: string;
  role: string;
  age: number;
  ethnicity: string;
  target_audience: 'female' | 'male' | 'anime';
  voice_description: string;
  profile_image_url: string | null;
  appearance: {
    hair: string;
    eyes: string;
    build: string;
    style: string;
    distinguishingFeatures: string[];
  };
  core_personality: {
    surface: string[];
    hidden: string[];
    core_trope: string;
  };
  speech_patterns: {
    formality: string;
    petNames: string[];
    verbalTics: string[];
    emotionalRange: string;
  };
  worldview: {
    settings: string[];
    timePeriod: string;
    defaultRelationship: string;
    relationshipAlternatives: string[];
    mainConflict: string;
    conflictStakes: string;
    openingLine: string;
    storyHooks: string[];
    boundaries: string[];
  };
  likes: string[];
  dislikes: string[];
  absolute_rules: string[];
  base_instruction: string;
  tone_config: {
    style: string;
    allowEmoji: boolean;
    allowSlang: boolean;
    minLength: number;
    maxLength: number;
  };
  situation_presets: {
    dawn: string[];
    morning: string[];
    afternoon: string[];
    evening: string[];
    night: string[];
  };
  behavior_by_stage: Record<string, {
    tone: string;
    distance: string;
    behaviors: string[];
    intimacy_level: string;
  }>;
  first_scenario_id: string;
}

interface ExampleDialogue {
  id?: string;
  tags: string[];
  messages: Array<{ role: string; content: string }>;
  priority: number;
  min_stage: string | null;
}

const defaultFormData: PersonaFormData = {
  id: '',
  name: '',
  full_name: '',
  role: '',
  age: 20,
  ethnicity: 'Korean',
  target_audience: 'female',
  voice_description: '',
  profile_image_url: null,
  appearance: {
    hair: '',
    eyes: '',
    build: '',
    style: '',
    distinguishingFeatures: [],
  },
  core_personality: {
    surface: [],
    hidden: [],
    core_trope: '',
  },
  speech_patterns: {
    formality: 'low',
    petNames: [],
    verbalTics: [],
    emotionalRange: 'high',
  },
  worldview: {
    settings: [],
    timePeriod: 'Present',
    defaultRelationship: '',
    relationshipAlternatives: [],
    mainConflict: '',
    conflictStakes: '',
    openingLine: '',
    storyHooks: [],
    boundaries: [],
  },
  likes: [],
  dislikes: [],
  absolute_rules: [],
  base_instruction: '',
  tone_config: {
    style: 'chat',
    allowEmoji: true,
    allowSlang: true,
    minLength: 1,
    maxLength: 3,
  },
  situation_presets: {
    dawn: [],
    morning: [],
    afternoon: [],
    evening: [],
    night: [],
  },
  behavior_by_stage: {
    stranger: { tone: 'neutral', distance: 'formal', behaviors: [], intimacy_level: 'none' },
    acquaintance: { tone: 'friendly', distance: 'polite', behaviors: [], intimacy_level: 'low' },
    friend: { tone: 'casual', distance: 'comfortable', behaviors: [], intimacy_level: 'medium' },
    close: { tone: 'warm', distance: 'close', behaviors: [], intimacy_level: 'high' },
    intimate: { tone: 'tender', distance: 'intimate', behaviors: [], intimacy_level: 'very_high' },
    lover: { tone: 'loving', distance: 'intimate', behaviors: [], intimacy_level: 'max' },
  },
  first_scenario_id: '',
};

export default function PersonaEditPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const isNew = resolvedParams.id === 'new';
  const [formData, setFormData] = useState<PersonaFormData>(defaultFormData);
  const [exampleDialogues, setExampleDialogues] = useState<ExampleDialogue[]>([]);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    ai: true,
    basic: true,
    appearance: false,
    personality: false,
    speech: false,
    worldview: false,
    system: false,
    situations: false,
    dialogues: false,
    image: false,
  });

  // Image generation queue (Supabase Realtime)
  const { processingTasks, getTaskForPersona, createTask, updateTask } = useImageGenerationQueue();
  const currentTask = !isNew ? getTaskForPersona(resolvedParams.id) : null;

  // Image history (Supabase Realtime)
  const { history: imageHistory, isLoading: isHistoryLoading, addToHistory, setAsCurrent } = useImageHistory(!isNew ? resolvedParams.id : null);
  const [showImageHistory, setShowImageHistory] = useState(false);

  // AI Generation states
  const [conceptPrompt, setConceptPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingField, setGeneratingField] = useState<string | null>(null);

  // Image generation states
  const [imageTaskId, setImageTaskId] = useState<string | null>(null);
  const [generatedImages, setGeneratedImages] = useState<Array<{ url: string; index: number }>>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [imageType, setImageType] = useState<'profile' | 'full' | 'scene'>('profile');
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [showPromptEditor, setShowPromptEditor] = useState(false);

  const router = useRouter();

  useEffect(() => {
    if (!isNew) {
      loadPersona();
    }
  }, [isNew, resolvedParams.id]);

  // 훅에서 이미지 생성이 완료되면 히스토리가 자동으로 업데이트됨
  // 히스토리 변경 감지하여 UI 업데이트
  useEffect(() => {
    if (imageHistory.length > 0 && isGeneratingImage) {
      // 히스토리에 새 이미지가 추가되면 생성 완료로 간주
      const latestImage = imageHistory[0];
      if (latestImage.is_current) {
        setFormData(prev => ({ ...prev, profile_image_url: latestImage.image_url }));
        setGeneratedImages([{ url: latestImage.image_url, index: 0 }]);
        setSelectedImageIndex(0);
        setImageTaskId(null);
        setIsGeneratingImage(false);
      }
    }
  }, [imageHistory, isGeneratingImage]);

  // currentTask 상태 변경 감지 (실패 시 알림)
  useEffect(() => {
    if (!currentTask && imageTaskId) {
      // 태스크가 목록에서 사라졌다 = 완료 또는 실패
      // 히스토리 훅에서 이미지가 추가되지 않았다면 실패로 간주
      const hasNewImage = imageHistory.some(h => h.created_at > new Date(Date.now() - 10000).toISOString());
      if (!hasNewImage && isGeneratingImage) {
        // 실패한 경우
        setImageTaskId(null);
        setIsGeneratingImage(false);
      }
    }
  }, [currentTask, imageTaskId, imageHistory, isGeneratingImage]);

  async function loadPersona() {
    setIsLoading(true);
    try {
      const { data: persona, error } = await supabase
        .from('persona_core')
        .select('*')
        .eq('id', resolvedParams.id)
        .single();

      if (error) throw error;

      const { data: dialogues } = await supabase
        .from('persona_example_dialogues')
        .select('*')
        .eq('persona_id', resolvedParams.id)
        .order('priority', { ascending: false });

      setFormData({
        ...defaultFormData,
        ...persona,
        profile_image_url: persona.profile_image_url || null,
        target_audience: persona.target_audience || 'female',
        appearance: persona.appearance || defaultFormData.appearance,
        core_personality: persona.core_personality || defaultFormData.core_personality,
        speech_patterns: persona.speech_patterns || defaultFormData.speech_patterns,
        worldview: persona.worldview || defaultFormData.worldview,
        tone_config: persona.tone_config || defaultFormData.tone_config,
        situation_presets: persona.situation_presets || defaultFormData.situation_presets,
        behavior_by_stage: persona.behavior_by_stage || defaultFormData.behavior_by_stage,
      });

      // 기존 프로필 이미지가 있으면 generatedImages에 설정
      if (persona.profile_image_url) {
        setGeneratedImages([{ url: persona.profile_image_url, index: 0 }]);
      }

      setExampleDialogues(dialogues || []);
    } catch (error) {
      console.error('Failed to load persona:', error);
      alert('페르소나를 불러오는데 실패했습니다.');
      router.push('/admin/personas');
    } finally {
      setIsLoading(false);
    }
  }

  // AI Generation: Generate all fields
  async function handleGenerateAll() {
    if (!conceptPrompt.trim()) {
      alert('생성 프롬프트를 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch('/api/admin/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: conceptPrompt }),
      });

      const result = await res.json();
      if (result.success && result.data) {
        setFormData(prev => ({
          ...prev,
          ...result.data,
          appearance: result.data.appearance || prev.appearance,
          core_personality: result.data.core_personality || prev.core_personality,
          speech_patterns: result.data.speech_patterns || prev.speech_patterns,
          worldview: result.data.worldview || prev.worldview,
          tone_config: result.data.tone_config || prev.tone_config,
          situation_presets: result.data.situation_presets || prev.situation_presets,
        }));
        // 모든 섹션 열기
        setExpandedSections({
          ai: true,
          basic: true,
          appearance: true,
          personality: true,
          speech: true,
          worldview: true,
          system: true,
          situations: true,
          dialogues: true,
          image: true,
        });
      } else {
        alert('생성 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Generation error:', error);
      alert('AI 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  }

  // AI Generation: Regenerate specific field
  async function handleRegenerateField(field: string) {
    if (!conceptPrompt.trim()) {
      alert('생성 프롬프트를 입력해주세요.');
      return;
    }

    setGeneratingField(field);
    try {
      const res = await fetch('/api/admin/persona/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: conceptPrompt,
          field,
          existingData: formData,
        }),
      });

      const result = await res.json();
      if (result.success && result.data !== undefined) {
        updateFormData(field, result.data);
      } else {
        alert('재생성 실패: ' + (result.error || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Regeneration error:', error);
      alert('재생성 중 오류가 발생했습니다.');
    } finally {
      setGeneratingField(null);
    }
  }

  // Image generation - preview prompt
  async function handlePreviewImagePrompt() {
    try {
      const res = await fetch('/api/admin/persona/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaData: {
            name: formData.name,
            role: formData.role,
            age: formData.age,
            ethnicity: formData.ethnicity,
            appearance: formData.appearance,
            core_personality: formData.core_personality,
          },
          conceptPrompt,
          imageType,
          previewOnly: true,
        }),
      });

      const result = await res.json();
      if (result.success && result.prompt) {
        setImagePrompt(result.prompt);
        setShowPromptEditor(true);
      }
    } catch (error) {
      console.error('Prompt preview error:', error);
    }
  }

  // Image generation
  async function handleGenerateImage() {
    setIsGeneratingImage(true);
    setGeneratedImages([]);

    try {
      const res = await fetch('/api/admin/persona/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaData: {
            name: formData.name,
            role: formData.role,
            age: formData.age,
            ethnicity: formData.ethnicity,
            appearance: formData.appearance,
            core_personality: formData.core_personality,
          },
          conceptPrompt,
          imageType,
          customPrompt: imagePrompt || undefined,  // 편집된 프롬프트 사용
        }),
      });

      const result = await res.json();
      if (result.success && result.taskId) {
        setImageTaskId(result.taskId);
        if (result.prompt) {
          setImagePrompt(result.prompt);
        }
        // Supabase에 태스크 등록
        if (!isNew && formData.id) {
          await createTask({
            personaId: formData.id,
            externalTaskId: result.taskId,
            prompt: result.prompt,
            imageType: imageType,
          });
        }
      } else {
        // 에러 코드별 처리
        if (result.errorCode === 'RATE_LIMIT') {
          alert(`⏳ ${result.error}\n\n${result.retryAfter}초 후에 다시 시도해주세요.`);
        } else if (result.errorCode === 'INSUFFICIENT_CREDITS') {
          alert(`💳 ${result.error}`);
        } else {
          alert('이미지 생성 시작 실패: ' + (result.error || '알 수 없는 오류'));
        }
        setIsGeneratingImage(false);
      }
    } catch (error) {
      console.error('Image generation error:', error);
      alert('이미지 생성 중 오류가 발생했습니다.');
      setIsGeneratingImage(false);
    }
  }

  async function handleSave() {
    if (!formData.id || !formData.name || !formData.role) {
      alert('ID, 이름, 역할은 필수입니다.');
      return;
    }

    setIsSaving(true);
    try {
      // 현재 선택된 이미지 URL 가져오기
      const selectedImageUrl = generatedImages[selectedImageIndex]?.url || formData.profile_image_url;

      const personaData = {
        id: formData.id,
        name: formData.name,
        full_name: formData.full_name || formData.name,
        role: formData.role,
        age: formData.age,
        ethnicity: formData.ethnicity,
        target_audience: formData.target_audience,
        voice_description: formData.voice_description,
        profile_image_url: selectedImageUrl,
        appearance: formData.appearance,
        core_personality: formData.core_personality,
        speech_patterns: formData.speech_patterns,
        worldview: formData.worldview,
        likes: formData.likes,
        dislikes: formData.dislikes,
        absolute_rules: formData.absolute_rules,
        base_instruction: formData.base_instruction,
        tone_config: formData.tone_config,
        situation_presets: formData.situation_presets,
        behavior_by_stage: formData.behavior_by_stage,
        first_scenario_id: formData.first_scenario_id || null,
        updated_at: new Date().toISOString(),
      };

      if (isNew) {
        // 새로 생성 시 실험실(lab)로 시작
        const { error } = await supabase
          .from('persona_core')
          .insert({ ...personaData, status: 'lab' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('persona_core')
          .update(personaData)
          .eq('id', resolvedParams.id);
        if (error) throw error;
      }

      if (exampleDialogues.length > 0) {
        await supabase
          .from('persona_example_dialogues')
          .delete()
          .eq('persona_id', formData.id);

        const dialoguesToInsert = exampleDialogues.map((d, idx) => ({
          persona_id: formData.id,
          tags: d.tags,
          messages: d.messages,
          priority: d.priority || exampleDialogues.length - idx,
          min_stage: d.min_stage,
        }));

        const { error: dialogueError } = await supabase
          .from('persona_example_dialogues')
          .insert(dialoguesToInsert);

        if (dialogueError) {
          console.error('Failed to save dialogues:', dialogueError);
        }
      }

      alert('저장되었습니다!');
      if (isNew) {
        router.push(`/admin/personas/${formData.id}`);
      }
    } catch (error: any) {
      console.error('Save failed:', error);
      alert('저장 실패: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  function toggleSection(section: string) {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  function updateFormData(path: string, value: any) {
    setFormData(prev => {
      const keys = path.split('.');
      const newData = { ...prev };
      let current: any = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });
  }

  function addArrayItem(path: string, defaultValue: string = '') {
    const keys = path.split('.');
    let current: any = formData;
    for (const key of keys) {
      current = current[key];
    }
    updateFormData(path, [...(current || []), defaultValue]);
  }

  function removeArrayItem(path: string, index: number) {
    const keys = path.split('.');
    let current: any = formData;
    for (const key of keys) {
      current = current[key];
    }
    updateFormData(path, current.filter((_: any, i: number) => i !== index));
  }

  function updateArrayItem(path: string, index: number, value: string) {
    const keys = path.split('.');
    let current: any = formData;
    for (const key of keys) {
      current = current[key];
    }
    const newArray = [...current];
    newArray[index] = value;
    updateFormData(path, newArray);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/personas">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold">
                {isNew ? '새 페르소나' : formData.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isNew ? 'AI로 자동 생성하거나 직접 입력' : `ID: ${formData.id}`}
                {currentTask && (
                  <span className="ml-2 inline-flex items-center gap-1 text-blue-500">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    이미지 생성 중...
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 전체 큐 상태 표시 */}
            {processingTasks.length > 0 && (
              <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded text-xs text-blue-700 dark:text-blue-300">
                <Clock className="w-3 h-3" />
                <span>이미지 큐: {processingTasks.length}개</span>
              </div>
            )}
            {!isNew && (
              <Link href={`/admin/playground?personaId=${resolvedParams.id}`}>
                <Button variant="outline" size="sm">
                  <MessageSquare className="w-4 h-4 mr-1" />
                  Playground
                </Button>
              </Link>
            )}
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-1" />
              )}
              저장
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          {/* AI Generation Section - Full Width */}
          {isNew && (
            <div className="mb-4">
              <SectionCard
                title="AI 자동 생성"
                isExpanded={expandedSections.ai}
                onToggle={() => toggleSection('ai')}
                badge={<Sparkles className="w-4 h-4 text-primary" />}
              >
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>생성 프롬프트</Label>
                    <Textarea
                      value={conceptPrompt}
                      onChange={(e) => setConceptPrompt(e.target.value)}
                      placeholder="캐릭터 컨셉을 자유롭게 작성하세요. 예: 24살 한국 아이돌, 무대에서는 완벽하지만 사생활에서는 외롭고 불안한 성격, 팬에게만 진심을 보여주는 비밀 연애 컨셉"
                      rows={4}
                    />
                    <p className="text-xs text-muted-foreground">
                      상세할수록 더 좋은 결과가 나옵니다. 역할, 나이, 성격, 외모, 말투 등을 포함해주세요.
                    </p>
                  </div>
                  <Button
                    onClick={handleGenerateAll}
                    disabled={isGenerating || !conceptPrompt.trim()}
                    className="w-full"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        모든 필드 자동 생성
                      </>
                    )}
                  </Button>
                </div>
              </SectionCard>
            </div>
          )}

          {/* Two Column Layout: Image Left, Form Right */}
          <div className="flex gap-6">
            {/* Left Column - Image */}
            <div className="w-80 flex-shrink-0 space-y-4">
              <SectionCard
                title="캐릭터 이미지"
                isExpanded={expandedSections.image}
                onToggle={() => toggleSection('image')}
                badge={<ImageIcon className="w-4 h-4 text-primary" />}
              >
                <div className="space-y-4">
                  {/* Image Preview - Main selected image */}
                  <div className="aspect-[3/4] bg-muted rounded-lg overflow-hidden border">
                    {generatedImages.length > 0 ? (
                      <img
                        src={generatedImages[selectedImageIndex]?.url}
                        alt="Generated persona"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                          <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">이미지 없음</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Image Thumbnails - 4개 이미지 선택 */}
                  {generatedImages.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {generatedImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedImageIndex(idx);
                            // 선택된 이미지를 formData에도 반영
                            setFormData(prev => ({ ...prev, profile_image_url: img.url }));
                          }}
                          className={`aspect-square rounded-md overflow-hidden border-2 transition-all ${
                            selectedImageIndex === idx
                              ? 'border-primary ring-2 ring-primary/30'
                              : 'border-transparent hover:border-muted-foreground/50'
                          }`}
                        >
                          <img
                            src={img.url}
                            alt={`Option ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 저장 안내 */}
                  {generatedImages.length > 0 && (
                    <p className="text-xs text-muted-foreground text-center">
                      ✓ 선택한 이미지가 저장 시 프로필로 적용됩니다
                    </p>
                  )}

                  {/* Image Type Selector */}
                  <div className="grid grid-cols-3 gap-1">
                    <button
                      onClick={() => setImageType('profile')}
                      className={`p-2 border rounded text-xs ${imageType === 'profile' ? 'border-primary bg-primary/5' : ''}`}
                    >
                      1:1
                    </button>
                    <button
                      onClick={() => setImageType('full')}
                      className={`p-2 border rounded text-xs ${imageType === 'full' ? 'border-primary bg-primary/5' : ''}`}
                    >
                      3:4
                    </button>
                    <button
                      onClick={() => setImageType('scene')}
                      className={`p-2 border rounded text-xs ${imageType === 'scene' ? 'border-primary bg-primary/5' : ''}`}
                    >
                      16:9
                    </button>
                  </div>

                  {/* Prompt Preview/Editor Toggle */}
                  <button
                    onClick={() => {
                      if (!showPromptEditor) {
                        handlePreviewImagePrompt();
                      } else {
                        setShowPromptEditor(false);
                      }
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-primary text-left"
                    disabled={!formData.name || !formData.role}
                  >
                    {showPromptEditor ? '▼ 프롬프트 숨기기' : '▶ 프롬프트 보기/편집'}
                  </button>

                  {/* Prompt Editor */}
                  {showPromptEditor && (
                    <div className="space-y-2">
                      <Textarea
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        placeholder="이미지 생성 프롬프트..."
                        rows={6}
                        className="text-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        프롬프트를 직접 수정할 수 있습니다. 비워두면 자동 생성됩니다.
                      </p>
                    </div>
                  )}

                  {/* Generate Button */}
                  <Button
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImage || !formData.name || !formData.role}
                    className="w-full"
                    size="sm"
                  >
                    {isGeneratingImage ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        생성 중...
                      </>
                    ) : (
                      <>
                        <ImageIcon className="w-4 h-4 mr-2" />
                        이미지 생성
                      </>
                    )}
                  </Button>

                  {/* Image History Section */}
                  {!isNew && (
                    <div className="border-t pt-3 mt-3">
                      <button
                        onClick={() => setShowImageHistory(!showImageHistory)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <History className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">이미지 히스토리</span>
                          {imageHistory.length > 0 && (
                            <span className="px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                              {imageHistory.length}개
                            </span>
                          )}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showImageHistory ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Image History Panel */}
                      {showImageHistory && (
                        <div className="mt-2 border rounded-lg p-3 bg-muted/30">
                          {imageHistory.length > 0 ? (
                            <>
                              <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                                {imageHistory.map((item) => (
                                  <div key={item.id} className="relative group">
                                    <button
                                      onClick={async () => {
                                        const success = await setAsCurrent(item.id);
                                        if (success) {
                                          setFormData(prev => ({ ...prev, profile_image_url: item.image_url }));
                                          setGeneratedImages([{ url: item.image_url, index: 0 }]);
                                          setSelectedImageIndex(0);
                                        }
                                      }}
                                      className={`aspect-square rounded-md overflow-hidden border-2 transition-all w-full ${
                                        item.is_current
                                          ? 'border-primary ring-2 ring-primary/30'
                                          : 'border-transparent hover:border-muted-foreground/50'
                                      }`}
                                    >
                                      <img
                                        src={item.image_url}
                                        alt="History"
                                        className="w-full h-full object-cover"
                                      />
                                    </button>
                                    {item.is_current && (
                                      <div className="absolute top-1 right-1 bg-primary text-white rounded-full p-0.5">
                                        <Check className="w-2.5 h-2.5" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center">
                                      <span className="text-white text-xs">선택</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2 text-center">
                                이미지를 클릭하여 현재 프로필로 설정
                              </p>
                            </>
                          ) : (
                            <div className="py-6 text-center text-muted-foreground">
                              <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              <p className="text-sm">이미지 히스토리가 없습니다</p>
                              <p className="text-xs mt-1">이미지를 생성하면 여기에 저장됩니다</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* Right Column - Form Fields */}
            <div className="flex-1 space-y-4">
          {/* Basic Info Section */}
          <SectionCard
            title="기본 정보"
            isExpanded={expandedSections.basic}
            onToggle={() => toggleSection('basic')}
          >
            <div className="grid grid-cols-2 gap-4">
              <FieldWithRegenerate
                label="ID"
                required
                isRegenerating={generatingField === 'id'}
                onRegenerate={() => handleRegenerateField('id')}
                showRegenerate={isNew && !!conceptPrompt}
              >
                <Input
                  value={formData.id}
                  onChange={(e) => updateFormData('id', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  disabled={!isNew}
                  placeholder="예: jun"
                />
              </FieldWithRegenerate>
              <FieldWithRegenerate
                label="이름"
                required
                isRegenerating={generatingField === 'name'}
                onRegenerate={() => handleRegenerateField('name')}
                showRegenerate={!!conceptPrompt}
              >
                <Input
                  value={formData.name}
                  onChange={(e) => updateFormData('name', e.target.value)}
                  placeholder="예: 준"
                />
              </FieldWithRegenerate>
              <FieldWithRegenerate
                label="전체 이름"
                isRegenerating={generatingField === 'full_name'}
                onRegenerate={() => handleRegenerateField('full_name')}
                showRegenerate={!!conceptPrompt}
              >
                <Input
                  value={formData.full_name}
                  onChange={(e) => updateFormData('full_name', e.target.value)}
                  placeholder="예: 이준혁"
                />
              </FieldWithRegenerate>
              <FieldWithRegenerate
                label="역할"
                required
                isRegenerating={generatingField === 'role'}
                onRegenerate={() => handleRegenerateField('role')}
                showRegenerate={!!conceptPrompt}
              >
                <Input
                  value={formData.role}
                  onChange={(e) => updateFormData('role', e.target.value)}
                  placeholder="예: 아이돌"
                />
              </FieldWithRegenerate>
              <div className="space-y-2">
                <Label>나이</Label>
                <Input
                  type="number"
                  value={formData.age}
                  onChange={(e) => updateFormData('age', parseInt(e.target.value) || 20)}
                />
              </div>
              <div className="space-y-2">
                <Label>국적/민족</Label>
                <Input
                  value={formData.ethnicity}
                  onChange={(e) => updateFormData('ethnicity', e.target.value)}
                  placeholder="예: Korean"
                />
              </div>
              <div className="space-y-2">
                <Label>타겟 유저 <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(v) => updateFormData('target_audience', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">💜 여성향</SelectItem>
                    <SelectItem value="male">💖 남성향</SelectItem>
                    <SelectItem value="anime">✨ 애니</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <FieldWithRegenerate
                label="목소리 설명"
                isRegenerating={generatingField === 'voice_description'}
                onRegenerate={() => handleRegenerateField('voice_description')}
                showRegenerate={!!conceptPrompt}
              >
                <Textarea
                  value={formData.voice_description}
                  onChange={(e) => updateFormData('voice_description', e.target.value)}
                  placeholder="예: 낮고 부드러운 목소리"
                  rows={2}
                />
              </FieldWithRegenerate>
            </div>
          </SectionCard>

          {/* Appearance Section */}
          <SectionCard
            title="외모"
            isExpanded={expandedSections.appearance}
            onToggle={() => toggleSection('appearance')}
            onRegenerate={conceptPrompt ? () => handleRegenerateField('appearance') : undefined}
            isRegenerating={generatingField === 'appearance'}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>헤어</Label>
                <Input
                  value={formData.appearance.hair}
                  onChange={(e) => updateFormData('appearance.hair', e.target.value)}
                  placeholder="예: 검은색 짧은 머리"
                />
              </div>
              <div className="space-y-2">
                <Label>눈</Label>
                <Input
                  value={formData.appearance.eyes}
                  onChange={(e) => updateFormData('appearance.eyes', e.target.value)}
                  placeholder="예: 짙은 갈색"
                />
              </div>
              <div className="space-y-2">
                <Label>체형</Label>
                <Input
                  value={formData.appearance.build}
                  onChange={(e) => updateFormData('appearance.build', e.target.value)}
                  placeholder="예: 181cm, 마른 편"
                />
              </div>
              <div className="space-y-2">
                <Label>스타일</Label>
                <Input
                  value={formData.appearance.style}
                  onChange={(e) => updateFormData('appearance.style', e.target.value)}
                  placeholder="예: 세련된 캐주얼"
                />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <Label>특징</Label>
              <ArrayEditor
                items={formData.appearance.distinguishingFeatures}
                onAdd={() => addArrayItem('appearance.distinguishingFeatures')}
                onRemove={(i) => removeArrayItem('appearance.distinguishingFeatures', i)}
                onUpdate={(i, v) => updateArrayItem('appearance.distinguishingFeatures', i, v)}
                placeholder="예: 왼쪽 눈 밑 점"
              />
            </div>
          </SectionCard>

          {/* Personality Section */}
          <SectionCard
            title="성격"
            isExpanded={expandedSections.personality}
            onToggle={() => toggleSection('personality')}
            onRegenerate={conceptPrompt ? () => handleRegenerateField('core_personality') : undefined}
            isRegenerating={generatingField === 'core_personality'}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>겉으로 보이는 성격</Label>
                <ArrayEditor
                  items={formData.core_personality.surface}
                  onAdd={() => addArrayItem('core_personality.surface')}
                  onRemove={(i) => removeArrayItem('core_personality.surface', i)}
                  onUpdate={(i, v) => updateArrayItem('core_personality.surface', i, v)}
                  placeholder="예: 밝고 활발함"
                />
              </div>
              <div className="space-y-2">
                <Label>숨겨진 성격</Label>
                <ArrayEditor
                  items={formData.core_personality.hidden}
                  onAdd={() => addArrayItem('core_personality.hidden')}
                  onRemove={(i) => removeArrayItem('core_personality.hidden', i)}
                  onUpdate={(i, v) => updateArrayItem('core_personality.hidden', i, v)}
                  placeholder="예: 외로움"
                />
              </div>
              <div className="space-y-2">
                <Label>코어 트로프</Label>
                <Input
                  value={formData.core_personality.core_trope}
                  onChange={(e) => updateFormData('core_personality.core_trope', e.target.value)}
                  placeholder="예: 비밀 아이돌"
                />
              </div>
              <div className="space-y-2">
                <Label>좋아하는 것</Label>
                <ArrayEditor
                  items={formData.likes}
                  onAdd={() => addArrayItem('likes')}
                  onRemove={(i) => removeArrayItem('likes', i)}
                  onUpdate={(i, v) => updateArrayItem('likes', i, v)}
                  placeholder="예: 음악"
                />
              </div>
              <div className="space-y-2">
                <Label>싫어하는 것</Label>
                <ArrayEditor
                  items={formData.dislikes}
                  onAdd={() => addArrayItem('dislikes')}
                  onRemove={(i) => removeArrayItem('dislikes', i)}
                  onUpdate={(i, v) => updateArrayItem('dislikes', i, v)}
                  placeholder="예: 거짓말"
                />
              </div>
            </div>
          </SectionCard>

          {/* Speech Patterns Section */}
          <SectionCard
            title="말투 패턴"
            isExpanded={expandedSections.speech}
            onToggle={() => toggleSection('speech')}
            onRegenerate={conceptPrompt ? () => handleRegenerateField('speech_patterns') : undefined}
            isRegenerating={generatingField === 'speech_patterns'}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>격식 수준</Label>
                <Select
                  value={formData.speech_patterns.formality}
                  onValueChange={(v) => updateFormData('speech_patterns.formality', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">낮음 (반말)</SelectItem>
                    <SelectItem value="medium">중간</SelectItem>
                    <SelectItem value="high">높음 (존댓말)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>감정 표현</Label>
                <Select
                  value={formData.speech_patterns.emotionalRange}
                  onValueChange={(v) => updateFormData('speech_patterns.emotionalRange', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">적음</SelectItem>
                    <SelectItem value="medium">보통</SelectItem>
                    <SelectItem value="high">많음</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>애칭</Label>
                <ArrayEditor
                  items={formData.speech_patterns.petNames}
                  onAdd={() => addArrayItem('speech_patterns.petNames')}
                  onRemove={(i) => removeArrayItem('speech_patterns.petNames', i)}
                  onUpdate={(i, v) => updateArrayItem('speech_patterns.petNames', i, v)}
                  placeholder="예: 자기야"
                />
              </div>
              <div className="space-y-2">
                <Label>말버릇</Label>
                <ArrayEditor
                  items={formData.speech_patterns.verbalTics}
                  onAdd={() => addArrayItem('speech_patterns.verbalTics')}
                  onRemove={(i) => removeArrayItem('speech_patterns.verbalTics', i)}
                  onUpdate={(i, v) => updateArrayItem('speech_patterns.verbalTics', i, v)}
                  placeholder="예: ~ㅎㅎ"
                />
              </div>
            </div>
          </SectionCard>

          {/* Worldview Section */}
          <SectionCard
            title="세계관"
            isExpanded={expandedSections.worldview}
            onToggle={() => toggleSection('worldview')}
            onRegenerate={conceptPrompt ? () => handleRegenerateField('worldview') : undefined}
            isRegenerating={generatingField === 'worldview'}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>시대 배경</Label>
                  <Input
                    value={formData.worldview.timePeriod}
                    onChange={(e) => updateFormData('worldview.timePeriod', e.target.value)}
                    placeholder="예: Present"
                  />
                </div>
                <div className="space-y-2">
                  <Label>기본 관계</Label>
                  <Input
                    value={formData.worldview.defaultRelationship}
                    onChange={(e) => updateFormData('worldview.defaultRelationship', e.target.value)}
                    placeholder="예: 팬과 아이돌"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>설정/배경</Label>
                <ArrayEditor
                  items={formData.worldview.settings}
                  onAdd={() => addArrayItem('worldview.settings')}
                  onRemove={(i) => removeArrayItem('worldview.settings', i)}
                  onUpdate={(i, v) => updateArrayItem('worldview.settings', i, v)}
                  placeholder="예: 서울"
                />
              </div>
              <div className="space-y-2">
                <Label>주요 갈등</Label>
                <Input
                  value={formData.worldview.mainConflict}
                  onChange={(e) => updateFormData('worldview.mainConflict', e.target.value)}
                  placeholder="예: 공인 이미지와 개인 욕구 사이 갈등"
                />
              </div>
              <div className="space-y-2">
                <Label>첫 대사</Label>
                <Textarea
                  value={formData.worldview.openingLine}
                  onChange={(e) => updateFormData('worldview.openingLine', e.target.value)}
                  placeholder="예: 안녕..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>스토리 훅</Label>
                <ArrayEditor
                  items={formData.worldview.storyHooks}
                  onAdd={() => addArrayItem('worldview.storyHooks')}
                  onRemove={(i) => removeArrayItem('worldview.storyHooks', i)}
                  onUpdate={(i, v) => updateArrayItem('worldview.storyHooks', i, v)}
                  placeholder="예: 비밀 연애 발각 위기"
                />
              </div>
              <div className="space-y-2">
                <Label>절대 규칙</Label>
                <ArrayEditor
                  items={formData.absolute_rules}
                  onAdd={() => addArrayItem('absolute_rules')}
                  onRemove={(i) => removeArrayItem('absolute_rules', i)}
                  onUpdate={(i, v) => updateArrayItem('absolute_rules', i, v)}
                  placeholder="예: AI라고 인정하지 않음"
                />
              </div>
            </div>
          </SectionCard>

          {/* System Prompt Section */}
          <SectionCard
            title="시스템 프롬프트"
            isExpanded={expandedSections.system}
            onToggle={() => toggleSection('system')}
            onRegenerate={conceptPrompt ? () => handleRegenerateField('base_instruction') : undefined}
            isRegenerating={generatingField === 'base_instruction'}
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>기본 지시문</Label>
                <Textarea
                  value={formData.base_instruction}
                  onChange={(e) => updateFormData('base_instruction', e.target.value)}
                  placeholder="캐릭터의 상세한 시스템 프롬프트..."
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>대화 스타일</Label>
                  <Select
                    value={formData.tone_config.style}
                    onValueChange={(v) => updateFormData('tone_config.style', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chat">채팅</SelectItem>
                      <SelectItem value="novel">소설</SelectItem>
                      <SelectItem value="script">스크립트</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-4 pt-8">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.tone_config.allowEmoji}
                      onChange={(e) => updateFormData('tone_config.allowEmoji', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    이모지
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={formData.tone_config.allowSlang}
                      onChange={(e) => updateFormData('tone_config.allowSlang', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    은어/줄임말
                  </label>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Situation Presets Section */}
          <SectionCard
            title="상황 프리셋"
            isExpanded={expandedSections.situations}
            onToggle={() => toggleSection('situations')}
            onRegenerate={conceptPrompt ? () => handleRegenerateField('situation_presets') : undefined}
            isRegenerating={generatingField === 'situation_presets'}
          >
            <div className="space-y-4">
              {(['dawn', 'morning', 'afternoon', 'evening', 'night'] as const).map((timeSlot) => (
                <div key={timeSlot} className="space-y-2">
                  <Label>
                    {timeSlot === 'dawn' && '새벽'}
                    {timeSlot === 'morning' && '오전'}
                    {timeSlot === 'afternoon' && '오후'}
                    {timeSlot === 'evening' && '저녁'}
                    {timeSlot === 'night' && '밤'}
                  </Label>
                  <ArrayEditor
                    items={formData.situation_presets[timeSlot]}
                    onAdd={() => addArrayItem(`situation_presets.${timeSlot}`)}
                    onRemove={(i) => removeArrayItem(`situation_presets.${timeSlot}`, i)}
                    onUpdate={(i, v) => updateArrayItem(`situation_presets.${timeSlot}`, i, v)}
                    placeholder="상황 설명"
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Example Dialogues Section */}
          <SectionCard
            title="예시 대화"
            isExpanded={expandedSections.dialogues}
            onToggle={() => toggleSection('dialogues')}
          >
            <div className="space-y-4">
              {exampleDialogues.map((dialogue, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">#{idx + 1}</span>
                      <Input
                        value={dialogue.tags.join(', ')}
                        onChange={(e) => {
                          const newDialogues = [...exampleDialogues];
                          newDialogues[idx].tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                          setExampleDialogues(newDialogues);
                        }}
                        placeholder="태그"
                        className="w-32"
                      />
                      <Select
                        value={dialogue.min_stage || ''}
                        onValueChange={(v) => {
                          const newDialogues = [...exampleDialogues];
                          newDialogues[idx].min_stage = v || null;
                          setExampleDialogues(newDialogues);
                        }}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="단계" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">모두</SelectItem>
                          <SelectItem value="stranger">stranger+</SelectItem>
                          <SelectItem value="friend">friend+</SelectItem>
                          <SelectItem value="close">close+</SelectItem>
                          <SelectItem value="lover">lover</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExampleDialogues(exampleDialogues.filter((_, i) => i !== idx))}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {dialogue.messages.map((msg, msgIdx) => (
                      <div key={msgIdx} className="flex items-center gap-2">
                        <Select
                          value={msg.role}
                          onValueChange={(v) => {
                            const newDialogues = [...exampleDialogues];
                            newDialogues[idx].messages[msgIdx].role = v;
                            setExampleDialogues(newDialogues);
                          }}
                        >
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">유저</SelectItem>
                            <SelectItem value="char">캐릭터</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={msg.content}
                          onChange={(e) => {
                            const newDialogues = [...exampleDialogues];
                            newDialogues[idx].messages[msgIdx].content = e.target.value;
                            setExampleDialogues(newDialogues);
                          }}
                          placeholder="대사"
                          className="flex-1"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newDialogues = [...exampleDialogues];
                            newDialogues[idx].messages = newDialogues[idx].messages.filter((_, i) => i !== msgIdx);
                            setExampleDialogues(newDialogues);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newDialogues = [...exampleDialogues];
                        newDialogues[idx].messages.push({ role: 'user', content: '' });
                        setExampleDialogues(newDialogues);
                      }}
                    >
                      <Plus className="w-3 h-3 mr-1" /> 대사 추가
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setExampleDialogues([
                  ...exampleDialogues,
                  { tags: [], messages: [{ role: 'user', content: '' }], priority: 0, min_stage: null }
                ])}
              >
                <Plus className="w-4 h-4 mr-2" /> 새 대화 예시
              </Button>
            </div>
          </SectionCard>
            </div>
            {/* End of Right Column */}
          </div>
          {/* End of Two Column Layout */}
        </div>
      </div>
    </div>
  );
}

// Section Card Component
function SectionCard({
  title,
  isExpanded,
  onToggle,
  children,
  badge,
  onRegenerate,
  isRegenerating,
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  badge?: React.ReactNode;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}) {
  return (
    <div className="border rounded-lg">
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex-1 px-4 py-3 flex items-center justify-between text-left hover:bg-muted/30"
        >
          <div className="flex items-center gap-2">
            {badge}
            <span className="font-medium">{title}</span>
          </div>
          <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="px-3 py-3 text-muted-foreground hover:text-primary disabled:opacity-50"
            title="이 섹션 재생성"
          >
            {isRegenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// Field with regenerate button
function FieldWithRegenerate({
  label,
  required,
  isRegenerating,
  onRegenerate,
  showRegenerate,
  children,
}: {
  label: string;
  required?: boolean;
  isRegenerating: boolean;
  onRegenerate: () => void;
  showRegenerate: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
        {showRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
          >
            {isRegenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// Array Editor Component
function ArrayEditor({
  items,
  onAdd,
  onRemove,
  onUpdate,
  placeholder,
}: {
  items: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={item}
            onChange={(e) => onUpdate(idx, e.target.value)}
            placeholder={placeholder}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemove(idx)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={onAdd} className="text-primary">
        <Plus className="w-4 h-4 mr-1" /> 추가
      </Button>
    </div>
  );
}

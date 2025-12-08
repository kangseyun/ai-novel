'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useImageGenerationQueue } from '@/hooks/useImageGenerationQueue';
import {
  Plus, Edit, Trash2, Eye, Loader2, Play, Settings,
  Image as ImageIcon, X, Check, Sparkles, Zap,
  FlaskConical, CheckCircle2, ArrowUpCircle, LayoutGrid, List, MessageSquare, Clock
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Persona {
  id: string;
  name: string;
  full_name: string;
  role: string;
  age: number;
  ethnicity?: string;
  profile_image_url: string | null;
  status: 'published' | 'lab';
  created_at: string;
  updated_at: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  category: string;
}

interface PipelineJob {
  id: string;
  templateId: string;
  templateName: string;
  status: 'pending' | 'generating_text' | 'generating_image' | 'polling_image' | 'completed' | 'failed';
  personaId?: string;
  personaName?: string;
  imageTaskId?: string;
  imageUrl?: string;
  error?: string;
}

type ViewMode = 'gallery' | 'list';
type TabMode = 'lab' | 'published';

export default function PersonasListPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Persona | null>(null);

  // Image generation queue (Supabase Realtime)
  const { processingTasks, getTaskForPersona, createTask } = useImageGenerationQueue();

  // View & Tab
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [activeTab, setActiveTab] = useState<TabMode>('lab');

  // Pipeline states
  const [showPipelineDialog, setShowPipelineDialog] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [pipelineJobs, setPipelineJobs] = useState<PipelineJob[]>([]);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [generateImages, setGenerateImages] = useState(true);

  // Auto-generation mode
  const [pipelineMode, setPipelineMode] = useState<'template' | 'auto'>('template');
  const [autoGenerateCount, setAutoGenerateCount] = useState(3);

  // Template management
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplatePrompt, setNewTemplatePrompt] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('general');

  useEffect(() => {
    loadPersonas();
    loadTemplates();
  }, []);

  // 파이프라인 Job UI 업데이트 (훅에서 Kling API 폴링 및 DB 업데이트 자동 처리)
  // processingTasks 변경을 감지하여 파이프라인 Job 상태 업데이트
  useEffect(() => {
    const jobsWithImageTasks = pipelineJobs.filter(j => j.status === 'polling_image' && j.imageTaskId);
    if (jobsWithImageTasks.length === 0) return;

    // processingTasks에서 사라진 태스크는 완료된 것
    for (const job of jobsWithImageTasks) {
      const task = processingTasks.find(t => t.external_task_id === job.imageTaskId);
      if (!task) {
        // 태스크가 사라졌다 = 완료 또는 실패
        // 페르소나 이미지 URL 가져오기
        supabase
          .from('persona_core')
          .select('profile_image_url')
          .eq('id', job.personaId)
          .single()
          .then(({ data }) => {
            if (data?.profile_image_url) {
              setPipelineJobs(prev =>
                prev.map(j =>
                  j.id === job.id
                    ? { ...j, status: 'completed', imageUrl: data.profile_image_url }
                    : j
                )
              );
            } else {
              setPipelineJobs(prev =>
                prev.map(j =>
                  j.id === job.id
                    ? { ...j, status: 'completed', error: '이미지 생성 실패' }
                    : j
                )
              );
            }
          });
      }
    }
  }, [processingTasks, pipelineJobs, supabase]);

  async function loadPersonas() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('persona_core')
      .select('id, name, full_name, role, age, ethnicity, profile_image_url, status, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load personas:', error);
    } else {
      // status가 없으면 lab으로 기본값 설정
      const personasWithStatus = (data || []).map(p => ({
        ...p,
        status: p.status || 'lab'
      }));
      setPersonas(personasWithStatus);
    }
    setIsLoading(false);
  }

  async function loadTemplates() {
    const { data, error } = await supabase
      .from('persona_prompt_templates')
      .select('*')
      .eq('is_active', true)
      .order('category', { ascending: true });

    if (error) {
      console.error('Failed to load templates:', error);
    } else {
      setTemplates(data || []);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    const { error } = await supabase
      .from('persona_core')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      alert('삭제 실패: ' + error.message);
    } else {
      setPersonas(personas.filter(p => p.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  }

  // 상태 변경 (실험실 <-> 확정)
  async function toggleStatus(persona: Persona) {
    const newStatus = persona.status === 'published' ? 'lab' : 'published';

    const { error } = await supabase
      .from('persona_core')
      .update({
        status: newStatus,
        ...(newStatus === 'published' ? { published_at: new Date().toISOString() } : {})
      })
      .eq('id', persona.id);

    if (error) {
      alert('상태 변경 실패: ' + error.message);
    } else {
      setPersonas(prev =>
        prev.map(p => p.id === persona.id ? { ...p, status: newStatus } : p)
      );
    }
  }

  // Generate random diverse prompts for auto-generation
  async function generateAutoPrompts(count: number): Promise<string[]> {
    const res = await fetch('/api/admin/persona/generate-auto-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    });

    const result = await res.json();
    if (result.success && result.prompts) {
      return result.prompts;
    }
    throw new Error(result.error || '자동 프롬프트 생성 실패');
  }

  // Pipeline: Start generation
  async function startPipeline() {
    let promptsToGenerate: { templateId: string; templateName: string; prompt: string }[] = [];

    if (pipelineMode === 'auto') {
      // Auto-generation mode
      setPipelineJobs([{ id: 'auto-init', templateId: 'auto', templateName: '프롬프트 생성 중...', status: 'generating_text' }]);
      setIsPipelineRunning(true);

      try {
        const autoPrompts = await generateAutoPrompts(autoGenerateCount);
        promptsToGenerate = autoPrompts.map((prompt, idx) => ({
          templateId: `auto-${idx}`,
          templateName: `자동 생성 #${idx + 1}`,
          prompt,
        }));
      } catch (error) {
        setPipelineJobs([{ id: 'auto-init', templateId: 'auto', templateName: '자동 프롬프트 생성', status: 'failed', error: error instanceof Error ? error.message : '알 수 없는 오류' }]);
        setIsPipelineRunning(false);
        return;
      }
    } else {
      // Template mode
      selectedTemplates.forEach(templateId => {
        const template = templates.find(t => t.id === templateId);
        if (template) {
          promptsToGenerate.push({
            templateId: template.id,
            templateName: template.name,
            prompt: template.prompt,
          });
        }
      });

      if (customPrompt.trim()) {
        promptsToGenerate.push({
          templateId: 'custom',
          templateName: '커스텀 프롬프트',
          prompt: customPrompt,
        });
      }

      if (promptsToGenerate.length === 0) {
        alert('최소 하나의 템플릿을 선택하거나 커스텀 프롬프트를 입력해주세요.');
        return;
      }
    }

    // Initialize jobs
    const jobs: PipelineJob[] = promptsToGenerate.map((p, idx) => ({
      id: `job-${idx}`,
      templateId: p.templateId,
      templateName: p.templateName,
      status: 'pending',
    }));

    setPipelineJobs(jobs);
    setIsPipelineRunning(true);

    // Run all jobs in parallel
    await Promise.all(
      promptsToGenerate.map(async (p, idx) => {
        const jobId = `job-${idx}`;

        // Update status to generating text
        setPipelineJobs(prev =>
          prev.map(j => j.id === jobId ? { ...j, status: 'generating_text' } : j)
        );

        try {
          // Generate persona text
          const isAutoMode = p.templateId.startsWith('auto');
          const res = await fetch('/api/admin/persona/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: p.prompt,
              autoMode: isAutoMode,
            }),
          });

          const result = await res.json();

          if (result.success && result.data) {
            // Save to database (새로 생성된 건 lab 상태)
            const personaData = {
              ...result.data,
              status: 'lab',
              appearance: result.data.appearance || {},
              core_personality: result.data.core_personality || {},
              speech_patterns: result.data.speech_patterns || {},
              worldview: result.data.worldview || {},
              tone_config: result.data.tone_config || {},
              situation_presets: result.data.situation_presets || {},
              behavior_by_stage: result.data.behavior_by_stage || {},
              updated_at: new Date().toISOString(),
            };

            const { data: savedPersona, error: saveError } = await supabase
              .from('persona_core')
              .insert(personaData)
              .select()
              .single();

            if (saveError) {
              throw new Error(saveError.message);
            }

            // Generate image if enabled
            if (generateImages) {
              setPipelineJobs(prev =>
                prev.map(j =>
                  j.id === jobId
                    ? { ...j, status: 'generating_image', personaId: savedPersona.id, personaName: savedPersona.name }
                    : j
                )
              );

              try {
                const imageRes = await fetch('/api/admin/persona/generate-image', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    personaData: {
                      name: savedPersona.name,
                      role: savedPersona.role,
                      age: savedPersona.age,
                      ethnicity: savedPersona.ethnicity,
                      appearance: savedPersona.appearance,
                      core_personality: savedPersona.core_personality,
                    },
                    conceptPrompt: p.prompt,
                    imageType: 'profile',
                  }),
                });

                const imageResult = await imageRes.json();

                if (imageResult.success && imageResult.taskId) {
                  setPipelineJobs(prev =>
                    prev.map(j =>
                      j.id === jobId
                        ? { ...j, status: 'polling_image', imageTaskId: imageResult.taskId }
                        : j
                    )
                  );
                  // Supabase에 태스크 등록
                  await createTask({
                    personaId: savedPersona.id,
                    externalTaskId: imageResult.taskId,
                    prompt: imageResult.prompt,
                    imageType: 'profile',
                  });
                } else {
                  // Image generation failed but persona is created
                  setPipelineJobs(prev =>
                    prev.map(j =>
                      j.id === jobId
                        ? { ...j, status: 'completed', error: '이미지 생성 시작 실패' }
                        : j
                    )
                  );
                }
              } catch {
                setPipelineJobs(prev =>
                  prev.map(j =>
                    j.id === jobId
                      ? { ...j, status: 'completed', error: '이미지 생성 오류' }
                      : j
                  )
                );
              }
            } else {
              setPipelineJobs(prev =>
                prev.map(j =>
                  j.id === jobId
                    ? { ...j, status: 'completed', personaId: savedPersona.id, personaName: savedPersona.name }
                    : j
                )
              );
            }
          } else {
            throw new Error(result.error || '생성 실패');
          }
        } catch (error) {
          setPipelineJobs(prev =>
            prev.map(j =>
              j.id === jobId
                ? { ...j, status: 'failed', error: error instanceof Error ? error.message : '알 수 없는 오류' }
                : j
            )
          );
        }
      })
    );

    // Check if all jobs are done (not polling)
    const checkCompletion = () => {
      setPipelineJobs(prev => {
        const allDone = prev.every(j => j.status === 'completed' || j.status === 'failed');
        if (allDone) {
          setIsPipelineRunning(false);
          loadPersonas();
        }
        return prev;
      });
    };

    // Initial check
    setTimeout(checkCompletion, 1000);
  }

  // Template management
  async function saveTemplate() {
    if (!newTemplateName.trim() || !newTemplatePrompt.trim()) {
      alert('템플릿 이름과 프롬프트를 입력해주세요.');
      return;
    }

    if (editingTemplate) {
      const { error } = await supabase
        .from('persona_prompt_templates')
        .update({
          name: newTemplateName,
          prompt: newTemplatePrompt,
          category: newTemplateCategory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingTemplate.id);

      if (error) {
        alert('저장 실패: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('persona_prompt_templates')
        .insert({
          name: newTemplateName,
          prompt: newTemplatePrompt,
          category: newTemplateCategory,
        });

      if (error) {
        alert('저장 실패: ' + error.message);
        return;
      }
    }

    loadTemplates();
    setShowTemplateDialog(false);
    setEditingTemplate(null);
    setNewTemplateName('');
    setNewTemplatePrompt('');
    setNewTemplateCategory('general');
  }

  async function deleteTemplate(id: string) {
    const { error } = await supabase
      .from('persona_prompt_templates')
      .update({ is_active: false })
      .eq('id', id);

    if (!error) {
      loadTemplates();
    }
  }

  // 필터링된 페르소나
  const filteredPersonas = personas.filter(
    (p) =>
      p.status === activeTab &&
      (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       p.role.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const labCount = personas.filter(p => p.status === 'lab').length;
  const publishedCount = personas.filter(p => p.status === 'published').length;

  const getJobStatusText = (status: PipelineJob['status']) => {
    switch (status) {
      case 'pending': return '대기중';
      case 'generating_text': return '텍스트 생성 중...';
      case 'generating_image': return '이미지 생성 시작...';
      case 'polling_image': return '이미지 생성 중...';
      case 'completed': return '완료';
      case 'failed': return '실패';
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1">페르소나 관리</h1>
          <p className="text-sm text-muted-foreground">
            실험실 {labCount}개 · 확정 {publishedCount}개
            {processingTasks.length > 0 && (
              <span className="ml-2 text-blue-500">
                · 이미지 생성 중 {processingTasks.length}개
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/image-queue">
            <Button
              variant="outline"
              size="sm"
              className={processingTasks.length > 0 ? 'border-blue-500 text-blue-600' : ''}
            >
              <Clock className="w-4 h-4 mr-1" />
              이미지 큐
              {processingTasks.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                  {processingTasks.length}
                </span>
              )}
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPipelineDialog(true)}
          >
            <Play className="w-4 h-4 mr-1" />
            파이프라인
          </Button>
          <Link href="/admin/personas/new">
            <Button size="sm">
              <Plus className="w-4 h-4 mr-1" />
              새 페르소나
            </Button>
          </Link>
        </div>
      </div>

      {/* Tabs + View Toggle + Search */}
      <div className="flex items-center gap-4 mb-6">
        {/* Tabs */}
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setActiveTab('lab')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'lab'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FlaskConical className="w-4 h-4" />
            실험실
            <span className="ml-1 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
              {labCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('published')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'published'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            확정
            <span className="ml-1 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
              {publishedCount}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="flex-1">
          <Input
            placeholder="이름 또는 역할로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* View Toggle */}
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewMode('gallery')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'gallery' ? 'bg-background shadow' : ''
            }`}
            title="갤러리 뷰"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-colors ${
              viewMode === 'list' ? 'bg-background shadow' : ''
            }`}
            title="리스트 뷰"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Description */}
      <div className="mb-4 p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground">
        {activeTab === 'lab' ? (
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            <span>실험실: 아직 테스트 중인 페르소나입니다. 세계관, 이미지, 프롬프트를 수정하며 완성도를 높이세요.</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>확정: 유저에게 공개되는 페르소나입니다. 신중하게 관리하세요.</span>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          로딩 중...
        </div>
      ) : filteredPersonas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
          <p>{searchQuery ? '검색 결과가 없습니다.' : `${activeTab === 'lab' ? '실험실' : '확정된'} 페르소나가 없습니다.`}</p>
          {activeTab === 'lab' && !searchQuery && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowPipelineDialog(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              파이프라인으로 생성하기
            </Button>
          )}
        </div>
      ) : viewMode === 'gallery' ? (
        /* Gallery View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredPersonas.map((persona) => (
            <div
              key={persona.id}
              className="group relative bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all"
            >
              {/* Image */}
              <div className="aspect-[3/4] bg-muted relative">
                {persona.profile_image_url ? (
                  <img
                    src={persona.profile_image_url}
                    alt={persona.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                {/* Image Generation Loading Indicator */}
                {getTaskForPersona(persona.id) && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                      <span className="text-xs text-white">이미지 생성 중...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <h3 className="font-medium text-sm truncate">{persona.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{persona.role}</p>
                <p className="text-xs text-muted-foreground">{persona.age}세 · {persona.ethnicity || 'Korean'}</p>
              </div>

              {/* Hover Actions */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Link href={`/admin/personas/${persona.id}`}>
                  <Button size="sm" variant="secondary" title="편집">
                    <Edit className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href={`/admin/playground?personaId=${persona.id}`}>
                  <Button size="sm" variant="secondary" title="Playground 테스트">
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </Link>
                <Link href={`/dm/${persona.id}`} target="_blank">
                  <Button size="sm" variant="secondary" title="미리보기">
                    <Eye className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => toggleStatus(persona)}
                  title={persona.status === 'lab' ? '확정으로 이동' : '실험실로 이동'}
                >
                  {persona.status === 'lab' ? (
                    <ArrowUpCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <FlaskConical className="w-4 h-4 text-orange-500" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setDeleteTarget(persona)}
                  className="text-destructive"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>

              {/* Status Badge */}
              <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium ${
                persona.status === 'published'
                  ? 'bg-green-500/90 text-white'
                  : 'bg-orange-500/90 text-white'
              }`}>
                {persona.status === 'published' ? '확정' : '실험실'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium w-16">이미지</th>
                <th className="text-left px-4 py-3 font-medium">이름</th>
                <th className="text-left px-4 py-3 font-medium">역할</th>
                <th className="text-left px-4 py-3 font-medium">나이</th>
                <th className="text-left px-4 py-3 font-medium">상태</th>
                <th className="text-left px-4 py-3 font-medium">생성일</th>
                <th className="text-right px-4 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPersonas.map((persona) => (
                <tr key={persona.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center relative">
                      {persona.profile_image_url ? (
                        <img
                          src={persona.profile_image_url}
                          alt={persona.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="w-5 h-5 text-muted-foreground/50" />
                      )}
                      {getTaskForPersona(persona.id) && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{persona.name}</p>
                    {persona.full_name && persona.full_name !== persona.name && (
                      <p className="text-xs text-muted-foreground">{persona.full_name}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{persona.role}</td>
                  <td className="px-4 py-3">{persona.age}세</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      persona.status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {persona.status === 'published' ? '확정' : '실험실'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(persona.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/personas/${persona.id}`}>
                        <Button variant="ghost" size="icon" title="편집">
                          <Edit className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Link href={`/admin/playground?personaId=${persona.id}`}>
                        <Button variant="ghost" size="icon" title="Playground 테스트">
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Link href={`/dm/${persona.id}`} target="_blank">
                        <Button variant="ghost" size="icon" title="미리보기">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toggleStatus(persona)}
                        title={persona.status === 'lab' ? '확정으로 이동' : '실험실로 이동'}
                      >
                        {persona.status === 'lab' ? (
                          <ArrowUpCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <FlaskConical className="w-4 h-4 text-orange-500" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(persona)}
                        className="text-destructive hover:text-destructive"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>페르소나 삭제</DialogTitle>
            <DialogDescription>
              정말로 &quot;{deleteTarget?.name}&quot; 페르소나를 삭제하시겠습니까?
              관련된 모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pipeline Dialog */}
      <Dialog open={showPipelineDialog} onOpenChange={setShowPipelineDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5" />
              페르소나 파이프라인
            </DialogTitle>
            <DialogDescription>
              여러 페르소나를 병렬로 자동 생성합니다. 생성된 페르소나는 실험실에 추가됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Mode Selection */}
            <div className="flex gap-2">
              <button
                onClick={() => setPipelineMode('template')}
                className={`flex-1 p-3 border rounded-lg text-left transition-all ${
                  pipelineMode === 'template'
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                disabled={isPipelineRunning}
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  <div>
                    <p className="font-medium text-sm">템플릿 선택</p>
                    <p className="text-xs text-muted-foreground">미리 정의된 템플릿 사용</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setPipelineMode('auto')}
                className={`flex-1 p-3 border rounded-lg text-left transition-all ${
                  pipelineMode === 'auto'
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-muted/50'
                }`}
                disabled={isPipelineRunning}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  <div>
                    <p className="font-medium text-sm">완전 자동</p>
                    <p className="text-xs text-muted-foreground">다양한 캐릭터 랜덤 생성</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Template Mode */}
            {pipelineMode === 'template' && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>프롬프트 템플릿</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTemplate(null);
                        setNewTemplateName('');
                        setNewTemplatePrompt('');
                        setNewTemplateCategory('general');
                        setShowTemplateDialog(true);
                      }}
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      템플릿 관리
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setSelectedTemplates(prev =>
                            prev.includes(template.id)
                              ? prev.filter(id => id !== template.id)
                              : [...prev, template.id]
                          );
                        }}
                        className={`p-3 border rounded-lg text-left transition-all ${
                          selectedTemplates.includes(template.id)
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                            : 'hover:bg-muted/50'
                        }`}
                        disabled={isPipelineRunning}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{template.name}</p>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {template.prompt}
                            </p>
                          </div>
                          {selectedTemplates.includes(template.id) && (
                            <Check className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>커스텀 프롬프트 (선택)</Label>
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="추가로 생성할 캐릭터 컨셉을 입력하세요..."
                    rows={3}
                    disabled={isPipelineRunning}
                  />
                </div>
              </>
            )}

            {/* Auto Mode */}
            {pipelineMode === 'auto' && (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-purple-500" />
                    <span className="font-medium">완전 자동 생성 모드</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    AI가 다양한 국적, 나이, 직업, 성격, 세계관을 가진 캐릭터들을 자동으로 생성합니다.
                    중복 없이 독특한 캐릭터들이 만들어집니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>생성할 캐릭터 수</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={autoGenerateCount}
                      onChange={(e) => setAutoGenerateCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-24"
                      disabled={isPipelineRunning}
                    />
                    <span className="text-sm text-muted-foreground">최대 10개</span>
                  </div>
                </div>
              </div>
            )}

            {/* Image Generation Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                <span className="text-sm">이미지도 함께 생성</span>
              </div>
              <button
                onClick={() => setGenerateImages(!generateImages)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  generateImages ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
                disabled={isPipelineRunning}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    generateImages ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            {/* Pipeline Jobs Status */}
            {pipelineJobs.length > 0 && (
              <div className="space-y-2">
                <Label>생성 진행 상황</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pipelineJobs.map((job) => (
                    <div
                      key={job.id}
                      className={`p-3 border rounded-lg flex items-center justify-between ${
                        job.status === 'completed'
                          ? 'border-green-500/50 bg-green-500/5'
                          : job.status === 'failed'
                          ? 'border-red-500/50 bg-red-500/5'
                          : job.status === 'pending'
                          ? ''
                          : 'border-blue-500/50 bg-blue-500/5'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{job.templateName}</p>
                        <p className="text-xs text-muted-foreground">
                          {getJobStatusText(job.status)}
                          {job.personaName && ` - ${job.personaName}`}
                        </p>
                        {job.error && (
                          <p className="text-xs text-red-600">{job.error}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {job.imageUrl && (
                          <div className="w-8 h-8 rounded overflow-hidden">
                            <img src={job.imageUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        {(job.status === 'generating_text' || job.status === 'generating_image' || job.status === 'polling_image') && (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        )}
                        {job.status === 'completed' && !job.error && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                        {job.status === 'failed' && (
                          <X className="w-4 h-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPipelineDialog(false);
                setPipelineJobs([]);
                setSelectedTemplates([]);
                setCustomPrompt('');
              }}
            >
              닫기
            </Button>
            <Button
              onClick={startPipeline}
              disabled={isPipelineRunning || (pipelineMode === 'template' && selectedTemplates.length === 0 && !customPrompt.trim())}
            >
              {isPipelineRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  {pipelineMode === 'auto'
                    ? `${autoGenerateCount}개 자동 생성`
                    : `${selectedTemplates.length + (customPrompt.trim() ? 1 : 0)}개 생성 시작`}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Management Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? '템플릿 수정' : '새 템플릿'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>템플릿 이름</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="예: 비밀 아이돌"
              />
            </div>

            <div className="space-y-2">
              <Label>카테고리</Label>
              <Select value={newTemplateCategory} onValueChange={setNewTemplateCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">일반</SelectItem>
                  <SelectItem value="idol">아이돌</SelectItem>
                  <SelectItem value="ceo">CEO</SelectItem>
                  <SelectItem value="protector">보디가드</SelectItem>
                  <SelectItem value="ex">전 연인</SelectItem>
                  <SelectItem value="dangerous">위험한 남자</SelectItem>
                  <SelectItem value="junior">후배</SelectItem>
                  <SelectItem value="senior">선배</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>프롬프트</Label>
              <Textarea
                value={newTemplatePrompt}
                onChange={(e) => setNewTemplatePrompt(e.target.value)}
                placeholder="캐릭터 생성을 위한 상세한 프롬프트를 입력하세요..."
                rows={5}
              />
            </div>

            {!editingTemplate && templates.length > 0 && (
              <div className="space-y-2">
                <Label>기존 템플릿</Label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2 border rounded text-sm"
                    >
                      <span>{t.name}</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingTemplate(t);
                            setNewTemplateName(t.name);
                            setNewTemplatePrompt(t.prompt);
                            setNewTemplateCategory(t.category);
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => deleteTemplate(t.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              취소
            </Button>
            <Button onClick={saveTemplate}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

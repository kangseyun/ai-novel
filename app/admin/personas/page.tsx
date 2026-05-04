'use client';
import { adminFetch } from '@/lib/admin-fetch';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useImageGenerationQueue } from '@/hooks/useImageGenerationQueue';
import {
  Plus, Edit, Trash2, Eye, Loader2, Play, Settings,
  Image as ImageIcon, X, Check, Sparkles, Zap,
  FlaskConical, CheckCircle2, ArrowUpCircle, LayoutGrid, List, MessageSquare, Clock,
  FolderPlus, Folder, FolderOpen, Filter, ChevronDown, Search, SlidersHorizontal,
  PanelLeftClose, PanelLeft
} from 'lucide-react';
import ProjectSidebar from './components/ProjectSidebar';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// 프로젝트 인터페이스
interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  target_audience: 'female' | 'male' | 'anime' | null;
  status: 'active' | 'archived';
  sort_order: number;
  created_at: string;
}

interface Persona {
  id: string;
  name: string;
  full_name: string;
  role: string;
  age: number;
  ethnicity?: string;
  target_audience?: 'female' | 'male' | 'anime';
  profile_image_url: string | null;
  status: 'published' | 'lab';
  project_id?: string | null;
  created_at: string;
  updated_at: string;
}

const TARGET_AUDIENCE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  female: { label: '여성향', icon: '💜', color: 'bg-purple-100 text-purple-700' },
  male: { label: '남성향', icon: '💖', color: 'bg-pink-100 text-pink-700' },
  anime: { label: '애니', icon: '✨', color: 'bg-blue-100 text-blue-700' },
};

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

// 필터 인터페이스
interface FilterState {
  targetAudience: 'all' | 'female' | 'male' | 'anime';
  projectId: string | null; // null = 모든 프로젝트, 'none' = 프로젝트 없음
  hasImage: 'all' | 'yes' | 'no';
  dateRange: 'all' | 'today' | 'week' | 'month';
}

// 프로젝트 색상 팔레트
const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4',
  '#0ea5e9', '#3b82f6', '#6366f1',
];

const PROJECT_ICONS = ['📁', '🎭', '🎬', '🎮', '📚', '💫', '🌟', '✨', '🔥', '💎', '🎯', '🚀', '💜', '💖', '🎨'];

export default function PersonasListPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Persona | null>(null);

  // Image generation queue (Supabase Realtime)
  const { processingTasks, getTaskForPersona, createTask } = useImageGenerationQueue();

  // View & Tab
  const [viewMode, setViewMode] = useState<ViewMode>('gallery');
  const [activeTab, setActiveTab] = useState<TabMode>('lab');

  // 고급 필터
  const [filters, setFilters] = useState<FilterState>({
    targetAudience: 'all',
    projectId: null,
    hasImage: 'all',
    dateRange: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);

  // 프로젝트 관리
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#6366f1');
  const [newProjectIcon, setNewProjectIcon] = useState('📁');
  const [newProjectTargetAudience, setNewProjectTargetAudience] = useState<'female' | 'male' | 'anime' | ''>('');
  const [deleteProjectTarget, setDeleteProjectTarget] = useState<Project | null>(null);

  // 페르소나 프로젝트 할당
  const [showAssignProjectDialog, setShowAssignProjectDialog] = useState(false);
  const [assigningPersonas, setAssigningPersonas] = useState<string[]>([]);
  const [selectedPersonas, setSelectedPersonas] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // 사이드바
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarSelectedProject, setSidebarSelectedProject] = useState<string | null>(null);

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
  const [pipelineTargetAudience, setPipelineTargetAudience] = useState<'female' | 'male' | 'anime'>('female');

  // Template management
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplatePrompt, setNewTemplatePrompt] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('general');

  useEffect(() => {
    loadPersonas();
    loadTemplates();
    loadProjects();
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
      .select('id, name, full_name, role, age, ethnicity, target_audience, profile_image_url, status, project_id, created_at, updated_at')
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

  async function loadProjects() {
    const { data, error } = await supabase
      .from('persona_projects')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Failed to load projects:', error);
    } else {
      setProjects(data || []);
    }
  }

  // 사이드바용 콜백 함수들
  const handleCreateProject = useCallback(async (projectData: Partial<Project>) => {
    const { error } = await supabase
      .from('persona_projects')
      .insert(projectData);

    if (error) {
      throw error;
    }
    loadProjects();
  }, []);

  const handleUpdateProject = useCallback(async (project: Project) => {
    const { error } = await supabase
      .from('persona_projects')
      .update({
        name: project.name,
        description: project.description,
        color: project.color,
        icon: project.icon,
        target_audience: project.target_audience,
        status: project.status,
      })
      .eq('id', project.id);

    if (error) {
      throw error;
    }
    loadProjects();
  }, []);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    const { error } = await supabase
      .from('persona_projects')
      .delete()
      .eq('id', projectId);

    if (error) {
      throw error;
    }
    loadProjects();
  }, []);

  const handleMovePersona = useCallback(async (personaId: string, projectId: string | null) => {
    const { error } = await supabase
      .from('persona_core')
      .update({ project_id: projectId })
      .eq('id', personaId);

    if (error) {
      throw error;
    }
    loadPersonas();
  }, []);

  const handleReorderProjects = useCallback(async (projectIds: string[]) => {
    // 각 프로젝트의 sort_order 업데이트
    const updates = projectIds.map((id, index) =>
      supabase
        .from('persona_projects')
        .update({ sort_order: index })
        .eq('id', id)
    );

    await Promise.all(updates);
    loadProjects();
  }, []);

  // 사이드바 프로젝트 선택 시 필터 적용
  const handleSelectProject = useCallback((projectId: string | null) => {
    setSidebarSelectedProject(projectId);
    if (projectId === null) {
      // 전체 선택
      setFilters(prev => ({ ...prev, projectId: null }));
    } else if (projectId === 'uncategorized') {
      // 미분류 선택
      setFilters(prev => ({ ...prev, projectId: 'none' }));
    } else {
      // 특정 프로젝트 선택
      setFilters(prev => ({ ...prev, projectId }));
    }
  }, []);

  async function saveProject() {
    if (!newProjectName.trim()) {
      alert('프로젝트 이름을 입력해주세요.');
      return;
    }

    const projectData = {
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || null,
      color: newProjectColor,
      icon: newProjectIcon,
      target_audience: newProjectTargetAudience || null,
    };

    if (editingProject) {
      const { error } = await supabase
        .from('persona_projects')
        .update(projectData)
        .eq('id', editingProject.id);

      if (error) {
        alert('저장 실패: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('persona_projects')
        .insert(projectData);

      if (error) {
        alert('저장 실패: ' + error.message);
        return;
      }
    }

    loadProjects();
    resetProjectForm();
  }

  function resetProjectForm() {
    setShowProjectDialog(false);
    setEditingProject(null);
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectColor('#6366f1');
    setNewProjectIcon('📁');
    setNewProjectTargetAudience('');
  }

  async function deleteProject() {
    if (!deleteProjectTarget) return;

    // 프로젝트 삭제 시 연결된 페르소나의 project_id를 null로
    const { error } = await supabase
      .from('persona_projects')
      .update({ status: 'archived' })
      .eq('id', deleteProjectTarget.id);

    if (error) {
      alert('삭제 실패: ' + error.message);
    } else {
      loadProjects();
    }
    setDeleteProjectTarget(null);
  }

  async function assignPersonasToProject(projectId: string | null) {
    const personaIds = assigningPersonas.length > 0 ? assigningPersonas : Array.from(selectedPersonas);

    if (personaIds.length === 0) return;

    const { error } = await supabase
      .from('persona_core')
      .update({ project_id: projectId })
      .in('id', personaIds);

    if (error) {
      alert('할당 실패: ' + error.message);
    } else {
      loadPersonas();
      setShowAssignProjectDialog(false);
      setAssigningPersonas([]);
      setSelectedPersonas(new Set());
      setIsSelectionMode(false);
    }
  }

  // 활성 필터 개수
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.targetAudience !== 'all') count++;
    if (filters.projectId !== null) count++;
    if (filters.hasImage !== 'all') count++;
    if (filters.dateRange !== 'all') count++;
    return count;
  }, [filters]);

  // 필터 초기화
  function resetFilters() {
    setFilters({
      targetAudience: 'all',
      projectId: null,
      hasImage: 'all',
      dateRange: 'all',
    });
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
    const res = await adminFetch('/api/admin/persona/generate-auto-prompts', {
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
          const res = await adminFetch('/api/admin/persona/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: p.prompt,
              autoMode: isAutoMode,
              targetAudience: pipelineTargetAudience,
            }),
          });

          const result = await res.json();

          if (result.success && result.data) {
            // Save to database (새로 생성된 건 lab 상태)
            const personaData = {
              ...result.data,
              status: 'lab',
              target_audience: pipelineTargetAudience,
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
                const imageRes = await adminFetch('/api/admin/persona/generate-image', {
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
  const filteredPersonas = useMemo(() => {
    return personas.filter((p) => {
      // 기본 탭 필터
      if (p.status !== activeTab) return false;

      // 검색어 필터
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !p.name.toLowerCase().includes(query) &&
          !p.role.toLowerCase().includes(query) &&
          !(p.full_name?.toLowerCase().includes(query))
        ) {
          return false;
        }
      }

      // 타겟 오디언스 필터
      if (filters.targetAudience !== 'all' && p.target_audience !== filters.targetAudience) {
        return false;
      }

      // 프로젝트 필터
      if (filters.projectId !== null) {
        if (filters.projectId === 'none' && p.project_id !== null) return false;
        if (filters.projectId !== 'none' && p.project_id !== filters.projectId) return false;
      }

      // 이미지 필터
      if (filters.hasImage === 'yes' && !p.profile_image_url) return false;
      if (filters.hasImage === 'no' && p.profile_image_url) return false;

      // 날짜 필터
      if (filters.dateRange !== 'all') {
        const createdAt = new Date(p.created_at);
        const now = new Date();
        if (filters.dateRange === 'today') {
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (createdAt < today) return false;
        } else if (filters.dateRange === 'week') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (createdAt < weekAgo) return false;
        } else if (filters.dateRange === 'month') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (createdAt < monthAgo) return false;
        }
      }

      return true;
    });
  }, [personas, activeTab, searchQuery, filters]);

  const labCount = personas.filter(p => p.status === 'lab').length;
  const publishedCount = personas.filter(p => p.status === 'published').length;

  // 프로젝트별 카운트
  const projectCounts = useMemo(() => {
    const counts: Record<string, number> = { none: 0 };
    personas.forEach(p => {
      if (p.project_id) {
        counts[p.project_id] = (counts[p.project_id] || 0) + 1;
      } else {
        counts.none++;
      }
    });
    return counts;
  }, [personas]);

  // 프로젝트 헬퍼 함수
  const getProjectById = (id: string | null | undefined) => projects.find(p => p.id === id);

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

  // 사이드바용 페르소나 데이터
  const sidebarPersonas = useMemo(() => {
    return personas.map(p => ({
      id: p.id,
      name: p.name,
      display_name: p.full_name || p.name,
      avatar_url: p.profile_image_url,
      project_id: p.project_id || null,
      target_audience: p.target_audience || null,
    }));
  }, [personas]);

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      {sidebarOpen && (
        <ProjectSidebar
          projects={projects}
          personas={sidebarPersonas}
          selectedProjectId={sidebarSelectedProject}
          onSelectProject={handleSelectProject}
          onCreateProject={handleCreateProject}
          onUpdateProject={handleUpdateProject}
          onDeleteProject={handleDeleteProject}
          onMovePersona={handleMovePersona}
          onReorderProjects={handleReorderProjects}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
      {/* Sidebar Toggle + Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="h-8 w-8"
            title={sidebarOpen ? '사이드바 닫기' : '사이드바 열기'}
          >
            {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
          </Button>
          <div>
          <h1 className="text-xl font-semibold mb-1">페르소나 관리</h1>
          <p className="text-sm text-muted-foreground">
            실험실 {labCount}개 · 확정 {publishedCount}개 · 프로젝트 {projects.length}개
            {processingTasks.length > 0 && (
              <span className="ml-2 text-blue-500">
                · 이미지 생성 중 {processingTasks.length}개
              </span>
            )}
          </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 선택 모드 액션 */}
          {isSelectionMode && selectedPersonas.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAssigningPersonas(Array.from(selectedPersonas));
                  setShowAssignProjectDialog(true);
                }}
              >
                <Folder className="w-4 h-4 mr-1" />
                프로젝트 할당 ({selectedPersonas.size})
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedPersonas(new Set());
                  setIsSelectionMode(false);
                }}
              >
                <X className="w-4 h-4 mr-1" />
                취소
              </Button>
            </>
          )}
          {!isSelectionMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSelectionMode(true)}
              >
                <Check className="w-4 h-4 mr-1" />
                선택
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <FolderOpen className="w-4 h-4 mr-1" />
                    프로젝트
                    <ChevronDown className="w-3 h-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => setShowProjectDialog(true)}>
                    <FolderPlus className="w-4 h-4 mr-2" />
                    새 프로젝트
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {projects.map(project => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => {
                        setEditingProject(project);
                        setNewProjectName(project.name);
                        setNewProjectDescription(project.description || '');
                        setNewProjectColor(project.color);
                        setNewProjectIcon(project.icon);
                        setNewProjectTargetAudience(project.target_audience || '');
                        setShowProjectDialog(true);
                      }}
                    >
                      <span className="mr-2">{project.icon}</span>
                      {project.name}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {projectCounts[project.id] || 0}
                      </span>
                    </DropdownMenuItem>
                  ))}
                  {projects.length === 0 && (
                    <DropdownMenuItem disabled>
                      프로젝트가 없습니다
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
            </>
          )}
        </div>
      </div>

      {/* Tabs + View Toggle + Search + Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
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
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="이름, 역할로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filter Button */}
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={activeFilterCount > 0 ? 'border-primary' : ''}>
              <SlidersHorizontal className="w-4 h-4 mr-1" />
              필터
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">필터</h4>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    초기화
                  </Button>
                )}
              </div>

              {/* 타겟 오디언스 */}
              <div className="space-y-2">
                <Label className="text-xs">타겟 유저</Label>
                <Select
                  value={filters.targetAudience}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, targetAudience: v as FilterState['targetAudience'] }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="female">💜 여성향</SelectItem>
                    <SelectItem value="male">💖 남성향</SelectItem>
                    <SelectItem value="anime">✨ 애니</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 프로젝트 */}
              <div className="space-y-2">
                <Label className="text-xs">프로젝트</Label>
                <Select
                  value={filters.projectId || 'all'}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, projectId: v === 'all' ? null : v }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="none">📂 미분류</SelectItem>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.icon} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 이미지 */}
              <div className="space-y-2">
                <Label className="text-xs">이미지</Label>
                <Select
                  value={filters.hasImage}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, hasImage: v as FilterState['hasImage'] }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="yes">이미지 있음</SelectItem>
                    <SelectItem value="no">이미지 없음</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 기간 */}
              <div className="space-y-2">
                <Label className="text-xs">생성일</Label>
                <Select
                  value={filters.dateRange}
                  onValueChange={(v) => setFilters(prev => ({ ...prev, dateRange: v as FilterState['dateRange'] }))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="today">오늘</SelectItem>
                    <SelectItem value="week">최근 7일</SelectItem>
                    <SelectItem value="month">최근 30일</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PopoverContent>
        </Popover>

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

      {/* 활성 필터 표시 */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.targetAudience !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
              {TARGET_AUDIENCE_LABELS[filters.targetAudience]?.icon} {TARGET_AUDIENCE_LABELS[filters.targetAudience]?.label}
              <button onClick={() => setFilters(prev => ({ ...prev, targetAudience: 'all' }))} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.projectId !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
              {filters.projectId === 'none' ? '📂 미분류' : `${getProjectById(filters.projectId)?.icon || ''} ${getProjectById(filters.projectId)?.name || ''}`}
              <button onClick={() => setFilters(prev => ({ ...prev, projectId: null }))} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.hasImage !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
              이미지 {filters.hasImage === 'yes' ? '있음' : '없음'}
              <button onClick={() => setFilters(prev => ({ ...prev, hasImage: 'all' }))} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.dateRange !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs">
              {filters.dateRange === 'today' ? '오늘' : filters.dateRange === 'week' ? '최근 7일' : '최근 30일'}
              <button onClick={() => setFilters(prev => ({ ...prev, dateRange: 'all' }))} className="ml-1 hover:text-destructive">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
        </div>
      )}

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
          {filteredPersonas.map((persona) => {
            const project = getProjectById(persona.project_id);
            const isSelected = selectedPersonas.has(persona.id);

            return (
            <div
              key={persona.id}
              className={`group relative bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all ${
                isSelected ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => {
                if (isSelectionMode) {
                  setSelectedPersonas(prev => {
                    const next = new Set(prev);
                    if (next.has(persona.id)) {
                      next.delete(persona.id);
                    } else {
                      next.add(persona.id);
                    }
                    return next;
                  });
                }
              }}
            >
              {/* Selection Checkbox */}
              {isSelectionMode && (
                <div className="absolute top-2 left-2 z-10">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    isSelected ? 'bg-primary border-primary' : 'bg-white/80 border-gray-400'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              )}

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
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{persona.age}세 · {persona.ethnicity || 'Korean'}</span>
                  {persona.target_audience && (
                    <span className={`ml-1 px-1 py-0.5 rounded text-[10px] ${TARGET_AUDIENCE_LABELS[persona.target_audience]?.color || ''}`}>
                      {TARGET_AUDIENCE_LABELS[persona.target_audience]?.icon}
                    </span>
                  )}
                </div>
                {/* 프로젝트 표시 */}
                {project && (
                  <div
                    className="mt-1 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded w-fit"
                    style={{ backgroundColor: `${project.color}20`, color: project.color }}
                  >
                    <span>{project.icon}</span>
                    <span className="truncate max-w-[80px]">{project.name}</span>
                  </div>
                )}
              </div>

              {/* Hover Actions */}
              {!isSelectionMode && (
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssigningPersonas([persona.id]);
                    setShowAssignProjectDialog(true);
                  }}
                  title="프로젝트 할당"
                >
                  <Folder className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStatus(persona);
                  }}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(persona);
                  }}
                  className="text-destructive"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              )}

              {/* Status Badge */}
              <div className={`absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium ${
                persona.status === 'published'
                  ? 'bg-green-500/90 text-white'
                  : 'bg-orange-500/90 text-white'
              }`}>
                {persona.status === 'published' ? '확정' : '실험실'}
              </div>
            </div>
          );
          })}
        </div>
      ) : (
        /* List View */
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {isSelectionMode && <th className="text-left px-4 py-3 font-medium w-10"></th>}
                <th className="text-left px-4 py-3 font-medium w-16">이미지</th>
                <th className="text-left px-4 py-3 font-medium">이름</th>
                <th className="text-left px-4 py-3 font-medium">역할</th>
                <th className="text-left px-4 py-3 font-medium">나이</th>
                <th className="text-left px-4 py-3 font-medium">타겟</th>
                <th className="text-left px-4 py-3 font-medium">프로젝트</th>
                <th className="text-left px-4 py-3 font-medium">상태</th>
                <th className="text-left px-4 py-3 font-medium">생성일</th>
                <th className="text-right px-4 py-3 font-medium">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPersonas.map((persona) => {
                const project = getProjectById(persona.project_id);
                const isSelected = selectedPersonas.has(persona.id);

                return (
                <tr
                  key={persona.id}
                  className={`hover:bg-muted/30 ${isSelected ? 'bg-primary/5' : ''}`}
                  onClick={() => {
                    if (isSelectionMode) {
                      setSelectedPersonas(prev => {
                        const next = new Set(prev);
                        if (next.has(persona.id)) {
                          next.delete(persona.id);
                        } else {
                          next.add(persona.id);
                        }
                        return next;
                      });
                    }
                  }}
                >
                  {isSelectionMode && (
                    <td className="px-4 py-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        isSelected ? 'bg-primary border-primary' : 'border-gray-400'
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </td>
                  )}
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
                    {persona.target_audience ? (
                      <span className={`px-2 py-0.5 rounded text-xs ${TARGET_AUDIENCE_LABELS[persona.target_audience]?.color || ''}`}>
                        {TARGET_AUDIENCE_LABELS[persona.target_audience]?.icon} {TARGET_AUDIENCE_LABELS[persona.target_audience]?.label}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {project ? (
                      <span
                        className="px-2 py-0.5 rounded text-xs flex items-center gap-1 w-fit"
                        style={{ backgroundColor: `${project.color}20`, color: project.color }}
                      >
                        <span>{project.icon}</span>
                        <span>{project.name}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
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
              );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">페르소나 삭제</DialogTitle>
            <DialogDescription className="text-gray-500">
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Play className="w-5 h-5" />
              페르소나 파이프라인
            </DialogTitle>
            <DialogDescription className="text-gray-500">
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
                    : 'hover:bg-gray-50 border-gray-200'
                }`}
                disabled={isPipelineRunning}
              >
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-gray-700" />
                  <div>
                    <p className="font-medium text-sm text-gray-900">템플릿 선택</p>
                    <p className="text-xs text-gray-500">미리 정의된 템플릿 사용</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setPipelineMode('auto')}
                className={`flex-1 p-3 border rounded-lg text-left transition-all ${
                  pipelineMode === 'auto'
                    ? 'border-primary bg-primary/5'
                    : 'hover:bg-gray-50 border-gray-200'
                }`}
                disabled={isPipelineRunning}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-gray-700" />
                  <div>
                    <p className="font-medium text-sm text-gray-900">완전 자동</p>
                    <p className="text-xs text-gray-500">다양한 캐릭터 랜덤 생성</p>
                  </div>
                </div>
              </button>
            </div>

            {/* Template Mode */}
            {pipelineMode === 'template' && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-700">프롬프트 템플릿</Label>
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
                            : 'hover:bg-gray-50 border-gray-200'
                        }`}
                        disabled={isPipelineRunning}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm text-gray-900">{template.name}</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
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
                  <Label className="text-gray-700">커스텀 프롬프트 (선택)</Label>
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="추가로 생성할 캐릭터 컨셉을 입력하세요..."
                    rows={3}
                    disabled={isPipelineRunning}
                    className="bg-white border-gray-300 text-gray-900"
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
                    <span className="font-medium text-gray-900">완전 자동 생성 모드</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    AI가 다양한 국적, 나이, 직업, 성격, 세계관을 가진 캐릭터들을 자동으로 생성합니다.
                    중복 없이 독특한 캐릭터들이 만들어집니다.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-700">생성할 캐릭터 수</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={autoGenerateCount}
                      onChange={(e) => setAutoGenerateCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                      className="w-24 bg-white border-gray-300 text-gray-900"
                      disabled={isPipelineRunning}
                    />
                    <span className="text-sm text-gray-500">최대 10개</span>
                  </div>
                </div>
              </div>
            )}

            {/* Target Audience Selection */}
            <div className="space-y-2">
              <Label className="text-gray-700">타겟 유저</Label>
              <div className="flex gap-2">
                {(['female', 'male', 'anime'] as const).map((audience) => (
                  <button
                    key={audience}
                    onClick={() => setPipelineTargetAudience(audience)}
                    disabled={isPipelineRunning}
                    className={`flex-1 p-3 border rounded-lg text-center transition-all ${
                      pipelineTargetAudience === audience
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'hover:bg-gray-50 border-gray-200'
                    } disabled:opacity-50`}
                  >
                    <span className="text-lg block mb-1">{TARGET_AUDIENCE_LABELS[audience].icon}</span>
                    <span className="text-xs font-medium text-gray-700">{TARGET_AUDIENCE_LABELS[audience].label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Image Generation Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-gray-600" />
                <span className="text-sm text-gray-700">이미지도 함께 생성</span>
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
                <Label className="text-gray-700">생성 진행 상황</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {pipelineJobs.map((job) => (
                    <div
                      key={job.id}
                      className={`p-3 border rounded-lg flex items-center justify-between ${
                        job.status === 'completed'
                          ? 'border-green-500/50 bg-green-50'
                          : job.status === 'failed'
                          ? 'border-red-500/50 bg-red-50'
                          : job.status === 'pending'
                          ? 'border-gray-200 bg-white'
                          : 'border-blue-500/50 bg-blue-50'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{job.templateName}</p>
                        <p className="text-xs text-gray-500">
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
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">
              {editingTemplate ? '템플릿 수정' : '새 템플릿'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">템플릿 이름</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="예: 비밀 아이돌"
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">카테고리</Label>
              <Select value={newTemplateCategory} onValueChange={setNewTemplateCategory}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
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
              <Label className="text-gray-700">프롬프트</Label>
              <Textarea
                value={newTemplatePrompt}
                onChange={(e) => setNewTemplatePrompt(e.target.value)}
                placeholder="캐릭터 생성을 위한 상세한 프롬프트를 입력하세요..."
                rows={5}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            {!editingTemplate && templates.length > 0 && (
              <div className="space-y-2">
                <Label className="text-gray-700">기존 템플릿</Label>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2 border border-gray-200 rounded text-sm bg-white"
                    >
                      <span className="text-gray-900">{t.name}</span>
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

      {/* Project Management Dialog */}
      <Dialog open={showProjectDialog} onOpenChange={(open) => !open && resetProjectForm()}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <FolderPlus className="w-5 h-5" />
              {editingProject ? '프로젝트 수정' : '새 프로젝트'}
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              페르소나를 프로젝트로 그룹화하여 관리하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-700">프로젝트 이름 <span className="text-destructive">*</span></Label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="예: 시즌1 아이돌"
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">설명 (선택)</Label>
              <Textarea
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
                placeholder="프로젝트 설명..."
                rows={2}
                className="bg-white border-gray-300 text-gray-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-700">아이콘</Label>
                <div className="flex flex-wrap gap-1 p-2 border border-gray-200 rounded-lg max-h-24 overflow-y-auto bg-white">
                  {PROJECT_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setNewProjectIcon(icon)}
                      className={`w-8 h-8 rounded flex items-center justify-center text-lg hover:bg-gray-100 ${
                        newProjectIcon === icon ? 'bg-primary/20 ring-1 ring-primary' : ''
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700">색상</Label>
                <div className="flex flex-wrap gap-1 p-2 border border-gray-200 rounded-lg max-h-24 overflow-y-auto bg-white">
                  {PROJECT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewProjectColor(color)}
                      className={`w-6 h-6 rounded-full ${
                        newProjectColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-700">타겟 유저 (선택)</Label>
              <Select
                value={newProjectTargetAudience}
                onValueChange={(v) => setNewProjectTargetAudience(v as typeof newProjectTargetAudience)}
              >
                <SelectTrigger className="bg-white border-gray-300 text-gray-900">
                  <SelectValue placeholder="선택 안함" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="">선택 안함</SelectItem>
                  <SelectItem value="female">💜 여성향</SelectItem>
                  <SelectItem value="male">💖 남성향</SelectItem>
                  <SelectItem value="anime">✨ 애니</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 미리보기 */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-500 mb-2">미리보기</p>
              <div
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: `${newProjectColor}20`, color: newProjectColor }}
              >
                <span className="text-lg">{newProjectIcon}</span>
                <span className="font-medium">{newProjectName || '프로젝트 이름'}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editingProject && (
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteProjectTarget(editingProject);
                  setShowProjectDialog(false);
                }}
                className="sm:mr-auto"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                삭제
              </Button>
            )}
            <Button variant="outline" onClick={resetProjectForm}>
              취소
            </Button>
            <Button onClick={saveProject} disabled={!newProjectName.trim()}>
              {editingProject ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation */}
      <Dialog open={!!deleteProjectTarget} onOpenChange={() => setDeleteProjectTarget(null)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">프로젝트 삭제</DialogTitle>
            <DialogDescription className="text-gray-500">
              &quot;{deleteProjectTarget?.name}&quot; 프로젝트를 삭제하시겠습니까?
              프로젝트에 속한 페르소나는 미분류로 이동됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProjectTarget(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={deleteProject}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Project Dialog */}
      <Dialog open={showAssignProjectDialog} onOpenChange={setShowAssignProjectDialog}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <Folder className="w-5 h-5" />
              프로젝트 할당
            </DialogTitle>
            <DialogDescription className="text-gray-500">
              {assigningPersonas.length || selectedPersonas.size}개의 페르소나를 프로젝트에 할당합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <button
              onClick={() => assignPersonasToProject(null)}
              className="w-full p-3 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📂</span>
                <div>
                  <p className="font-medium text-sm text-gray-900">미분류</p>
                  <p className="text-xs text-gray-500">프로젝트에서 제거</p>
                </div>
              </div>
            </button>

            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => assignPersonasToProject(project.id)}
                className="w-full p-3 border border-gray-200 rounded-lg text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="text-lg w-8 h-8 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${project.color}20` }}
                  >
                    {project.icon}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-sm text-gray-900">{project.name}</p>
                    {project.description && (
                      <p className="text-xs text-gray-500 line-clamp-1">{project.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {projectCounts[project.id] || 0}개
                  </span>
                </div>
              </button>
            ))}

            {projects.length === 0 && (
              <div className="p-4 text-center text-gray-500">
                <p className="text-sm mb-2">프로젝트가 없습니다</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAssignProjectDialog(false);
                    setShowProjectDialog(true);
                  }}
                >
                  <FolderPlus className="w-4 h-4 mr-1" />
                  새 프로젝트 생성
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignProjectDialog(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

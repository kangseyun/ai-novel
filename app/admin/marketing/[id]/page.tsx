'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import {
  ArrowLeft,
  Loader2,
  Plus,
  Download,
  Check,
  X,
  Trash2,
  RefreshCw,
  Image as ImageIcon,
  Sparkles,
  ExternalLink,
  Search,
  ChevronRight,
  Layers,
  CheckCircle2,
  Clock,
  PlayCircle,
  XCircle,
  AlertCircle,
  Wand2,
  FileText,
  Copy,
  PenTool,
  Pin,
  Eye,
  UploadCloud, // Added icon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface MarketingProject {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'completed' | 'archived';
  target_platform: string;
  created_at: string;
  updated_at: string;
  // 연결된 캐릭터 정보
  persona_id: string | null;
  persona_name: string | null;
  persona_avatar_url: string | null;
  // 베이스 이미지 정보
  base_image_url: string | null;
  base_template: string | null;
  base_custom_prompt: string | null;
  // 마케팅 컨셉 정보
  marketing_concept: string | null;
  cta_goal: string | null;
}

interface MarketingCopy {
  id: string;
  project_id: string;
  headline: string;
  body: string;
  cta: string;
  version: number;
  variation_type: string | null;
  status: 'generated' | 'approved' | 'rejected' | 'used';
  created_at: string;
}

interface MarketingImage {
  id: string;
  project_id: string;
  persona_id: string | null;
  persona_name: string;
  image_url: string;
  thumbnail_url: string | null;
  ad_size: string;
  ad_size_label: string;
  template: string;
  template_label: string;
  custom_prompt: string | null;
  generated_prompt: string | null;
  width: number | null;
  height: number | null;
  status: 'generating' | 'generated' | 'approved' | 'rejected' | 'used';
  notes: string | null;
  created_at: string;
  // 계층 구조 관련 필드
  parent_image_id?: string | null;
  is_base?: boolean;
  generation_group_id?: string | null;
}

interface Persona {
  id: string;
  name: string;
  displayName: string;
  avatarUrl: string;
  category: string;
  age?: number;
  ethnicity?: string;
  appearance?: Record<string, unknown>;
  corePersonality?: Record<string, unknown>;
}

interface AdTemplate {
  label: string;
  promptGuide: string;
}

interface AdSize {
  width: number;
  height: number;
  label: string;
  aspectRatio: string;
}

interface SizeTask {
  task_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  images: string[];
  error?: string;
}

interface GenerationTask {
  id: string;
  project_id: string;
  persona_id: string | null;
  persona_name: string;
  template: string;
  custom_prompt: string | null;
  size_tasks: Record<string, SizeTask>;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  selected_base_image: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  generating: { label: '생성중', color: 'bg-yellow-100 text-yellow-800' },
  generated: { label: '생성완료', color: 'bg-blue-100 text-blue-800' },
  approved: { label: '승인됨', color: 'bg-green-100 text-green-800' },
  rejected: { label: '거절됨', color: 'bg-red-100 text-red-800' },
  used: { label: '사용됨', color: 'bg-purple-100 text-purple-800' },
};

const TASK_STATUS_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  pending: { label: '대기중', icon: <Clock className="w-4 h-4" />, color: 'text-gray-500' },
  processing: { label: '생성중', icon: <Loader2 className="w-4 h-4 animate-spin" />, color: 'text-blue-500' },
  completed: { label: '완료', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-green-500' },
  failed: { label: '실패', icon: <XCircle className="w-4 h-4" />, color: 'text-red-500' },
  cancelled: { label: '취소됨', icon: <XCircle className="w-4 h-4" />, color: 'text-gray-500' },
};

type GenerationStep = 'select-persona' | 'generate-base' | 'confirm-base';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<MarketingProject | null>(null);
  const [images, setImages] = useState<MarketingImage[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [templates, setTemplates] = useState<Record<string, AdTemplate>>({});
  const [sizes, setSizes] = useState<Record<string, AdSize>>({});
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [marketingCopies, setMarketingCopies] = useState<MarketingCopy[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showPersonaDialog, setShowPersonaDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'images' | 'tasks' | 'copy'>('images');

  // Generation workflow state
  const [generationStep, setGenerationStep] = useState<GenerationStep>('select-persona');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');
  const [generatedBaseImages, setGeneratedBaseImages] = useState<string[]>([]);
  const [selectedGeneratedBaseImage, setSelectedGeneratedBaseImage] = useState<string | null>(null);
  const [useBackgroundMode, setUseBackgroundMode] = useState(true);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [baseImageCount, setBaseImageCount] = useState<number>(1);

  // Generation form
  const [selectedPersona, setSelectedPersona] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('romantic-chat');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [personaSearch, setPersonaSearch] = useState<string>('');

  // Marketing concept and copy
  const [marketingConcept, setMarketingConcept] = useState<string>('');
  const [ctaGoal, setCtaGoal] = useState<string>('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isGeneratingConcept, setIsGeneratingConcept] = useState(false);
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false);
  const [showCopySection, setShowCopySection] = useState(false);


  // Base image detail popup
  const [selectedBaseImage, setSelectedBaseImageForPopup] = useState<MarketingImage | null>(null);
  const [isDetailPopupOpen, setIsDetailPopupOpen] = useState(false);
  const [isUploadingMeta, setIsUploadingMeta] = useState(false); // Add missing state

  // Meta Upload (Moved logic here to access state)
  const handleUploadToMeta = async (image: MarketingImage) => {
    if (!confirm('이 이미지를 Meta 광고 관리자에 업로드하시겠습니까?')) return;

    setIsUploadingMeta(true);
    try {
      // Find matching copy if available (optional)
      const approvedCopy = marketingCopies.find(c => c.status === 'approved');
      
      const res = await fetch('/api/admin/marketing/upload/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: image.id,
          headline: approvedCopy?.headline,
          message: approvedCopy?.body,
          // campaignId: project.external_campaign_id, // If we had one
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        alert('Meta 업로드 성공! (Creative ID: ' + data.creativeId + ')');
        // Update image status or add execution record locally if needed
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Meta upload failed:', error);
      alert('Meta 업로드 실패: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsUploadingMeta(false);
    }
  };

  const loadProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/marketing/projects/${projectId}`);
      const data = await res.json();
      setProject(data.project);
      setImages(data.images || []);
      setMarketingCopies(data.copies || []);
      // 마케팅 컨셉 정보 로드
      if (data.project?.marketing_concept) {
        setMarketingConcept(data.project.marketing_concept);
      }
      if (data.project?.cta_goal) {
        setCtaGoal(data.project.cta_goal);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }, [projectId]);

  const loadPersonas = useCallback(async () => {
    try {
      // persona_core 테이블에서 직접 조회 (어드민용)
      const supabase = createClient();
      const { data, error } = await supabase
        .from('persona_core')
        .select('id, name, full_name, role, age, ethnicity, profile_image_url, appearance, core_personality, status')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load personas:', error);
        return;
      }

      const mappedPersonas = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        displayName: p.full_name || p.name,
        avatarUrl: p.profile_image_url || '/default-avatar.png',
        category: p.role || 'other',
        age: p.age || 25,
        ethnicity: p.ethnicity,
        appearance: p.appearance,
        corePersonality: p.core_personality,
      }));
      setPersonas(mappedPersonas);
    } catch (error) {
      console.error('Failed to load personas:', error);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/marketing/generate-ad');
      const data = await res.json();
      setTemplates(data.templates || {});
      setSizes(data.sizes || {});
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/marketing/tasks?project_id=${projectId}`);
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }, [projectId]);

  useEffect(() => {
    Promise.all([loadProject(), loadPersonas(), loadTemplates(), loadTasks()]).finally(() => {
      setIsLoading(false);
    });
  }, [loadProject, loadPersonas, loadTemplates, loadTasks]);

  // 프로젝트에 이미지가 있으면 해당 캐릭터를 고정
  const projectPersona = useMemo(() => {
    // 프로젝트에 저장된 캐릭터 정보가 있으면 사용
    if (project?.persona_id) {
      return {
        id: project.persona_id,
        name: project.persona_name || '',
        avatarUrl: project.persona_avatar_url || '',
      };
    }
    // 없으면 기존 이미지에서 캐릭터 정보 추출
    if (images.length > 0) {
      const firstImage = images[0];
      const persona = personas.find((p) => p.id === firstImage.persona_id);
      if (persona) {
        return {
          id: persona.id,
          name: persona.displayName,
          avatarUrl: persona.avatarUrl,
        };
      }
      // 페르소나 목록에 없으면 이미지 데이터에서 이름만 사용
      return {
        id: firstImage.persona_id || '',
        name: firstImage.persona_name,
        avatarUrl: '',
      };
    }
    return null;
  }, [project, images, personas]);

  // 캐릭터가 고정되어 있는지 (이미지가 있거나 프로젝트에 연결된 경우)
  const isPersonaLocked = !!projectPersona;

  // 프로젝트에 저장된 베이스 이미지
  const projectBaseImage = project?.base_image_url || null;

  // 베이스 이미지가 있는지 여부 (다른 사이즈 생성 가능 여부)
  const hasBaseImage = !!projectBaseImage;

  // 캐릭터가 고정되어 있으면 자동으로 선택
  useEffect(() => {
    if (projectPersona && !selectedPersona) {
      setSelectedPersona(projectPersona.id);
    }
  }, [projectPersona, selectedPersona]);

  // Poll for task updates when there are processing tasks
  useEffect(() => {
    const processingTasks = tasks.filter((t) => t.status === 'processing');
    if (processingTasks.length === 0) return;

    const interval = setInterval(() => {
      loadTasks();
      loadProject(); // 베이스 이미지 상태 업데이트를 위해 프로젝트도 다시 로드
    }, 5000);

    return () => clearInterval(interval);
  }, [tasks, loadTasks, loadProject]);

  // Poll current task in dialog
  useEffect(() => {
    if (!currentTaskId || !showGenerateDialog) return;

    const pollTask = async () => {
      try {
        const res = await fetch(`/api/admin/marketing/tasks/${currentTaskId}`);
        const data = await res.json();
        const task = data.task as GenerationTask;

        if (task.status === 'completed' || task.status === 'failed') {
          if (task.status === 'completed') {
            // Check if base images are ready
            const baseSizeTask = task.size_tasks['feed-square'];
            if (baseSizeTask?.status === 'completed' && baseSizeTask.images.length > 0) {
              setGeneratedBaseImages(baseSizeTask.images);
              setGenerationStep('confirm-base');
              setGenerationProgress('베이스 이미지 생성 완료!');
            }
          } else {
            setGenerationProgress(`오류: ${task.error_message || '생성 실패'}`);
            setGenerationStep('select-persona');
          }
          setIsGenerating(false);
          setCurrentTaskId(null);
        }
      } catch (error) {
        console.error('Failed to poll task:', error);
      }
    };

    const interval = setInterval(pollTask, 3000);
    return () => clearInterval(interval);
  }, [currentTaskId, showGenerateDialog]);

  const filteredPersonas = useMemo(() => {
    if (!personaSearch.trim()) return personas;
    const search = personaSearch.toLowerCase();
    return personas.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.displayName.toLowerCase().includes(search) ||
        p.category?.toLowerCase().includes(search)
    );
  }, [personas, personaSearch]);

  const selectedPersonaData = useMemo(() => {
    return personas.find((p) => p.id === selectedPersona);
  }, [personas, selectedPersona]);

  const getPersonaData = (personaId: string) => {
    const persona = personas.find((p) => p.id === personaId);
    if (!persona) {
      console.warn('Persona not found:', personaId, 'Available:', personas.map(p => p.id));
      return null;
    }

    return {
      name: persona.displayName || persona.name,
      role: persona.category || 'character',
      age: persona.age || 25,
      ethnicity: persona.ethnicity,
      appearance: persona.appearance || { style: 'modern casual' },
      core_personality: persona.corePersonality,
    };
  };

  const resetGeneration = () => {
    setGenerationStep('select-persona');
    setGeneratedBaseImages([]);
    setSelectedGeneratedBaseImage(null);
    setGenerationProgress('');
    setCustomPrompt('');
    setCurrentTaskId(null);
  };

  // Generate base image using background task
  const handleGenerateBaseBackground = async () => {
    if (!selectedPersona) return;

    const persona = personas.find((p) => p.id === selectedPersona);
    if (!persona) return;

    setIsGenerating(true);
    setGenerationProgress('백그라운드 태스크 생성 중...');
    setGeneratedBaseImages([]);
    setGenerationStep('generate-base');

    try {
      const res = await fetch('/api/admin/marketing/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          persona_id: selectedPersona,
          persona_name: persona.displayName || persona.name,
          persona_data: getPersonaData(selectedPersona),
          template: selectedTemplate,
          custom_prompt: customPrompt || undefined,
          generate_all_sizes: false,
          base_image_count: baseImageCount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Task creation failed');
      }

      setCurrentTaskId(data.task.id);
      setGenerationProgress('백그라운드에서 이미지 생성 중... (1~2분 소요)');
      loadTasks();
    } catch (error) {
      console.error('Task creation error:', error);
      setGenerationProgress(`오류: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setGenerationStep('select-persona');
      setIsGenerating(false);
    }
  };

  // Generate base image (foreground)
  const handleGenerateBase = async () => {
    if (useBackgroundMode) {
      return handleGenerateBaseBackground();
    }

    if (!selectedPersona) return;

    const personaData = getPersonaData(selectedPersona);
    if (!personaData) return;

    setIsGenerating(true);
    setGenerationProgress('베이스 이미지 생성 요청 중...');
    setGeneratedBaseImages([]);
    setGenerationStep('generate-base');

    try {
      const res = await fetch('/api/admin/marketing/generate-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaData,
          adSize: 'feed-square',
          template: selectedTemplate,
          customPrompt: customPrompt || undefined,
          imageCount: baseImageCount,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      const taskId = data.taskId;
      setGenerationProgress('베이스 이미지 생성 중... (1~2분 소요)');

      let attempts = 0;
      const maxAttempts = 60;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        attempts++;

        const statusRes = await fetch(`/api/admin/marketing/generate-ad?taskId=${taskId}`);
        const statusData = await statusRes.json();

        if (statusData.status === 'succeed') {
          const imageUrls = statusData.images.map((img: { url: string }) => img.url);
          setGeneratedBaseImages(imageUrls);
          setGenerationProgress(`${imageUrls.length}개 베이스 이미지 생성 완료!`);
          setGenerationStep('confirm-base');
          break;
        } else if (statusData.status === 'failed') {
          throw new Error(statusData.statusMessage || 'Generation failed');
        }

        setGenerationProgress(`베이스 이미지 생성 중... (${attempts * 3}초 경과)`);
      }

      if (attempts >= maxAttempts) {
        throw new Error('Generation timed out');
      }
    } catch (error) {
      console.error('Generation error:', error);
      setGenerationProgress(`오류: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setGenerationStep('select-persona');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateBase = () => {
    setGeneratedBaseImages([]);
    setSelectedGeneratedBaseImage(null);
    handleGenerateBase();
  };

  // 베이스 이미지만 확정 (모든 사이즈 생성 없이)
  const handleConfirmBaseOnly = async () => {
    if (!selectedGeneratedBaseImage || !selectedPersona) return;

    const persona = personas.find((p) => p.id === selectedPersona);
    if (!persona) return;

    // Save base image to project
    await saveBaseImageToProject(selectedGeneratedBaseImage);

    // Save the base image to images table with is_base flag
    await saveImageToProject(selectedGeneratedBaseImage, 'feed-square');

    // Close dialog and refresh
    setShowGenerateDialog(false);
    resetGeneration();
    loadProject();
  };

  const saveImageToProject = async (imageUrl: string, adSize: string) => {
    const persona = personas.find((p) => p.id === selectedPersona);
    if (!persona) return null;

    try {
      const res = await fetch('/api/admin/marketing/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          persona_id: selectedPersona,
          persona_name: persona.displayName || persona.name,
          image_url: imageUrl,
          ad_size: adSize,
          ad_size_label: sizes[adSize]?.label || adSize,
          template: selectedTemplate,
          template_label: templates[selectedTemplate]?.label || selectedTemplate,
          custom_prompt: customPrompt || null,
          generated_prompt: null,
          width: sizes[adSize]?.width,
          height: sizes[adSize]?.height,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        return data.image;
      }
    } catch (error) {
      console.error('Failed to save image:', error);
    }
    return null;
  };

  // 베이스 이미지를 프로젝트에 저장
  const saveBaseImageToProject = async (imageUrl: string) => {
    try {
      const res = await fetch(`/api/admin/marketing/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_image_url: imageUrl,
          base_template: selectedTemplate,
          base_custom_prompt: customPrompt || null,
        }),
      });

      if (res.ok) {
        // 로컬 프로젝트 상태도 업데이트
        setProject((prev) =>
          prev ? { ...prev, base_image_url: imageUrl, base_template: selectedTemplate, base_custom_prompt: customPrompt || null } : null
        );
        return true;
      }
    } catch (error) {
      console.error('Failed to save base image to project:', error);
    }
    return false;
  };

  // LLM 자동 생성 함수들
  const handleGeneratePrompt = async () => {
    if (!projectPersona) return;

    setIsGeneratingPrompt(true);
    try {
      const res = await fetch('/api/admin/marketing/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'image_prompt',
          persona_name: projectPersona.name,
          persona_description: '', // 캐릭터 설명이 있으면 추가
          template_label: templates[selectedTemplate]?.label || selectedTemplate,
          existing_prompt: customPrompt || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.result) {
        setCustomPrompt(data.result as string);
      } else {
        alert(data.error || '프롬프트 생성 실패');
      }
    } catch (error) {
      console.error('Failed to generate prompt:', error);
      alert('프롬프트 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleGenerateConcept = async () => {
    if (!projectPersona) return;

    setIsGeneratingConcept(true);
    try {
      const res = await fetch('/api/admin/marketing/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'marketing_concept',
          persona_name: projectPersona.name,
          persona_description: '',
          target_platform: project?.target_platform || 'meta',
          existing_prompt: marketingConcept || undefined,
        }),
      });

      const data = await res.json();
      if (data.success && data.result) {
        setMarketingConcept(data.result as string);
      } else {
        alert(data.error || '컨셉 생성 실패');
      }
    } catch (error) {
      console.error('Failed to generate concept:', error);
      alert('컨셉 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingConcept(false);
    }
  };

  const handleGenerateMarketingCopy = async () => {
    if (!projectPersona || !marketingConcept) {
      alert('마케팅 컨셉을 먼저 입력해주세요.');
      return;
    }

    setIsGeneratingCopy(true);
    try {
      const res = await fetch('/api/admin/marketing/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'marketing_copy',
          persona_name: projectPersona.name,
          concept: marketingConcept,
          cta_goal: ctaGoal || '앱 다운로드 및 첫 대화',
          target_platform: project?.target_platform || 'meta',
        }),
      });

      const data = await res.json();
      if (data.success && Array.isArray(data.result)) {
        // 문구 저장
        await saveMarketingCopies(data.result);
      } else {
        alert(data.error || '문구 생성 실패');
      }
    } catch (error) {
      console.error('Failed to generate copy:', error);
      alert('문구 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingCopy(false);
    }
  };

  const saveMarketingCopies = async (copies: Array<{ headline: string; body: string; cta: string }>) => {
    try {
      const res = await fetch('/api/admin/marketing/copies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          copies,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMarketingCopies(prev => [...data.copies, ...prev]);
      }
    } catch (error) {
      console.error('Failed to save copies:', error);
    }
  };

  const saveMarketingConcept = async () => {
    try {
      await fetch(`/api/admin/marketing/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketing_concept: marketingConcept || null,
          cta_goal: ctaGoal || null,
        }),
      });
      setProject(prev => prev ? { ...prev, marketing_concept: marketingConcept, cta_goal: ctaGoal } : null);
    } catch (error) {
      console.error('Failed to save marketing concept:', error);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleUpdateCopyStatus = async (copyId: string, status: string) => {
    try {
      await fetch(`/api/admin/marketing/copies/${copyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setMarketingCopies(prev =>
        prev.map(c => c.id === copyId ? { ...c, status: status as MarketingCopy['status'] } : c)
      );
    } catch (error) {
      console.error('Failed to update copy status:', error);
    }
  };

  const handleDeleteCopy = async (copyId: string) => {
    if (!confirm('이 문구를 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/admin/marketing/copies/${copyId}`, { method: 'DELETE' });
      setMarketingCopies(prev => prev.filter(c => c.id !== copyId));
    } catch (error) {
      console.error('Failed to delete copy:', error);
    }
  };

  const handleUpdateImageStatus = async (imageId: string, status: string) => {
    try {
      await fetch(`/api/admin/marketing/images/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, status: status as MarketingImage['status'] } : img
        )
      );
    } catch (error) {
      console.error('Failed to update image status:', error);
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('이 이미지를 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/admin/marketing/images/${imageId}`, { method: 'DELETE' });
      setImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (error) {
      console.error('Failed to delete image:', error);
    }
  };

  // 이미지를 베이스 이미지로 설정
  const handleSetAsBaseImage = async (imageUrl: string) => {
    try {
      const res = await fetch(`/api/admin/marketing/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_image_url: imageUrl,
        }),
      });

      if (res.ok) {
        setProject((prev) =>
          prev ? { ...prev, base_image_url: imageUrl } : null
        );
      }
    } catch (error) {
      console.error('Failed to set base image:', error);
    }
  };

  // 트리 뷰에서 베이스 이미지를 기반으로 다른 사이즈 생성
  const handleGenerateSizesFromBase = async (baseImageId: string, baseImageUrl: string) => {
    if (!projectPersona) {
      alert('캐릭터 정보가 없습니다.');
      return;
    }

    try {
      const res = await fetch('/api/admin/marketing/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          persona_id: projectPersona.id,
          persona_name: projectPersona.name,
          persona_data: getPersonaData(projectPersona.id),
          template: project?.base_template || 'romantic-chat',
          custom_prompt: project?.base_custom_prompt || undefined,
          generate_all_sizes: true,
          selected_base_image: baseImageUrl,
          selected_base_image_id: baseImageId, // 베이스 이미지 ID 추가
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Task creation failed');
      }

      // 태스크 탭으로 전환하고 목록 새로고침
      setActiveTab('tasks');
      loadTasks();
      loadProject();
    } catch (error) {
      console.error('Failed to generate sizes:', error);
      alert('사이즈 생성 태스크 생성에 실패했습니다.');
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await fetch(`/api/admin/marketing/tasks/${taskId}`, { method: 'DELETE' });
      loadTasks();
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  };

  // 특정 베이스 이미지와 그 파생 이미지들을 다운로드
  const handleDownloadBaseWithChildren = async (baseImage: MarketingImage) => {
    setIsDownloading(true);

    try {
      const zip = new JSZip();
      const relatedImages = getRelatedImages(baseImage);
      const allImages = [baseImage, ...relatedImages];

      for (const img of allImages) {
        try {
          const response = await fetch(img.image_url);
          const blob = await response.blob();
          const sizeLabel = sizes[img.ad_size]?.label || img.ad_size;
          zip.file(`${sizeLabel}_${img.id.slice(0, 8)}.png`, blob);
        } catch (e) {
          console.warn(`Failed to download image: ${img.image_url}`, e);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${baseImage.persona_name}_${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (error) {
      console.error('Failed to create zip:', error);
      alert('ZIP 파일 생성에 실패했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  // 베이스 이미지만 필터링 (is_base가 true이거나, feed-square이면서 parent가 없는 것)
  const baseImages = useMemo(() => {
    return images.filter((img) => {
      // is_base가 명시적으로 true인 경우
      if (img.is_base === true) return true;
      // feed-square이면서 parent가 없는 경우 (베이스 이미지로 간주)
      if (img.ad_size === 'feed-square' && !img.parent_image_id) return true;
      return false;
    });
  }, [images]);

  // 선택된 베이스 이미지의 파생 이미지들
  const getChildImages = useCallback((baseImageId: string) => {
    return images.filter((img) => img.parent_image_id === baseImageId);
  }, [images]);

  // 선택된 베이스 이미지와 동일한 generation_group의 이미지들
  const getRelatedImages = useCallback((baseImage: MarketingImage) => {
    if (baseImage.generation_group_id) {
      return images.filter(
        (img) => img.generation_group_id === baseImage.generation_group_id && img.id !== baseImage.id
      );
    }
    // generation_group이 없으면 parent_image_id로 연결된 이미지들 반환
    return images.filter((img) => img.parent_image_id === baseImage.id);
  }, [images]);


  const processingTasksCount = tasks.filter((t) => t.status === 'processing').length;

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">프로젝트를 찾을 수 없습니다.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/marketing')}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/marketing')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {/* 캐릭터 아바타 */}
            {project.persona_avatar_url ? (
              <img
                src={project.persona_avatar_url}
                alt={project.persona_name || ''}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : null}
            <div>
              <h1 className="text-xl font-semibold">{project.name}</h1>
              {project.persona_name && (
                <p className="text-xs text-muted-foreground">{project.persona_name}</p>
              )}
            </div>
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
          )}
        </div>
      </div>

      {/* Generate Dialog - 트리거 없이 상태로만 제어 */}
      <Dialog
        open={showGenerateDialog}
        onOpenChange={(open) => {
          setShowGenerateDialog(open);
          if (!open) resetGeneration();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {hasBaseImage ? '다른 사이즈 이미지 생성' : '베이스 이미지 생성'}
              </DialogTitle>
              <DialogDescription>
                {generationStep === 'select-persona' && (
                  hasBaseImage
                    ? '확정된 베이스 이미지를 기반으로 다른 사이즈 이미지를 생성합니다. 베이스 이미지를 변경하려면 재생성하세요.'
                    : isPersonaLocked
                      ? '템플릿을 선택하고 베이스 이미지를 생성하세요. (캐릭터는 고정되어 있습니다)'
                      : '캐릭터와 템플릿을 선택하고 베이스 이미지를 생성하세요.'
                )}
                {generationStep === 'generate-base' && '베이스 이미지를 생성하고 있습니다...'}
                {generationStep === 'confirm-base' && '베이스 이미지를 선택하세요. 마음에 들지 않으면 재생성할 수 있습니다.'}
              </DialogDescription>
            </DialogHeader>

            {/* Step 1: Select Persona & Template */}
            {generationStep === 'select-persona' && (
              <div className="space-y-6 mt-4">
                {/* 베이스 이미지가 있으면 표시 */}
                {hasBaseImage && projectBaseImage && (
                  <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                    <div className="flex items-start gap-4">
                      <img
                        src={projectBaseImage}
                        alt="Base Image"
                        className="w-24 h-24 rounded-lg object-cover"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-green-800">현재 베이스 이미지</h4>
                          <Badge variant="default" className="bg-green-600 text-xs">확정됨</Badge>
                        </div>
                        <p className="text-sm text-green-700 mb-2">
                          {project?.base_template && templates[project.base_template]?.label}
                        </p>
                        <p className="text-xs text-green-600">
                          이 이미지를 기반으로 다른 사이즈를 생성하거나, 아래에서 새로운 베이스 이미지를 생성할 수 있습니다.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Persona Selection - 캐릭터가 고정된 경우 수정 불가 */}
                <div>
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-medium">캐릭터</Label>
                    {isPersonaLocked && (
                      <Badge variant="secondary" className="text-xs">고정됨</Badge>
                    )}
                  </div>
                  <div
                    className={cn(
                      "mt-2 border rounded-lg p-3 transition-colors",
                      isPersonaLocked
                        ? "bg-muted/50 cursor-not-allowed"
                        : "cursor-pointer hover:border-primary"
                    )}
                    onClick={() => !isPersonaLocked && setShowPersonaDialog(true)}
                  >
                    {/* 고정된 캐릭터 표시 */}
                    {isPersonaLocked && projectPersona ? (
                      <div className="flex items-center gap-3">
                        {projectPersona.avatarUrl ? (
                          <img
                            src={projectPersona.avatarUrl}
                            alt={projectPersona.name}
                            className="w-12 h-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                            <span className="text-lg font-medium">{projectPersona.name.charAt(0)}</span>
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{projectPersona.name}</p>
                          <p className="text-xs text-muted-foreground">이 프로젝트의 모든 이미지는 이 캐릭터로 생성됩니다</p>
                        </div>
                      </div>
                    ) : selectedPersonaData ? (
                      <div className="flex items-center gap-3">
                        <img
                          src={selectedPersonaData.avatarUrl}
                          alt={selectedPersonaData.displayName}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div className="flex-1">
                          <p className="font-medium">{selectedPersonaData.displayName}</p>
                          <p className="text-sm text-muted-foreground">{selectedPersonaData.category}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>캐릭터를 선택하세요</span>
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Template Selection */}
                <div>
                  <Label>템플릿</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(templates).map(([key, tpl]) => (
                        <SelectItem key={key} value={key}>
                          {tpl.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Custom Prompt */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>추가 프롬프트 (선택)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGeneratePrompt}
                      disabled={isGeneratingPrompt || !projectPersona}
                      className="h-7 text-xs"
                    >
                      {isGeneratingPrompt ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3 mr-1" />
                      )}
                      AI 생성
                    </Button>
                  </div>
                  <Textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="추가적인 연출 지시... AI 생성 버튼을 눌러 자동으로 작성할 수 있습니다."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                {/* Marketing Concept */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>마케팅 컨셉</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleGenerateConcept}
                      disabled={isGeneratingConcept || !projectPersona}
                      className="h-7 text-xs"
                    >
                      {isGeneratingConcept ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3 mr-1" />
                      )}
                      AI 생성
                    </Button>
                  </div>
                  <Textarea
                    value={marketingConcept}
                    onChange={(e) => setMarketingConcept(e.target.value)}
                    onBlur={saveMarketingConcept}
                    placeholder="마케팅 컨셉을 입력하세요. 예: 외로운 밤, 당신만을 위한 대화 상대..."
                    className="mt-1"
                    rows={2}
                  />
                </div>

                {/* CTA Goal */}
                <div>
                  <Label>CTA 목표</Label>
                  <Input
                    value={ctaGoal}
                    onChange={(e) => setCtaGoal(e.target.value)}
                    onBlur={saveMarketingConcept}
                    placeholder="예: 앱 다운로드, 첫 대화 시작"
                    className="mt-1"
                  />
                </div>

                {/* Base Image Count */}
                <div>
                  <Label>베이스 이미지 생성 개수</Label>
                  <Select
                    value={String(baseImageCount)}
                    onValueChange={(v) => setBaseImageCount(Number(v))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1장</SelectItem>
                      <SelectItem value="2">2장</SelectItem>
                      <SelectItem value="3">3장</SelectItem>
                      <SelectItem value="4">4장</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Background Mode Toggle */}
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div>
                    <Label className="text-sm font-medium">백그라운드 생성</Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      창을 닫아도 생성이 계속됩니다. 생성 완료 후 태스크 탭에서 확인하세요.
                    </p>
                  </div>
                  <Switch
                    checked={useBackgroundMode}
                    onCheckedChange={setUseBackgroundMode}
                  />
                </div>

                {/* Actions */}
                <Button
                  onClick={handleGenerateBase}
                  disabled={!selectedPersona}
                  className="w-full"
                  size="lg"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  베이스 이미지 생성 ({baseImageCount}장)
                </Button>
              </div>
            )}

            {/* Step 2: Generating Base */}
            {generationStep === 'generate-base' && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <p className="text-lg font-medium">{generationProgress}</p>
                <p className="text-sm text-muted-foreground mt-2">잠시만 기다려주세요...</p>
                {useBackgroundMode && (
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => {
                      setShowGenerateDialog(false);
                      setActiveTab('tasks');
                    }}
                  >
                    창 닫고 백그라운드에서 계속
                  </Button>
                )}
              </div>
            )}

            {/* Step 3: Confirm Base */}
            {generationStep === 'confirm-base' && (
              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">베이스 이미지 선택</Label>
                  <Button variant="outline" size="sm" onClick={handleRegenerateBase} disabled={isGenerating}>
                    <RefreshCw className={cn('w-4 h-4 mr-2', isGenerating && 'animate-spin')} />
                    재생성
                  </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {generatedBaseImages.map((url, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all',
                        selectedGeneratedBaseImage === url
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-transparent hover:border-muted-foreground/30'
                      )}
                      onClick={() => setSelectedGeneratedBaseImage(url)}
                    >
                      <img
                        src={url}
                        alt={`Option ${idx + 1}`}
                        className="w-full aspect-square object-cover"
                      />
                      {selectedGeneratedBaseImage === url && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="absolute bottom-2 right-2 h-7 w-7 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(url, '_blank');
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleConfirmBaseOnly}
                  disabled={!selectedGeneratedBaseImage}
                  className="w-full"
                  size="lg"
                >
                  <Check className="w-4 h-4 mr-2" />
                  베이스 이미지 확정
                </Button>
              </div>
            )}

          </DialogContent>
        </Dialog>

      {/* Persona Selection Dialog */}
      <Dialog open={showPersonaDialog} onOpenChange={setShowPersonaDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>캐릭터 선택</DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="캐릭터 검색..."
              value={personaSearch}
              onChange={(e) => setPersonaSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px] -mx-6 px-6">
            <div className="space-y-2">
              {filteredPersonas.map((persona) => (
                <div
                  key={persona.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                    selectedPersona === persona.id
                      ? 'bg-primary/10 border border-primary'
                      : 'hover:bg-muted border border-transparent'
                  )}
                  onClick={() => {
                    setSelectedPersona(persona.id);
                    setShowPersonaDialog(false);
                  }}
                >
                  <img
                    src={persona.avatarUrl}
                    alt={persona.displayName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{persona.displayName}</p>
                    <p className="text-sm text-muted-foreground">{persona.category}</p>
                  </div>
                  {selectedPersona === persona.id && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </div>
              ))}
              {filteredPersonas.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Persona Info Section */}
      <div className="mb-6 p-4 border rounded-lg bg-muted/30">
        <div className="flex items-start gap-4">
          {/* Persona Profile Image */}
          <div className="w-32 h-40 rounded-lg overflow-hidden bg-muted flex-shrink-0 border">
            {selectedPersonaData?.avatarUrl ? (
              <img
                src={selectedPersonaData.avatarUrl}
                alt={selectedPersonaData.displayName}
                className="w-full h-full object-cover"
              />
            ) : projectPersona?.avatarUrl ? (
              <img
                src={projectPersona.avatarUrl}
                alt={projectPersona.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground">
                <ImageIcon className="w-8 h-8 mb-2" />
                <span className="text-xs">페르소나</span>
              </div>
            )}
          </div>

          {/* Persona Info & Actions */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold text-lg">
                {selectedPersonaData?.displayName || projectPersona?.name || '캐릭터 미선택'}
              </h3>
              {selectedPersonaData?.category && (
                <Badge variant="outline" className="text-xs">
                  {selectedPersonaData.category}
                </Badge>
              )}
            </div>

            {/* Persona Details */}
            {selectedPersonaData && (
              <div className="space-y-2 mb-3">
                {selectedPersonaData.age && (
                  <p className="text-sm text-muted-foreground">
                    {selectedPersonaData.age}세 {selectedPersonaData.ethnicity && `• ${selectedPersonaData.ethnicity}`}
                  </p>
                )}
                {selectedPersonaData.appearance && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">외형: </span>
                    <span className="text-foreground">
                      {typeof selectedPersonaData.appearance === 'object'
                        ? Object.entries(selectedPersonaData.appearance)
                            .slice(0, 3)
                            .map(([k, v]) => `${v}`)
                            .join(', ')
                        : String(selectedPersonaData.appearance)}
                    </span>
                  </div>
                )}
                {selectedPersonaData.corePersonality && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">성격: </span>
                    <span className="text-foreground">
                      {typeof selectedPersonaData.corePersonality === 'object'
                        ? Object.entries(selectedPersonaData.corePersonality)
                            .slice(0, 2)
                            .map(([k, v]) => typeof v === 'string' ? v : k)
                            .join(', ')
                        : String(selectedPersonaData.corePersonality)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {!selectedPersonaData && !projectPersona && (
              <p className="text-sm text-muted-foreground mb-3">
                이미지를 생성하려면 먼저 캐릭터를 선택하세요.
              </p>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => setShowGenerateDialog(true)}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                이미지 생성
              </Button>
              {selectedPersonaData && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPersonaDialog(true)}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  캐릭터 변경
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'images' | 'tasks' | 'copy')} className="mb-6">
        <TabsList>
          <TabsTrigger value="images">
            이미지 ({images.length})
          </TabsTrigger>
          <TabsTrigger value="copy">
            마케팅 문구 ({marketingCopies.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="relative">
            생성 태스크 ({tasks.length})
            {processingTasksCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {processingTasksCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Images Tab Content */}
      {activeTab === 'images' && (
        <>
          {/* Stats */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex gap-4 text-sm">
              <span className="text-muted-foreground">
                베이스: <strong>{baseImages.length}</strong>
              </span>
              <span className="text-muted-foreground">
                전체: <strong>{images.length}</strong>
              </span>
            </div>
          </div>

          {/* Base Images Grid */}
          {baseImages.length === 0 ? (
            <div className="text-center py-16 border rounded-lg bg-muted/30">
              <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">
                아직 베이스 이미지가 없습니다
              </p>
              <Button onClick={() => setShowGenerateDialog(true)}>
                <Sparkles className="w-4 h-4 mr-2" />
                첫 베이스 이미지 생성하기
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {baseImages.map((image) => {
                const childImages = getRelatedImages(image);
                const childCount = childImages.length;
                const isProjectBase = projectBaseImage === image.image_url;

                return (
                  <div
                    key={image.id}
                    className={cn(
                      'border rounded-lg overflow-hidden group relative cursor-pointer transition-all hover:ring-2 hover:ring-primary/50',
                      isProjectBase && 'ring-2 ring-primary border-primary'
                    )}
                    onClick={() => {
                      setSelectedBaseImageForPopup(image);
                      setIsDetailPopupOpen(true);
                    }}
                  >
                    {/* 프로젝트 베이스 이미지 표시 */}
                    {isProjectBase && (
                      <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                        <Pin className="w-3 h-3" />
                        메인
                      </div>
                    )}

                    {/* 파생 이미지 개수 표시 */}
                    {childCount > 0 && (
                      <div className="absolute top-2 right-2 z-10 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium">
                        +{childCount}
                      </div>
                    )}

                    <div className="aspect-square">
                      <img
                        src={image.image_url}
                        alt={image.persona_name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUploadToMeta(image);
                          }}
                          disabled={isUploadingMeta}
                        >
                          {isUploadingMeta ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-1" />}
                          Meta
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBaseImageForPopup(image);
                            setIsDetailPopupOpen(true);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          상세
                        </Button>
                      </div>
                    </div>

                    <div className="p-2 text-xs">
                      <span className="font-medium truncate block">{image.persona_name}</span>
                      <p className="text-muted-foreground mt-1 truncate">
                        {childCount > 0 ? `${childCount + 1}개 사이즈` : '베이스만'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Base Image Detail Popup - Full Screen Style */}
      <Dialog open={isDetailPopupOpen} onOpenChange={setIsDetailPopupOpen}>
        <DialogContent className="max-w-[95vw] w-full max-h-[95vh] overflow-y-auto">
          {selectedBaseImage && (() => {
            const relatedImages = getRelatedImages(selectedBaseImage);
            const allImages = [selectedBaseImage, ...relatedImages];
            const isProjectBase = projectBaseImage === selectedBaseImage.image_url;

            // 비율별로 이미지 그룹핑
            const imagesByRatio = allImages.reduce((acc, img) => {
              const ratio = img.ad_size;
              if (!acc[ratio]) acc[ratio] = [];
              acc[ratio].push(img);
              return acc;
            }, {} as Record<string, MarketingImage[]>);

            // 비율 순서 정의
            const ratioOrder = ['feed-square', 'feed-portrait', 'story', 'carousel'];
            const sortedRatios = Object.keys(imagesByRatio).sort(
              (a, b) => ratioOrder.indexOf(a) - ratioOrder.indexOf(b)
            );

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-xl">
                    {selectedBaseImage.persona_name}
                    {isProjectBase && (
                      <Badge className="bg-primary text-primary-foreground">메인 베이스</Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-base">
                    {allImages.length}개 이미지 • {sortedRatios.length}개 비율
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* 액션 버튼 */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleDownloadBaseWithChildren(selectedBaseImage)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      전체 다운로드 ({allImages.length}개)
                    </Button>
                    {!isProjectBase && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleSetAsBaseImage(selectedBaseImage.image_url);
                          setIsDetailPopupOpen(false);
                        }}
                      >
                        <Pin className="w-4 h-4 mr-2" />
                        메인으로 설정
                      </Button>
                    )}
                    {relatedImages.length < Object.keys(sizes).length - 1 && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          handleGenerateSizesFromBase(selectedBaseImage.id, selectedBaseImage.image_url);
                          setIsDetailPopupOpen(false);
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        추가 사이즈 생성
                      </Button>
                    )}
                  </div>

                  {/* 비율별 이미지 섹션 */}
                  <div className="space-y-8">
                    {sortedRatios.map((ratio) => {
                      const ratioImages = imagesByRatio[ratio];
                      const sizeInfo = sizes[ratio];

                      return (
                        <div key={ratio} className="space-y-3">
                          {/* 비율 헤더 */}
                          <div className="flex items-center gap-3 pb-2 border-b">
                            <h3 className="text-lg font-semibold">
                              {sizeInfo?.label || ratio}
                            </h3>
                            <Badge variant="outline">
                              {sizeInfo?.width || '?'} x {sizeInfo?.height || '?'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {ratioImages.length}개
                            </span>
                          </div>

                          {/* 이미지 그리드 - 비율에 맞게 표시 */}
                          <div className={cn(
                            'grid gap-4',
                            ratio === 'story'
                              ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
                              : ratio === 'feed-portrait'
                                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'
                                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                          )}>
                            {ratioImages.map((img) => (
                              <div
                                key={img.id}
                                className="group relative border rounded-lg overflow-hidden bg-muted/30"
                              >
                                {/* 실제 비율로 이미지 표시 */}
                                <div
                                  className="relative w-full"
                                  style={{
                                    aspectRatio: sizeInfo
                                      ? `${sizeInfo.width} / ${sizeInfo.height}`
                                      : '1 / 1'
                                  }}
                                >
                                  <img
                                    src={img.image_url}
                                    alt={img.persona_name}
                                    className="absolute inset-0 w-full h-full object-cover"
                                  />

                                  {/* Hover Overlay */}
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="h-8 w-8 p-0"
                                      onClick={() => window.open(img.image_url, '_blank')}
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      className="h-8 w-8 p-0 text-destructive hover:bg-destructive/20"
                                      onClick={() => {
                                        handleDeleteImage(img.id);
                                        if (img.id === selectedBaseImage.id) {
                                          setIsDetailPopupOpen(false);
                                        }
                                      }}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Marketing Copy Tab Content */}
      {activeTab === 'copy' && (
        <div className="space-y-6">
          {/* 마케팅 컨셉 입력 섹션 */}
          <div className="p-4 border rounded-lg bg-muted/30">
            <h3 className="font-medium mb-4 flex items-center gap-2">
              <PenTool className="w-4 h-4" />
              마케팅 컨셉 설정
            </h3>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>마케팅 컨셉</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateConcept}
                    disabled={isGeneratingConcept || !projectPersona}
                    className="h-7 text-xs"
                  >
                    {isGeneratingConcept ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3 mr-1" />
                    )}
                    AI 생성
                  </Button>
                </div>
                <Textarea
                  value={marketingConcept}
                  onChange={(e) => setMarketingConcept(e.target.value)}
                  onBlur={saveMarketingConcept}
                  placeholder="마케팅 컨셉을 입력하세요. 예: 외로운 밤, 당신만을 위한 대화 상대..."
                  rows={2}
                />
              </div>

              <div>
                <Label>CTA 목표</Label>
                <Input
                  value={ctaGoal}
                  onChange={(e) => setCtaGoal(e.target.value)}
                  onBlur={saveMarketingConcept}
                  placeholder="예: 앱 다운로드, 첫 대화 시작"
                  className="mt-1"
                />
              </div>

              <Button
                onClick={handleGenerateMarketingCopy}
                disabled={isGeneratingCopy || !marketingConcept}
                className="w-full"
              >
                {isGeneratingCopy ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4 mr-2" />
                )}
                마케팅 문구 생성 (3개 버전)
              </Button>
            </div>
          </div>

          {/* 생성된 문구 목록 */}
          {marketingCopies.length === 0 ? (
            <div className="text-center py-16 border rounded-lg bg-muted/30">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-4">아직 생성된 마케팅 문구가 없습니다</p>
              <p className="text-sm text-muted-foreground">
                위에서 마케팅 컨셉을 설정하고 문구를 생성해보세요
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">생성된 문구 ({marketingCopies.length}개)</h3>
              </div>

              <div className="grid gap-4">
                {marketingCopies.map((copy) => (
                  <div
                    key={copy.id}
                    className={cn(
                      'p-4 border rounded-lg',
                      copy.status === 'approved' && 'border-green-300 bg-green-50/50',
                      copy.status === 'rejected' && 'border-red-300 bg-red-50/50 opacity-60'
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            copy.status === 'approved' && 'bg-green-100 text-green-800',
                            copy.status === 'rejected' && 'bg-red-100 text-red-800',
                            copy.status === 'used' && 'bg-purple-100 text-purple-800'
                          )}
                        >
                          {copy.status === 'generated' && '검토중'}
                          {copy.status === 'approved' && '승인됨'}
                          {copy.status === 'rejected' && '거절됨'}
                          {copy.status === 'used' && '사용됨'}
                        </Badge>
                        {copy.variation_type && (
                          <span className="text-xs text-muted-foreground">{copy.variation_type}</span>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={copy.status === 'approved' ? 'default' : 'outline'}
                          className="h-7 px-2"
                          onClick={() => handleUpdateCopyStatus(copy.id, 'approved')}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant={copy.status === 'rejected' ? 'destructive' : 'outline'}
                          className="h-7 px-2"
                          onClick={() => handleUpdateCopyStatus(copy.id, 'rejected')}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => handleDeleteCopy(copy.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Headline */}
                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">헤드라인</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => handleCopyToClipboard(copy.headline)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="font-medium">{copy.headline}</p>
                      </div>

                      {/* Body */}
                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">본문</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => handleCopyToClipboard(copy.body)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">{copy.body}</p>
                      </div>

                      {/* CTA */}
                      <div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">CTA 버튼</Label>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => handleCopyToClipboard(copy.cta)}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                        <Badge variant="outline" className="mt-1">{copy.cta}</Badge>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                      생성: {new Date(copy.created_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tasks Tab Content */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {tasks.length === 0 ? (
            <div className="text-center py-16 border rounded-lg bg-muted/30">
              <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">아직 생성 태스크가 없습니다</p>
            </div>
          ) : (
            tasks.map((task) => {
              const statusInfo = TASK_STATUS_LABELS[task.status];
              const completedSizes = Object.values(task.size_tasks).filter(
                (st) => st.status === 'completed'
              ).length;
              const totalSizes = Object.keys(task.size_tasks).length;

              return (
                <div key={task.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.persona_name}</span>
                        <Badge variant="outline" className={statusInfo?.color}>
                          {statusInfo?.icon}
                          <span className="ml-1">{statusInfo?.label}</span>
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {templates[task.template]?.label || task.template} •
                        {new Date(task.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    {task.status === 'processing' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancelTask(task.id)}
                      >
                        취소
                      </Button>
                    )}
                  </div>

                  {/* Size Tasks Progress */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(task.size_tasks).map(([sizeKey, sizeTask]) => (
                      <div
                        key={sizeKey}
                        className={cn(
                          'p-2 rounded text-xs border',
                          sizeTask.status === 'completed' && 'bg-green-50 border-green-200',
                          sizeTask.status === 'processing' && 'bg-blue-50 border-blue-200',
                          sizeTask.status === 'failed' && 'bg-red-50 border-red-200',
                          sizeTask.status === 'pending' && 'bg-gray-50 border-gray-200'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{sizes[sizeKey]?.label || sizeKey}</span>
                          {sizeTask.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                          {sizeTask.status === 'processing' && <Loader2 className="w-3 h-3 animate-spin text-blue-600" />}
                          {sizeTask.status === 'failed' && <XCircle className="w-3 h-3 text-red-600" />}
                          {sizeTask.status === 'pending' && <Clock className="w-3 h-3 text-gray-400" />}
                        </div>
                        {sizeTask.images.length > 0 && (
                          <div className="mt-2">
                            <div className="flex gap-1 flex-wrap">
                              {sizeTask.images.slice(0, 4).map((imgUrl, idx) => (
                                <img
                                  key={idx}
                                  src={imgUrl}
                                  alt={`Generated ${idx + 1}`}
                                  className="w-10 h-10 rounded object-cover cursor-pointer hover:ring-2 hover:ring-primary"
                                  onClick={() => window.open(imgUrl, '_blank')}
                                />
                              ))}
                              {sizeTask.images.length > 4 && (
                                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xs">
                                  +{sizeTask.images.length - 4}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        {sizeTask.error && (
                          <p className="text-red-600 mt-1 truncate">{sizeTask.error}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 선택된 베이스 이미지 표시 */}
                  {task.selected_base_image && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">베이스 이미지:</span>
                        <img
                          src={task.selected_base_image}
                          alt="Base"
                          className="w-12 h-12 rounded object-cover cursor-pointer hover:ring-2 hover:ring-primary"
                          onClick={() => window.open(task.selected_base_image!, '_blank')}
                        />
                      </div>
                    </div>
                  )}

                  {task.status === 'completed' && (
                    <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                      {completedSizes}/{totalSizes} 사이즈 완료 •
                      완료: {task.completed_at && new Date(task.completed_at).toLocaleString('ko-KR')}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

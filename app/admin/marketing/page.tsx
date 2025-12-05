'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Loader2,
  FolderOpen,
  MoreVertical,
  Trash2,
  Image as ImageIcon,
  Calendar,
  Target,
  Search,
  Check,
  ChevronRight,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase-browser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MarketingProject {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'completed' | 'archived';
  target_platform: 'meta' | 'google' | 'tiktok' | 'all';
  created_at: string;
  updated_at: string;
  image_count: number;
  // 캐릭터 정보
  persona_id: string | null;
  persona_name: string | null;
  persona_avatar_url: string | null;
  // 베이스 이미지
  base_image_url: string | null;
}

interface Persona {
  id: string;
  name: string;
  displayName: string;
  avatarUrl: string;
  category: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  meta: 'Meta (Facebook/Instagram)',
  google: 'Google Ads',
  tiktok: 'TikTok',
  all: '전체 플랫폼',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: '진행중', color: 'bg-green-100 text-green-800' },
  completed: { label: '완료', color: 'bg-blue-100 text-blue-800' },
  archived: { label: '보관', color: 'bg-gray-100 text-gray-800' },
};

export default function MarketingPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<MarketingProject[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPersonaDialog, setShowPersonaDialog] = useState(false);
  const [personaSearch, setPersonaSearch] = useState('');

  // 새 프로젝트 폼
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    target_platform: 'meta',
    persona_id: '',
    persona_name: '',
    persona_avatar_url: '',
  });

  useEffect(() => {
    Promise.all([loadProjects(), loadPersonas()]).finally(() => {
      setIsLoading(false);
    });
  }, []);

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
    return personas.find((p) => p.id === newProject.persona_id);
  }, [personas, newProject.persona_id]);

  async function loadProjects() {
    try {
      const res = await fetch('/api/admin/marketing/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }

  async function loadPersonas() {
    try {
      // persona_core 테이블에서 직접 조회 (어드민용)
      const supabase = createClient();
      const { data, error } = await supabase
        .from('persona_core')
        .select('id, name, full_name, role, profile_image_url, status')
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
      }));
      setPersonas(mappedPersonas);
    } catch (error) {
      console.error('Failed to load personas:', error);
    }
  }

  async function handleCreateProject() {
    if (!newProject.name.trim() || !newProject.persona_id) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/admin/marketing/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProject),
      });

      const data = await res.json();
      if (data.project) {
        setProjects(prev => [{ ...data.project, image_count: 0 }, ...prev]);
        setShowCreateDialog(false);
        setNewProject({
          name: '',
          description: '',
          target_platform: 'meta',
          persona_id: '',
          persona_name: '',
          persona_avatar_url: '',
        });
        router.push(`/admin/marketing/${data.project.id}`);
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteProject(id: string) {
    if (!confirm('이 프로젝트를 삭제하시겠습니까? 모든 이미지도 함께 삭제됩니다.')) return;

    try {
      await fetch(`/api/admin/marketing/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }

  async function handleUpdateStatus(id: string, status: string) {
    try {
      await fetch(`/api/admin/marketing/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setProjects(prev =>
        prev.map(p => (p.id === id ? { ...p, status: status as MarketingProject['status'] } : p))
      );
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">마케팅 프로젝트</h1>
          <p className="text-sm text-muted-foreground mt-1">
            광고 캠페인별로 이미지를 관리하세요
          </p>
        </div>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              새 프로젝트
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 마케팅 프로젝트</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {/* 캐릭터 선택 (필수) */}
              <div>
                <Label className="flex items-center gap-1">
                  캐릭터 <span className="text-red-500">*</span>
                </Label>
                <div
                  className="mt-1 border rounded-lg p-3 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => setShowPersonaDialog(true)}
                >
                  {selectedPersonaData ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={selectedPersonaData.avatarUrl}
                        alt={selectedPersonaData.displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{selectedPersonaData.displayName}</p>
                        <p className="text-sm text-muted-foreground">{selectedPersonaData.category}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="w-5 h-5" />
                        <span>캐릭터를 선택하세요</span>
                      </div>
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  프로젝트 생성 후에는 캐릭터를 변경할 수 없습니다.
                </p>
              </div>

              <div>
                <Label>프로젝트명</Label>
                <Input
                  value={newProject.name}
                  onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 12월 크리스마스 캠페인"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>설명 (선택)</Label>
                <Textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="캠페인 목표, 타겟 등..."
                  className="mt-1"
                  rows={2}
                />
              </div>
              <div>
                <Label>타겟 플랫폼</Label>
                <Select
                  value={newProject.target_platform}
                  onValueChange={(v) => setNewProject(prev => ({ ...prev, target_platform: v }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Meta (Facebook/Instagram)</SelectItem>
                    <SelectItem value="google">Google Ads</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="all">전체 플랫폼</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleCreateProject}
                disabled={!newProject.name.trim() || !newProject.persona_id || isCreating}
                className="w-full"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                프로젝트 생성
              </Button>
            </div>
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
                      newProject.persona_id === persona.id
                        ? 'bg-primary/10 border border-primary'
                        : 'hover:bg-muted border border-transparent'
                    )}
                    onClick={() => {
                      setNewProject(prev => ({
                        ...prev,
                        persona_id: persona.id,
                        persona_name: persona.displayName || persona.name,
                        persona_avatar_url: persona.avatarUrl,
                      }));
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
                    {newProject.persona_id === persona.id && (
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
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-muted/30">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground mb-4">아직 프로젝트가 없습니다</p>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            첫 프로젝트 만들기
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <div
              key={project.id}
              className="border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={() => router.push(`/admin/marketing/${project.id}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* 캐릭터 아바타 */}
                  {project.persona_avatar_url ? (
                    <img
                      src={project.persona_avatar_url}
                      alt={project.persona_name || ''}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{project.name}</h3>
                    {project.persona_name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {project.persona_name}
                      </p>
                    )}
                    {project.description && (
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {project.description}
                      </p>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateStatus(project.id, 'active');
                    }}>
                      진행중으로 변경
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateStatus(project.id, 'completed');
                    }}>
                      완료로 변경
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateStatus(project.id, 'archived');
                    }}>
                      보관으로 변경
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteProject(project.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      삭제
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className={`px-2 py-0.5 rounded-full ${STATUS_LABELS[project.status]?.color}`}>
                  {STATUS_LABELS[project.status]?.label}
                </span>
                <span className="flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {PLATFORM_LABELS[project.target_platform]}
                </span>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  {project.image_count}개 이미지
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(project.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

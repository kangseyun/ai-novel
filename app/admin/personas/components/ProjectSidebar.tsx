'use client';

import React, { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  User,
  GripVertical,
  FolderPlus,
  Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Types
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
  display_name: string;
  avatar_url: string | null;
  project_id: string | null;
  target_audience: 'female' | 'male' | 'anime' | null;
}

interface ProjectSidebarProps {
  projects: Project[];
  personas: Persona[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  onCreateProject: (project: Partial<Project>) => Promise<void>;
  onUpdateProject: (project: Project) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onMovePersona: (personaId: string, projectId: string | null) => Promise<void>;
  onReorderProjects?: (projectIds: string[]) => Promise<void>;
}

// Color palette for projects
const PROJECT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#71717a', '#78716c',
];

// Icon options for projects
const PROJECT_ICONS = ['📁', '📂', '🗂️', '💼', '🎯', '⭐', '🔥', '💎', '🎨', '🎭', '💫', '🌟', '🚀', '💡', '🎬', '📱', '💬', '❤️', '🌸', '🌙'];

// Draggable Persona Item
function DraggablePersonaItem({
  persona,
  isDragging,
}: {
  persona: Persona;
  isDragging?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: `persona-${persona.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer hover:bg-gray-100 group ml-4',
        isDragging && 'opacity-50'
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 cursor-grab" />
      {persona.avatar_url ? (
        <img
          src={persona.avatar_url}
          alt={persona.name}
          className="w-5 h-5 rounded-full object-cover"
        />
      ) : (
        <User className="w-5 h-5 text-gray-400" />
      )}
      <span className="truncate text-gray-700">{persona.display_name || persona.name}</span>
    </div>
  );
}

// Project Tree Item
function ProjectTreeItem({
  project,
  personas,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onEdit,
  onDelete,
  onArchive,
}: {
  project: Project;
  personas: Persona[];
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isOver,
  } = useSortable({ id: `project-${project.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const personaCount = personas.length;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group transition-colors',
          isSelected ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100',
          isOver && 'bg-blue-100 ring-1 ring-blue-400'
        )}
        onClick={onSelect}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="p-0.5 hover:bg-gray-200 rounded"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        <div
          className="cursor-grab opacity-0 group-hover:opacity-100"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>

        <span className="text-lg">{project.icon}</span>

        <span
          className="flex-1 truncate font-medium text-sm"
          style={{ color: project.color }}
        >
          {project.name}
        </span>

        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-gray-100 text-gray-600">
          {personaCount}
        </Badge>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <button className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded">
              <MoreHorizontal className="w-4 h-4 text-gray-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-2" />
              수정
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="w-4 h-4 mr-2" />
              {project.status === 'archived' ? '활성화' : '보관'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-500">
              <Trash2 className="w-4 h-4 mr-2" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isExpanded && (
        <div className="mt-1 space-y-0.5">
          <SortableContext
            items={personas.map((p) => `persona-${p.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {personas.map((persona) => (
              <DraggablePersonaItem key={persona.id} persona={persona} />
            ))}
          </SortableContext>
          {personas.length === 0 && (
            <div className="ml-8 text-xs text-gray-400 py-1">
              페르소나 없음
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main Sidebar Component
export default function ProjectSidebar({
  projects,
  personas,
  selectedProjectId,
  onSelectProject,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onMovePersona,
  onReorderProjects,
}: ProjectSidebarProps) {
  // State
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [draggedPersona, setDraggedPersona] = useState<Persona | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#6366f1');
  const [formIcon, setFormIcon] = useState('📁');
  const [formTargetAudience, setFormTargetAudience] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Filter projects
  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active').sort((a, b) => a.sort_order - b.sort_order),
    [projects]
  );

  const archivedProjects = useMemo(
    () => projects.filter((p) => p.status === 'archived').sort((a, b) => a.sort_order - b.sort_order),
    [projects]
  );

  // Group personas by project
  const personasByProject = useMemo(() => {
    const grouped: Record<string, Persona[]> = { uncategorized: [] };
    projects.forEach((p) => {
      grouped[p.id] = [];
    });
    personas.forEach((persona) => {
      if (persona.project_id && grouped[persona.project_id]) {
        grouped[persona.project_id].push(persona);
      } else {
        grouped.uncategorized.push(persona);
      }
    });
    return grouped;
  }, [projects, personas]);

  // Toggle project expansion
  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Open create dialog
  const handleOpenCreate = () => {
    setFormName('');
    setFormDescription('');
    setFormColor('#6366f1');
    setFormIcon('📁');
    setFormTargetAudience('all');
    setIsCreateDialogOpen(true);
  };

  // Open edit dialog
  const handleOpenEdit = (project: Project) => {
    setEditingProject(project);
    setFormName(project.name);
    setFormDescription(project.description || '');
    setFormColor(project.color);
    setFormIcon(project.icon);
    setFormTargetAudience(project.target_audience || 'all');
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const handleOpenDelete = (project: Project) => {
    setDeletingProject(project);
    setIsDeleteDialogOpen(true);
  };

  // Create project
  const handleCreate = async () => {
    if (!formName.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreateProject({
        name: formName.trim(),
        description: formDescription.trim() || null,
        color: formColor,
        icon: formIcon,
        target_audience: formTargetAudience === 'all' ? null : formTargetAudience as 'female' | 'male' | 'anime',
        status: 'active',
        sort_order: activeProjects.length,
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update project
  const handleUpdate = async () => {
    if (!editingProject || !formName.trim()) return;
    setIsSubmitting(true);
    try {
      await onUpdateProject({
        ...editingProject,
        name: formName.trim(),
        description: formDescription.trim() || null,
        color: formColor,
        icon: formIcon,
        target_audience: formTargetAudience === 'all' ? null : formTargetAudience as 'female' | 'male' | 'anime',
      });
      setIsEditDialogOpen(false);
      setEditingProject(null);
    } catch (error) {
      console.error('Failed to update project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete project
  const handleDelete = async () => {
    if (!deletingProject) return;
    setIsSubmitting(true);
    try {
      await onDeleteProject(deletingProject.id);
      setIsDeleteDialogOpen(false);
      setDeletingProject(null);
      if (selectedProjectId === deletingProject.id) {
        onSelectProject(null);
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle archive status
  const handleToggleArchive = async (project: Project) => {
    try {
      await onUpdateProject({
        ...project,
        status: project.status === 'archived' ? 'active' : 'archived',
      });
    } catch (error) {
      console.error('Failed to toggle archive:', error);
    }
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = String(active.id);
    if (activeId.startsWith('persona-')) {
      const personaId = activeId.replace('persona-', '');
      const persona = personas.find((p) => p.id === personaId);
      if (persona) {
        setDraggedPersona(persona);
      }
    }
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedPersona(null);

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Dragging persona to project
    if (activeId.startsWith('persona-') && overId.startsWith('project-')) {
      const personaId = activeId.replace('persona-', '');
      const projectId = overId.replace('project-', '');
      await onMovePersona(personaId, projectId);
    }

    // Dragging persona to uncategorized
    if (activeId.startsWith('persona-') && overId === 'uncategorized') {
      const personaId = activeId.replace('persona-', '');
      await onMovePersona(personaId, null);
    }

    // Reordering projects
    if (activeId.startsWith('project-') && overId.startsWith('project-') && onReorderProjects) {
      const activeProjectId = activeId.replace('project-', '');
      const overProjectId = overId.replace('project-', '');
      if (activeProjectId !== overProjectId) {
        const oldIndex = activeProjects.findIndex((p) => p.id === activeProjectId);
        const newIndex = activeProjects.findIndex((p) => p.id === overProjectId);
        const newOrder = [...activeProjects];
        const [moved] = newOrder.splice(oldIndex, 1);
        newOrder.splice(newIndex, 0, moved);
        await onReorderProjects(newOrder.map((p) => p.id));
      }
    }
  };

  return (
    <div className="w-64 h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Folder className="w-4 h-4" />
            프로젝트
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenCreate}
            className="h-7 px-2 hover:bg-gray-100"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* All Personas */}
          <div
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
              selectedProjectId === null ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100'
            )}
            onClick={() => onSelectProject(null)}
          >
            <Users className="w-4 h-4 text-gray-500" />
            <span className="flex-1 font-medium text-sm text-gray-700">전체 페르소나</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-gray-100 text-gray-600">
              {personas.length}
            </Badge>
          </div>

          {/* Uncategorized */}
          <div
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer',
              selectedProjectId === 'uncategorized' ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-100'
            )}
            onClick={() => onSelectProject('uncategorized')}
            id="uncategorized"
          >
            <FolderOpen className="w-4 h-4 text-gray-400" />
            <span className="flex-1 font-medium text-sm text-gray-500">미분류</span>
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-gray-100 text-gray-600">
              {personasByProject.uncategorized?.length || 0}
            </Badge>
          </div>

          <div className="my-2 border-t border-gray-200" />

          {/* Active Projects */}
          <SortableContext
            items={activeProjects.map((p) => `project-${p.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {activeProjects.map((project) => (
              <ProjectTreeItem
                key={project.id}
                project={project}
                personas={personasByProject[project.id] || []}
                isExpanded={expandedProjects.has(project.id)}
                isSelected={selectedProjectId === project.id}
                onToggle={() => toggleProject(project.id)}
                onSelect={() => onSelectProject(project.id)}
                onEdit={() => handleOpenEdit(project)}
                onDelete={() => handleOpenDelete(project)}
                onArchive={() => handleToggleArchive(project)}
              />
            ))}
          </SortableContext>

          {/* Archived Projects */}
          {archivedProjects.length > 0 && (
            <>
              <div className="my-2 border-t border-gray-200" />
              <button
                className="flex items-center gap-2 px-2 py-1.5 w-full text-left text-gray-400 hover:text-gray-600"
                onClick={() => setShowArchived(!showArchived)}
              >
                {showArchived ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <Archive className="w-4 h-4" />
                <span className="text-sm">보관된 프로젝트</span>
                <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5 bg-gray-100 text-gray-600 ml-auto">
                  {archivedProjects.length}
                </Badge>
              </button>
              {showArchived && (
                <div className="space-y-1 ml-2">
                  {archivedProjects.map((project) => (
                    <ProjectTreeItem
                      key={project.id}
                      project={project}
                      personas={personasByProject[project.id] || []}
                      isExpanded={expandedProjects.has(project.id)}
                      isSelected={selectedProjectId === project.id}
                      onToggle={() => toggleProject(project.id)}
                      onSelect={() => onSelectProject(project.id)}
                      onEdit={() => handleOpenEdit(project)}
                      onDelete={() => handleOpenDelete(project)}
                      onArchive={() => handleToggleArchive(project)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Drag Overlay */}
          <DragOverlay>
            {draggedPersona && (
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white shadow-lg border border-gray-200 text-sm">
                {draggedPersona.avatar_url ? (
                  <img
                    src={draggedPersona.avatar_url}
                    alt={draggedPersona.name}
                    className="w-5 h-5 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-5 h-5 text-gray-400" />
                )}
                <span className="text-gray-700">
                  {draggedPersona.display_name || draggedPersona.name}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Create New Project Button */}
      <div className="p-3 border-t border-gray-200 bg-white">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-gray-600 border-gray-300 hover:bg-gray-50"
          onClick={handleOpenCreate}
        >
          <FolderPlus className="w-4 h-4" />
          새 프로젝트 만들기
        </Button>
      </div>

      {/* Create Project Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">새 프로젝트 만들기</DialogTitle>
            <DialogDescription className="text-gray-500">
              페르소나를 그룹화할 새 프로젝트를 만듭니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-700">프로젝트 이름</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="프로젝트 이름 입력"
                className="bg-white border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-700">설명</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="프로젝트 설명 (선택)"
                rows={2}
                className="bg-white border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">아이콘</Label>
              <div className="flex flex-wrap gap-1">
                {PROJECT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded flex items-center justify-center text-lg hover:bg-gray-100',
                      formIcon === icon && 'bg-blue-50 ring-2 ring-blue-500'
                    )}
                    onClick={() => setFormIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">색상</Label>
              <div className="flex flex-wrap gap-1">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      'w-6 h-6 rounded-full',
                      formColor === color && 'ring-2 ring-offset-2 ring-offset-white ring-blue-500'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="targetAudience" className="text-gray-700">타겟 오디언스</Label>
              <Select value={formTargetAudience} onValueChange={setFormTargetAudience}>
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="female">여성향</SelectItem>
                  <SelectItem value="male">남성향</SelectItem>
                  <SelectItem value="anime">애니</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="border-gray-300">
              취소
            </Button>
            <Button onClick={handleCreate} disabled={!formName.trim() || isSubmitting}>
              {isSubmitting ? '생성 중...' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">프로젝트 수정</DialogTitle>
            <DialogDescription className="text-gray-500">
              프로젝트 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name" className="text-gray-700">프로젝트 이름</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="프로젝트 이름 입력"
                className="bg-white border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-gray-700">설명</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="프로젝트 설명 (선택)"
                rows={2}
                className="bg-white border-gray-300"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">아이콘</Label>
              <div className="flex flex-wrap gap-1">
                {PROJECT_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={cn(
                      'w-8 h-8 rounded flex items-center justify-center text-lg hover:bg-gray-100',
                      formIcon === icon && 'bg-blue-50 ring-2 ring-blue-500'
                    )}
                    onClick={() => setFormIcon(icon)}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-gray-700">색상</Label>
              <div className="flex flex-wrap gap-1">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      'w-6 h-6 rounded-full',
                      formColor === color && 'ring-2 ring-offset-2 ring-offset-white ring-blue-500'
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => setFormColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-targetAudience" className="text-gray-700">타겟 오디언스</Label>
              <Select value={formTargetAudience} onValueChange={setFormTargetAudience}>
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="female">여성향</SelectItem>
                  <SelectItem value="male">남성향</SelectItem>
                  <SelectItem value="anime">애니</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="border-gray-300">
              취소
            </Button>
            <Button onClick={handleUpdate} disabled={!formName.trim() || isSubmitting}>
              {isSubmitting ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-900">프로젝트 삭제</DialogTitle>
            <DialogDescription className="text-gray-500">
              정말로 &ldquo;{deletingProject?.name}&rdquo; 프로젝트를 삭제하시겠습니까?
              <br />
              이 프로젝트에 속한 페르소나는 미분류로 이동됩니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} className="border-gray-300">
              취소
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
              {isSubmitting ? '삭제 중...' : '삭제'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

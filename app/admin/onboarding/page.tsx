'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  GripVertical,
  Trash2,
  Settings,
  Eye,
  Loader2,
  Save,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingPersona {
  id: string;
  persona_id: string;
  display_name: { ko: string; en: string };
  teaser_line: { ko: string; en: string };
  onboarding_image_url: string | null;
  theme_color: string;
  display_order: number;
  is_active: boolean;
  onboarding_scenario_id: string | null;
  persona_core?: {
    name: string;
    full_name: string;
    profile_image_url: string | null;
  };
}

interface PersonaCore {
  id: string;
  name: string;
  full_name: string;
  first_scenario_id: string | null;
}

interface ScenarioTemplate {
  id: string;
  title: string;
  persona_id: string;
  scenario_type: string;
}

interface OnboardingSettings {
  variant_weights: { A: number; B: number };
  default_variant: string;
  show_skip_button: boolean;
  max_personas_display: number;
}

function SortableRow({ persona, onEdit, onDelete, onToggleActive }: {
  persona: OnboardingPersona;
  onEdit: (p: OnboardingPersona) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: persona.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // onboarding_image_url을 우선 사용, 없으면 persona_core.profile_image_url 폴백
  const displayImage = persona.onboarding_image_url || persona.persona_core?.profile_image_url;

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <button {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-slate-100 rounded">
          <GripVertical className="w-4 h-4 text-slate-400" />
        </button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          {displayImage ? (
            <img
              src={displayImage}
              alt={persona.display_name.ko}
              className="w-10 h-10 rounded-full object-cover"
              style={{ boxShadow: `0 0 0 2px ${persona.theme_color}` }}
            />
          ) : (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: persona.theme_color }}
            >
              {persona.display_name.ko?.[0] || '?'}
            </div>
          )}
          <div>
            <p className="font-medium">{persona.display_name.ko}</p>
            <p className="text-xs text-slate-500">{persona.persona_id}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-[200px] truncate text-sm text-slate-600">
        {persona.teaser_line.ko}
      </TableCell>
      <TableCell>
        <div
          className="w-6 h-6 rounded"
          style={{ backgroundColor: persona.theme_color }}
          title={persona.theme_color}
        />
      </TableCell>
      <TableCell>
        <Badge variant={persona.onboarding_scenario_id ? 'default' : 'secondary'}>
          {persona.onboarding_scenario_id ? '연결됨' : '미설정'}
        </Badge>
      </TableCell>
      <TableCell>
        <Switch
          checked={persona.is_active}
          onCheckedChange={(checked) => onToggleActive(persona.id, checked)}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(persona)}>
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(persona.id)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function OnboardingManagementPage() {
  const [personas, setPersonas] = useState<OnboardingPersona[]>([]);
  const [availablePersonas, setAvailablePersonas] = useState<PersonaCore[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioTemplate[]>([]);
  const [settings, setSettings] = useState<OnboardingSettings>({
    variant_weights: { A: 0.5, B: 0.5 },
    default_variant: 'B',
    show_skip_button: true,
    max_personas_display: 5,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPersona, setEditingPersona] = useState<OnboardingPersona | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch onboarding personas with persona_core data
      const { data: onboardingData, error: onboardingError } = await supabase
        .from('onboarding_personas')
        .select(`
          *,
          persona_core (
            name,
            full_name,
            profile_image_url
          )
        `)
        .order('display_order', { ascending: true });

      if (onboardingError) throw onboardingError;
      setPersonas(onboardingData || []);

      // Fetch all available personas from persona_core
      const { data: personaCoreData, error: personaCoreError } = await supabase
        .from('persona_core')
        .select('id, name, full_name, first_scenario_id');

      if (personaCoreError) throw personaCoreError;
      setAvailablePersonas(personaCoreData || []);

      // Fetch scenarios
      const { data: scenarioData, error: scenarioError } = await supabase
        .from('scenario_templates')
        .select('id, title, persona_id, scenario_type')
        .in('scenario_type', ['first_meeting', 'onboarding']);

      if (scenarioError) throw scenarioError;
      setScenarios(scenarioData || []);

      // Fetch settings
      const { data: settingsData, error: settingsError } = await supabase
        .from('onboarding_settings')
        .select('setting_key, setting_value');

      if (settingsError) throw settingsError;

      if (settingsData) {
        const newSettings = { ...settings };
        settingsData.forEach((s) => {
          if (s.setting_key === 'variant_weights') {
            newSettings.variant_weights = s.setting_value;
          } else if (s.setting_key === 'default_variant') {
            newSettings.default_variant = s.setting_value.replace(/"/g, '');
          } else if (s.setting_key === 'show_skip_button') {
            newSettings.show_skip_button = s.setting_value;
          } else if (s.setting_key === 'max_personas_display') {
            newSettings.max_personas_display = s.setting_value;
          }
        });
        setSettings(newSettings);
      }
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = personas.findIndex((p) => p.id === active.id);
      const newIndex = personas.findIndex((p) => p.id === over.id);

      const newPersonas = arrayMove(personas, oldIndex, newIndex);

      // Update display_order
      const updatedPersonas = newPersonas.map((p, idx) => ({
        ...p,
        display_order: idx,
      }));

      setPersonas(updatedPersonas);

      // Save to database
      try {
        for (const p of updatedPersonas) {
          await supabase
            .from('onboarding_personas')
            .update({ display_order: p.display_order })
            .eq('id', p.id);
        }
        toast.success('순서가 변경되었습니다');
      } catch (error) {
        console.error('Error updating order:', error);
        toast.error('순서 변경에 실패했습니다');
      }
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('onboarding_personas')
        .update({ is_active: active })
        .eq('id', id);

      if (error) throw error;

      setPersonas(personas.map(p =>
        p.id === id ? { ...p, is_active: active } : p
      ));
      toast.success(active ? '활성화되었습니다' : '비활성화되었습니다');
    } catch (error) {
      console.error('Error toggling active:', error);
      toast.error('상태 변경에 실패했습니다');
    }
  };

  const handleAddPersona = async () => {
    if (!selectedPersonaId) return;

    try {
      const persona = availablePersonas.find(p => p.id === selectedPersonaId);
      if (!persona) return;

      const { data, error } = await supabase
        .from('onboarding_personas')
        .insert({
          persona_id: selectedPersonaId,
          display_name: { ko: persona.name, en: persona.name },
          teaser_line: { ko: '', en: '' },
          theme_color: '#8B5CF6',
          display_order: personas.length,
          is_active: false,
          onboarding_scenario_id: persona.first_scenario_id,
        })
        .select(`
          *,
          persona_core (
            name,
            full_name
          )
        `)
        .single();

      if (error) throw error;

      setPersonas([...personas, data]);
      setIsAddDialogOpen(false);
      setSelectedPersonaId('');
      toast.success('페르소나가 추가되었습니다');
    } catch (error: unknown) {
      console.error('Error adding persona:', error);
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') {
        toast.error('이미 등록된 페르소나입니다');
      } else {
        toast.error('페르소나 추가에 실패했습니다');
      }
    }
  };

  const handleDeletePersona = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('onboarding_personas')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPersonas(personas.filter(p => p.id !== id));
      toast.success('삭제되었습니다');
    } catch (error) {
      console.error('Error deleting persona:', error);
      toast.error('삭제에 실패했습니다');
    }
  };

  const handleUpdatePersona = async (updated: OnboardingPersona) => {
    try {
      const { error } = await supabase
        .from('onboarding_personas')
        .update({
          display_name: updated.display_name,
          teaser_line: updated.teaser_line,
          onboarding_image_url: updated.onboarding_image_url,
          theme_color: updated.theme_color,
          onboarding_scenario_id: updated.onboarding_scenario_id,
        })
        .eq('id', updated.id);

      if (error) throw error;

      setPersonas(personas.map(p =>
        p.id === updated.id ? updated : p
      ));
      setEditingPersona(null);
      toast.success('저장되었습니다');
    } catch (error) {
      console.error('Error updating persona:', error);
      toast.error('저장에 실패했습니다');
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Update each setting
      await supabase
        .from('onboarding_settings')
        .update({ setting_value: settings.variant_weights })
        .eq('setting_key', 'variant_weights');

      await supabase
        .from('onboarding_settings')
        .update({ setting_value: JSON.stringify(settings.default_variant) })
        .eq('setting_key', 'default_variant');

      await supabase
        .from('onboarding_settings')
        .update({ setting_value: settings.show_skip_button })
        .eq('setting_key', 'show_skip_button');

      await supabase
        .from('onboarding_settings')
        .update({ setting_value: settings.max_personas_display })
        .eq('setting_key', 'max_personas_display');

      toast.success('설정이 저장되었습니다');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('설정 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  // Get unused personas
  const unusedPersonas = availablePersonas.filter(
    ap => !personas.some(p => p.persona_id === ap.id)
  );

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">온보딩 관리</h1>
          <p className="text-slate-500 mt-1">온보딩 페르소나 목록과 설정을 관리합니다</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      {/* A/B Testing Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">온보딩 설정</CardTitle>
          <CardDescription>A/B 테스트 및 전역 설정</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>타입 A 가중치: {Math.round(settings.variant_weights.A * 100)}%</Label>
              <Slider
                value={[settings.variant_weights.A * 100]}
                onValueChange={([v]) => {
                  setSettings({
                    ...settings,
                    variant_weights: {
                      A: v / 100,
                      B: (100 - v) / 100,
                    }
                  });
                }}
                max={100}
                step={1}
              />
            </div>
            <div className="space-y-3">
              <Label>타입 B 가중치: {Math.round(settings.variant_weights.B * 100)}%</Label>
              <Slider
                value={[settings.variant_weights.B * 100]}
                onValueChange={([v]) => {
                  setSettings({
                    ...settings,
                    variant_weights: {
                      A: (100 - v) / 100,
                      B: v / 100,
                    }
                  });
                }}
                max={100}
                step={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label>기본 타입</Label>
              <Select
                value={settings.default_variant}
                onValueChange={(v) => setSettings({ ...settings, default_variant: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">타입 A - DM 리스트 바로 보기</SelectItem>
                  <SelectItem value="B">타입 B - 잠금화면 → 시나리오</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>최대 표시 페르소나 수</Label>
              <Input
                type="number"
                value={settings.max_personas_display}
                onChange={(e) => setSettings({
                  ...settings,
                  max_personas_display: parseInt(e.target.value) || 5
                })}
                min={1}
                max={10}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>스킵 버튼 표시</Label>
              <Switch
                checked={settings.show_skip_button}
                onCheckedChange={(checked) => setSettings({
                  ...settings,
                  show_skip_button: checked
                })}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              설정 저장
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Onboarding Personas List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">온보딩 페르소나</CardTitle>
              <CardDescription>온보딩에 표시될 페르소나 목록 (드래그하여 순서 변경)</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={unusedPersonas.length === 0}>
                  <Plus className="w-4 h-4 mr-2" />
                  페르소나 추가
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>온보딩 페르소나 추가</DialogTitle>
                  <DialogDescription>
                    등록된 페르소나 중 온보딩에 추가할 페르소나를 선택하세요
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Select value={selectedPersonaId} onValueChange={setSelectedPersonaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="페르소나 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {unusedPersonas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.full_name})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    취소
                  </Button>
                  <Button onClick={handleAddPersona} disabled={!selectedPersonaId}>
                    추가
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {personas.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              등록된 온보딩 페르소나가 없습니다
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>페르소나</TableHead>
                    <TableHead>티저 문구</TableHead>
                    <TableHead>컬러</TableHead>
                    <TableHead>시나리오</TableHead>
                    <TableHead>활성</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={personas.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {personas.map((persona) => (
                      <SortableRow
                        key={persona.id}
                        persona={persona}
                        onEdit={setEditingPersona}
                        onDelete={handleDeletePersona}
                        onToggleActive={handleToggleActive}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingPersona} onOpenChange={(open) => !open && setEditingPersona(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>온보딩 페르소나 편집</DialogTitle>
          </DialogHeader>
          {editingPersona && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>이름 (한국어)</Label>
                  <Input
                    value={editingPersona.display_name.ko}
                    onChange={(e) => setEditingPersona({
                      ...editingPersona,
                      display_name: { ...editingPersona.display_name, ko: e.target.value }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>이름 (영어)</Label>
                  <Input
                    value={editingPersona.display_name.en}
                    onChange={(e) => setEditingPersona({
                      ...editingPersona,
                      display_name: { ...editingPersona.display_name, en: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>티저 문구 (한국어)</Label>
                <Input
                  value={editingPersona.teaser_line.ko}
                  onChange={(e) => setEditingPersona({
                    ...editingPersona,
                    teaser_line: { ...editingPersona.teaser_line, ko: e.target.value }
                  })}
                  placeholder="새벽 3시. 편의점에서 만난 그는..."
                />
              </div>

              <div className="space-y-2">
                <Label>티저 문구 (영어)</Label>
                <Input
                  value={editingPersona.teaser_line.en}
                  onChange={(e) => setEditingPersona({
                    ...editingPersona,
                    teaser_line: { ...editingPersona.teaser_line, en: e.target.value }
                  })}
                  placeholder="3AM. The stranger at the convenience store..."
                />
              </div>

              <div className="space-y-2">
                <Label>이미지 URL (비워두면 페르소나 기본 이미지 사용)</Label>
                <div className="flex gap-3 items-start">
                  {/* 이미지 미리보기 */}
                  <div
                    className="w-16 h-16 rounded-full overflow-hidden shrink-0"
                    style={{ boxShadow: `0 0 0 2px ${editingPersona.theme_color}` }}
                  >
                    {(editingPersona.onboarding_image_url || editingPersona.persona_core?.profile_image_url) ? (
                      <img
                        src={editingPersona.onboarding_image_url || editingPersona.persona_core?.profile_image_url || ''}
                        alt="미리보기"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center text-white font-bold text-xl"
                        style={{ backgroundColor: editingPersona.theme_color }}
                      >
                        {editingPersona.display_name.ko?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <Input
                    value={editingPersona.onboarding_image_url || ''}
                    onChange={(e) => setEditingPersona({
                      ...editingPersona,
                      onboarding_image_url: e.target.value || null
                    })}
                    placeholder="https://... (비워두면 페르소나 기본 이미지)"
                    className="flex-1"
                  />
                </div>
                {editingPersona.persona_core?.profile_image_url && !editingPersona.onboarding_image_url && (
                  <p className="text-xs text-slate-500">현재 페르소나 기본 이미지 사용 중</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>테마 컬러</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={editingPersona.theme_color}
                      onChange={(e) => setEditingPersona({
                        ...editingPersona,
                        theme_color: e.target.value
                      })}
                      className="w-16 h-10 p-1"
                    />
                    <Input
                      value={editingPersona.theme_color}
                      onChange={(e) => setEditingPersona({
                        ...editingPersona,
                        theme_color: e.target.value
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>온보딩 시나리오</Label>
                  <Select
                    value={editingPersona.onboarding_scenario_id || 'none'}
                    onValueChange={(v) => setEditingPersona({
                      ...editingPersona,
                      onboarding_scenario_id: v === 'none' ? null : v
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">미설정</SelectItem>
                      {scenarios
                        .filter(s => s.persona_id === editingPersona.persona_id)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingPersona(null)}>
              취소
            </Button>
            <Button onClick={() => editingPersona && handleUpdatePersona(editingPersona)}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

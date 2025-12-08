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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Loader2,
  RefreshCw,
  Filter,
  Zap,
  Clock,
  Heart,
  MessageSquare,
  Calendar,
  Play,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';

interface EventTriggerRule {
  id: string;
  persona_id: string;
  trigger_name: string;
  trigger_type: string;
  conditions: {
    affection_min?: number;
    affection_max?: number;
    relationship_stage?: string;
    time_based?: {
      hours_since_last_activity?: number;
      specific_hours?: number[];
    };
    keyword_triggers?: string[];
    custom_conditions?: Record<string, unknown>;
  };
  action_type: string;
  action_config: Record<string, unknown>;
  scenario_config?: {
    scenario_type?: 'static' | 'guided' | 'dynamic';
    scenario_id?: string;
    dynamic_template_id?: string;
    interrupt_dm?: boolean;
  };
  priority: number;
  cooldown_hours: number;
  max_triggers_per_day: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

interface ScenarioTemplate {
  id: string;
  title: string;
  persona_id: string;
  generation_mode?: string;
}

const TRIGGER_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  affection_threshold: { label: '호감도 도달', icon: <Heart className="w-4 h-4" />, color: 'bg-pink-100 text-pink-700' },
  relationship_change: { label: '관계 변화', icon: <Heart className="w-4 h-4" />, color: 'bg-red-100 text-red-700' },
  inactivity: { label: '비활성 감지', icon: <Clock className="w-4 h-4" />, color: 'bg-orange-100 text-orange-700' },
  scheduled: { label: '예약 트리거', icon: <Calendar className="w-4 h-4" />, color: 'bg-blue-100 text-blue-700' },
  keyword: { label: '키워드 감지', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-green-100 text-green-700' },
  dm_context: { label: 'DM 컨텍스트', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-purple-100 text-purple-700' },
  custom: { label: '커스텀', icon: <Zap className="w-4 h-4" />, color: 'bg-slate-100 text-slate-700' },
};

const ACTION_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  send_dm: { label: 'DM 발송', color: 'bg-blue-100 text-blue-700' },
  start_scenario: { label: '시나리오 시작', color: 'bg-purple-100 text-purple-700' },
  push_notification: { label: '푸시 알림', color: 'bg-green-100 text-green-700' },
  update_state: { label: '상태 업데이트', color: 'bg-yellow-100 text-yellow-700' },
  generate_scenario: { label: 'AI 시나리오 생성', color: 'bg-pink-100 text-pink-700' },
};

const RELATIONSHIP_STAGES = ['stranger', 'acquaintance', 'friend', 'close', 'intimate', 'lover'];

export default function TriggersManagementPage() {
  const router = useRouter();
  const [triggers, setTriggers] = useState<EventTriggerRule[]>([]);
  const [personas, setPersonas] = useState<PersonaCore[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPersona, setFilterPersona] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [personaSearch, setPersonaSearch] = useState('');
  const [isPersonaDropdownOpen, setIsPersonaDropdownOpen] = useState(false);

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<EventTriggerRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    persona_id: '',
    trigger_name: '',
    trigger_type: 'affection_threshold',
    conditions: {} as Record<string, unknown>,
    action_type: 'send_dm',
    action_config: {} as Record<string, unknown>,
    scenario_config: {} as Record<string, unknown>,
    priority: 0,
    cooldown_hours: 24,
    max_triggers_per_day: 1,
  });

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch triggers with persona data
      const { data: triggerData, error: triggerError } = await supabase
        .from('event_trigger_rules')
        .select(`
          *,
          persona_core (
            name,
            profile_image_url
          )
        `)
        .order('persona_id')
        .order('priority', { ascending: false });

      if (triggerError) throw triggerError;
      setTriggers(triggerData || []);

      // Fetch personas for filter
      const { data: personaData, error: personaError } = await supabase
        .from('persona_core')
        .select('id, name, profile_image_url')
        .order('name');

      if (personaError) throw personaError;
      setPersonas(personaData || []);

      // Fetch scenarios for linking
      const { data: scenarioData, error: scenarioError } = await supabase
        .from('scenario_templates')
        .select('id, title, persona_id, generation_mode')
        .order('title');

      if (scenarioError) throw scenarioError;
      setScenarios(scenarioData || []);
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
        .from('event_trigger_rules')
        .update({ is_active: active, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setTriggers(triggers.map(t =>
        t.id === id ? { ...t, is_active: active } : t
      ));
      toast.success(active ? '활성화되었습니다' : '비활성화되었습니다');
    } catch (error) {
      console.error('Error toggling active:', error);
      toast.error('상태 변경에 실패했습니다');
    }
  };

  const handleDuplicate = async (trigger: EventTriggerRule) => {
    try {
      const { error } = await supabase
        .from('event_trigger_rules')
        .insert({
          persona_id: trigger.persona_id,
          trigger_name: `${trigger.trigger_name} (복사본)`,
          trigger_type: trigger.trigger_type,
          conditions: trigger.conditions,
          action_type: trigger.action_type,
          action_config: trigger.action_config,
          scenario_config: trigger.scenario_config,
          priority: trigger.priority,
          cooldown_hours: trigger.cooldown_hours,
          max_triggers_per_day: trigger.max_triggers_per_day,
          is_active: false,
        });

      if (error) throw error;

      toast.success('트리거가 복제되었습니다');
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
        .from('event_trigger_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTriggers(triggers.filter(t => t.id !== id));
      toast.success('삭제되었습니다');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('삭제에 실패했습니다');
    }
  };

  const resetForm = () => {
    setFormData({
      persona_id: '',
      trigger_name: '',
      trigger_type: 'affection_threshold',
      conditions: {},
      action_type: 'send_dm',
      action_config: {},
      scenario_config: {},
      priority: 0,
      cooldown_hours: 24,
      max_triggers_per_day: 1,
    });
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsCreateDialogOpen(true);
  };

  const handleOpenEdit = (trigger: EventTriggerRule) => {
    setEditingTrigger(trigger);
    setFormData({
      persona_id: trigger.persona_id,
      trigger_name: trigger.trigger_name,
      trigger_type: trigger.trigger_type,
      conditions: trigger.conditions || {},
      action_type: trigger.action_type,
      action_config: trigger.action_config || {},
      scenario_config: trigger.scenario_config || {},
      priority: trigger.priority,
      cooldown_hours: trigger.cooldown_hours,
      max_triggers_per_day: trigger.max_triggers_per_day,
    });
    setIsEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.persona_id || !formData.trigger_name) {
      toast.error('필수 필드를 입력해주세요');
      return;
    }

    setIsSaving(true);
    try {
      if (editingTrigger) {
        // Update existing
        const { error } = await supabase
          .from('event_trigger_rules')
          .update({
            persona_id: formData.persona_id,
            trigger_name: formData.trigger_name,
            trigger_type: formData.trigger_type,
            conditions: formData.conditions,
            action_type: formData.action_type,
            action_config: formData.action_config,
            scenario_config: formData.scenario_config,
            priority: formData.priority,
            cooldown_hours: formData.cooldown_hours,
            max_triggers_per_day: formData.max_triggers_per_day,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTrigger.id);

        if (error) throw error;
        toast.success('트리거가 수정되었습니다');
        setIsEditDialogOpen(false);
      } else {
        // Create new
        const { error } = await supabase
          .from('event_trigger_rules')
          .insert({
            persona_id: formData.persona_id,
            trigger_name: formData.trigger_name,
            trigger_type: formData.trigger_type,
            conditions: formData.conditions,
            action_type: formData.action_type,
            action_config: formData.action_config,
            scenario_config: formData.scenario_config,
            priority: formData.priority,
            cooldown_hours: formData.cooldown_hours,
            max_triggers_per_day: formData.max_triggers_per_day,
            is_active: false,
          });

        if (error) throw error;
        toast.success('트리거가 생성되었습니다');
        setIsCreateDialogOpen(false);
      }

      fetchData();
      resetForm();
      setEditingTrigger(null);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('저장에 실패했습니다');
    } finally {
      setIsSaving(false);
    }
  };

  // Filter triggers
  const filteredTriggers = triggers.filter(t => {
    if (filterPersona !== 'all' && t.persona_id !== filterPersona) return false;
    if (filterType !== 'all' && t.trigger_type !== filterType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        t.trigger_name.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query)
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

  // Group by persona
  const groupedTriggers = filteredTriggers.reduce((acc, trigger) => {
    const personaId = trigger.persona_id;
    const personaName = trigger.persona_core?.name || trigger.persona_id;
    const personaImage = trigger.persona_core?.profile_image_url || null;
    const key = `${personaId}|${personaName}|${personaImage || ''}`;
    if (!acc[key]) {
      acc[key] = { id: personaId, name: personaName, image: personaImage, triggers: [] };
    }
    acc[key].triggers.push(trigger);
    return acc;
  }, {} as Record<string, { id: string; name: string; image: string | null; triggers: EventTriggerRule[] }>);

  // Render condition form based on trigger type
  const renderConditionForm = () => {
    switch (formData.trigger_type) {
      case 'affection_threshold':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>최소 호감도</Label>
                <Input
                  type="number"
                  value={(formData.conditions as Record<string, number>).affection_min || 0}
                  onChange={(e) => setFormData({
                    ...formData,
                    conditions: { ...formData.conditions, affection_min: parseInt(e.target.value) || 0 }
                  })}
                />
              </div>
              <div>
                <Label>최대 호감도</Label>
                <Input
                  type="number"
                  value={(formData.conditions as Record<string, number>).affection_max || 100}
                  onChange={(e) => setFormData({
                    ...formData,
                    conditions: { ...formData.conditions, affection_max: parseInt(e.target.value) || 100 }
                  })}
                />
              </div>
            </div>
          </div>
        );

      case 'relationship_change':
        return (
          <div>
            <Label>관계 단계</Label>
            <Select
              value={(formData.conditions as Record<string, string>).relationship_stage || 'friend'}
              onValueChange={(value) => setFormData({
                ...formData,
                conditions: { ...formData.conditions, relationship_stage: value }
              })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_STAGES.map(stage => (
                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'inactivity':
        return (
          <div>
            <Label>비활성 시간 (시간)</Label>
            <Input
              type="number"
              value={((formData.conditions as Record<string, Record<string, number>>).time_based?.hours_since_last_activity) || 24}
              onChange={(e) => setFormData({
                ...formData,
                conditions: {
                  ...formData.conditions,
                  time_based: {
                    ...((formData.conditions as Record<string, Record<string, number>>).time_based || {}),
                    hours_since_last_activity: parseInt(e.target.value) || 24
                  }
                }
              })}
            />
          </div>
        );

      case 'keyword':
        return (
          <div>
            <Label>키워드 (쉼표로 구분)</Label>
            <Input
              value={((formData.conditions as Record<string, string[]>).keyword_triggers || []).join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                conditions: {
                  ...formData.conditions,
                  keyword_triggers: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                }
              })}
              placeholder="예: 보고싶어, 힘들어, 외로워"
            />
          </div>
        );

      case 'scheduled':
        return (
          <div>
            <Label>실행 시간 (0-23, 쉼표로 구분)</Label>
            <Input
              value={((formData.conditions as Record<string, Record<string, number[]>>).time_based?.specific_hours || []).join(', ')}
              onChange={(e) => setFormData({
                ...formData,
                conditions: {
                  ...formData.conditions,
                  time_based: {
                    ...((formData.conditions as Record<string, Record<string, number[]>>).time_based || {}),
                    specific_hours: e.target.value.split(',').map(h => parseInt(h.trim())).filter(h => !isNaN(h) && h >= 0 && h <= 23)
                  }
                }
              })}
              placeholder="예: 9, 12, 18, 21"
            />
          </div>
        );

      default:
        return (
          <div>
            <Label>커스텀 조건 (JSON)</Label>
            <Textarea
              value={JSON.stringify(formData.conditions, null, 2)}
              onChange={(e) => {
                try {
                  setFormData({ ...formData, conditions: JSON.parse(e.target.value) });
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              rows={4}
            />
          </div>
        );
    }
  };

  // Render action form based on action type
  const renderActionForm = () => {
    switch (formData.action_type) {
      case 'send_dm':
        return (
          <div>
            <Label>DM 메시지 (AI 생성 시 프롬프트로 사용)</Label>
            <Textarea
              value={(formData.action_config as Record<string, string>).message_prompt || ''}
              onChange={(e) => setFormData({
                ...formData,
                action_config: { ...formData.action_config, message_prompt: e.target.value }
              })}
              placeholder="예: 오랜만에 연락하는 걱정 메시지"
              rows={3}
            />
          </div>
        );

      case 'start_scenario':
      case 'generate_scenario':
        return (
          <div className="space-y-4">
            <div>
              <Label>시나리오 타입</Label>
              <Select
                value={(formData.scenario_config as Record<string, string>).scenario_type || 'static'}
                onValueChange={(value) => setFormData({
                  ...formData,
                  scenario_config: { ...formData.scenario_config, scenario_type: value }
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Static (사전 정의)</SelectItem>
                  <SelectItem value="guided">Guided (가이드 AI 생성)</SelectItem>
                  <SelectItem value="dynamic">Dynamic (완전 AI 생성)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.scenario_config as Record<string, string>).scenario_type === 'static' && (
              <div>
                <Label>연결할 시나리오</Label>
                <Select
                  value={(formData.scenario_config as Record<string, string>).scenario_id || ''}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    scenario_config: { ...formData.scenario_config, scenario_id: value }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="시나리오 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios
                      .filter(s => s.persona_id === formData.persona_id)
                      .map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Switch
                checked={(formData.scenario_config as Record<string, boolean>).interrupt_dm || false}
                onCheckedChange={(checked) => setFormData({
                  ...formData,
                  scenario_config: { ...formData.scenario_config, interrupt_dm: checked }
                })}
              />
              <Label>DM 진행 중 강제 전환</Label>
            </div>
          </div>
        );

      case 'push_notification':
        return (
          <div className="space-y-4">
            <div>
              <Label>알림 제목</Label>
              <Input
                value={(formData.action_config as Record<string, string>).notification_title || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  action_config: { ...formData.action_config, notification_title: e.target.value }
                })}
              />
            </div>
            <div>
              <Label>알림 내용</Label>
              <Textarea
                value={(formData.action_config as Record<string, string>).notification_body || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  action_config: { ...formData.action_config, notification_body: e.target.value }
                })}
                rows={2}
              />
            </div>
          </div>
        );

      default:
        return (
          <div>
            <Label>액션 설정 (JSON)</Label>
            <Textarea
              value={JSON.stringify(formData.action_config, null, 2)}
              onChange={(e) => {
                try {
                  setFormData({ ...formData, action_config: JSON.parse(e.target.value) });
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              rows={4}
            />
          </div>
        );
    }
  };

  const renderTriggerDialog = (isEdit: boolean) => (
    <Dialog
      open={isEdit ? isEditDialogOpen : isCreateDialogOpen}
      onOpenChange={isEdit ? setIsEditDialogOpen : setIsCreateDialogOpen}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '트리거 수정' : '새 트리거 생성'}</DialogTitle>
          <DialogDescription>
            이벤트 트리거를 설정하여 특정 조건에서 자동으로 액션을 실행합니다
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">기본 정보</h3>

            <div>
              <Label>페르소나</Label>
              <Select
                value={formData.persona_id}
                onValueChange={(value) => setFormData({ ...formData, persona_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="페르소나 선택" />
                </SelectTrigger>
                <SelectContent>
                  {personas.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        {p.profile_image_url ? (
                          <img src={p.profile_image_url} alt="" className="w-5 h-5 rounded-full" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-slate-300" />
                        )}
                        {p.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>트리거 이름</Label>
              <Input
                value={formData.trigger_name}
                onChange={(e) => setFormData({ ...formData, trigger_name: e.target.value })}
                placeholder="예: 호감도 50 달성 축하"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>우선순위</Label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>쿨다운 (시간)</Label>
                <Input
                  type="number"
                  value={formData.cooldown_hours}
                  onChange={(e) => setFormData({ ...formData, cooldown_hours: parseInt(e.target.value) || 24 })}
                />
              </div>
              <div>
                <Label>일일 최대 횟수</Label>
                <Input
                  type="number"
                  value={formData.max_triggers_per_day}
                  onChange={(e) => setFormData({ ...formData, max_triggers_per_day: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
          </div>

          {/* 트리거 조건 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">트리거 조건</h3>

            <div>
              <Label>트리거 타입</Label>
              <Select
                value={formData.trigger_type}
                onValueChange={(value) => setFormData({ ...formData, trigger_type: value, conditions: {} })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_TYPE_LABELS).map(([key, { label, icon }]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {icon}
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {renderConditionForm()}
          </div>

          {/* 액션 설정 */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm text-slate-700">실행 액션</h3>

            <div>
              <Label>액션 타입</Label>
              <Select
                value={formData.action_type}
                onValueChange={(value) => setFormData({
                  ...formData,
                  action_type: value,
                  action_config: {},
                  scenario_config: {}
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTION_TYPE_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {renderActionForm()}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (isEdit) {
                setIsEditDialogOpen(false);
              } else {
                setIsCreateDialogOpen(false);
              }
              resetForm();
              setEditingTrigger(null);
            }}
          >
            취소
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? '수정' : '생성'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

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
          <h1 className="text-2xl font-bold text-slate-900">이벤트 트리거 관리</h1>
          <p className="text-slate-500 mt-1">
            호감도, 시간, 키워드 등 조건에 따라 자동으로 시나리오나 DM을 발생시킵니다
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
          <Button onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-2" />
            새 트리거
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
                placeholder="트리거 검색..."
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
                {Object.entries(TRIGGER_TYPE_LABELS).map(([key, { label }]) => (
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
            <div className="text-2xl font-bold">{triggers.length}</div>
            <p className="text-sm text-slate-500">전체 트리거</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {triggers.filter(t => t.is_active).length}
            </div>
            <p className="text-sm text-slate-500">활성 트리거</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {triggers.filter(t => t.action_type === 'start_scenario' || t.action_type === 'generate_scenario').length}
            </div>
            <p className="text-sm text-slate-500">시나리오 연결</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {new Set(triggers.map(t => t.persona_id)).size}
            </div>
            <p className="text-sm text-slate-500">페르소나 수</p>
          </CardContent>
        </Card>
      </div>

      {/* Triggers List */}
      {Object.entries(groupedTriggers).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-slate-500">
            {searchQuery || filterPersona !== 'all' || filterType !== 'all'
              ? '검색 결과가 없습니다'
              : '등록된 트리거가 없습니다'}
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedTriggers).map(([key, { name: personaName, image: personaImage, triggers: personaTriggers }]) => (
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
                    {personaName?.[0] || '?'}
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg">{personaName || '알 수 없음'}</CardTitle>
                  <CardDescription>{personaTriggers.length}개의 트리거</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>트리거</TableHead>
                    <TableHead>타입</TableHead>
                    <TableHead>액션</TableHead>
                    <TableHead>조건</TableHead>
                    <TableHead>우선순위</TableHead>
                    <TableHead>활성</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {personaTriggers.map((trigger) => {
                    const typeInfo = TRIGGER_TYPE_LABELS[trigger.trigger_type] || {
                      label: trigger.trigger_type,
                      icon: <Zap className="w-4 h-4" />,
                      color: 'bg-slate-100 text-slate-700',
                    };
                    const actionInfo = ACTION_TYPE_LABELS[trigger.action_type] || {
                      label: trigger.action_type,
                      color: 'bg-slate-100 text-slate-700',
                    };

                    return (
                      <TableRow key={trigger.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{trigger.trigger_name}</p>
                            <p className="text-xs text-slate-500 font-mono">{trigger.id.slice(0, 8)}...</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${typeInfo.color} flex items-center gap-1 w-fit`}>
                            {typeInfo.icon}
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={actionInfo.color}>{actionInfo.label}</Badge>
                          {trigger.scenario_config?.scenario_id && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                              <BookOpen className="w-3 h-3" />
                              시나리오 연결됨
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm space-y-1 text-slate-600">
                            {trigger.conditions?.affection_min !== undefined && (
                              <div>호감도: {trigger.conditions.affection_min}+</div>
                            )}
                            {trigger.conditions?.relationship_stage && (
                              <div>관계: {trigger.conditions.relationship_stage}</div>
                            )}
                            {trigger.conditions?.time_based?.hours_since_last_activity && (
                              <div>비활성: {trigger.conditions.time_based.hours_since_last_activity}시간</div>
                            )}
                            {trigger.conditions?.keyword_triggers?.length && (
                              <div>키워드: {trigger.conditions.keyword_triggers.slice(0, 2).join(', ')}...</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{trigger.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={trigger.is_active}
                            onCheckedChange={(checked) => handleToggleActive(trigger.id, checked)}
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
                              <DropdownMenuItem onClick={() => handleOpenEdit(trigger)}>
                                <Edit className="w-4 h-4 mr-2" />
                                편집
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(trigger)}>
                                <Copy className="w-4 h-4 mr-2" />
                                복제
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDelete(trigger.id)}
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

      {/* Create/Edit Dialogs */}
      {renderTriggerDialog(false)}
      {renderTriggerDialog(true)}
    </div>
  );
}

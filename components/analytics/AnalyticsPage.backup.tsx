'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ChevronLeft, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/stores/auth-store';
import { MemoryListSkeleton, MemoryDetailSkeleton } from '@/components/ui/Skeleton';
import { useTranslations, t, useLocale } from '@/lib/i18n';
import { formatCompactNumber } from '@/lib/utils';

// 페르소나 진행도 타입 (API 응답 기반)
interface PersonaProgress {
  id: string;
  name: string;
  fullName: string;
  role: string;
  image: string;
  affection: number;
  trust: number;
  intimacy: number;
  stage: string;
  storyProgress: number;
  totalStories: number;
  unlockedSecrets: number;
  totalSecrets: number;
  memories: Memo[];
  relationship: string;
  currentArc: string;
  userNickname: string | null;
  personaNickname: string | null;
  totalMessages: number;
  firstInteractionAt: string | null;
  lastInteractionAt: string | null;
}

// 메모 타입
interface Memo {
  id: string;
  type: string;
  title: string;
  content: string;
  isLocked: boolean;
  unlockCondition?: string;
  emotionalWeight?: number;
  createdAt?: string;
}

// 상세 페이지용 stats
interface DetailStats {
  trust: number;
  intimacy: number;
  mystery: number;
  chemistry: number;
  loyalty: number;
}

// 상세 데이터 타입
interface PersonaDetail {
  exists: boolean;
  persona?: {
    id: string;
    name: string;
    fullName: string;
    role: string;
    image: string;
  };
  relationship?: {
    stage: string;
    stageLabel: string;
    affection: number;
    trust: number;
    intimacy: number;
    totalMessages: number;
    firstInteractionAt: string | null;
    lastInteractionAt: string | null;
    userNickname: string | null;
    personaNickname: string | null;
  };
  stats?: DetailStats;
  progress?: {
    storyProgress: number;
    totalStories: number;
    currentArc: string;
    unlockedSecrets: number;
    totalSecrets: number;
  };
  memories?: Memo[];
  lockedMemos?: Memo[];
}

type TabType = 'progress' | 'memo';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('progress');
  const [personas, setPersonas] = useState<PersonaProgress[]>([]);
  const [stats, setStats] = useState({ totalCharacters: 0, totalSecrets: 0, totalStories: 0 });
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [personaDetail, setPersonaDetail] = useState<PersonaDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isAuthenticated } = useAuthStore();
  const tr = useTranslations();
  const locale = useLocale();

  // 기억 목록 로드
  const loadMemoryList = async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getMemoryList();
      setPersonas(data.personas);
      setStats(data.stats);
    } catch (err) {
      console.error('[AnalyticsPage] Failed to load memory list:', err);
      setError(tr.common.error);
      // 로그인 안된 경우 빈 목록
      setPersonas([]);
    } finally {
      setIsLoading(false);
    }
  };

  // 페르소나 상세 로드
  const loadPersonaDetail = async (personaId: string) => {
    try {
      setIsDetailLoading(true);
      const data = await apiClient.getMemoryDetail(personaId);
      setPersonaDetail(data);
    } catch (err) {
      console.error('[AnalyticsPage] Failed to load persona detail:', err);
      setPersonaDetail(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  useEffect(() => {
    loadMemoryList();
  }, [isAuthenticated]);

  // 페르소나 선택 시 상세 로드
  useEffect(() => {
    if (selectedPersonaId) {
      loadPersonaDetail(selectedPersonaId);
    } else {
      setPersonaDetail(null);
    }
  }, [selectedPersonaId]);

  const handleSelectPersona = (personaId: string) => {
    setSelectedPersonaId(personaId);
    setActiveTab('progress');
  };

  // 로딩 상태 - 스켈레톤 표시
  if (isLoading) {
    return <MemoryListSkeleton count={3} />;
  }

  // 로그인 필요 상태
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white pb-24">
        <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
          <div className="px-4 py-4">
            <h1 className="text-lg font-bold">{tr.memory.title}</h1>
            <p className="text-xs text-white/40 mt-0.5">{tr.memory.selectPersona}</p>
          </div>
        </div>
        <div className="px-4 pt-20 text-center">
          <p className="text-white/40">{tr.common.loginRequired}</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error && personas.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white pb-24">
        <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
          <div className="px-4 py-4">
            <h1 className="text-lg font-bold">{tr.memory.title}</h1>
          </div>
        </div>
        <div className="px-4 pt-20 text-center space-y-4">
          <p className="text-white/40">{error}</p>
          <button
            onClick={loadMemoryList}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            {tr.common.retry}
          </button>
        </div>
      </div>
    );
  }

  // 페르소나 선택 화면
  if (!selectedPersonaId) {
    return (
      <div className="min-h-screen bg-black text-white pb-24">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
          <div className="px-4 py-4">
            <h1 className="text-lg font-bold">{tr.memory.title}</h1>
            <p className="text-xs text-white/40 mt-0.5">
              {personas.length > 0 ? tr.memory.selectPersona : tr.memory.startDMHint}
            </p>
          </div>
        </div>

        {/* 페르소나 선택 그리드 */}
        <div className="px-4 pt-4">
          {personas.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <Lock className="w-6 h-6 text-white/20" />
              </div>
              <p className="text-white/40 text-sm">{tr.memory.noMemory}</p>
              <p className="text-white/20 text-xs mt-1">{tr.memory.noMemoryHint}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {personas.map((persona, idx) => {
                const isUnlocked = persona.storyProgress > 0 || persona.totalMessages > 0;
                const progressPercent = persona.affection;

                return (
                  <motion.button
                    key={persona.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => handleSelectPersona(persona.id)}
                    className="w-full p-4 rounded-xl border text-left transition bg-white/[0.03] border-white/10 active:bg-white/[0.06]"
                  >
                    <div className="flex items-center gap-3">
                      {/* 프로필 이미지 */}
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full overflow-hidden">
                          <img
                            src={persona.image}
                            alt={persona.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{persona.name}</h3>
                          <span className="text-xs text-white/40">
                            {persona.relationship}
                          </span>
                        </div>

                        <p className="text-xs text-white/30 mt-0.5">{persona.currentArc}</p>
                        {/* 호감도 바 */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-white/40 rounded-full"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span className="text-xs text-white/40">{persona.affection}%</span>
                        </div>
                      </div>

                      {/* 화살표 */}
                      <ChevronLeft className="w-4 h-4 text-white/20 rotate-180" />
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}

          {/* 전체 통계 */}
          {personas.length > 0 && (
            <div className="mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="flex justify-around text-sm">
                <div className="text-center">
                  <p className="text-lg font-medium">{formatCompactNumber(stats.totalCharacters, locale)}</p>
                  <p className="text-xs text-white/30">{tr.memory.characters}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium">{formatCompactNumber(stats.totalSecrets, locale)}</p>
                  <p className="text-xs text-white/30">{tr.memory.secrets}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium">{formatCompactNumber(stats.totalStories, locale)}</p>
                  <p className="text-xs text-white/30">{tr.memory.stories}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 상세 로딩 중 - 스켈레톤 표시
  if (isDetailLoading || !personaDetail) {
    return <MemoryDetailSkeleton />;
  }

  // 상세 데이터가 없는 경우
  if (!personaDetail.exists) {
    return (
      <div className="min-h-screen bg-black text-white pb-24">
        <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
          <div className="px-4 py-3">
            <button
              onClick={() => setSelectedPersonaId(null)}
              className="p-1 -ml-1 hover:bg-white/5 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5 text-white/50" />
            </button>
          </div>
        </div>
        <div className="px-4 pt-20 text-center">
          <p className="text-white/40">{tr.memory.noMemory}</p>
        </div>
      </div>
    );
  }

  const { persona, relationship, stats: detailStats, progress, memories, lockedMemos } = personaDetail;

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-12 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPersonaId(null)}
              className="p-1 -ml-1 hover:bg-white/5 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5 text-white/50" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden">
                <img src={persona?.image} alt={persona?.name} className="w-full h-full object-cover" />
              </div>
              <span className="font-medium">{persona?.name}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pb-3 gap-4">
          {[
            { id: 'progress' as TabType, label: tr.memory.ourRelationship },
            { id: 'memo' as TabType, label: tr.memory.memo },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`text-sm transition ${
                activeTab === id
                  ? 'text-white font-medium'
                  : 'text-white/40'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        <AnimatePresence mode="wait">
          {/* 우리 사이 탭 */}
          {activeTab === 'progress' && (
            <motion.div
              key="progress"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* 현재 관계 */}
              <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full overflow-hidden">
                    <img
                      src={persona?.image}
                      alt={persona?.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="font-medium">{persona?.name}</h2>
                    <p className="text-xs text-white/40">{progress?.currentArc}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm text-white/70">{relationship?.stageLabel}</p>
                    {relationship?.totalMessages && relationship.totalMessages > 0 && (
                      <p className="text-xs text-white/30">{formatCompactNumber(relationship.totalMessages, locale)} 메시지</p>
                    )}
                  </div>
                </div>

                {/* 프로그레스 바들 */}
                <div className="space-y-3">
                  <ProgressBar
                    label={tr.memory.openedHeart}
                    value={relationship?.affection || 0}
                    max={100}
                  />
                  <ProgressBar
                    label={tr.memory.sharedStories}
                    value={progress?.storyProgress || 0}
                    max={progress?.totalStories || 12}
                  />
                  <ProgressBar
                    label={tr.memory.knownSecrets}
                    value={progress?.unlockedSecrets || 0}
                    max={progress?.totalSecrets || 8}
                  />
                </div>
              </div>

              {/* 관계 온도 (스탯이 있는 경우만) */}
              {detailStats && (
                <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                  <p className="text-xs text-white/40 mb-3">{tr.memory.currentRelationship}</p>
                  <RadarChart stats={detailStats as unknown as Record<string, number>} />

                  {/* 스탯 목록 */}
                  <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                    {Object.entries(detailStats).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-sm font-medium">{Math.round(value)}</p>
                        <p className="text-[10px] text-white/30">{getStatLabel(key, tr)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 별명 (있는 경우) */}
              {(relationship?.userNickname || relationship?.personaNickname) && (
                <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                  <p className="text-xs text-white/40 mb-2">{tr.memory.ourNames}</p>
                  {relationship?.personaNickname && (
                    <p className="text-sm text-white/70">
                      {persona?.name}{tr.memory.callsMe}: <span className="text-white">{relationship.personaNickname}</span>
                    </p>
                  )}
                  {relationship?.userNickname && (
                    <p className="text-sm text-white/70 mt-1">
                      {t(tr.memory.iCall, { name: persona?.name || '' })}: <span className="text-white">{relationship.userNickname}</span>
                    </p>
                  )}
                </div>
              )}

              {/* 다음 이야기 */}
              <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                <p className="text-xs text-white/40 mb-2">{tr.memory.nextStory}</p>
                <p className="text-sm text-white/70">{tr.memory.nextStoryHint}</p>
              </div>
            </motion.div>
          )}

          {/* 메모 탭 */}
          {activeTab === 'memo' && (
            <motion.div
              key="memo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              <p className="text-xs text-white/30 mb-3">
                {t(tr.memory.aboutPersona, { name: persona?.name || '' })}
              </p>

              {/* 해금된 메모 */}
              {memories && memories.length > 0 ? (
                memories.map((memo, idx) => (
                  <motion.div
                    key={memo.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-3 rounded-xl border bg-white/[0.03] border-white/10"
                  >
                    <div className="flex items-start gap-3">
                      <div>
                        <h4 className="text-sm text-white">{memo.title}</h4>
                        <p className="text-xs mt-0.5 text-white/50">{memo.content}</p>
                        {memo.createdAt && (
                          <p className="text-[10px] text-white/20 mt-1">
                            {new Date(memo.createdAt).toLocaleDateString('ko-KR')}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-white/30 text-sm">{tr.memory.noMemos}</p>
                </div>
              )}

              {/* 잠긴 메모 */}
              {lockedMemos && lockedMemos.map((memo, idx) => (
                <motion.div
                  key={memo.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: (memories?.length || 0 + idx) * 0.05 }}
                  className="p-3 rounded-xl border bg-white/[0.01] border-white/5"
                >
                  <div className="flex items-start gap-3">
                    <Lock className="w-4 h-4 text-white/20 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm text-white/30">{memo.title}</h4>
                      <p className="text-xs mt-0.5 text-white/20">{memo.content}</p>
                      {memo.unlockCondition && (
                        <p className="text-[10px] text-white/20 mt-1">{memo.unlockCondition}</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// 프로그레스 바 컴포넌트
function ProgressBar({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-white/40">{label}</span>
        <span className="text-white/50">{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full bg-white/40 rounded-full"
        />
      </div>
    </div>
  );
}

// 레이더 차트 컴포넌트
function RadarChart({ stats }: { stats: Record<string, number> }) {
  const labels = Object.keys(stats);
  const values = Object.values(stats);
  const maxValue = 100;
  const centerX = 100;
  const centerY = 80;
  const radius = 55;
  const angleStep = (2 * Math.PI) / labels.length;

  const getPolygonPoints = (scale: number) => {
    return labels.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * scale * Math.cos(angle);
      const y = centerY + radius * scale * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  };

  const dataPoints = values.map((value, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const scale = value / maxValue;
    const x = centerX + radius * scale * Math.cos(angle);
    const y = centerY + radius * scale * Math.sin(angle);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 200 160" className="w-full h-40">
      {/* 배경 그리드 */}
      {[0.25, 0.5, 0.75, 1].map((scale, i) => (
        <polygon
          key={i}
          points={getPolygonPoints(scale)}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="1"
        />
      ))}

      {/* 축 라인 */}
      {labels.map((_, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        return (
          <line
            key={i}
            x1={centerX}
            y1={centerY}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        );
      })}

      {/* 데이터 영역 */}
      <polygon
        points={dataPoints}
        fill="rgba(255,255,255,0.1)"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1"
      />

      {/* 데이터 포인트 */}
      {values.map((value, i) => {
        const angle = i * angleStep - Math.PI / 2;
        const scale = value / maxValue;
        const x = centerX + radius * scale * Math.cos(angle);
        const y = centerY + radius * scale * Math.sin(angle);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2"
            fill="white"
            opacity="0.5"
          />
        );
      })}
    </svg>
  );
}

// 헬퍼 함수
function getStatLabel(key: string, tr: ReturnType<typeof useTranslations>): string {
  const labels: Record<string, string> = {
    trust: tr.memory.trust,
    intimacy: tr.memory.intimacy,
    mystery: tr.memory.mystery,
    chemistry: tr.memory.chemistry,
    loyalty: tr.memory.loyalty,
  };
  return labels[key] || key;
}

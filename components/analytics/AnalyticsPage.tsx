'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ChevronLeft } from 'lucide-react';
import { JUN_PROFILE } from '@/lib/hacked-sns-data';
import { useHackerStore } from '@/lib/stores/hacker-store';

// 페르소나 진행도 타입
interface PersonaProgress {
  id: string;
  name: string;
  image: string;
  affection: number;
  maxAffection: number;
  storyProgress: number;
  totalStories: number;
  currentArc: string;
  relationship: string;
  unlockedSecrets: number;
  totalSecrets: number;
  stats: {
    trust: number;
    intimacy: number;
    mystery: number;
    chemistry: number;
    loyalty: number;
  };
}

// 메모 타입 (유저가 캐릭터에 대해 파악한 내용)
interface Memo {
  id: string;
  personaId: string;
  title: string;
  content: string;
  isLocked: boolean;
  unlockCondition?: string;
}

// 더미 데이터 - 여러 페르소나
const PERSONA_PROGRESS: PersonaProgress[] = [
  {
    id: 'jun',
    name: 'Jun',
    image: JUN_PROFILE.profileImage,
    affection: 35,
    maxAffection: 100,
    storyProgress: 3,
    totalStories: 12,
    currentArc: 'Chapter 1: 첫 만남',
    relationship: '호감',
    unlockedSecrets: 2,
    totalSecrets: 8,
    stats: {
      trust: 45,
      intimacy: 30,
      mystery: 70,
      chemistry: 55,
      loyalty: 25,
    },
  },
  {
    id: 'yuna',
    name: 'Yuna',
    image: 'https://i.pravatar.cc/400?img=5',
    affection: 0,
    maxAffection: 100,
    storyProgress: 0,
    totalStories: 10,
    currentArc: '아직 시작하지 않음',
    relationship: '???',
    unlockedSecrets: 0,
    totalSecrets: 6,
    stats: {
      trust: 0,
      intimacy: 0,
      mystery: 100,
      chemistry: 0,
      loyalty: 0,
    },
  },
  {
    id: 'minho',
    name: 'Minho',
    image: 'https://i.pravatar.cc/400?img=12',
    affection: 0,
    maxAffection: 100,
    storyProgress: 0,
    totalStories: 14,
    currentArc: '아직 시작하지 않음',
    relationship: '???',
    unlockedSecrets: 0,
    totalSecrets: 10,
    stats: {
      trust: 0,
      intimacy: 0,
      mystery: 100,
      chemistry: 0,
      loyalty: 0,
    },
  },
];

const MEMOS: Memo[] = [
  {
    id: 'memo_1',
    personaId: 'jun',
    title: '감정 표현',
    content: '직접적으로 말하지 않지만, 눈빛으로 많은 걸 표현하는 것 같다.',
    isLocked: false,
  },
  {
    id: 'memo_2',
    personaId: 'jun',
    title: '좋아하는 것',
    content: '밤바다를 좋아하는 듯. 혼자 있을 때 자주 가는 것 같다.',
    isLocked: false,
  },
  {
    id: 'memo_3',
    personaId: 'jun',
    title: '숨기는 것',
    content: '???',
    isLocked: true,
    unlockCondition: '더 알아가면 기록됨',
  },
];

type TabType = 'progress' | 'memo';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('progress');
  const [selectedPersona, setSelectedPersona] = useState<PersonaProgress | null>(null);

  const profile = useHackerStore(state => state.getProfile('jun'));
  const hackLevel = profile?.hackLevel ?? 1;

  // 페르소나 선택 화면
  if (!selectedPersona) {
    return (
      <div className="min-h-screen bg-black text-white pb-24">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
          <div className="px-4 py-4">
            <h1 className="text-lg font-bold">기억</h1>
            <p className="text-xs text-white/40 mt-0.5">누군가를 선택하세요</p>
          </div>
        </div>

        {/* 페르소나 선택 그리드 */}
        <div className="px-4 pt-4">
          <div className="space-y-3">
            {PERSONA_PROGRESS.map((persona, idx) => {
              const isUnlocked = persona.storyProgress > 0;
              const progressPercent = (persona.affection / persona.maxAffection) * 100;

              return (
                <motion.button
                  key={persona.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  onClick={() => isUnlocked && setSelectedPersona(persona)}
                  disabled={!isUnlocked}
                  className={`w-full p-4 rounded-xl border text-left transition ${
                    isUnlocked
                      ? 'bg-white/[0.03] border-white/10 active:bg-white/[0.06]'
                      : 'bg-white/[0.01] border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* 프로필 이미지 */}
                    <div className="relative">
                      <div className={`w-14 h-14 rounded-full overflow-hidden ${
                        !isUnlocked && 'grayscale opacity-50'
                      }`}>
                        <img
                          src={persona.image}
                          alt={persona.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {!isUnlocked && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-white/40" />
                        </div>
                      )}
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{persona.name}</h3>
                        {isUnlocked && (
                          <span className="text-xs text-white/40">
                            {persona.relationship}
                          </span>
                        )}
                      </div>

                      {isUnlocked ? (
                        <>
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
                        </>
                      ) : (
                        <p className="text-xs text-white/20 mt-0.5">잠김</p>
                      )}
                    </div>

                    {/* 화살표 */}
                    {isUnlocked && (
                      <ChevronLeft className="w-4 h-4 text-white/20 rotate-180" />
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* 전체 통계 - 심플하게 */}
          <div className="mt-6 p-4 bg-white/[0.02] border border-white/5 rounded-xl">
            <div className="flex justify-around text-sm">
              <div className="text-center">
                <p className="text-lg font-medium">{PERSONA_PROGRESS.filter(p => p.storyProgress > 0).length}</p>
                <p className="text-xs text-white/30">캐릭터</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-medium">
                  {PERSONA_PROGRESS.reduce((sum, p) => sum + p.unlockedSecrets, 0)}
                </p>
                <p className="text-xs text-white/30">비밀</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-12 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPersona(null)}
              className="p-1 -ml-1 hover:bg-white/5 rounded-lg transition"
            >
              <ChevronLeft className="w-5 h-5 text-white/50" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden">
                <img src={selectedPersona.image} alt={selectedPersona.name} className="w-full h-full object-cover" />
              </div>
              <span className="font-medium">{selectedPersona.name}</span>
            </div>
          </div>
        </div>

        {/* Tabs - 미니멀 */}
        <div className="flex px-4 pb-3 gap-4">
          {[
            { id: 'progress' as TabType, label: '우리 사이' },
            { id: 'memo' as TabType, label: '메모' },
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
          {activeTab === 'progress' && selectedPersona && (
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
                      src={selectedPersona.image}
                      alt={selectedPersona.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="font-medium">{selectedPersona.name}</h2>
                    <p className="text-xs text-white/40">{selectedPersona.currentArc}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-sm text-white/70">{selectedPersona.relationship}</p>
                  </div>
                </div>

                {/* 감성적인 프로그레스 바들 */}
                <div className="space-y-3">
                  <ProgressBar
                    label="마음을 연 정도"
                    value={selectedPersona.affection}
                    max={selectedPersona.maxAffection}
                  />
                  <ProgressBar
                    label="함께한 이야기"
                    value={selectedPersona.storyProgress}
                    max={selectedPersona.totalStories}
                  />
                  <ProgressBar
                    label="알게 된 비밀"
                    value={selectedPersona.unlockedSecrets}
                    max={selectedPersona.totalSecrets}
                  />
                </div>
              </div>

              {/* 관계 온도 */}
              <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                <p className="text-xs text-white/40 mb-3">지금 우리 사이는</p>
                <RadarChart stats={selectedPersona.stats} />

                {/* 스탯 목록 - 감성적 */}
                <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                  {Object.entries(selectedPersona.stats).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-sm font-medium">{value}</p>
                      <p className="text-[10px] text-white/30">{getStatLabel(key)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* 다음 이야기 */}
              <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
                <p className="text-xs text-white/40 mb-2">조금만 더 가까워지면</p>
                <p className="text-sm text-white/70">새로운 이야기가 시작될 것 같다</p>
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
                {selectedPersona?.name}에 대해 알게 된 것들
              </p>

              {MEMOS.map((memo, idx) => (
                <motion.div
                  key={memo.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-3 rounded-xl border ${
                    memo.isLocked
                      ? 'bg-white/[0.01] border-white/5'
                      : 'bg-white/[0.03] border-white/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {memo.isLocked && (
                      <Lock className="w-4 h-4 text-white/20 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <h4 className={`text-sm ${memo.isLocked ? 'text-white/30' : 'text-white'}`}>
                        {memo.title}
                      </h4>
                      <p className={`text-xs mt-0.5 ${memo.isLocked ? 'text-white/20' : 'text-white/50'}`}>
                        {memo.content}
                      </p>
                      {memo.isLocked && memo.unlockCondition && (
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
  const percent = (value / max) * 100;
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

// 레이더 차트 컴포넌트 - 심플
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
function getStatLabel(key: string): string {
  const labels: Record<string, string> = {
    trust: '신뢰',
    intimacy: '친밀',
    mystery: '미스터리',
    chemistry: '케미',
    loyalty: '충성',
  };
  return labels[key] || key;
}

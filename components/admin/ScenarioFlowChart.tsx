'use client';

import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Position,
  MarkerType,
  Handle,
  NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Type, ListChecks, UserCircle, ArrowRightLeft } from 'lucide-react';

interface ScenarioChoice {
  id: string;
  text: string;
  tone?: string;
  next_scene?: string;
  affection_change?: number;
  flag?: string;
  is_premium?: boolean;
}

interface ScenarioScene {
  id: string;
  type: 'narration' | 'dialogue' | 'choice' | 'character_appear' | 'transition';
  text?: string;
  character?: string;
  expression?: string;
  prompt?: string;
  choices?: ScenarioChoice[];
}

interface ScenarioFlowChartProps {
  scenes: ScenarioScene[];
  selectedSceneId?: string;
  onSceneSelect?: (sceneId: string) => void;
}

// 씬 타입별 색상
const SCENE_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  narration: { bg: '#f0f9ff', border: '#0ea5e9', text: '#0369a1' },
  dialogue: { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' },
  choice: { bg: '#fdf4ff', border: '#d946ef', text: '#a21caf' },
  character_appear: { bg: '#fff7ed', border: '#f97316', text: '#c2410c' },
  transition: { bg: '#f5f5f4', border: '#78716c', text: '#44403c' },
};

const SCENE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  narration: Type,
  dialogue: MessageSquare,
  choice: ListChecks,
  character_appear: UserCircle,
  transition: ArrowRightLeft,
};

// 노드 데이터 타입
interface SceneNodeData {
  label: string;
  type: string;
  index: number;
  text?: string;
  prompt?: string;
  character?: string;
  expression?: string;
  choices?: ScenarioChoice[];
}

// 커스텀 노드 컴포넌트
function SceneNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as SceneNodeData;
  const colors = SCENE_TYPE_COLORS[nodeData.type] || SCENE_TYPE_COLORS.narration;
  const Icon = SCENE_TYPE_ICONS[nodeData.type] || Type;
  const isChoice = nodeData.type === 'choice';
  const choices = nodeData.choices || [];

  return (
    <div
      className={`rounded-lg border-2 shadow-sm min-w-[180px] max-w-[280px] transition-all ${
        selected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
      }}
    >
      {/* 입력 핸들 */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
      />

      {/* 헤더 */}
      <div
        className="px-3 py-2 border-b flex items-center gap-2"
        style={{ borderColor: colors.border + '40' }}
      >
        <span style={{ color: colors.text }}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-xs font-medium" style={{ color: colors.text }}>
          {nodeData.label}
        </span>
        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
          #{nodeData.index}
        </Badge>
      </div>

      {/* 콘텐츠 */}
      <div className="px-3 py-2">
        {nodeData.character && (
          <div className="text-xs font-medium text-slate-700 mb-1">
            {nodeData.character}
            {nodeData.expression && (
              <span className="text-slate-400 ml-1">({nodeData.expression})</span>
            )}
          </div>
        )}
        <p className="text-xs text-slate-600 line-clamp-3">
          {nodeData.text || nodeData.prompt || '(내용 없음)'}
        </p>
      </div>

      {/* 선택지 표시 (choice 타입인 경우) */}
      {isChoice && choices.length > 0 && (
        <div className="px-3 py-2 border-t space-y-1" style={{ borderColor: colors.border + '40' }}>
          {choices.map((choice: ScenarioChoice, idx: number) => (
            <div
              key={choice.id}
              className="flex items-center gap-1 text-[10px] text-slate-600"
            >
              <span className="w-4 h-4 rounded bg-purple-100 text-purple-700 flex items-center justify-center font-medium">
                {idx + 1}
              </span>
              <span className="truncate flex-1">{choice.text || '(빈 선택지)'}</span>
              {choice.affection_change !== 0 && choice.affection_change !== undefined && (
                <span className={`font-medium ${choice.affection_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {choice.affection_change > 0 ? '+' : ''}{choice.affection_change}
                </span>
              )}
              {choice.is_premium && (
                <Badge className="text-[8px] px-1 py-0 bg-amber-100 text-amber-700">PRO</Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 출력 핸들 */}
      {isChoice ? (
        // Choice 노드는 선택지 개수만큼 핸들 생성
        choices.map((choice: ScenarioChoice, idx: number) => (
          <Handle
            key={choice.id}
            type="source"
            position={Position.Bottom}
            id={choice.id}
            className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
            style={{
              left: `${((idx + 1) / (choices.length + 1)) * 100}%`,
            }}
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
        />
      )}
    </div>
  );
}

// 노드 타입 등록
const nodeTypes = {
  scene: SceneNode,
};

export default function ScenarioFlowChart({
  scenes,
  selectedSceneId,
  onSceneSelect,
}: ScenarioFlowChartProps) {
  // 씬 데이터를 노드와 엣지로 변환
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const sceneIdToIndex = new Map<string, number>();

    // 씬 ID → 인덱스 맵 생성
    scenes.forEach((scene, idx) => {
      sceneIdToIndex.set(scene.id, idx);
    });

    // 노드 생성 (다단계 레이아웃)
    // 먼저 순차적 흐름과 분기를 분석
    const visited = new Set<string>();
    const levels: string[][] = [];

    // BFS로 레벨 할당
    const assignLevels = (startId: string, level: number) => {
      if (!startId || visited.has(startId)) return;
      visited.add(startId);

      if (!levels[level]) levels[level] = [];
      levels[level].push(startId);

      const scene = scenes.find(s => s.id === startId);
      if (!scene) return;

      if (scene.type === 'choice' && scene.choices) {
        scene.choices.forEach(choice => {
          if (choice.next_scene) {
            assignLevels(choice.next_scene, level + 1);
          }
        });
      } else {
        // 순차 진행: 다음 씬으로
        const idx = sceneIdToIndex.get(startId);
        if (idx !== undefined && idx < scenes.length - 1) {
          const nextScene = scenes[idx + 1];
          assignLevels(nextScene.id, level + 1);
        }
      }
    };

    // 첫 씬부터 시작
    if (scenes.length > 0) {
      assignLevels(scenes[0].id, 0);
    }

    // 방문하지 않은 씬 처리 (도달 불가능한 씬)
    scenes.forEach((scene, idx) => {
      if (!visited.has(scene.id)) {
        // 마지막 레벨에 추가
        const lastLevel = levels.length;
        if (!levels[lastLevel]) levels[lastLevel] = [];
        levels[lastLevel].push(scene.id);
      }
    });

    // 노드 위치 계산
    const NODE_WIDTH = 220;
    const NODE_HEIGHT = 150;
    const HORIZONTAL_GAP = 60;
    const VERTICAL_GAP = 80;

    levels.forEach((levelScenes, levelIdx) => {
      const totalWidth = levelScenes.length * NODE_WIDTH + (levelScenes.length - 1) * HORIZONTAL_GAP;
      const startX = -totalWidth / 2;

      levelScenes.forEach((sceneId, posIdx) => {
        const scene = scenes.find(s => s.id === sceneId);
        if (!scene) return;

        const typeLabel = {
          narration: '나레이션',
          dialogue: '대화',
          choice: '선택지',
          character_appear: '캐릭터 등장',
          transition: '전환',
        }[scene.type] || scene.type;

        nodes.push({
          id: scene.id,
          type: 'scene',
          position: {
            x: startX + posIdx * (NODE_WIDTH + HORIZONTAL_GAP),
            y: levelIdx * (NODE_HEIGHT + VERTICAL_GAP),
          },
          data: {
            label: typeLabel,
            type: scene.type,
            index: sceneIdToIndex.get(scene.id),
            text: scene.text,
            prompt: scene.prompt,
            character: scene.character,
            expression: scene.expression,
            choices: scene.choices,
          },
          selected: scene.id === selectedSceneId,
        });
      });
    });

    // 엣지 생성
    scenes.forEach((scene, idx) => {
      if (scene.type === 'choice' && scene.choices) {
        // 선택지에서 다음 씬으로 연결
        scene.choices.forEach((choice, choiceIdx) => {
          if (choice.next_scene && sceneIdToIndex.has(choice.next_scene)) {
            edges.push({
              id: `${scene.id}-${choice.id}`,
              source: scene.id,
              target: choice.next_scene,
              sourceHandle: choice.id,
              animated: true,
              style: { stroke: '#d946ef', strokeWidth: 2 },
              label: `${choiceIdx + 1}`,
              labelStyle: { fill: '#d946ef', fontWeight: 600, fontSize: 10 },
              labelBgStyle: { fill: '#fdf4ff', fillOpacity: 0.8 },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#d946ef',
              },
            });
          }
        });
      } else {
        // 순차 진행
        if (idx < scenes.length - 1) {
          const nextScene = scenes[idx + 1];
          edges.push({
            id: `${scene.id}-next`,
            source: scene.id,
            target: nextScene.id,
            style: { stroke: '#94a3b8', strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#94a3b8',
            },
          });
        }
      }
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [scenes, selectedSceneId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 씬 변경 시 노드/엣지 업데이트
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // 노드 클릭 핸들러
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onSceneSelect?.(node.id);
    },
    [onSceneSelect]
  );

  if (scenes.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border-2 border-dashed">
        씬을 추가하면 플로우차트가 표시됩니다
      </div>
    );
  }

  return (
    <div className="h-[500px] border rounded-lg overflow-hidden bg-slate-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const colors = SCENE_TYPE_COLORS[node.data?.type as string];
            return colors?.border || '#94a3b8';
          }}
          maskColor="rgb(240, 240, 240, 0.8)"
          className="!bg-white"
        />
      </ReactFlow>

      {/* 범례 */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-sm border">
        <p className="text-xs font-medium text-slate-600 mb-2">범례</p>
        <div className="flex flex-wrap gap-3">
          {Object.entries(SCENE_TYPE_COLORS).map(([type, colors]) => {
            const Icon = SCENE_TYPE_ICONS[type];
            const label = {
              narration: '나레이션',
              dialogue: '대화',
              choice: '선택지',
              character_appear: '캐릭터',
              transition: '전환',
            }[type];
            return (
              <div key={type} className="flex items-center gap-1">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: colors.border }}
                />
                <span className="text-[10px] text-slate-500">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

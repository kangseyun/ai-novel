'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Layers,
  Plus,
  Check,
  X,
  ExternalLink,
  Trash2,
  Pin,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';

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
  width: number;
  height: number;
  status: 'generated' | 'approved' | 'rejected' | 'used';
  created_at: string;
  parent_image_id?: string | null;
  is_base?: boolean;
  generation_group_id?: string | null;
}

interface AdSize {
  width: number;
  height: number;
  label: string;
}

interface ImageNode {
  image: MarketingImage;
  children: ImageNode[];
  level: number;
  isExpanded: boolean;
}

interface ImageTreeViewProps {
  images: MarketingImage[];
  sizes: Record<string, AdSize>;
  baseImageUrl: string | null;
  onSetAsBase: (imageUrl: string) => void;
  onGenerateSizes: (baseImageUrl: string) => void;
  onUpdateStatus: (imageId: string, status: string) => void;
  onDelete: (imageId: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  generated: 'bg-gray-100 text-gray-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  used: 'bg-purple-100 text-purple-800',
};

const SIZE_COLORS: Record<string, string> = {
  'feed-square': 'border-blue-400',
  'feed-portrait': 'border-green-400',
  'story': 'border-purple-400',
  'carousel': 'border-orange-400',
};

export function ImageTreeView({
  images,
  sizes,
  baseImageUrl,
  onSetAsBase,
  onGenerateSizes,
  onUpdateStatus,
  onDelete,
}: ImageTreeViewProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // 이미지를 트리 구조로 변환
  const imageTree = useMemo(() => {
    const imageMap = new Map<string, ImageNode>();
    const roots: ImageNode[] = [];

    // 먼저 모든 이미지를 노드로 변환
    images.forEach((img) => {
      imageMap.set(img.id, {
        image: img,
        children: [],
        level: 0,
        isExpanded: expandedNodes.has(img.id),
      });
    });

    // 부모-자식 관계 설정
    images.forEach((img) => {
      const node = imageMap.get(img.id)!;
      if (img.parent_image_id && imageMap.has(img.parent_image_id)) {
        const parent = imageMap.get(img.parent_image_id)!;
        parent.children.push(node);
        node.level = parent.level + 1;
      } else {
        // 부모가 없으면 루트
        roots.push(node);
      }
    });

    // 베이스 이미지 (1:1)를 먼저 정렬
    roots.sort((a, b) => {
      if (a.image.ad_size === 'feed-square' && b.image.ad_size !== 'feed-square') return -1;
      if (a.image.ad_size !== 'feed-square' && b.image.ad_size === 'feed-square') return 1;
      return new Date(b.image.created_at).getTime() - new Date(a.image.created_at).getTime();
    });

    // 자식들도 사이즈 순으로 정렬
    const sortChildren = (nodes: ImageNode[]) => {
      nodes.forEach((node) => {
        node.children.sort((a, b) => {
          const sizeOrder = ['feed-square', 'feed-portrait', 'story', 'carousel'];
          return sizeOrder.indexOf(a.image.ad_size) - sizeOrder.indexOf(b.image.ad_size);
        });
        sortChildren(node.children);
      });
    };
    sortChildren(roots);

    return roots;
  }, [images, expandedNodes]);

  // 베이스 이미지들만 그룹화 (같은 generation_group_id 또는 parent가 없는 1:1 이미지들)
  const baseGroups = useMemo(() => {
    const groups: Map<string, ImageNode[]> = new Map();

    imageTree.forEach((node) => {
      const groupId = node.image.generation_group_id || node.image.id;
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)!.push(node);
    });

    return Array.from(groups.values());
  }, [imageTree]);

  const toggleExpand = useCallback((imageId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.1, 1.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.1, 0.5));
  const handleResetZoom = () => setZoom(1);

  // 노드 렌더링
  const renderNode = (node: ImageNode, isLast: boolean, parentLines: boolean[]) => {
    const { image, children } = node;
    const isBase = image.image_url === baseImageUrl;
    const isExpanded = expandedNodes.has(image.id);
    const hasChildren = children.length > 0;
    const sizeColor = SIZE_COLORS[image.ad_size] || 'border-gray-400';

    return (
      <div key={image.id} className="relative">
        {/* 연결선 */}
        <div className="flex">
          {/* 부모와의 연결선 */}
          {parentLines.map((showLine, idx) => (
            <div
              key={idx}
              className={cn(
                'w-8 flex-shrink-0',
                showLine && 'border-l-2 border-dashed border-gray-300'
              )}
            />
          ))}

          {/* 현재 노드와의 연결선 */}
          {node.level > 0 && (
            <div className="w-8 flex-shrink-0 relative">
              <div
                className={cn(
                  'absolute left-0 top-0 h-1/2 border-l-2 border-dashed border-gray-300',
                  isLast && 'border-l-2'
                )}
              />
              <div className="absolute left-0 top-1/2 w-full border-t-2 border-dashed border-gray-300" />
              {!isLast && (
                <div className="absolute left-0 top-1/2 h-1/2 border-l-2 border-dashed border-gray-300" />
              )}
            </div>
          )}

          {/* 이미지 카드 */}
          <div
            className={cn(
              'flex-1 p-2 rounded-lg border-2 transition-all cursor-pointer',
              sizeColor,
              isBase && 'ring-2 ring-primary ring-offset-2',
              selectedImage === image.id && 'bg-primary/5',
              'hover:shadow-md'
            )}
            onClick={() => setSelectedImage(image.id === selectedImage ? null : image.id)}
          >
            <div className="flex gap-3">
              {/* 썸네일 */}
              <div className="relative flex-shrink-0">
                <img
                  src={image.image_url}
                  alt={image.persona_name}
                  className="w-20 h-20 rounded object-cover"
                />
                {isBase && (
                  <div className="absolute -top-1 -left-1 bg-primary text-primary-foreground p-1 rounded-full">
                    <Pin className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">{image.persona_name}</span>
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">
                    {sizes[image.ad_size]?.label || image.ad_size_label}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <Badge className={cn('text-[10px]', STATUS_COLORS[image.status])}>
                    {image.status === 'generated' && '검토중'}
                    {image.status === 'approved' && '승인'}
                    {image.status === 'rejected' && '거절'}
                    {image.status === 'used' && '사용됨'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(image.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>

                {/* 액션 버튼들 */}
                {selectedImage === image.id && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {!isBase && image.ad_size === 'feed-square' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetAsBase(image.image_url);
                        }}
                      >
                        <Pin className="w-3 h-3 mr-1" />
                        베이스로
                      </Button>
                    )}
                    {image.ad_size === 'feed-square' && (
                      <Button
                        size="sm"
                        variant="default"
                        className="h-6 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateSizes(image.image_url);
                        }}
                      >
                        <Layers className="w-3 h-3 mr-1" />
                        사이즈 생성
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant={image.status === 'approved' ? 'default' : 'outline'}
                      className="h-6 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(image.id, 'approved');
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant={image.status === 'rejected' ? 'destructive' : 'outline'}
                      className="h-6 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateStatus(image.id, 'rejected');
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(image.image_url, '_blank');
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-6 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(image.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>

              {/* 확장/축소 버튼 */}
              {hasChildren && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(image.id);
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 자식 노드들 */}
        {isExpanded && hasChildren && (
          <div className="mt-2">
            {children.map((child, idx) =>
              renderNode(
                child,
                idx === children.length - 1,
                [...parentLines, !isLast]
              )
            )}
          </div>
        )}
      </div>
    );
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-16 border rounded-lg bg-muted/30">
        <Layers className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground mb-2">아직 생성된 이미지가 없습니다</p>
        <p className="text-sm text-muted-foreground">
          이미지를 생성하면 트리 형태로 관계를 확인할 수 있습니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 툴바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">이미지 트리</span>
          <Badge variant="secondary">{images.length}개</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button size="sm" variant="outline" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleResetZoom}>
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-blue-400" />
          <span>정사각형 (1:1)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-green-400" />
          <span>세로형 (4:5)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-purple-400" />
          <span>스토리 (9:16)</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded border-2 border-orange-400" />
          <span>캐러셀 (1:1)</span>
        </div>
      </div>

      {/* 트리 뷰 */}
      <div
        className="border rounded-lg p-4 overflow-auto bg-muted/10"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
      >
        <div className="space-y-4 min-w-[500px]">
          {imageTree.map((node, idx) =>
            renderNode(node, idx === imageTree.length - 1, [])
          )}
        </div>
      </div>
    </div>
  );
}

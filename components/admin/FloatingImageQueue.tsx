'use client';

import { useState } from 'react';
import { useImageGenerationQueue } from '@/hooks/useImageGenerationQueue';
import { Image as ImageIcon, X, Loader2, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function FloatingImageQueue() {
  const { processingTasks } = useImageGenerationQueue();
  const [isExpanded, setIsExpanded] = useState(false);

  // Don't show if no tasks
  if (processingTasks.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Expanded Panel */}
      {isExpanded && (
        <div className="mb-2 bg-card border rounded-lg shadow-lg w-80 max-h-80 overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span className="text-sm font-medium">이미지 생성 중</span>
            </div>
            <div className="flex items-center gap-1">
              <Link href="/admin/image-queue">
                <Button variant="ghost" size="icon" className="w-6 h-6" title="큐 페이지로 이동">
                  <ExternalLink className="w-3 h-3" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6"
                onClick={() => setIsExpanded(false)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-2 space-y-2">
            {processingTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center gap-3 p-2 rounded-md bg-muted/30 hover:bg-muted/50"
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {task.persona_name || 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {task.status === 'pending' ? '대기중...' : '생성중...'}
                  </p>
                </div>
                <Link href={`/admin/personas/${task.persona_id}`}>
                  <Button variant="ghost" size="icon" className="w-6 h-6 flex-shrink-0">
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg transition-all"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm font-medium">
          이미지 {processingTasks.length}개 생성 중
        </span>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronUp className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

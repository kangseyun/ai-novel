'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { useImageGenerationQueue } from '@/hooks/useImageGenerationQueue';
import {
  Loader2, Image as ImageIcon, Clock, CheckCircle2, XCircle,
  ArrowLeft, RefreshCw, Trash2, Eye, ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ImageTask {
  id: string;
  persona_id: string;
  external_task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string | null;
  image_type: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  persona_name?: string;
  profile_image_url?: string;
}

interface ImageHistoryItem {
  id: string;
  persona_id: string;
  task_id: string | null;
  image_url: string;
  prompt: string | null;
  is_current: boolean;
  created_at: string;
  persona_name?: string;
}

type TabType = 'queue' | 'history';
type StatusFilter = 'all' | 'pending' | 'processing' | 'completed' | 'failed';

export default function ImageQueuePage() {
  const [activeTab, setActiveTab] = useState<TabType>('queue');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [allTasks, setAllTasks] = useState<ImageTask[]>([]);
  const [historyItems, setHistoryItems] = useState<ImageHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { processingTasks } = useImageGenerationQueue();
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function loadData() {
    setIsLoading(true);

    // Load all tasks (including completed/failed)
    let tasksQuery = supabase
      .from('persona_image_tasks')
      .select(`
        *,
        persona_core(name, profile_image_url)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (statusFilter !== 'all') {
      tasksQuery = tasksQuery.eq('status', statusFilter);
    }

    const { data: tasksData } = await tasksQuery;

    if (tasksData) {
      const tasksWithPersona = tasksData.map((t: any) => ({
        ...t,
        persona_name: t.persona_core?.name,
        profile_image_url: t.persona_core?.profile_image_url,
      }));
      setAllTasks(tasksWithPersona);
    }

    // Load history items
    const { data: historyData } = await supabase
      .from('persona_image_history')
      .select(`
        *,
        persona_core(name)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (historyData) {
      const historyWithPersona = historyData.map((h: any) => ({
        ...h,
        persona_name: h.persona_core?.name,
      }));
      setHistoryItems(historyWithPersona);
    }

    setIsLoading(false);
  }

  async function deleteTask(taskId: string) {
    if (!confirm('이 태스크를 삭제하시겠습니까?')) return;

    const { error } = await supabase
      .from('persona_image_tasks')
      .delete()
      .eq('id', taskId);

    if (!error) {
      setAllTasks(prev => prev.filter(t => t.id !== taskId));
    }
  }

  async function deleteHistoryItem(historyId: string) {
    if (!confirm('이 이미지를 히스토리에서 삭제하시겠습니까?')) return;

    const { error } = await supabase
      .from('persona_image_history')
      .delete()
      .eq('id', historyId);

    if (!error) {
      setHistoryItems(prev => prev.filter(h => h.id !== historyId));
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
            <Clock className="w-3 h-3" />
            대기중
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            <Loader2 className="w-3 h-3 animate-spin" />
            생성중
          </span>
        );
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle2 className="w-3 h-3" />
            완료
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
            <XCircle className="w-3 h-3" />
            실패
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const pendingCount = allTasks.filter(t => t.status === 'pending' || t.status === 'processing').length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/personas">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />
              페르소나 목록
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              이미지 생성 큐
            </h1>
            <p className="text-sm text-muted-foreground">
              진행중 {pendingCount}개 · 전체 {allTasks.length}개
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <RefreshCw className="w-4 h-4 mr-1" />
          새로고침
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'queue'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-4 h-4" />
            생성 큐
            {pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'history'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            이미지 히스토리
            <span className="ml-1 text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded">
              {historyItems.length}
            </span>
          </button>
        </div>

        {activeTab === 'queue' && (
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="pending">대기중</SelectItem>
              <SelectItem value="processing">생성중</SelectItem>
              <SelectItem value="completed">완료</SelectItem>
              <SelectItem value="failed">실패</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          로딩 중...
        </div>
      ) : activeTab === 'queue' ? (
        /* Queue Tab */
        <div className="space-y-2">
          {allTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
              <p>이미지 생성 태스크가 없습니다.</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">페르소나</th>
                    <th className="text-left px-4 py-3 font-medium">상태</th>
                    <th className="text-left px-4 py-3 font-medium">타입</th>
                    <th className="text-left px-4 py-3 font-medium">프롬프트</th>
                    <th className="text-left px-4 py-3 font-medium">생성일</th>
                    <th className="text-right px-4 py-3 font-medium">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center">
                            {task.profile_image_url ? (
                              <img
                                src={task.profile_image_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-muted-foreground/50" />
                            )}
                          </div>
                          <Link
                            href={`/admin/personas/${task.persona_id}`}
                            className="font-medium hover:underline"
                          >
                            {task.persona_name || task.persona_id}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(task.status)}
                        {task.error_message && (
                          <p className="text-xs text-red-500 mt-1 max-w-[200px] truncate">
                            {task.error_message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {task.image_type}
                      </td>
                      <td className="px-4 py-3">
                        <p className="max-w-[300px] truncate text-muted-foreground text-xs">
                          {task.prompt || '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(task.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/personas/${task.persona_id}`}>
                            <Button variant="ghost" size="icon" title="페르소나 보기">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteTask(task.id)}
                            className="text-destructive hover:text-destructive"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* History Tab */
        <div className="space-y-4">
          {historyItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
              <p>이미지 히스토리가 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all"
                >
                  {/* Image */}
                  <div className="aspect-square bg-muted relative">
                    <img
                      src={item.image_url}
                      alt=""
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setSelectedImage(item.image_url)}
                    />
                    {item.is_current && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium bg-green-500/90 text-white">
                        현재
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <Link
                      href={`/admin/personas/${item.persona_id}`}
                      className="font-medium text-sm truncate block hover:underline"
                    >
                      {item.persona_name || 'Unknown'}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.created_at)}
                    </p>
                  </div>

                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedImage(item.image_url)}
                      title="크게 보기"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Link href={`/admin/personas/${item.persona_id}`}>
                      <Button size="sm" variant="secondary" title="페르소나 보기">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => deleteHistoryItem(item.id)}
                      className="text-destructive"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Preview Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl max-h-[90vh] relative">
            <img
              src={selectedImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => setSelectedImage(null)}
            >
              닫기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

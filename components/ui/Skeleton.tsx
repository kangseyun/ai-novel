'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-white/10',
        className
      )}
    />
  );
}

// 피드 포스트 스켈레톤
export function FeedPostSkeleton() {
  return (
    <div className="bg-black">
      {/* Header */}
      <div className="flex items-center gap-3 p-3">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
      {/* Image */}
      <Skeleton className="aspect-square w-full" />
      {/* Actions */}
      <div className="p-3">
        <div className="flex items-center gap-4 mb-3">
          <Skeleton className="w-6 h-6 rounded" />
          <Skeleton className="w-6 h-6 rounded" />
          <Skeleton className="w-6 h-6 rounded" />
        </div>
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

// DM 리스트 아이템 스켈레톤
export function DMItemSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4">
      <Skeleton className="w-14 h-14 rounded-full" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-3 w-40" />
      </div>
    </div>
  );
}

// 알림 아이템 스켈레톤
export function ActivityItemSkeleton() {
  return (
    <div className="p-4 flex items-start gap-3 bg-white/5 rounded-xl mb-2">
      <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-3 w-32 mb-1" />
        <Skeleton className="h-4 w-48" />
      </div>
    </div>
  );
}

// 프로필 스켈레톤
export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>

      {/* Profile Info */}
      <div className="p-6">
        <div className="flex items-center gap-6">
          <Skeleton className="w-20 h-20 rounded-full" />
          <div className="flex-1 flex justify-around">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-6 w-8 mx-auto mb-1" />
                <Skeleton className="h-3 w-10 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>

        <div className="mt-3 flex gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>

        <Skeleton className="w-full h-10 rounded-lg mt-4" />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <div className="flex-1 py-3 flex justify-center">
          <Skeleton className="w-5 h-5" />
        </div>
        <div className="flex-1 py-3 flex justify-center">
          <Skeleton className="w-5 h-5" />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 gap-0.5">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    </div>
  );
}

// 피드 스켈레톤 (여러 포스트)
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="divide-y divide-white/5">
      {[...Array(count)].map((_, i) => (
        <FeedPostSkeleton key={i} />
      ))}
    </div>
  );
}

// DM 리스트 스켈레톤
export function DMListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-white/5">
      {[...Array(count)].map((_, i) => (
        <DMItemSkeleton key={i} />
      ))}
    </div>
  );
}

// 알림 리스트 스켈레톤
export function ActivityListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="px-4">
      {[...Array(count)].map((_, i) => (
        <ActivityItemSkeleton key={i} />
      ))}
    </div>
  );
}

// 기억(Memory) 페르소나 아이템 스켈레톤
export function MemoryPersonaItemSkeleton() {
  return (
    <div className="w-full p-4 rounded-xl border bg-white/[0.03] border-white/10">
      <div className="flex items-center gap-3">
        <Skeleton className="w-14 h-14 rounded-full" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-3 w-24 mb-2" />
          <div className="flex items-center gap-2">
            <Skeleton className="flex-1 h-1 rounded-full" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
        <Skeleton className="w-4 h-4" />
      </div>
    </div>
  );
}

// 기억(Memory) 리스트 스켈레톤
export function MemoryListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-4">
          <Skeleton className="h-6 w-12 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>

      {/* 페르소나 리스트 */}
      <div className="px-4 pt-4 space-y-3">
        {[...Array(count)].map((_, i) => (
          <MemoryPersonaItemSkeleton key={i} />
        ))}
      </div>

      {/* 전체 통계 */}
      <div className="px-4 mt-6">
        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
          <div className="flex justify-around">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-6 w-8 mx-auto mb-1" />
                <Skeleton className="h-3 w-10 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 기억(Memory) 상세 스켈레톤
export function MemoryDetailSkeleton() {
  return (
    <div className="min-h-screen bg-black text-white pb-24">
      {/* Header */}
      <div className="sticky top-12 z-40 bg-black/95 backdrop-blur-xl border-b border-white/5">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-5 h-5" />
            <Skeleton className="w-7 h-7 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="flex px-4 pb-3 gap-4">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4 space-y-4">
        {/* 현재 관계 카드 */}
        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="w-12 h-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="text-right">
              <Skeleton className="h-4 w-16 mb-1" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
          {/* 프로그레스 바들 */}
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-10" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* 스탯 카드 */}
        <div className="p-4 bg-white/[0.03] border border-white/5 rounded-xl">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="w-full h-40 rounded" />
          <div className="mt-3 grid grid-cols-5 gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="text-center">
                <Skeleton className="h-4 w-6 mx-auto mb-1" />
                <Skeleton className="h-2 w-8 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

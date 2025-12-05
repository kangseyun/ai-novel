import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, serverError } from '@/lib/auth';
import { getRelationshipManager } from '@/lib/relationship';

/**
 * GET /api/memory
 * 유저의 기억 페이지 데이터 (관계 형성된 페르소나 목록)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const manager = getRelationshipManager();
    const data = await manager.getMemoryListData(user.id);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[Memory] Error:', error);
    return serverError(error);
  }
}

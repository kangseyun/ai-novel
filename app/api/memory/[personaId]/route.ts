import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, unauthorized, badRequest, serverError } from '@/lib/auth';
import {
  getRelationshipManager,
  getMemoryTitle,
  getPersonaMemoryTypes,
  getPersonaUnlockStatus,
  getPersonaMemoryTitle,
} from '@/lib/relationship';

/**
 * GET /api/memory/:personaId
 * 특정 페르소나와의 상세 기억 정보
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId } = await params;

    if (!personaId) {
      return badRequest('personaId is required');
    }

    const manager = getRelationshipManager();

    const [data, unlockProgress, personaMemoryTypes] = await Promise.all([
      manager.getMemoryDetailData(user.id, personaId),
      getPersonaUnlockStatus(user.id, personaId),
      getPersonaMemoryTypes(personaId),
    ]);

    return NextResponse.json({
      ...data,
      unlockProgress,
      // 페르소나별 기억 타입 정보 추가
      personaMemoryTypes: personaMemoryTypes.map(t => ({
        id: t.id,
        title: t.title,
        description: t.description,
        emoji: t.emoji,
      })),
    });
  } catch (error) {
    console.error('[Memory Detail] Error:', error);
    return serverError(error);
  }
}

/**
 * POST /api/memory/:personaId
 * 새 기억 추가 (DM/시나리오에서 호출)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId } = await params;
    const body = await request.json();

    const { memoryType, summary, details, emotionalWeight, sourceType, sourceId } = body;

    if (!memoryType || !summary) {
      return badRequest('memoryType and summary are required');
    }

    const manager = getRelationshipManager();

    const memory = await manager.saveMemory(user.id, personaId, {
      type: memoryType,
      summary,
      details: details || {},
      emotionalWeight: emotionalWeight || undefined,
      sourceType: sourceType || 'manual',
      sourceId: sourceId || undefined,
    });

    if (!memory) {
      // 중복 기억
      return NextResponse.json({ success: true, duplicate: true });
    }

    // 페르소나별 기억 타입 정보로 제목 가져오기
    const personaMemoryTypes = await getPersonaMemoryTypes(personaId);
    const title = getPersonaMemoryTitle(memory.type, personaMemoryTypes);

    return NextResponse.json({
      success: true,
      memory: {
        id: memory.id,
        type: memory.type,
        title,
        content: memory.summary,
      },
    });
  } catch (error) {
    console.error('[Memory Create] Error:', error);
    return serverError(error);
  }
}

/**
 * PUT /api/memory/:personaId
 * 별명 설정
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) return unauthorized();

    const { personaId } = await params;
    const body = await request.json();

    const { action, nicknameType, nickname } = body;

    if (action === 'set_nickname') {
      if (!nicknameType || !nickname) {
        return badRequest('nicknameType and nickname are required');
      }

      const manager = getRelationshipManager();
      await manager.setNickname(user.id, personaId, {
        type: nicknameType,
        nickname,
      });

      return NextResponse.json({ success: true });
    }

    return badRequest('Unknown action');
  } catch (error) {
    console.error('[Memory Update] Error:', error);
    return serverError(error);
  }
}

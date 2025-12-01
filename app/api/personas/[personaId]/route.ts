import { NextRequest, NextResponse } from 'next/server';

// GET /api/personas/:personaId - 페르소나 상세 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params;

  const personas: Record<string, object> = {
    jun: {
      id: 'jun',
      name: 'Jun',
      full_name: '이준혁',
      age: 24,
      occupation: '아이돌 그룹 ECLIPSE 센터/메인보컬',
      public_personality: '완벽한 아이돌, 국민 남친',
      private_personality: '외로움을 느끼는 청년, 의존적, 질투심',
      speech_patterns: {
        formal: '~요, ~네요',
        casual: '~야, ~어',
        emotional_cues: ['...', 'ㅎㅎ', '후...'],
      },
      sns_profile: {
        username: '@jun.eclipse',
        followers: '2.4M',
        bio: 'ECLIPSE | Main Vocal | 여러분 덕분에 여기까지 왔어요 💜',
      },
      background: `어릴 때부터 춤추고 노래하는 걸 좋아했던 평범한 소년.
      17살에 연습생이 되어 3년간 힘든 연습생 생활을 거쳐 데뷔.
      화려한 무대 뒤에는 늘 외로움과 싸우고 있다.
      팬들 앞에서는 완벽한 미소를 유지하지만,
      진짜 나를 알아주는 사람을 갈구하고 있다.`,
      likes: ['새벽 산책', '음악 듣기', '편의점 음식', '고양이'],
      dislikes: ['거짓말', '사람 많은 곳', '일정표', '비교당하는 것'],
    },
    minho: {
      id: 'minho',
      name: 'Minho',
      full_name: '강민호',
      age: 27,
      occupation: 'IT 스타트업 CEO',
      public_personality: '차갑고 냉철한 사업가',
      private_personality: '숨겨진 따뜻함, 워커홀릭',
      available: false,
    },
  };

  const persona = personas[personaId];

  if (!persona) {
    return NextResponse.json(
      { error: 'Persona not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(persona);
}

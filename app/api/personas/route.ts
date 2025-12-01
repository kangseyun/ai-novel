import { NextResponse } from 'next/server';

// GET /api/personas - 페르소나 목록 조회
export async function GET() {
  // 정적 페르소나 데이터 (나중에 DB로 이동 가능)
  const personas = [
    {
      id: 'jun',
      name: 'Jun',
      full_name: '이준혁',
      age: 24,
      occupation: '아이돌',
      image: '/personas/jun-profile.jpg',
      color: '#8B5CF6',
      teaser_line: '...잠이 안 와. 너도?',
      available: true,
      episode_count: 5,
    },
    {
      id: 'minho',
      name: 'Minho',
      full_name: '강민호',
      age: 27,
      occupation: 'CEO',
      image: '/personas/minho-profile.jpg',
      color: '#3B82F6',
      teaser_line: '시간 없어. 짧게 말해.',
      available: false,
      episode_count: 0,
    },
    {
      id: 'yuna',
      name: 'Yuna',
      full_name: '한유나',
      age: 23,
      occupation: '배우',
      image: '/personas/yuna-profile.jpg',
      color: '#EC4899',
      teaser_line: '오빠, 나 심심해~',
      available: false,
      episode_count: 0,
    },
  ];

  return NextResponse.json({ personas });
}

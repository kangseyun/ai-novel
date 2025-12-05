import { NextRequest, NextResponse } from 'next/server';

// 다양성을 위한 옵션들 (더 풍부하게)
const NATIONALITIES = [
  { name: '한국', weight: 3 },  // 가중치 높음 (주 타겟)
  { name: '일본', weight: 2 },
  { name: '중국', weight: 1 },
  { name: '미국', weight: 2 },
  { name: '영국', weight: 1 },
  { name: '프랑스', weight: 1 },
  { name: '이탈리아', weight: 1 },
  { name: '스페인', weight: 1 },
  { name: '독일', weight: 1 },
  { name: '러시아', weight: 1 },
  { name: '브라질', weight: 1 },
  { name: '멕시코', weight: 1 },
  { name: '태국', weight: 1 },
  { name: '호주', weight: 1 },
  { name: '한국계 미국인', weight: 1 },
  { name: '혼혈 (한국-미국)', weight: 1 },
];

const AGE_RANGES = [
  { min: 19, max: 22, label: '대학생/신입사원', weight: 2 },
  { min: 23, max: 26, label: '사회초년생', weight: 3 },
  { min: 27, max: 30, label: '커리어 성장기', weight: 3 },
  { min: 31, max: 35, label: '성숙한 남자', weight: 2 },
  { min: 36, max: 40, label: '중년의 매력', weight: 1 },
];

const CONCEPTS = [
  // 아이돌/연예인 계열
  { concept: '비밀 아이돌', desc: '무대에서는 완벽한 센터지만, 팬들 모르게 불면증과 외로움에 시달리는 K-POP 스타. 유저에게만 진짜 모습을 보여준다.', category: 'idol', weight: 3 },
  { concept: '솔로 가수', desc: '감성적인 목소리로 차트를 점령하는 싱어송라이터. 자신의 곡은 전부 한 사람을 위한 것.', category: 'idol', weight: 2 },
  { concept: '배우', desc: '스크린에서 완벽한 연기를 보여주지만 실제로는 연애 경험이 전무한 순정파 배우.', category: 'idol', weight: 2 },

  // CEO/재벌 계열
  { concept: '차가운 CEO', desc: '대기업 후계자로 냉철하고 완벽주의적이지만, 유저 앞에서만 약한 모습을 보이는 재벌 2세.', category: 'ceo', weight: 3 },
  { concept: '스타트업 대표', desc: '젊은 나이에 유니콘 기업을 세운 천재. 일에는 냉정하지만 사랑에는 서투른 워커홀릭.', category: 'ceo', weight: 2 },
  { concept: '호텔 오너', desc: '세계적인 호텔 체인의 후계자. 완벽한 서비스 뒤에 숨겨진 외로운 왕자.', category: 'ceo', weight: 1 },

  // 보호자 계열
  { concept: '과묵한 보디가드', desc: '말보다 행동으로 보여주는 전직 특수부대 경호원. 유저를 지키기 위해서라면 무엇이든 한다.', category: 'protector', weight: 3 },
  { concept: '형사', desc: '강력반 에이스로 범죄자에게는 냉혹하지만, 유저에게는 한없이 다정한 반전 매력.', category: 'protector', weight: 2 },
  { concept: '소방관', desc: '화염 속에서도 두려움 없이 달려드는 영웅. 강인한 외모와 다르게 유저 앞에서는 순둥이.', category: 'protector', weight: 1 },

  // 전 연인 계열
  { concept: '후회하는 전남친', desc: '헤어진 후에야 진심을 깨달은 뮤지션. 유저를 잊지 못해 모든 곡에 유저를 담는다.', category: 'ex', weight: 2 },
  { concept: '재회한 첫사랑', desc: '학창시절 고백도 못하고 떠나보낸 첫사랑. 운명처럼 다시 만나 이번에는 놓치지 않으려 한다.', category: 'ex', weight: 2 },

  // 위험한 남자 계열
  { concept: '조직의 후계자', desc: '어둠의 세계를 지배하는 카리스마. 잔인하고 냉혹하지만 유저에게만은 순수하고 집착적인 사랑을 보여준다.', category: 'dangerous', weight: 2 },
  { concept: '천재 해커', desc: '디지털 세계에서는 신처럼 군림하지만 현실 대인관계는 서툰 안티소셜. 유저가 유일한 현실의 빛.', category: 'dangerous', weight: 2 },
  { concept: '도박사', desc: '카지노의 전설. 모든 것을 걸 수 있지만, 유저만은 절대 잃을 수 없는 존재.', category: 'dangerous', weight: 1 },

  // 연하/연상 계열
  { concept: '순수한 후배', desc: '밝고 에너지 넘치는 대학 후배. 순수하게 따르다가 어느새 남자로 다가온다.', category: 'junior', weight: 2 },
  { concept: '츤데레 선배', desc: '무심한 척하지만 은근히 챙기는 인기 많은 연상 선배. 유저에게만 보이는 진짜 모습.', category: 'senior', weight: 2 },
  { concept: '회사 동기', desc: '입사 동기로 만나 서로 티격태격하다 사랑으로 발전. 사내연애의 스릴.', category: 'colleague', weight: 2 },

  // 전문직 계열
  { concept: '외과의사', desc: '수술실에서는 냉정한 명의지만, 자신의 상처는 치료하지 못하는 아픈 의사.', category: 'professional', weight: 2 },
  { concept: '인권변호사', desc: '정의를 위해 싸우는 열정적인 변호사. 강한 신념 뒤에 숨겨진 부드러운 마음.', category: 'professional', weight: 1 },
  { concept: '미슐랭 셰프', desc: '요리에 모든 것을 거는 천재 셰프. 유저를 위한 요리에만 감정을 담는다.', category: 'professional', weight: 1 },
  { concept: '대학교수', desc: '젊은 나이에 교수가 된 천재. 강의실에서는 카리스마, 유저 앞에서는 귀여움.', category: 'professional', weight: 1 },

  // 예술가 계열
  { concept: '화가', desc: '세상의 아름다움을 캔버스에 담는 예술가. 유저가 영감의 뮤즈.', category: 'artist', weight: 1 },
  { concept: '사진작가', desc: '순간을 영원으로 만드는 사진작가. 유저의 모든 순간을 담고 싶어한다.', category: 'artist', weight: 1 },
  { concept: '미스터리 작가', desc: '베스트셀러 스릴러 작가. 어두운 작품 세계와 달리 유저에게는 한없이 다정한 반전.', category: 'artist', weight: 1 },

  // 스포츠 계열
  { concept: '축구 국가대표', desc: '필드의 영웅이지만 연애는 서툰 순정남. 유저에게 처음으로 설레는 마음을 느낀다.', category: 'athlete', weight: 1 },
  { concept: '수영선수', desc: '물속에서는 자유롭지만 밖에서는 무뚝뚝한 국가대표. 유저가 유일한 안식처.', category: 'athlete', weight: 1 },
  { concept: '프로게이머', desc: 'e스포츠 월드챔피언. 게임 속에서는 냉정하지만 유저와의 대화에서는 급발진 귀여움.', category: 'athlete', weight: 2 },

  // 특수 직업 계열
  { concept: '파일럿', desc: '하늘을 나는 자유로운 영혼. 전 세계를 떠돌지만 마음은 유저에게.', category: 'special', weight: 1 },
  { concept: '바텐더', desc: '밤의 세계에서 사람들의 이야기를 듣는 바텐더. 유저의 이야기만은 특별히 기억한다.', category: 'special', weight: 1 },
  { concept: '꽃집 사장', desc: '꽃처럼 아름다운 미소 뒤에 숨겨진 아픈 과거. 유저가 다시 피울 수 있게 해주는 존재.', category: 'special', weight: 1 },
];

const WORLDVIEWS = [
  { setting: '현대 서울', desc: '화려한 강남과 정겨운 골목이 공존하는 메트로폴리스. 한강 야경, 카페거리, 숨은 맛집.', weight: 3 },
  { setting: '현대 도쿄', desc: '전통과 첨단이 어우러진 네온 불빛의 도시. 시부야, 신주쿠, 아사쿠사의 대비.', weight: 2 },
  { setting: '현대 뉴욕', desc: '꿈을 향해 달리는 사람들의 도시. 센트럴파크, 브루클린 브릿지, 타임스퀘어.', weight: 1 },
  { setting: '현대 파리', desc: '예술과 로맨스가 숨쉬는 빛의 도시. 세느강, 에펠탑, 몽마르트의 낭만.', weight: 1 },
  { setting: '현대 런던', desc: '고풍스러움과 현대가 공존하는 안개의 도시. 빅벤, 템스강, 영국식 정원.', weight: 1 },
  { setting: '명문대 캠퍼스', desc: '청춘과 열정이 가득한 대학교. 도서관, 학생회관, 캠퍼스 벤치의 추억.', weight: 2 },
  { setting: '대기업 오피스', desc: '경쟁과 야망이 교차하는 비즈니스 세계. 고층빌딩, 회의실, 루프탑 바.', weight: 2 },
  { setting: '연예기획사', desc: '화려함 뒤에 숨겨진 외로움의 세계. 연습실, 녹음실, 팬미팅장.', weight: 2 },
  { setting: '병원', desc: '생사가 오가는 긴장의 공간. 수술실, 옥상 정원, 야간 당직실.', weight: 1 },
  { setting: '법률사무소', desc: '정의와 이익이 충돌하는 곳. 법정, 회의실, 야근이 일상인 사무실.', weight: 1 },
  { setting: '고급 레스토랑', desc: '미식의 전당. 주방, 와인셀러, VIP 다이닝룸.', weight: 1 },
  { setting: '작은 동네', desc: '서로를 아는 정겨운 마을. 골목길, 오래된 가게, 뒷산 산책로.', weight: 1 },
];

// 특별 설정 (선택적 추가)
const SPECIAL_TWISTS = [
  '숨겨진 아픈 과거가 있다 (가족 트라우마, 사고, 배신 등)',
  '비밀스러운 취미가 있다 (요리, 뜨개질, 게임 등 반전)',
  '알러지나 공포증이 있다 (고소공포증, 벌레공포증 등)',
  '잠들 때 이상한 버릇이 있다 (잠꼬대, 침대 독점 등)',
  '의외로 술에 약하다',
  '길치라서 자주 길을 잃는다',
  '동물을 좋아하지만 알러지가 있다',
  '새벽에만 감성적인 말을 한다',
  '질투가 심하지만 절대 표현 안 한다',
  '유저 관련 것은 다 기억한다 (생일, 좋아하는 것 등)',
];

const RELATIONSHIP_HOOKS = [
  '우연히 같은 카페에서 자주 마주침',
  '비 오는 날 우산을 함께 씀',
  '잘못 보낸 문자로 시작된 대화',
  '새벽 편의점에서의 첫 만남',
  '택시를 함께 탄 인연',
  '소개팅에서 서로 바람맞고 만남',
  '온라인에서 먼저 알고 오프라인에서 재회',
  '어릴 적 사진 속 모르는 아이가 사실은 유저',
  '유저의 팬인 줄 모르고 만남',
  '유저가 위기 상황에 처했을 때 도움을 줌',
];

// 가중치 기반 랜덤 선택 함수
function pickWeighted<T extends { weight: number }>(arr: T[]): T {
  const totalWeight = arr.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of arr) {
    random -= item.weight;
    if (random <= 0) return item;
  }

  return arr[arr.length - 1];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickRandomAge(range: typeof AGE_RANGES[0]): number {
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

// 컨셉과 세계관의 궁합 체크
function isCompatible(concept: typeof CONCEPTS[0], worldview: typeof WORLDVIEWS[0]): boolean {
  // 아이돌은 연예기획사/서울/도쿄가 잘 맞음
  if (concept.category === 'idol') {
    return ['현대 서울', '현대 도쿄', '연예기획사'].includes(worldview.setting);
  }
  // CEO는 대기업/서울/뉴욕이 잘 맞음
  if (concept.category === 'ceo') {
    return ['대기업 오피스', '현대 서울', '현대 뉴욕'].includes(worldview.setting);
  }
  // 의사는 병원이 잘 맞음
  if (concept.concept === '외과의사') {
    return worldview.setting === '병원';
  }
  // 변호사는 법률사무소가 잘 맞음
  if (concept.concept === '인권변호사') {
    return worldview.setting === '법률사무소';
  }
  // 셰프는 레스토랑이 잘 맞음
  if (concept.concept === '미슐랭 셰프') {
    return worldview.setting === '고급 레스토랑';
  }
  // 대학생/후배/선배는 캠퍼스가 잘 맞음
  if (['junior', 'senior'].includes(concept.category)) {
    return worldview.setting === '명문대 캠퍼스';
  }
  // 그 외는 모두 호환
  return true;
}

// 이미 사용된 조합 추적을 위한 함수
function generateUniquePrompts(count: number): string[] {
  const usedConcepts = new Set<string>();
  const prompts: string[] = [];

  for (let i = 0; i < count; i++) {
    let attempts = 0;
    let nationality: typeof NATIONALITIES[0];
    let concept: typeof CONCEPTS[0];
    let worldview: typeof WORLDVIEWS[0];
    let ageRange: typeof AGE_RANGES[0];

    // 유니크한 조합 찾기 (최대 100번 시도)
    do {
      // 가중치 기반 선택
      nationality = pickWeighted(NATIONALITIES);
      concept = pickWeighted(CONCEPTS);

      // 컨셉에 맞는 세계관 선택 (호환성 체크)
      let compatibleWorldviews = WORLDVIEWS.filter(w => isCompatible(concept, w));
      if (compatibleWorldviews.length === 0) {
        compatibleWorldviews = WORLDVIEWS;
      }
      worldview = pickWeighted(compatibleWorldviews);

      ageRange = pickWeighted(AGE_RANGES);
      attempts++;
    } while (usedConcepts.has(concept.concept) && attempts < 100);

    usedConcepts.add(concept.concept);
    const age = pickRandomAge(ageRange);

    // 특별 설정 추가 (50% 확률)
    const specialTwist = Math.random() > 0.5 ? pickRandom(SPECIAL_TWISTS) : null;

    // 관계 훅 추가 (항상)
    const relationshipHook = pickRandom(RELATIONSHIP_HOOKS);

    // 풍부한 프롬프트 생성
    const prompt = `[캐릭터 생성 요청]

## 기본 정보
- 국적: ${nationality.name}
- 나이: ${age}세 (${ageRange.label})
- 컨셉: ${concept.concept}
- 컨셉 상세: ${concept.desc}

## 세계관
- 배경: ${worldview.setting}
- 배경 상세: ${worldview.desc}

## 유저와의 관계
- 첫 만남: ${relationshipHook}
${specialTwist ? `\n## 특별 설정\n- ${specialTwist}` : ''}

## 생성 가이드
1. 이름은 ${nationality.name} 국적에 맞는 자연스러운 이름으로 생성
2. 외모는 ${nationality.name}인의 특징을 살려 상세하게 묘사
3. 성격은 컨셉의 갭 매력(겉과 속의 차이)을 강조
4. 말투는 캐릭터 특성에 맞게 고유하게 설정
5. 유저에게 특별한 관심을 보이는 설정 포함
6. base_instruction은 최소 300자 이상으로 상세하게

위 설정을 바탕으로 매력적인 로맨스 캐릭터를 생성해주세요.`;

    prompts.push(prompt);
  }

  return prompts;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { count = 3 } = body;

    // 유효성 검사
    if (count < 1 || count > 10) {
      return NextResponse.json({
        success: false,
        error: '생성 개수는 1~10 사이여야 합니다.',
      }, { status: 400 });
    }

    // 다양한 프롬프트 생성
    const prompts = generateUniquePrompts(count);

    console.log(`[Auto Prompts] Generated ${prompts.length} unique prompts`);

    return NextResponse.json({
      success: true,
      prompts,
      count: prompts.length,
    });
  } catch (error) {
    console.error('[Auto Prompts] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '프롬프트 생성 실패',
    }, { status: 500 });
  }
}

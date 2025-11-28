# AI 채팅 소설 MVP 개발 계획 (업데이트됨)

## 1. 프로젝트 목표 및 전략
*   **목표:** 니치한 "인터랙티브 로맨스" 시장에서 높은 LTV(생애 가치) 잠재력 검증. 목표: 월 매출 $3,000.
*   **핵심 지표:**
    *   **LTV (생애 가치):** 목표 > $30 (유저당 높은 지출).
    *   **리텐션 (D1/D7):** 목표 > 40% / 15% (정서적 유대감의 고착성).
    *   **에셋 잠금 해제율:** 유료 음성/사진 잠금 해제 유저 비율.
*   **타겟 페르소나:** "소피" (30-45세 여성, 정서적 친밀감 & 고강도 로맨스 추구).

## 2. 핵심 MVP 기능 ("친밀감"을 위한 범위)

### A. 사용자 경험 (모바일 웹 - 채팅 인터페이스)
*   **인터페이스:** 고급 메신저 앱 느낌 (예: WhatsApp/iMessage 스타일이지만 프리미엄 느낌).
*   **온보딩:** 즉각적인 "인-미디어-레스(In-Media-Res, 이야기 중간부터 시작)" 도입. 유저가 이미 진행 중인 채팅에 진입 (예: "왜 내 전화 안 받았어?").
*   **상호작용:**
    *   객관식 (가이드됨) 또는 자유 텍스트 입력 (하이브리드).
    *   *MVP 전략:* **하이브리드**로 시작 (플롯 진행을 위한 선택지, "친밀감/스몰토크"를 위한 자유 텍스트).

### B. "기억" 시스템 (기술적 차별화 요소)
*   **문맥 인식:** AI 캐릭터는 유저가 언급한 주요 사실(이름, 직업, 기분)을 기억해야 함.
*   **구현:** MVP를 위한 단순 Key-Value 추출 (예: `user_mood: sad`, `user_name: Sophie`).

### C. 수익화 ("고래" 모델)
*   **재화:** "하트" 또는 "코인".
*   **페이월(Paywalls):**
    1.  **선택지 잠금:** "그에게 키스하기" (프리미엄 선택지 - 15 코인).
    2.  **에셋 잠금 (고가치):** 캐릭터가 흐릿한 사진이나 잠긴 음성 메시지를 보냄. "잠금 해제하여 보기/듣기" (50 코인).
    3.  **딥 다이브 (속마음):** "그때 그는 무슨 생각을 했을까?" (40 코인).
    4.  **시간 장벽:** "그가 자고 있습니다... 4시간을 기다리거나 깨우세요 (30 코인)."
*   **구독 (VIP):** 월 $19.99 (무제한 채팅, 월 5회 무료 에셋 해제, 빠른 응답).

### D. 콘텐츠 (큐레이션)
*   **초기 출시:** 3가지 차별화된 캐릭터/시나리오.
    1.  *집착하는 CEO:* 현대 로맨스.
    2.  *후회하는 전 남친:* 감정 드라마.
    3.  *위험한 마피아:* 다크 로맨스 스릴러.
*   **형식:** "기억" 주입 포인트가 있는 사전 설계된 서사 아크.

### E. Romantic Sleep Aid (섹슈얼 테라피)
*   **기능:** 불면증과 외로움을 동시에 해결하는 "아슬아슬한 수면 유도".
*   **컨셉:** "내 침대 맡에 있는 그 남자". 단순 낭독이 아닌, 연인 간의 베개머리 송사(Pillow Talk).
*   **수위 조절:** 
    *   **청각적 자극:** 옷 스치는 소리, 침대 스프링 소리, 귓가에 닿을 듯한 숨소리(Breathing) 극대화.
    *   **스크립트:** "오늘 많이 힘들었지? 이리 와, 안아줄게..."로 시작해 점차 나른하고 관능적인 톤으로 전환.
*   **구현:** ElevenLabs의 '속삭임(Whisper)' 모드 활용 + 3D 바이노럴(Binaural) 효과음 믹싱.

## 3. 기술 스택 및 요구사항
*   **프론트엔드:** Next.js (모바일 최적화).
*   **백엔드:** Supabase (인증, DB, 기억을 위한 벡터/임베딩 - 필요시).
*   **AI:** 
    *   **LLM:** OpenAI/Anthropic (채팅용).
    *   **Voice:** ElevenLabs API (고품질 음성 생성).
*   **오디오:** Web Audio API (바이노럴 효과, 배경음 믹싱).
*   **결제:** Stripe (웹 체크아웃).

## 4. Development Roadmap (Step-by-Step Implementation Guide)

이 로드맵은 LLM 에이전트가 순차적으로 개발을 진행할 수 있도록, 기능 단위로 상세하게 분리되어 있습니다.

### Phase 1: Core Infrastructure & Auth (기반 공사)
1.  **Project Setup**
    *   Next.js 16+ (App Router) 프로젝트 생성.
    *   Tailwind CSS, Shadcn/UI 설치 및 테마 설정 (Dark Mode 기본).
    *   Supabase 프로젝트 생성 및 연동 (Environment Variables 설정).
2.  **Authentication (Supabase Auth)**
    *   이메일/비밀번호 로그인 및 소셜 로그인(Google/Apple) 구현.
    *   `users` 테이블 생성 (UUID, email, display_name, coin_balance, is_vip).
    *   로그인 상태 관리를 위한 Context/Provider 설정.
    *   보호된 라우트(Protected Routes) 미들웨어 설정.

### Phase 2: Chat Interface & Basic Logic (채팅 엔진)
1.  **Database Schema (Chat)**
    *   `characters`: id, name, persona_prompt, voice_id(ElevenLabs), avatar_url.
    *   `chats`: id, user_id, character_id, created_at, updated_at.
    *   `messages`: id, chat_id, sender('user'|'ai'), content, type('text'|'image'|'audio'), is_locked(boolean).
2.  **Chat UI Components**
    *   `ChatBubble`: 메시지 타입(텍스트, 이미지, 오디오)에 따른 조건부 렌더링.
    *   `ChatInput`: 텍스트 입력창 + 전송 버튼.
    *   `TypingIndicator`: "상대방이 입력 중..." 애니메이션.
3.  **Real-time Communication**
    *   Supabase Realtime 구독을 통한 메시지 동기화.
    *   낙관적 업데이트(Optimistic Updates)로 UX 반응 속도 향상.

### Phase 3: AI Character & Memory System (두뇌)
1.  **LLM Integration (API)**
    *   Next.js API Route (`/api/chat`) 생성.
    *   OpenAI/Anthropic API 연동.
    *   시스템 프롬프트 주입: 캐릭터 페르소나 + "기억해야 할 규칙" 설정.
2.  **Memory Logic (Simple RAG)**
    *   `memories` 테이블 생성: id, user_id, character_id, key(ex: 'job'), value(ex: 'nurse').
    *   **Memory Extraction:** 사용자 메시지에서 핵심 정보(이름, 직업, 호불호)를 추출하는 별도 LLM 체인 구현.
    *   **Context Injection:** 다음 대화 생성 시, 추출된 기억을 시스템 프롬프트에 동적으로 삽입.
    
### Phase 4: Multimedia & Immersion (감각)
1.  **Voice/Audio System**
    *   ElevenLabs API 연동 (`/api/voice`).
    *   오디오 플레이어 컴포넌트 구현 (재생/일시정지, 파형 시각화).
    *   **Binaural Mixer:** 배경음(BGM)과 음성(Voice)을 클라이언트에서 합성하여 재생하는 로직.
2.  **Image Handling**
    *   캐릭터별 상황에 맞는 이미지(일반/블러 처리된 유료 이미지) DB 매핑.
    *   이미지 뷰어 모달 구현.

### Phase 5: Monetization & Shop (수익화)
1.  **Currency System**
    *   `transactions` 테이블 생성: id, user_id, amount, type('purchase'|'spend'), description.
    *   코인 차감 로직 구현 (DB 트랜잭션 필수).
2.  **Paywall Components**
    *   `LockedMessage`: "잠금 해제하려면 50코인" 오버레이 UI.
    *   `PremiumChoice`: 선택지에 자물쇠 아이콘 및 가격 표시.
    *   `WaitTimer`: "4시간 기다리기" 카운트다운 타이머 및 "즉시 완료" 버튼.
3.  **Stripe Integration**
    *   Stripe Checkout 세션 연동.
    *   Webhook 처리: 결제 성공 시 유저 `coin_balance` 업데이트.

### Phase 6: Polish & Launch Prep (마무리)
1.  **Onboarding Flow**
    *   첫 진입 시 "이름 입력" -> "캐릭터 선택" -> "첫 메시지 수신" 시퀀스 구현.
2.  **Analytics**
    *   사용자 행동 로그 수집 (메시지 전송 수, 잠금 해제 클릭 수).
3.  **Deployment**
    *   Vercel 배포.
    *   환경 변수 점검 및 프로덕션 DB 마이그레이션.

## 5. 다음 단계
*   **데이터베이스 설계:** `memories` 및 `character_assets` 스키마 생성.
*   **콘텐츠 제작:** 3명 캐릭터를 위한 "훅(Hook)" 스크립트 작성.

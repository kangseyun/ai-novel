'use client';

import Link from 'next/link';

export default function TestOnboardingIndexPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-2">온보딩 A/B/C 테스트</h1>
      <p className="text-white/50 text-sm mb-8">각 버전을 테스트해보세요</p>

      <div className="space-y-4 w-full max-w-xs">
        <Link
          href="/test/onboarding/a"
          className="block w-full py-4 px-6 bg-white/10 rounded-xl text-center hover:bg-white/20 transition"
        >
          <span className="font-bold">옵션 A</span>
          <p className="text-sm text-white/50 mt-1">메시지 리스트 강화 (잠금화면 X)</p>
        </Link>

        <Link
          href="/test/onboarding/b"
          className="block w-full py-4 px-6 bg-white/10 rounded-xl text-center hover:bg-white/20 transition"
        >
          <span className="font-bold">옵션 B</span>
          <p className="text-sm text-white/50 mt-1">잠금화면에서 바로 선택</p>
        </Link>

        <Link
          href="/test/onboarding/c"
          className="block w-full py-4 px-6 bg-white/10 rounded-xl text-center hover:bg-white/20 transition"
        >
          <span className="font-bold">옵션 C</span>
          <p className="text-sm text-white/50 mt-1">잠금화면 + 로딩 트랜지션</p>
        </Link>
      </div>

      <Link
        href="/"
        className="mt-8 text-sm text-white/30 hover:text-white/50 transition"
      >
        ← 홈으로
      </Link>
    </div>
  );
}

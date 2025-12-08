'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import DMChat from '@/components/sns/DMChat';
import { useTutorial } from '@/components/tutorial/useTutorial';

interface SNSProfile {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  profileImage: string;
  isVerified: boolean;
  followers: string;
  following: number;
}

export default function DMChatPage() {
  const params = useParams();
  const router = useRouter();
  const personaId = params.personaId as string;

  const [profile, setProfile] = useState<SNSProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tutorialTriggered = useRef(false);
  const { startDMTutorial, isDMTutorialCompleted } = useTutorial();

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }
      loadPersonaProfile();
    };
    checkAuth();
  }, [personaId, router]);

  const loadPersonaProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 모든 페르소나를 DB에서 가져오기 (id 또는 name으로 검색)
      // personas 뷰에서 avatar_url과 profile_image_url 모두 조회
      const { data: persona, error: fetchError } = await supabase
        .from('personas')
        .select('id, name, display_name, username, bio, avatar_url, profile_image_url, is_verified')
        .or(`id.eq.${personaId},name.eq.${personaId}`)
        .single();

      console.log('[DMChatPage] Loaded persona:', personaId, {
        id: persona?.id,
        name: persona?.name,
        avatar_url: persona?.avatar_url,
        profile_image_url: persona?.profile_image_url,
      });

      if (fetchError || !persona) {
        console.error('[DMChatPage] Persona not found:', fetchError);
        setError('페르소나를 찾을 수 없습니다');
        setIsLoading(false);
        return;
      }

      // avatar_url 또는 profile_image_url 사용 (둘 다 같은 값이어야 함)
      const imageUrl = persona.avatar_url || persona.profile_image_url || '/default-avatar.png';

      setProfile({
        id: persona.id,
        username: persona.username || persona.name,
        displayName: persona.display_name || persona.name,
        bio: persona.bio || '',
        profileImage: imageUrl,
        isVerified: persona.is_verified || false,
        followers: '0',
        following: 0,
      });
      setIsLoading(false);
    } catch (err) {
      console.error('[DMChatPage] Error:', err);
      setError('프로필을 불러오는데 실패했습니다');
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    // 뒤로가기 또는 메인으로
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleGainXP = (amount: number) => {
    // XP gain handling (if needed)
    console.log('[DMChatPage] XP gained:', amount);
  };

  // DM 튜토리얼 트리거
  useEffect(() => {
    if (!isLoading && profile && !tutorialTriggered.current && !isDMTutorialCompleted()) {
      tutorialTriggered.current = true;
      const timer = setTimeout(() => {
        startDMTutorial();
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading, profile, startDMTutorial, isDMTutorialCompleted]);

  // 로딩 중
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/50 text-sm">대화를 불러오는 중...</div>
      </div>
    );
  }

  // 에러
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <div className="text-white/50 text-sm">{error || '알 수 없는 오류'}</div>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-white/10 rounded-lg text-sm text-white hover:bg-white/20 transition"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black overflow-hidden">
      <DMChat
        personaId={personaId}
        profile={profile}
        onClose={handleClose}
        onGainXP={handleGainXP}
        isPage={true}
      />
    </div>
  );
}

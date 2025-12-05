'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Gift, Users, Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useTranslations, useLocale } from '@/lib/i18n';
import { toast } from 'sonner';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ReferralModal({ isOpen, onClose }: ReferralModalProps) {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{
    referral_code: string;
    referral_count: number;
    referred_by: string | null;
  } | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [claiming, setClaiming] = useState(false);
  
  // 번역 (임시)
  const t = {
    title: '친구 초대',
    subtitle: '친구도 나도 50 크레딧씩 받아요!',
    myCode: '나의 초대 코드',
    copy: '복사',
    copied: '복사됨!',
    inviteFriends: '친구 초대하기',
    statLabel: '초대한 친구',
    statValue: '{n}명',
    enterCode: '추천인 코드 입력',
    enterPlaceholder: '코드를 입력하세요',
    claimReward: '보상 받기',
    alreadyClaimed: '이미 추천인을 등록했습니다.',
    successClaim: '50 크레딧을 받았습니다! 🎉',
    errorSelf: '자기 자신의 코드는 사용할 수 없습니다.',
    errorInvalid: '유효하지 않은 코드입니다.',
    shareMessage: 'Luminovel에서 나만의 AI 캐릭터와 대화해보세요! 가입할 때 제 코드를 입력하면 50 크레딧을 드려요. \n\n초대 코드: {code}\nhttps://luminovel.ai',
  };

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getReferralStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load referral stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!stats?.referral_code) return;
    navigator.clipboard.writeText(stats.referral_code);
    toast.success(t.copied);
  };

  const handleShare = () => {
    if (!stats?.referral_code) return;
    const text = t.shareMessage.replace('{code}', stats.referral_code);
    
    if (navigator.share) {
      navigator.share({
        title: 'Luminovel Invite',
        text: text,
        url: 'https://luminovel.ai',
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(text);
      toast.success(t.copied);
    }
  };

  const handleClaim = async () => {
    if (!inputCode.trim()) return;
    
    try {
      setClaiming(true);
      const res = await apiClient.claimReferralReward(inputCode);
      if (res.success) {
        toast.success(t.successClaim);
        loadStats(); // 상태 갱신
        setInputCode('');
      }
    } catch (error: any) {
      console.error('Claim error:', error);
      // 에러 메시지 처리 (실제로는 서버 에러 응답 파싱 필요)
      toast.error('코드를 확인해주세요.');
    } finally {
      setClaiming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-sm bg-[#121212] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.05]">
            <h2 className="text-base font-medium text-white">{t.title}</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* Banner */}
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white">{t.subtitle}</h3>
              <p className="text-sm text-white/40 leading-relaxed">
                친구에게 Luminovel을 소개하고<br/>함께 보상을 받으세요.
              </p>
            </div>

            {loading ? (
              <div className="py-10 text-center text-white/30 text-sm">Loading...</div>
            ) : (
              <>
                {/* My Code Section */}
                <div className="space-y-3">
                  <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{t.myCode}</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-4 py-3 text-center font-mono text-base font-medium text-white tracking-widest select-all">
                      {stats?.referral_code}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="px-4 bg-white text-black hover:bg-white/90 rounded-lg transition flex items-center justify-center"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={handleShare}
                    className="w-full py-3 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 text-white text-sm font-medium rounded-lg transition"
                  >
                    {t.inviteFriends}
                  </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 text-center">
                    <p className="text-[10px] text-white/30 mb-1">{t.statLabel}</p>
                    <p className="text-xl font-medium text-white">{stats?.referral_count}</p>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 text-center">
                    <p className="text-[10px] text-white/30 mb-1">획득한 크레딧</p>
                    <p className="text-xl font-medium text-white">{(stats?.referral_count || 0) * 50}</p>
                  </div>
                </div>

                {/* Enter Code Section */}
                <div className="pt-6 border-t border-white/[0.05]">
                  {stats?.referred_by ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-white/30 text-xs">
                      <Check className="w-3 h-3" />
                      {t.alreadyClaimed}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="text-[10px] font-semibold text-white/30 uppercase tracking-widest">{t.enterCode}</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputCode}
                          onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                          placeholder={t.enterPlaceholder}
                          className="flex-1 bg-transparent border-b border-white/20 px-2 py-2 text-white placeholder:text-white/20 focus:outline-none focus:border-white transition font-mono text-sm uppercase rounded-none"
                        />
                        <button
                          onClick={handleClaim}
                          disabled={!inputCode.trim() || claiming}
                          className="px-4 py-2 text-sm text-white/60 hover:text-white disabled:opacity-30 disabled:hover:text-white/60 transition font-medium whitespace-nowrap"
                        >
                          {claiming ? '...' : t.claimReward}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

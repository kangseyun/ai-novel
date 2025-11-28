'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  ChevronLeft,
  Phone,
  Video,
  Info,
  Lock,
  Crown,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { JUN_PROFILE } from '@/lib/hacked-sns-data';
import { ONBOARDING_DM_SCENARIO, OnboardingMessage, OnboardingChoice, SPECIAL_SCENARIO_TRIGGER } from '@/lib/onboarding-data';

interface OnboardingChatProps {
  onProgress: (affection: number, isPremiumTease: boolean) => void;
  onCliffhanger: () => void;
  onTriggerScenario?: () => void;  // 스페셜 시나리오 전환
}

interface ChatBubble {
  id: string;
  sender: 'user' | 'npc' | 'system';
  content: string;
  isTyping?: boolean;
  emotion?: string;
}

export default function OnboardingChat({ onProgress, onCliffhanger, onTriggerScenario }: OnboardingChatProps) {
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [choices, setChoices] = useState<OnboardingChoice[]>([]);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumTease, setPremiumTease] = useState('');
  const [isStarted, setIsStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const processedIdsRef = useRef<Set<string>>(new Set());

  // 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 메시지 처리 (중복 방지)
  const processMessage = (msg: OnboardingMessage, nextIndexAfterThis: number) => {
    // 이미 처리된 메시지는 스킵
    if (processedIdsRef.current.has(msg.id)) {
      return;
    }
    processedIdsRef.current.add(msg.id);

    // 타이핑 표시
    if (msg.isTyping && msg.sender === 'npc') {
      setMessages(prev => [...prev, {
        id: `${msg.id}_typing`,
        sender: 'npc',
        content: '',
        isTyping: true,
      }]);

      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== `${msg.id}_typing`));
        addMessage(msg, nextIndexAfterThis);
      }, 1500);
    } else {
      addMessage(msg, nextIndexAfterThis);
    }
  };

  const addMessage = (msg: OnboardingMessage, currentIdx: number) => {
    setMessages(prev => [...prev, {
      id: msg.id,
      sender: msg.sender,
      content: msg.content,
      emotion: msg.emotion,
    }]);

    // 스페셜 시나리오 트리거 체크
    if (msg.id === SPECIAL_SCENARIO_TRIGGER.afterMessageId && onTriggerScenario) {
      // 트랜지션 메시지 표시 후 시나리오로 전환
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: 'transition',
          sender: 'system',
          content: SPECIAL_SCENARIO_TRIGGER.transitionText,
        }]);
        setTimeout(() => {
          onTriggerScenario();
        }, SPECIAL_SCENARIO_TRIGGER.transitionDelay);
      }, 1500);
      return;
    }

    // 선택지가 있으면 표시
    if (msg.choices) {
      setTimeout(() => {
        setChoices(msg.choices!);
      }, 500);
    } else {
      // 다음 메시지로 진행
      const nextIndex = currentIdx + 1;
      if (nextIndex < ONBOARDING_DM_SCENARIO.length) {
        const nextMsg = ONBOARDING_DM_SCENARIO[nextIndex];

        setTimeout(() => {
          processMessage(nextMsg, nextIndex);
        }, nextMsg.delay);
      } else {
        // 클리프행어 도달
        setTimeout(() => {
          onCliffhanger();
        }, 1500);
      }
    }
  };

  // 첫 메시지 시작 (한 번만)
  useEffect(() => {
    if (isStarted) return;
    setIsStarted(true);

    const firstMsg = ONBOARDING_DM_SCENARIO[0];
    setTimeout(() => {
      processMessage(firstMsg, 0);
    }, 500);
  }, [isStarted]);

  // 선택지 클릭
  const handleChoice = (choice: OnboardingChoice) => {
    // 프리미엄 선택지인 경우
    if (choice.isPremium) {
      setPremiumTease(choice.premiumTease || '');
      setShowPremiumModal(true);
      onProgress(0, true);
      return;
    }

    setChoices([]);

    // 유저 메시지 추가
    setMessages(prev => [...prev, {
      id: `user_${choice.id}`,
      sender: 'user',
      content: choice.text,
    }]);

    onProgress(choice.affectionChange, false);

    // 다음 메시지 찾기
    const nextMsgIndex = ONBOARDING_DM_SCENARIO.findIndex(m => m.id === choice.nextMessageId);
    if (nextMsgIndex !== -1) {
      const nextMsg = ONBOARDING_DM_SCENARIO[nextMsgIndex];

      setTimeout(() => {
        processMessage(nextMsg, nextMsgIndex);
      }, 1000);
    }
  };

  // 프리미엄 모달 닫기 (일반 선택지로 계속)
  const handleContinueWithFree = () => {
    setShowPremiumModal(false);
    // 첫 번째 무료 선택지 선택
    const freeChoice = choices.find(c => !c.isPremium);
    if (freeChoice) {
      handleChoice(freeChoice);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/90 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button className="p-1">
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-red-500/50">
                  <Image
                    src={JUN_PROFILE.profileImage}
                    alt={JUN_PROFILE.displayName}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white text-sm">{JUN_PROFILE.displayName}</span>
                  <Lock className="w-3 h-3 text-red-400" />
                </div>
                <span className="text-xs text-green-400">활동 중</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className="px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3 h-3 text-red-400" />
                <span className="text-[10px] text-red-400 font-mono">INTERCEPTED</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'system' ? (
              <div className="w-full text-center">
                <span className="text-xs text-white/40 bg-white/5 px-3 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            ) : msg.isTyping ? (
              <div className="flex items-end gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                  <Image
                    src={JUN_PROFILE.profileImage}
                    alt=""
                    width={32}
                    height={32}
                    className="object-cover"
                  />
                </div>
                <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className={`flex items-end gap-2 max-w-[80%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.sender === 'npc' && (
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                    <Image
                      src={JUN_PROFILE.profileImage}
                      alt=""
                      width={32}
                      height={32}
                      className="object-cover"
                    />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 ${
                    msg.sender === 'user'
                      ? 'bg-blue-500 rounded-br-md'
                      : 'bg-white/10 rounded-bl-md'
                  }`}
                >
                  <p className="text-sm text-white whitespace-pre-line">{msg.content}</p>
                </div>
              </div>
            )}
          </motion.div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Choices */}
      <AnimatePresence>
        {choices.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="p-4 bg-gradient-to-t from-black to-transparent space-y-2"
          >
            {choices.map((choice, idx) => (
              <motion.button
                key={choice.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => handleChoice(choice)}
                className={`w-full p-4 rounded-2xl text-left transition ${
                  choice.isPremium
                    ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50 hover:from-amber-500/30 hover:to-orange-500/30'
                    : 'bg-white/10 border border-white/10 hover:bg-white/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${choice.isPremium ? 'text-amber-300' : 'text-white'}`}>
                    {choice.text}
                  </span>
                  {choice.isPremium && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/30 rounded-full">
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span className="text-[10px] text-amber-300">PREMIUM</span>
                    </div>
                  )}
                </div>
                {choice.isPremium && (
                  <p className="text-xs text-amber-200/50 mt-1">
                    특별한 반응을 이끌어낼 수 있어요
                  </p>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium modal */}
      <AnimatePresence>
        {showPremiumModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center"
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-zinc-900 rounded-t-3xl p-6"
            >
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1 bg-white/20 rounded-full" />
              </div>

              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center mb-4">
                  <Crown className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">프리미엄 선택지</h3>
                <p className="text-sm text-white/60">{premiumTease}</p>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>특별한 대화 루트 해금</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Jun의 특별한 반응</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-white/70">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>시크릿 엔딩 접근</span>
                </div>
              </div>

              <button
                onClick={handleContinueWithFree}
                className="w-full py-4 bg-white/10 rounded-2xl text-white/70 text-sm hover:bg-white/15 transition"
              >
                일반 선택지로 계속하기
              </button>

              <p className="text-center text-xs text-white/30 mt-4">
                가입 후 프리미엄 선택지를 사용할 수 있어요
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

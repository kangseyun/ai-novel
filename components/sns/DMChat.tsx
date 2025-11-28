'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Phone,
  Video,
  Info,
  Image as ImageIcon,
  Mic,
  Heart,
  Send,
  Lock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import {
  SNSProfile,
  JUN_DM_SCENARIOS,
  DMScenario,
  DMMessage,
  DMChoice,
} from '@/lib/hacked-sns-data';
import { useFeedStore } from '@/lib/stores/feed-store';
import { JUN_REACTION_SCENARIOS } from '@/lib/user-feed-system';

interface DMChatProps {
  scenarioId: string;
  profile: SNSProfile;
  onClose: () => void;
  onGainXP: (amount: number) => void;
}

interface ChatMessage extends DMMessage {
  isNew?: boolean;
}

export default function DMChat({
  scenarioId,
  profile,
  onClose,
  onGainXP,
}: DMChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [availableChoices, setAvailableChoices] = useState<DMChoice[]>([]);
  const [inputText, setInputText] = useState('');
  const [showPremiumPrompt, setShowPremiumPrompt] = useState(false);
  const [affection, setAffection] = useState(0);
  const [scenarioComplete, setScenarioComplete] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Feed store for persona progress
  const updatePersonaAffection = useFeedStore(state => state.updatePersonaAffection);
  const completePersonaScenario = useFeedStore(state => state.completePersonaScenario);
  const initPersonaProgress = useFeedStore(state => state.initPersonaProgress);

  // Find scenario from either DM scenarios or reaction scenarios
  const dmScenario = JUN_DM_SCENARIOS.find(s => s.id === scenarioId);
  const reactionScenario = JUN_REACTION_SCENARIOS[scenarioId as keyof typeof JUN_REACTION_SCENARIOS];

  // Create a unified scenario object
  const scenario: DMScenario | null = dmScenario || (reactionScenario ? {
    id: reactionScenario.id,
    profileId: 'jun',
    title: reactionScenario.title,
    context: reactionScenario.context,
    messages: [
      {
        id: 'opening',
        sender: 'npc' as const,
        type: 'text' as const,
        content: reactionScenario.openingMessage,
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        choices: [
          { id: 'c1', text: '뭐야 갑자기...', affectionChange: -5 },
          { id: 'c2', text: '어, 나도 생각나서', affectionChange: 10 },
          { id: 'c3', text: '무슨 일 있어?', affectionChange: 5 },
        ],
      },
      {
        id: 'response_good',
        sender: 'npc' as const,
        type: 'text' as const,
        content: '아무것도 아니야...\n그냥 궁금했어',
        timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      },
    ],
    endings: [{
      id: 'default',
      type: 'normal',
      title: '대화 종료',
      description: '대화가 자연스럽게 마무리되었다',
    }],
  } : null);

  // Initialize persona progress on mount
  useEffect(() => {
    initPersonaProgress('jun');
  }, [initPersonaProgress]);

  useEffect(() => {
    if (!scenario) return;

    // Start with first NPC message after a delay
    const timer = setTimeout(() => {
      processNextMessage();
    }, 1000);

    return () => clearTimeout(timer);
  }, [scenario]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const processNextMessage = () => {
    if (!scenario) return;

    const nextMsg = scenario.messages[currentMessageIndex];
    if (!nextMsg) {
      // Scenario complete - no more messages
      if (!scenarioComplete) {
        setScenarioComplete(true);
        completePersonaScenario('jun', scenarioId);
        // Grant base affection for completing a scenario
        updatePersonaAffection('jun', 5);
      }
      return;
    }

    if (nextMsg.sender === 'npc') {
      // Show typing indicator
      setIsTyping(true);

      // Add message after delay
      const typingDelay = Math.min(nextMsg.content.length * 30, 2000);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, { ...nextMsg, isNew: true }]);
        setCurrentMessageIndex(prev => prev + 1);

        // Check for choices or continue to next message
        if (nextMsg.choices && nextMsg.choices.length > 0) {
          setAvailableChoices(nextMsg.choices);
        } else {
          // Auto-advance to next NPC message if any
          const following = scenario.messages[currentMessageIndex + 1];
          if (following && following.sender === 'npc') {
            setTimeout(() => processNextMessage(), 1500);
          }
        }
      }, typingDelay);
    }
  };

  const handleChoiceSelect = (choice: DMChoice) => {
    if (choice.isPremium) {
      setShowPremiumPrompt(true);
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      type: 'text',
      content: choice.text,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      isNew: true,
    };
    setMessages(prev => [...prev, userMessage]);
    setAvailableChoices([]);

    // Apply effects
    if (choice.affectionChange) {
      setAffection(prev => prev + choice.affectionChange!);
      // Update feed store's persona affection
      updatePersonaAffection('jun', choice.affectionChange);
      onGainXP(choice.affectionChange > 0 ? 15 : 5);
    }

    // Continue scenario
    if (choice.nextMessageId) {
      const nextIndex = scenario?.messages.findIndex(m => m.id === choice.nextMessageId);
      if (nextIndex !== undefined && nextIndex >= 0) {
        setCurrentMessageIndex(nextIndex);
        setTimeout(() => processNextMessage(), 1000);
      }
    } else {
      setCurrentMessageIndex(prev => prev + 1);
      setTimeout(() => processNextMessage(), 1000);
    }
  };

  const handleSendMessage = () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      type: 'text',
      content: inputText,
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      isNew: true,
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    onGainXP(5);

    // Auto response (could be enhanced with AI)
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: `npc-${Date.now()}`,
          sender: 'npc',
          type: 'text',
          content: '응, 알겠어 ㅎㅎ',
          timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
          isNew: true,
        }]);
      }, 1500);
    }, 500);
  };

  if (!scenario) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black flex justify-center"
      >
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-white/70">Scenario not found</p>
          <button onClick={onClose} className="mt-4 text-red-400">
            Close
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-black flex justify-center"
    >
      <div className="w-full max-w-[430px] min-h-screen relative bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full overflow-hidden border border-white/20">
                <Image
                  src={profile.profileImage}
                  alt={profile.username}
                  width={40}
                  height={40}
                  className="object-cover"
                />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{profile.displayName}</span>
                {profile.isVerified && (
                  <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-[8px] text-white">✓</span>
                  </div>
                )}
              </div>
              <span className="text-xs text-green-400">Active now</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-white/70 hover:text-white">
            <Phone className="w-5 h-5" />
          </button>
          <button className="text-white/70 hover:text-white">
            <Video className="w-5 h-5" />
          </button>
          <button className="text-white/70 hover:text-white">
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Affection indicator */}
      {affection !== 0 && (
        <div className="px-4 py-2 bg-gradient-to-r from-pink-500/10 to-red-500/10 border-b border-pink-500/20">
          <div className="flex items-center justify-center gap-2 text-xs">
            <Heart className={`w-3 h-3 ${affection > 0 ? 'text-pink-400 fill-current' : 'text-gray-400'}`} />
            <span className="text-pink-400">호감도: {affection > 0 ? '+' : ''}{affection}</span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Scenario context */}
        <div className="text-center py-4">
          <div className="inline-block px-4 py-2 bg-white/5 rounded-full">
            <span className="text-xs text-white/40">{scenario.context}</span>
          </div>
        </div>

        {messages.map((msg, idx) => (
          <motion.div
            key={msg.id}
            initial={msg.isNew ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'npc' && (
              <div className="w-8 h-8 rounded-full overflow-hidden mr-2 flex-shrink-0">
                <Image
                  src={profile.profileImage}
                  alt=""
                  width={32}
                  height={32}
                  className="object-cover"
                />
              </div>
            )}
            <div
              className={`max-w-[70%] ${
                msg.sender === 'user'
                  ? 'bg-blue-500 text-white rounded-2xl rounded-br-md'
                  : 'bg-white/10 text-white rounded-2xl rounded-bl-md'
              } px-4 py-2`}
            >
              {msg.type === 'image' ? (
                <div className="w-48 h-48 bg-white/10 rounded-lg flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-white/30" />
                </div>
              ) : (
                <p className="text-sm whitespace-pre-line">{msg.content}</p>
              )}
              {msg.emotion && (
                <span className="text-[10px] opacity-50 mt-1 block">
                  [{msg.emotion}]
                </span>
              )}
            </div>
          </motion.div>
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden">
                <Image
                  src={profile.profileImage}
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
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Choices */}
      <AnimatePresence>
        {availableChoices.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="px-4 py-3 space-y-2 bg-gradient-to-t from-black via-black/95 to-transparent"
          >
            <div className="text-xs text-white/40 text-center mb-2">응답을 선택하세요</div>
            {availableChoices.map((choice, idx) => (
              <motion.button
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => handleChoiceSelect(choice)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  choice.isPremium
                    ? 'bg-gradient-to-r from-amber-500/10 to-purple-500/10 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{choice.text}</span>
                  {choice.isPremium && (
                    <div className="flex items-center gap-1 text-amber-400">
                      <Sparkles className="w-3 h-3" />
                      <span className="text-[10px]">PREMIUM</span>
                    </div>
                  )}
                </div>
                {choice.affectionChange && choice.affectionChange > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-pink-400">
                    <Heart className="w-3 h-3" />
                    <span className="text-[10px]">+{choice.affectionChange}</span>
                  </div>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      {availableChoices.length === 0 && (
        <div className="px-4 py-3 border-t border-white/10 bg-black">
          <div className="flex items-center gap-3">
            <button className="text-white/50 hover:text-white">
              <ImageIcon className="w-6 h-6" />
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="메시지 보내기..."
                className="w-full px-4 py-2 bg-white/10 border border-white/10 rounded-full text-sm focus:outline-none focus:border-white/30"
              />
            </div>
            {inputText ? (
              <button
                onClick={handleSendMessage}
                className="text-blue-400 hover:text-blue-300"
              >
                <Send className="w-6 h-6" />
              </button>
            ) : (
              <>
                <button className="text-white/50 hover:text-white">
                  <Mic className="w-6 h-6" />
                </button>
                <button className="text-white/50 hover:text-white">
                  <Heart className="w-6 h-6" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Premium Prompt Modal */}
      <AnimatePresence>
        {showPremiumPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-6"
            onClick={() => setShowPremiumPrompt(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900 rounded-2xl p-6 max-w-sm w-full border border-amber-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-500 to-purple-500 rounded-full flex items-center justify-center">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Premium Choice</h3>
                <p className="text-sm text-white/60 mb-6">
                  이 선택지는 프리미엄 멤버만 사용할 수 있습니다.
                  특별한 스토리를 경험해보세요.
                </p>
                <div className="space-y-3">
                  <button className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-xl">
                    프리미엄 구독하기
                  </button>
                  <button
                    onClick={() => setShowPremiumPrompt(false)}
                    className="w-full py-3 bg-white/10 text-white rounded-xl"
                  >
                    다른 선택지 고르기
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.div>
  );
}

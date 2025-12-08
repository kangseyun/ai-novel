'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
  Loader2,
  Play,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFeedStore } from '@/lib/stores/feed-store';

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
import { useAuthStore } from '@/lib/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { Coins } from 'lucide-react';
import { useTranslations, t } from '@/lib/i18n';
import analytics from '@/lib/analytics';

interface DMChatProps {
  personaId: string;
  profile: SNSProfile;
  onClose: () => void;
  onGainXP: (amount: number) => void;
  isPage?: boolean; // true면 페이지 모드 (애니메이션 없음)
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'npc';
  content: string;
  emotion?: string;
  innerThought?: string | null;
  timestamp: string;
  isNew?: boolean;
}

interface AIChoice {
  id: string;
  text: string;
  tone: string;
  isPremium: boolean;
  affectionHint: number;
}

export default function DMChat({
  personaId,
  profile,
  onClose,
  onGainXP,
  isPage = false,
}: DMChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [availableChoices, setAvailableChoices] = useState<AIChoice[]>([]);
  const [inputText, setInputText] = useState('');
  const [showPremiumPrompt, setShowPremiumPrompt] = useState(false);
  const [affection, setAffection] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioTrigger, setScenarioTrigger] = useState<{
    shouldStart: boolean;
    scenarioType: string;
    scenarioContext: string;
    location?: string;
    transitionMessage?: string;
  } | null>(null);
  const [showScenarioTransition, setShowScenarioTransition] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const tr = useTranslations();

  // Auth store for tokens
  const user = useAuthStore(state => state.user);
  const updateUser = useAuthStore(state => state.updateUser);
  const tokens = user?.tokens ?? 0;

  // Feed store for persona progress
  const updatePersonaAffection = useFeedStore(state => state.updatePersonaAffection);
  const initPersonaProgress = useFeedStore(state => state.initPersonaProgress);

  // DM 열기 이벤트 중복 방지
  const dmOpenTrackedRef = useRef(false);

  // Initialize persona progress on mount
  useEffect(() => {
    initPersonaProgress(personaId);

    // DM 열기 이벤트 (중복 방지)
    if (!dmOpenTrackedRef.current) {
      dmOpenTrackedRef.current = true;
      analytics.trackDMOpen(personaId, profile.displayName);
    }
  }, [initPersonaProgress, personaId, profile.displayName]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show scenario transition when triggered
  useEffect(() => {
    if (scenarioTrigger?.shouldStart) {
      // Small delay before showing transition for dramatic effect
      const timer = setTimeout(() => {
        setShowScenarioTransition(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [scenarioTrigger]);

  // Load or create AI session on mount
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initSession = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try to get existing session
        const sessionData = await apiClient.getAiSession(personaId);

        if (sessionData.session) {
          // Existing session found
          setSessionId(sessionData.session.id);

          // Load existing messages
          const loadedMessages: ChatMessage[] = sessionData.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
              id: m.id,
              sender: m.role === 'user' ? 'user' : 'npc',
              content: m.content,
              emotion: m.emotion || undefined,
              innerThought: m.innerThought,
              timestamp: new Date(m.createdAt).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit'
              }),
            }));

          setMessages(loadedMessages);

          // Check if last message had choices
          const lastAssistantMsg = sessionData.messages
            .filter(m => m.role === 'assistant')
            .pop();

          if (lastAssistantMsg?.choicesPresented && !lastAssistantMsg.choiceSelected) {
            setAvailableChoices(lastAssistantMsg.choicesPresented.map(c => ({
              id: c.id,
              text: c.text,
              tone: 'neutral',
              isPremium: c.isPremium,
              affectionHint: 0,
            })));
          }
        } else {
          // Create new session and start conversation
          await startNewConversation();
        }
      } catch (err) {
        console.error('Failed to init session:', err);
        // If no session exists, start new conversation
        await startNewConversation();
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, [personaId]);

  const startNewConversation = async () => {
    try {
      // Start with a greeting message
      const response = await apiClient.aiChat({
        personaId,
        message: '[대화 시작]', // System message to initiate
      });

      setSessionId(response.sessionId);

      // Add AI's opening message
      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'npc',
        content: response.response.content,
        emotion: response.response.emotion,
        innerThought: response.response.innerThought,
        timestamp: new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit'
        }),
        isNew: true,
      };

      setMessages([aiMessage]);
      setAvailableChoices(response.choices);

      if (response.affectionChange) {
        setAffection(prev => prev + response.affectionChange);
      }
    } catch (err) {
      console.error('Failed to start conversation:', err);
      setError(tr.dm.cannotStartChat);
    }
  };

  const handleChoiceSelect = useCallback(async (choice: AIChoice) => {
    if (choice.isPremium) {
      setShowPremiumPrompt(true);
      return;
    }

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: choice.text,
      timestamp: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      isNew: true,
    };
    setMessages(prev => [...prev, userMessage]);
    setAvailableChoices([]);

    // Show typing indicator
    setIsTyping(true);

    try {
      const response = await apiClient.aiChat({
        personaId,
        message: choice.text,
        sessionId: sessionId || undefined,
        choiceData: {
          choiceId: choice.id,
          isPremium: choice.isPremium,
          wasPremium: false,
        },
      });

      setSessionId(response.sessionId);

      // Simulate typing delay based on response length
      const typingDelay = Math.min(response.response.content.length * 20, 2000);

      setTimeout(() => {
        setIsTyping(false);

        // Add AI response
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'npc',
          content: response.response.content,
          emotion: response.response.emotion,
          innerThought: response.response.innerThought,
          timestamp: new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          isNew: true,
        };

        setMessages(prev => [...prev, aiMessage]);
        setAvailableChoices(response.choices);

        // Update affection
        if (response.affectionChange) {
          setAffection(prev => prev + response.affectionChange);
          updatePersonaAffection(personaId, response.affectionChange);
          onGainXP(response.affectionChange > 0 ? 15 : 5);
        }
      }, typingDelay);
    } catch (err) {
      console.error('Failed to send message:', err);
      setIsTyping(false);
      setError(tr.dm.sendFailed);
    }
  }, [personaId, sessionId, updatePersonaAffection, onGainXP, tr.dm.sendFailed]);

  const handleSendMessage = useCallback(async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();
    setInputText('');

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit'
      }),
      isNew: true,
    };
    setMessages(prev => [...prev, userMessage]);
    setAvailableChoices([]);

    // Show typing indicator
    setIsTyping(true);
    onGainXP(5);

    // 메시지 전송 이벤트
    analytics.trackMessageSent(personaId);

    try {
      const response = await apiClient.aiChat({
        personaId,
        message: messageText,
        sessionId: sessionId || undefined,
      });

      setSessionId(response.sessionId);

      // Simulate typing delay
      const typingDelay = Math.min(response.response.content.length * 20, 2000);

      setTimeout(() => {
        setIsTyping(false);

        // Add AI response
        const aiMessage: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'npc',
          content: response.response.content,
          emotion: response.response.emotion,
          innerThought: response.response.innerThought,
          timestamp: new Date().toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit'
          }),
          isNew: true,
        };

        setMessages(prev => [...prev, aiMessage]);
        setAvailableChoices(response.choices);

        // Update affection
        if (response.affectionChange) {
          setAffection(prev => prev + response.affectionChange);
          updatePersonaAffection(personaId, response.affectionChange);
        }

        // Update token balance from response
        if (response.tokenBalance !== undefined) {
          updateUser({ tokens: response.tokenBalance });
        }

        // Check for scenario trigger
        console.log('[DMChat] AI Response:', {
          content: response.response.content.slice(0, 50),
          scenarioTrigger: response.scenarioTrigger,
        });
        if (response.scenarioTrigger?.shouldStart) {
          console.log('[DMChat] Scenario trigger activated!', response.scenarioTrigger);
          setScenarioTrigger(response.scenarioTrigger);
        }
      }, typingDelay);
    } catch (err: unknown) {
      console.error('Failed to send message:', err);
      setIsTyping(false);

      // Handle insufficient tokens error
      const error = err as { status?: number; message?: string };
      if (error.status === 402) {
        setError(tr.dm.insufficientTokens);
      } else {
        setError(tr.dm.sendFailed);
      }
    }
  }, [inputText, personaId, sessionId, updatePersonaAffection, updateUser, onGainXP, tr.dm.insufficientTokens, tr.dm.sendFailed]);

  // Handle scenario start
  const handleStartScenario = useCallback(() => {
    if (!scenarioTrigger) return;

    // Navigate to scenario mode with context
    const params = new URLSearchParams({
      personaId,
      type: scenarioTrigger.scenarioType,
      context: scenarioTrigger.scenarioContext,
      ...(scenarioTrigger.location && { location: scenarioTrigger.location }),
    });

    router.push(`/scenario?${params.toString()}`);
  }, [scenarioTrigger, personaId, router]);

  // Dismiss scenario trigger
  const handleDismissScenario = useCallback(() => {
    setShowScenarioTransition(false);
    setScenarioTrigger(null);
  }, []);

  // Loading state
  if (isLoading) {
    const loadingClass = isPage
      ? "min-h-screen bg-black flex items-center justify-center"
      : "fixed inset-0 z-50 bg-black flex items-center justify-center";
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={loadingClass}
      >
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
          <p className="text-white/70">{tr.dm.loadingChat}</p>
        </div>
      </motion.div>
    );
  }

  // Error state
  if (error && messages.length === 0) {
    const errorClass = isPage
      ? "min-h-screen bg-black flex items-center justify-center"
      : "fixed inset-0 z-50 bg-black flex items-center justify-center";
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={errorClass}
      >
        <div className="text-center px-6">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white/10 rounded-lg text-white mr-2"
          >
            {tr.dm.retry}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-white/10 rounded-lg text-white">
            {tr.dm.close}
          </button>
        </div>
      </motion.div>
    );
  }

  // 페이지 모드면 애니메이션 없이, 모달 모드면 슬라이드 애니메이션
  const containerClass = isPage
    ? "h-screen bg-black flex justify-center"
    : "fixed inset-0 z-50 bg-black flex justify-center";

  return (
    <motion.div
      initial={isPage ? false : { x: '100%' }}
      animate={isPage ? {} : { x: 0 }}
      exit={isPage ? {} : { x: '100%' }}
      transition={isPage ? {} : { type: 'spring', damping: 30, stiffness: 300 }}
      className={containerClass}
    >
      <div className="w-full max-w-[430px] h-full relative bg-black flex flex-col">
        {/* Header - 상단 고정 */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black text-white">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-1 text-white">
              <ChevronLeft className="w-6 h-6 text-white" />
            </button>
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => router.push(`/profile/${personaId}`)}
            >
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
                  <span className="font-medium text-sm text-white hover:underline">{profile.displayName}</span>
                  {profile.isVerified && (
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-[8px] text-white">✓</span>
                    </div>
                  )}
                </div>
                <span className="text-xs text-green-400">{tr.dm.activeNow}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Token Balance */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 rounded-full">
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium text-yellow-400">{tokens}</span>
            </div>
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
              <span className="text-pink-400">{tr.dm.affection}: {affection > 0 ? '+' : ''}{affection}</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Context/intro */}
          <div className="text-center py-4">
            <div className="inline-block px-4 py-2 bg-white/5 rounded-full">
              <span className="text-xs text-white/40">{t(tr.dm.chatWith, { name: profile.displayName })}</span>
            </div>
          </div>

          {messages.map((msg) => (
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
                <p className="text-sm whitespace-pre-line">{msg.content}</p>
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

          {/* Error message */}
          {error && messages.length > 0 && (
            <div className="text-center">
              <span className="text-xs text-red-400">{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input - 하단 고정 */}
        <div className="sticky bottom-0 z-10 px-4 py-3 border-t border-white/10 bg-black">
          <div className="flex items-center gap-3">
            <button className="text-white/50 hover:text-white">
              <ImageIcon className="w-6 h-6" />
            </button>
            <div className="flex-1 relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isTyping && handleSendMessage()}
                placeholder={tr.dm.sendPlaceholder}
                disabled={isTyping}
                className="w-full px-4 py-2 bg-white/10 border border-white/10 rounded-full text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 disabled:opacity-50"
              />
            </div>
            {inputText ? (
              <button
                onClick={handleSendMessage}
                disabled={isTyping}
                className="text-blue-400 hover:text-blue-300 disabled:opacity-50"
              >
                <Send className="w-6 h-6" />
              </button>
            ) : (
              <button className="text-white/50 hover:text-white">
                <Mic className="w-6 h-6" />
              </button>
            )}
          </div>
        </div>

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
                  <h3 className="text-xl font-bold text-white mb-2">{tr.dm.premiumChoice}</h3>
                  <p className="text-sm text-white/60 mb-6 whitespace-pre-line">
                    {tr.dm.premiumOnlyHint}
                  </p>
                  <div className="space-y-3">
                    <button className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold rounded-xl">
                      {tr.dm.subscribePremium}
                    </button>
                    <button
                      onClick={() => setShowPremiumPrompt(false)}
                      className="w-full py-3 bg-white/10 text-white rounded-xl"
                    >
                      {tr.dm.chooseOther}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scenario Transition Modal */}
        <AnimatePresence>
          {showScenarioTransition && scenarioTrigger && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-60 bg-black/95 flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className="max-w-sm w-full text-center"
              >
                {/* Transition message */}
                <motion.div
                  initial={{ y: -20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mb-8"
                >
                  <p className="text-white/60 text-sm mb-2">{tr.dm.afterMoment}</p>
                  <p className="text-white text-lg leading-relaxed">
                    {scenarioTrigger.transitionMessage || tr.dm.newSceneStarts}
                  </p>
                  {scenarioTrigger.location && (
                    <p className="text-white/50 text-sm mt-2">
                      📍 {scenarioTrigger.location}
                    </p>
                  )}
                </motion.div>

                {/* Visual indicator */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4, type: 'spring' }}
                  className="mb-8"
                >
                  <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-white/20 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                  </div>
                </motion.div>

                {/* Action buttons */}
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="space-y-3"
                >
                  <button
                    onClick={handleStartScenario}
                    className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:from-purple-600 hover:to-pink-600 transition-all"
                  >
                    <Play className="w-5 h-5" />
                    {tr.dm.startScenario}
                  </button>
                  <button
                    onClick={handleDismissScenario}
                    className="w-full py-3 bg-white/10 text-white/70 rounded-xl hover:bg-white/20 transition-all"
                  >
                    {tr.dm.continueChat}
                  </button>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

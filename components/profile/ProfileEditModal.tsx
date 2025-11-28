'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Check, Camera } from 'lucide-react';
import {
  useUserPersonaStore,
  PERSONALITY_LABELS,
  COMMUNICATION_LABELS,
  EMOTIONAL_LABELS,
  LOVE_LANGUAGE_LABELS,
  ATTACHMENT_LABELS,
  INTEREST_OPTIONS,
  PersonalityType,
  CommunicationStyle,
  EmotionalTendency,
  LoveLanguage,
  AttachmentStyle,
} from '@/lib/stores/user-persona-store';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EditSection = 'main' | 'personality' | 'communication' | 'emotional' | 'interests' | 'love' | 'attachment';

export default function ProfileEditModal({ isOpen, onClose }: ProfileEditModalProps) {
  const [section, setSection] = useState<EditSection>('main');
  const persona = useUserPersonaStore((state) => state.persona);
  const setPersona = useUserPersonaStore((state) => state.setPersona);
  const toggleInterest = useUserPersonaStore((state) => state.toggleInterest);

  const [localNickname, setLocalNickname] = useState(persona.nickname);
  const [localBio, setLocalBio] = useState(persona.bio);

  const handleSave = () => {
    setPersona({
      nickname: localNickname,
      bio: localBio,
    });
    onClose();
  };

  const handleBack = () => {
    if (section === 'main') {
      handleSave();
    } else {
      setSection('main');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black flex justify-center"
      >
        <div className="w-full max-w-[430px] min-h-screen relative bg-black">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black border-b border-white/10">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={handleBack} className="p-1">
              {section === 'main' ? (
                <X className="w-6 h-6" />
              ) : (
                <span className="text-sm text-white/70">뒤로</span>
              )}
            </button>
            <h1 className="text-lg font-medium">
              {section === 'main' && '프로필 편집'}
              {section === 'personality' && '성격'}
              {section === 'communication' && '대화 스타일'}
              {section === 'emotional' && '감정 표현'}
              {section === 'interests' && '관심사'}
              {section === 'love' && '사랑의 언어'}
              {section === 'attachment' && '관계 성향'}
            </h1>
            {section === 'main' ? (
              <button onClick={handleSave} className="text-blue-400 font-medium">
                완료
              </button>
            ) : (
              <div className="w-10" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-56px)] pb-20">
          <AnimatePresence mode="wait">
            {section === 'main' && (
              <motion.div
                key="main"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                {/* Profile Image */}
                <div className="flex flex-col items-center py-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-3xl font-bold">
                      {persona.profileImage ? (
                        <img
                          src={persona.profileImage}
                          alt="Profile"
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        localNickname?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <button className="absolute bottom-0 right-0 w-8 h-8 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/30">
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Basic Info */}
                <div className="px-4 space-y-4">
                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">닉네임</label>
                    <input
                      type="text"
                      value={localNickname}
                      onChange={(e) => setLocalNickname(e.target.value)}
                      placeholder="어떻게 불러드릴까요?"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                      maxLength={20}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">한 줄 소개</label>
                    <input
                      type="text"
                      value={localBio}
                      onChange={(e) => setLocalBio(e.target.value)}
                      placeholder="나를 표현하는 한 마디"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                      maxLength={50}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="h-2 bg-white/5 my-6" />

                {/* Persona Settings */}
                <div className="px-4">
                  <p className="text-xs text-white/40 mb-3">나의 성향</p>
                  <p className="text-xs text-white/30 mb-4">
                    설정한 성향에 따라 캐릭터들이 다르게 반응해요
                  </p>

                  <div className="space-y-2">
                    <SettingRow
                      label="성격"
                      value={PERSONALITY_LABELS[persona.personality].label}
                      onClick={() => setSection('personality')}
                    />
                    <SettingRow
                      label="대화 스타일"
                      value={COMMUNICATION_LABELS[persona.communicationStyle].label}
                      onClick={() => setSection('communication')}
                    />
                    <SettingRow
                      label="감정 표현"
                      value={EMOTIONAL_LABELS[persona.emotionalTendency].label}
                      onClick={() => setSection('emotional')}
                    />
                    <SettingRow
                      label="관심사"
                      value={persona.interests.length > 0 ? persona.interests.slice(0, 2).join(', ') + (persona.interests.length > 2 ? ` 외 ${persona.interests.length - 2}개` : '') : '설정 안함'}
                      onClick={() => setSection('interests')}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="h-2 bg-white/5 my-6" />

                {/* Relationship Settings */}
                <div className="px-4">
                  <p className="text-xs text-white/40 mb-3">연애 성향</p>

                  <div className="space-y-2">
                    <SettingRow
                      label="사랑의 언어"
                      value={LOVE_LANGUAGE_LABELS[persona.loveLanguage].label}
                      onClick={() => setSection('love')}
                    />
                    <SettingRow
                      label="관계 성향"
                      value={ATTACHMENT_LABELS[persona.attachmentStyle].label}
                      onClick={() => setSection('attachment')}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {section === 'personality' && (
              <SelectionSection
                options={Object.entries(PERSONALITY_LABELS).map(([key, val]) => ({
                  id: key,
                  ...val,
                }))}
                selected={persona.personality}
                onSelect={(id) => {
                  setPersona({ personality: id as PersonalityType });
                  setSection('main');
                }}
              />
            )}

            {section === 'communication' && (
              <SelectionSection
                options={Object.entries(COMMUNICATION_LABELS).map(([key, val]) => ({
                  id: key,
                  ...val,
                }))}
                selected={persona.communicationStyle}
                onSelect={(id) => {
                  setPersona({ communicationStyle: id as CommunicationStyle });
                  setSection('main');
                }}
              />
            )}

            {section === 'emotional' && (
              <SelectionSection
                options={Object.entries(EMOTIONAL_LABELS).map(([key, val]) => ({
                  id: key,
                  ...val,
                }))}
                selected={persona.emotionalTendency}
                onSelect={(id) => {
                  setPersona({ emotionalTendency: id as EmotionalTendency });
                  setSection('main');
                }}
              />
            )}

            {section === 'love' && (
              <SelectionSection
                options={Object.entries(LOVE_LANGUAGE_LABELS).map(([key, val]) => ({
                  id: key,
                  ...val,
                }))}
                selected={persona.loveLanguage}
                onSelect={(id) => {
                  setPersona({ loveLanguage: id as LoveLanguage });
                  setSection('main');
                }}
              />
            )}

            {section === 'attachment' && (
              <SelectionSection
                options={Object.entries(ATTACHMENT_LABELS).map(([key, val]) => ({
                  id: key,
                  ...val,
                }))}
                selected={persona.attachmentStyle}
                onSelect={(id) => {
                  setPersona({ attachmentStyle: id as AttachmentStyle });
                  setSection('main');
                }}
              />
            )}

            {section === 'interests' && (
              <motion.div
                key="interests"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-4 py-4"
              >
                <p className="text-xs text-white/40 mb-4">
                  최대 5개까지 선택할 수 있어요 ({persona.interests.length}/5)
                </p>

                <div className="flex flex-wrap gap-2">
                  {INTEREST_OPTIONS.map((interest) => {
                    const isSelected = persona.interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={`px-4 py-2 rounded-full text-sm transition ${
                          isSelected
                            ? 'bg-white text-black font-medium'
                            : 'bg-white/10 text-white/70 hover:bg-white/15'
                        }`}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setSection('main')}
                  className="w-full mt-8 py-3 bg-white text-black rounded-xl font-medium"
                >
                  선택 완료
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// 설정 항목 행
function SettingRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl transition"
    >
      <span className="text-white/80">{label}</span>
      <div className="flex items-center gap-2 text-white/50">
        <span className="text-sm">{value}</span>
        <ChevronRight className="w-4 h-4" />
      </div>
    </button>
  );
}

// 선택 섹션
function SelectionSection({
  options,
  selected,
  onSelect,
}: {
  options: { id: string; label: string; description: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <motion.div
      key="selection"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="px-4 py-4 space-y-2"
    >
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(option.id)}
          className={`w-full p-4 rounded-xl text-left transition ${
            selected === option.id
              ? 'bg-white/15 border border-white/30'
              : 'bg-white/5 border border-transparent hover:bg-white/10'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{option.label}</p>
              <p className="text-sm text-white/50 mt-0.5">{option.description}</p>
            </div>
            {selected === option.id && (
              <Check className="w-5 h-5 text-white" />
            )}
          </div>
        </button>
      ))}
    </motion.div>
  );
}

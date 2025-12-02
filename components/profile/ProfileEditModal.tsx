'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Check, Camera, Loader2 } from 'lucide-react';
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
import { useTranslations, t } from '@/lib/i18n';

interface ProfileEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type EditSection = 'main' | 'personality' | 'communication' | 'emotional' | 'interests' | 'love' | 'attachment';

export default function ProfileEditModal({ isOpen, onClose }: ProfileEditModalProps) {
  const [section, setSection] = useState<EditSection>('main');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const tr = useTranslations();

  const persona = useUserPersonaStore((state) => state.persona);
  const setPersona = useUserPersonaStore((state) => state.setPersona);
  const toggleInterest = useUserPersonaStore((state) => state.toggleInterest);
  const saveToServer = useUserPersonaStore((state) => state.saveToServer);

  const [localNickname, setLocalNickname] = useState(persona.nickname);
  const [localBio, setLocalBio] = useState(persona.bio);

  // 모달 열릴 때 로컬 상태 초기화
  useEffect(() => {
    if (isOpen) {
      setLocalNickname(persona.nickname);
      setLocalBio(persona.bio);
      setSaveError(null);
    }
  }, [isOpen, persona.nickname, persona.bio]);

  const handleSave = async () => {
    // 로컬 스토어에 저장
    setPersona({
      nickname: localNickname,
      bio: localBio,
    });

    // 서버에 저장 (단일 API 호출)
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveToServer();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : tr.profileEdit.saveError);
    } finally {
      setIsSaving(false);
    }
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
                <span className="text-sm text-white/70">{tr.common.back}</span>
              )}
            </button>
            <h1 className="text-lg font-medium">
              {section === 'main' && tr.profileEdit.editProfile}
              {section === 'personality' && tr.profileEdit.personality}
              {section === 'communication' && tr.profileEdit.conversationStyle}
              {section === 'emotional' && tr.profileEdit.emotionalExpression}
              {section === 'interests' && tr.profileEdit.interests}
              {section === 'love' && tr.profileEdit.loveLanguage}
              {section === 'attachment' && tr.profileEdit.relationshipStyle}
            </h1>
            {section === 'main' ? (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-blue-400 font-medium disabled:opacity-50 flex items-center gap-1"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {tr.profileEdit.saving}
                  </>
                ) : (
                  tr.common.done
                )}
              </button>
            ) : (
              <div className="w-10" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-[calc(100vh-56px)] pb-20">
          {/* Error Message */}
          {saveError && (
            <div className="mx-4 mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl">
              <p className="text-sm text-red-400">{saveError}</p>
            </div>
          )}

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
                    <label className="text-xs text-white/40 mb-1.5 block">{tr.profileEdit.nickname}</label>
                    <input
                      type="text"
                      value={localNickname}
                      onChange={(e) => setLocalNickname(e.target.value)}
                      placeholder={tr.profileEdit.nicknamePlaceholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                      maxLength={20}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-white/40 mb-1.5 block">{tr.profileEdit.bioLabel}</label>
                    <input
                      type="text"
                      value={localBio}
                      onChange={(e) => setLocalBio(e.target.value)}
                      placeholder={tr.profileEdit.bioPlaceholder}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30"
                      maxLength={50}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="h-2 bg-white/5 my-6" />

                {/* Persona Settings */}
                <div className="px-4">
                  <p className="text-xs text-white/40 mb-3">{tr.profileEdit.myTendency}</p>
                  <p className="text-xs text-white/30 mb-4">
                    {tr.profileEdit.tendencyHint}
                  </p>

                  <div className="space-y-2">
                    <SettingRow
                      label={tr.profileEdit.personality}
                      value={PERSONALITY_LABELS[persona.personality].label}
                      onClick={() => setSection('personality')}
                    />
                    <SettingRow
                      label={tr.profileEdit.conversationStyle}
                      value={COMMUNICATION_LABELS[persona.communicationStyle].label}
                      onClick={() => setSection('communication')}
                    />
                    <SettingRow
                      label={tr.profileEdit.emotionalExpression}
                      value={EMOTIONAL_LABELS[persona.emotionalTendency].label}
                      onClick={() => setSection('emotional')}
                    />
                    <SettingRow
                      label={tr.profileEdit.interests}
                      value={persona.interests.length > 0 ? persona.interests.slice(0, 2).join(', ') + (persona.interests.length > 2 ? ` ${t(tr.profileEdit.andMore, { n: persona.interests.length - 2 })}` : '') : tr.profileEdit.notSet}
                      onClick={() => setSection('interests')}
                    />
                  </div>
                </div>

                {/* Divider */}
                <div className="h-2 bg-white/5 my-6" />

                {/* Relationship Settings */}
                <div className="px-4">
                  <p className="text-xs text-white/40 mb-3">{tr.profileEdit.loveTendency}</p>

                  <div className="space-y-2">
                    <SettingRow
                      label={tr.profileEdit.loveLanguage}
                      value={LOVE_LANGUAGE_LABELS[persona.loveLanguage].label}
                      onClick={() => setSection('love')}
                    />
                    <SettingRow
                      label={tr.profileEdit.relationshipStyle}
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
                  {t(tr.createPost.maxSelect, { n: 5 })} ({persona.interests.length}/5)
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
                  {tr.createPost.selectionComplete}
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

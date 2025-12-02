'use client';

import { motion } from 'framer-motion';
import { PERSONAS, PersonaCard } from '@/lib/persona-data';
import { useTranslations } from '@/lib/i18n';

interface PersonaSelectProps {
  onSelect: (personaId: string) => void;
}

export default function PersonaSelect({ onSelect }: PersonaSelectProps) {
  const tr = useTranslations();

  const handleCardClick = (persona: PersonaCard) => {
    if (!persona.available) return;
    onSelect(persona.id);
  };

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-12 pb-4 shrink-0">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold mb-1"
        >
          {tr.onboarding.messages}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-white/40 text-sm"
        >
          {tr.onboarding.whoseMessageToOpen}
        </motion.p>
      </div>

      {/* DM List */}
      <div className="flex-1 px-4 overflow-y-auto min-h-0 pb-8">
        {PERSONAS.map((persona, idx) => (
          <motion.button
            key={persona.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 + idx * 0.05 }}
            onClick={() => handleCardClick(persona)}
            disabled={!persona.available}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl mb-2 transition-colors ${
              persona.available
                ? 'hover:bg-white/5 active:bg-white/10'
                : 'opacity-40'
            }`}
          >
            {/* Avatar */}
            <div className="relative">
              <div
                className="w-14 h-14 rounded-full overflow-hidden"
                style={{
                  boxShadow: persona.available
                    ? `0 0 0 2px ${persona.color}`
                    : 'none',
                }}
              >
                <img
                  src={persona.image}
                  alt={persona.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {persona.available && (
                <div
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-black"
                  style={{ backgroundColor: persona.color }}
                />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">{persona.name}</span>
                {persona.available && (
                  <span className="text-xs text-white/40">{tr.onboarding.justNow}</span>
                )}
              </div>
              <p className="text-sm text-white/50 truncate">
                {persona.available ? persona.teaserLine : tr.onboarding.comingSoon}
              </p>
            </div>

            {/* Unread indicator */}
            {persona.available && (
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: persona.color }}
              />
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

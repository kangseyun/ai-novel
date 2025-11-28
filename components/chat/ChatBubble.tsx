import React from 'react';
import { cn } from '@/lib/utils';
import { Message, Character } from '@/types';

interface ChatBubbleProps {
  message: Message;
  character?: Character;
  isCurrentUser?: boolean; // For future user interaction
}

export function ChatBubble({ message, character, isCurrentUser }: ChatBubbleProps) {
  const isSystem = message.type === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex w-full mb-4", isCurrentUser ? "justify-end" : "justify-start")}>
      {!isCurrentUser && (
        <div className="flex-shrink-0 mr-2 flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-gray-300 overflow-hidden flex items-center justify-center text-lg font-bold text-white select-none">
                {character?.avatar_url ? (
                    <img src={character.avatar_url} alt={character.name} className="w-full h-full object-cover" />
                ) : (
                    character?.name?.[0] || '?'
                )}
            </div>
            {/* Name below avatar if needed, or better: above the bubble */}
        </div>
      )}
      
      <div className="flex flex-col max-w-[75%]">
        {!isCurrentUser && character && (
            <span className="text-xs text-gray-500 mb-1 ml-1">{character.name}</span>
        )}
        <div
          className={cn(
            "px-4 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap shadow-sm",
            isCurrentUser
              ? "bg-blue-500 text-white rounded-br-none"
              : "bg-white border border-gray-100 text-gray-800 rounded-tl-none"
          )}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}

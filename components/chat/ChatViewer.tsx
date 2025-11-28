'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Message, Character, Novel } from '@/types';
import { ChatBubble } from './ChatBubble';
import { ChevronLeft, MoreVertical } from 'lucide-react';
import Link from 'next/link';

interface ChatViewerProps {
  novel: Novel;
  initialMessages: Message[];
  characters: Record<string, Character>; // Map character ID to Character object
}

export function ChatViewer({ novel, initialMessages, characters }: ChatViewerProps) {
  const [visibleCount, setVisibleCount] = useState(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleCount]);

  const handleTap = () => {
    if (visibleCount < initialMessages.length) {
      setVisibleCount((prev) => prev + 1);
    }
  };

  const progress = Math.round((visibleCount / initialMessages.length) * 100);

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-md mx-auto shadow-2xl overflow-hidden border-x border-gray-200">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100 z-10 shrink-0">
        <Link href="/" className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft className="w-6 h-6 text-gray-600" />
        </Link>
        <div className="flex flex-col items-center">
            <h1 className="font-semibold text-gray-800 text-sm">{novel.title}</h1>
            <span className="text-xs text-gray-400">{visibleCount} / {initialMessages.length}</span>
        </div>
        <button className="p-2 -mr-2 hover:bg-gray-100 rounded-full">
            <MoreVertical className="w-5 h-5 text-gray-600" />
        </button>
      </header>

      {/* Progress Bar */}
      <div className="w-full h-1 bg-gray-100">
        <div 
            className="h-full bg-blue-500 transition-all duration-300 ease-out" 
            style={{ width: `${progress}%` }}
        />
      </div>

      {/* Chat Area */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-2 cursor-pointer tap-highlight-transparent"
        onClick={handleTap}
      >
        <div className="flex flex-col pb-10 min-h-full justify-end">
            {initialMessages.slice(0, visibleCount).map((msg) => (
            <ChatBubble 
                key={msg.id} 
                message={msg} 
                character={characters[msg.character_id]}
                isCurrentUser={false} // In a viewer, usually we read others. If we add "Player" role, we can change this.
            />
            ))}
            {/* Spacer for scroll */}
            <div ref={bottomRef} className="h-4" />
            
            {visibleCount < initialMessages.length && (
                <div className="text-center mt-8 animate-pulse text-gray-400 text-sm">
                    Tap to continue...
                </div>
            )}
            
            {visibleCount >= initialMessages.length && (
                <div className="text-center mt-8 py-8 border-t border-gray-100">
                    <p className="text-gray-500 font-medium">To be continued...</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
}

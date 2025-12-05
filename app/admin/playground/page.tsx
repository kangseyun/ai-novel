'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Send, RotateCcw, Save, Sparkles, Bot, User, Star, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Persona {
  id: string;
  name: string;
  role: string;
  base_instruction?: string;
  tone_config?: any;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

interface Model {
  id: string;
  name: string;
  context_length?: number;
}

export default function AIPlaygroundPage() {
  const searchParams = useSearchParams();
  const initialPersonaId = searchParams.get('personaId');

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Settings State
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState([0.7]);
  
  // Model Selection State
  const [selectedModelId, setSelectedModelId] = useState('deepseek/deepseek-chat');
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isModelListOpen, setIsModelListOpen] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const supabase = createClient();

  // Load User Preferences (LocalStorage)
  useEffect(() => {
    const savedModel = localStorage.getItem('playground_last_model');
    const savedFavorites = localStorage.getItem('playground_model_favorites');
    
    if (savedModel) setSelectedModelId(savedModel);
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('Failed to parse favorites', e);
      }
    }
  }, []);

  // Save Preferences
  const handleModelSelect = (modelId: string) => {
    setSelectedModelId(modelId);
    localStorage.setItem('playground_last_model', modelId);
    setIsModelListOpen(false);
  };

  const toggleFavorite = (e: React.MouseEvent, modelId: string) => {
    e.preventDefault(); // 기본 동작 방지
    e.stopPropagation(); // 이벤트 전파 중단 (Popover 닫힘 방지)
    
    setFavorites(prev => {
      const newFavorites = prev.includes(modelId) 
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId];
      
      localStorage.setItem('playground_model_favorites', JSON.stringify(newFavorites));
      return newFavorites;
    });
  };

  // Load Personas
  useEffect(() => {
    async function loadPersonas() {
      try {
        const { data } = await supabase
          .from('persona_core')
          .select('*')
          .order('created_at', { ascending: false });

        if (data) {
          setPersonas(data);
          // URL에서 personaId가 있으면 해당 페르소나 선택, 없으면 첫 번째
          if (initialPersonaId) {
            const targetPersona = data.find(p => p.id === initialPersonaId);
            if (targetPersona) {
              handlePersonaSelect(targetPersona);
            } else if (data.length > 0) {
              handlePersonaSelect(data[0]);
            }
          } else if (data.length > 0) {
            handlePersonaSelect(data[0]);
          }
        }
      } catch (error) {
        console.error('Failed to load personas:', error);
      } finally {
        setLoading(false);
      }
    }
    loadPersonas();
  }, [supabase, initialPersonaId]);

  // Load Dynamic Models from OpenRouter
  useEffect(() => {
    async function loadModels() {
      setModelsLoading(true);
      try {
        const response = await fetch('/api/admin/playground/models');
        if (!response.ok) throw new Error('Failed to fetch models');
        const data = await response.json();
        setModels(data.models || []);
      } catch (error) {
        console.error('Failed to load models:', error);
        toast.error('모델 목록을 불러오지 못했습니다.');
        // Fallback
        setModels([
          { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3 (Fallback)' },
          { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite (Fallback)' },
          { id: 'openai/gpt-4o', name: 'GPT-4o (Fallback)' },
        ]);
      } finally {
        setModelsLoading(false);
      }
    }
    loadModels();
  }, []);

  // Filtered & Sorted Models
  const filteredModels = models
    .filter(m => 
      m.name.toLowerCase().includes(modelSearchQuery.toLowerCase()) || 
      m.id.toLowerCase().includes(modelSearchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aFav = favorites.includes(a.id);
      const bFav = favorites.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

  const selectedModelName = models.find(m => m.id === selectedModelId)?.name || selectedModelId;

  // Handle Persona Selection
  const handlePersonaSelect = (persona: Persona) => {
    setSelectedPersona(persona);
    setSystemPrompt(persona.base_instruction || '');
    setMessages([]);
  };

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Save Settings
  const handleSave = async () => {
    if (!selectedPersona) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('persona_core')
        .update({
          base_instruction: systemPrompt,
        })
        .eq('id', selectedPersona.id);

      if (error) throw error;
      toast.success('프롬프트 설정이 저장되었습니다.');
      
      setPersonas(prev => prev.map(p => 
        p.id === selectedPersona.id 
          ? { ...p, base_instruction: systemPrompt }
          : p
      ));
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Send Message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending || !selectedPersona) return;

    const userMsg: Message = { role: 'user', content: inputMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setSending(true);

    try {
      const response = await fetch('/api/admin/playground/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          systemPrompt,
          model: selectedModelId,
          temperature: temperature[0],
          history: messages,
          personaId: selectedPersona.id
        })
      });

      if (!response.ok) throw new Error('API Error');
      
      const data = await response.json();
      const aiMsg: Message = { role: 'assistant', content: data.reply, timestamp: Date.now() };
      
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      toast.error('메시지 전송 실패');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Left Panel: Settings (40%) */}
      <div className="w-[40%] border-r flex flex-col h-full bg-slate-50/50">
        <div className="p-4 border-b bg-white">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            AI Playground
          </h1>
          <p className="text-sm text-muted-foreground">
            프롬프트를 수정하고 실시간으로 테스트하세요.
          </p>
        </div>
        
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Persona Selector */}
            <div className="space-y-2">
              <Label>대상 페르소나</Label>
              <Select 
                value={selectedPersona?.id} 
                onValueChange={(id) => {
                  const p = personas.find(p => p.id === id);
                  if (p) handlePersonaSelect(p);
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="페르소나 선택" />
                </SelectTrigger>
                <SelectContent>
                  {personas.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Config (Searchable + Favorites) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>모델 (Model)</Label>
                  {modelsLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
                
                <Popover open={isModelListOpen} onOpenChange={setIsModelListOpen}>
                  <PopoverTrigger asChild>
                    <Button 
                      variant="outline" 
                      role="combobox" 
                      aria-expanded={isModelListOpen}
                      className="w-full justify-between bg-white px-3 font-normal"
                    >
                      <span className="truncate">{selectedModelName}</span>
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0" align="start">
                    <div className="p-2 border-b">
                      <Input 
                        placeholder="모델 검색..." 
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <ScrollArea className="h-[300px]">
                      <div className="p-1">
                        {filteredModels.length === 0 ? (
                          <div className="py-6 text-center text-xs text-muted-foreground">
                            검색 결과가 없습니다.
                          </div>
                        ) : (
                          filteredModels.map((model) => (
                            <div
                              key={model.id}
                              className={cn(
                                "flex items-center justify-between px-2 py-2 text-sm rounded-sm cursor-pointer hover:bg-slate-100",
                                selectedModelId === model.id && "bg-slate-100 font-medium"
                              )}
                              onClick={() => handleModelSelect(model.id)}
                            >
                              <div className="flex flex-col overflow-hidden w-[220px]">
                                <span className="truncate text-foreground text-sm">{model.name}</span>
                                <span className="text-[10px] text-muted-foreground truncate">{model.id}</span>
                              </div>
                              <button
                                type="button"
                                className="h-8 w-8 flex items-center justify-center cursor-pointer hover:bg-slate-200 rounded-full transition-colors z-20 shrink-0"
                                onClick={(e) => toggleFavorite(e, model.id)}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <Star 
                                  className={cn(
                                    "h-4 w-4 transition-colors", 
                                    favorites.includes(model.id) ? "fill-yellow-400 text-yellow-400" : "text-slate-300 hover:text-slate-400"
                                  )} 
                                />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </PopoverContent>
                </Popover>
                
                <p className="text-[10px] text-muted-foreground truncate">
                  * 즐겨찾기 된 모델이 상단에 표시됩니다.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Temperature ({temperature[0]})</Label>
                </div>
                <Slider 
                  value={temperature} 
                  onValueChange={setTemperature} 
                  max={1.5} 
                  step={0.1} 
                  className="py-4"
                />
              </div>
            </div>

            {/* System Prompt Editor */}
            <div className="space-y-2 flex-1 flex flex-col">
              <div className="flex justify-between items-center">
                <Label>시스템 프롬프트 (System Prompt)</Label>
                <Badge variant="outline" className="text-xs font-normal">
                  {systemPrompt.length} chars
                </Badge>
              </div>
              <Textarea 
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="min-h-[400px] font-mono text-sm bg-white resize-none flex-1 leading-relaxed"
                placeholder="페르소나의 성격, 말투, 행동 지침을 입력하세요..."
              />
              <p className="text-xs text-muted-foreground">
                * 이 내용은 '기본 지침(Base Instruction)'으로 저장됩니다.
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-white flex justify-end gap-2">
          <Button 
            variant="outline" 
            onClick={() => selectedPersona && handlePersonaSelect(selectedPersona)}
            disabled={saving}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            초기화
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            설정 저장
          </Button>
        </div>
      </div>

      {/* Right Panel: Chat (60%) */}
      <div className="w-[60%] flex flex-col h-full bg-slate-100">
        {/* Chat Header */}
        <div className="p-4 border-b bg-white flex justify-between items-center shadow-sm z-10">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <Bot className="w-5 h-5 text-slate-500" />
              테스트 채팅
            </h2>
            <p className="text-xs text-muted-foreground">
              변경한 설정이 즉시 반영됩니다. (DB 저장 안됨)
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setMessages([])}>
            <RotateCcw className="w-4 h-4 mr-2" />
            대화 지우기
          </Button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
              <Bot className="w-16 h-16 mb-4" />
              <p>대화를 시작하여 페르소나를 테스트해보세요.</p>
            </div>
          )}
          
          {messages.map((msg, idx) => (
            <div 
              key={idx} 
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 shadow-sm flex-shrink-0">
                  <Bot className="w-5 h-5 text-indigo-600" />
                </div>
              )}
              
              <div 
                className={`max-w-[80%] rounded-2xl px-5 py-3 shadow-sm text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                }`}
              >
                {msg.content}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center border border-slate-300 shadow-sm flex-shrink-0">
                  <User className="w-5 h-5 text-slate-600" />
                </div>
              )}
            </div>
          ))}
          
          {sending && (
            <div className="flex gap-4 justify-start">
               <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center border border-indigo-200 shadow-sm">
                  <Bot className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="bg-white rounded-2xl rounded-bl-none px-5 py-4 border border-slate-200 shadow-sm flex items-center gap-1">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t">
          <form 
            className="flex gap-2 max-w-4xl mx-auto"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
          >
            <Textarea 
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="min-h-[50px] max-h-[150px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button 
              type="submit" 
              size="icon" 
              className="h-[50px] w-[50px]" 
              disabled={!inputMessage.trim() || sending}
            >
              <Send className="w-5 h-5" />
            </Button>
          </form>
          <div className="text-center mt-2">
            <span className="text-[10px] text-muted-foreground">
              Enter를 눌러 전송, Shift+Enter로 줄바꿈
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

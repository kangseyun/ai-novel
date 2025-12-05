import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Use server client
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getLLMClient } from '@/lib/ai-agent/core/llm-client';

export async function POST(req: NextRequest) {
  try {
    // 1. Admin Check
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Parse Body
    const { message, systemPrompt, model, temperature, history } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 3. Construct Messages for LLM
    // History includes previous user/assistant messages from the playground session
    const messages = [
      { role: 'system', content: systemPrompt || 'You are a helpful AI assistant.' },
      ...history, // Previous conversation context
      { role: 'user', content: message } // Current message
    ];

    // 4. Call LLM directly (bypassing the complex context builder of LLMClient)
    // We access the private callLLM method via a trick or expose a public method for raw calls.
    // Since callLLM is private, we'll instantiate LLMClient and use a public wrapper if available,
    // or we can just fetch OpenRouter directly here for the playground to keep it simple and flexible.
    
    // However, to reuse the API key and logic, let's use the LLMClient but we might need to modify it 
    // to allow raw calls or just fetch directly here using the key from env.
    
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('API Key missing');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Luminovel Playground',
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content
        })),
        temperature: temperature ?? 0.7,
        // Playground doesn't strictly need JSON format unless we want to test JSON outputs
        // But the game engine expects JSON. Let's make it optional or just text for now to see raw output.
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API Error: ${errorText}`);
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || '';

    return NextResponse.json({ reply });

  } catch (error: any) {
    console.error('Playground Chat Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

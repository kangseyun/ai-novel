import { supabase } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getEmbeddingService } from '@/lib/ai-agent/memory/embedding-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const { userId } = await params;

    // 2. Parse Body
    const body = await request.json();
    const { query, personaId, threshold = 0.5, matchCount = 5 } = body;

    if (!query || !personaId) {
      return NextResponse.json({ error: 'Missing query or personaId' }, { status: 400 });
    }

    // 3. Generate Embedding
    const embeddingService = getEmbeddingService();
    const queryEmbedding = await embeddingService.generateEmbedding(query);

    if (!queryEmbedding) {
      return NextResponse.json({ error: 'Failed to generate embedding' }, { status: 500 });
    }

    // 4. Search Vector DB (Using Supabase RPC)
    // We use the Service Role key here to bypass RLS if needed, or just standard client
    // Since we are in an API route, we can use the admin client if needed, 
    // but the current supabase client is user-scoped. 
    // However, the RPC 'search_memories_semantic' might respect RLS. 
    // Admin should see everything. Let's use a service role client if possible, 
    // or assume the admin user has DB permissions.
    // Given the previous code, let's try with the authenticated client first.
    
    // NOTE: The RPC expects a vector string format like '[0.1, 0.2, ...]'
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    const { data: memories, error } = await supabase.rpc('search_memories_semantic', {
      p_user_id: userId,
      p_persona_id: personaId,
      p_query_embedding: embeddingStr,
      p_match_threshold: threshold,
      p_match_count: matchCount,
    });

    if (error) {
      console.error('Vector search error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      query,
      results: memories 
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

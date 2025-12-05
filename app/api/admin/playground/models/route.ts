import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error('Failed to fetch models from OpenRouter');
    }

    const data = await response.json();
    
    // Sort models by pricing (descending) or context length as a proxy for capability
    // Or just sort alphabetically. Let's prioritize known high-tier providers.
    const models = data.data.sort((a: any, b: any) => {
      // Prioritize specific providers
      const priorityProviders = ['anthropic', 'openai', 'google', 'deepseek', 'meta-llama'];
      const aProvider = a.id.split('/')[0];
      const bProvider = b.id.split('/')[0];
      
      const aPriority = priorityProviders.indexOf(aProvider);
      const bPriority = priorityProviders.indexOf(bProvider);
      
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;
      
      return a.id.localeCompare(b.id);
    });

    return NextResponse.json({ models });
  } catch (error) {
    console.error('Model fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}

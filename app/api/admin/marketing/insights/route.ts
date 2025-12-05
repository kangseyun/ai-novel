import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { adManager } from '@/lib/marketing/core/ad-manager';
import { AdPlatform } from '@/lib/marketing/core/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { platform, adId } = body;

    if (!platform || !adId) {
      return NextResponse.json({ error: 'Missing platform or adId' }, { status: 400 });
    }

    // 1. Sync Insights via AdManager
    const insights = await adManager.syncAdInsights(platform as AdPlatform, adId);

    if (!insights) {
      return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
    }

    // 2. Save to DB (marketing_ad_executions table)
    // We update the existing execution record or log it somewhere
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find the execution record by external_ad_id
    const { data: execution, error: findError } = await supabase
      .from('marketing_ad_executions')
      .select('id, performance_data')
      .eq('external_ad_id', adId)
      .eq('platform', platform)
      .single();

    if (execution) {
      // Merge new insights with existing performance data or replace
      const updatedPerformance = {
        ...((execution.performance_data as object) || {}),
        last_synced_at: new Date().toISOString(),
        ...insights,
      };

      const { error: updateError } = await supabase
        .from('marketing_ad_executions')
        .update({ performance_data: updatedPerformance })
        .eq('id', execution.id);

      if (updateError) {
        console.error('Failed to update DB:', updateError);
      }
    } else {
      console.warn(`No execution record found for ad ${adId} on ${platform}`);
    }

    return NextResponse.json({ success: true, insights });

  } catch (error: any) {
    console.error('Insights Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

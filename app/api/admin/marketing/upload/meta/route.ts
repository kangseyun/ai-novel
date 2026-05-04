import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth';
import { MetaAdsClient } from '@/lib/marketing/clients/meta-client';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAdmin();
    if (!guard.ok) return guard.response;

    const body = await req.json();
    const { imageId, campaignId, adSetId, headline, message, linkUrl } = body;

    if (!imageId) {
      return NextResponse.json({ error: 'Missing imageId' }, { status: 400 });
    }

    // 1. Supabase Client (Service Role for reading sensitive data if needed)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 2. Fetch Image URL & Data
    const { data: imageData, error: imageError } = await supabase
      .from('marketing_images')
      .select('*')
      .eq('id', imageId)
      .single();

    if (imageError || !imageData) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // 3. Initialize Meta Client
    const metaClient = new MetaAdsClient();

    // 4. Upload Image to Meta
    // NOTE: MetaClient.uploadImage currently returns a stub hash; replace with real
    // binary upload when the production Meta integration is wired up.
    const imageHash = await metaClient.uploadImage(imageData.storage_path);

    // 5. Create Ad Creative
    const creativeName = `Creative - ${imageData.persona_name} - ${new Date().toISOString().split('T')[0]}`;
    const creativeId = await metaClient.createCreative({
      name: creativeName,
      imageUrl: imageData.storage_path,
      message: message || '지금 바로 대화를 시작해보세요!',
      headline: headline || `AI ${imageData.persona_name}와의 특별한 만남`,
      linkUrl: linkUrl || 'https://luminovel.ai',
    });

    // 6. Create Ad (Optional - if campaign/adset provided)
    let adId = null;
    if (campaignId && adSetId) {
      // createAd takes (adGroupId, creativeId, name) - adSetId is the adGroup
      adId = await metaClient.createAd(adSetId, creativeId, creativeName);
    }

    // 7. Save Execution Record to DB
    const { error: dbError } = await supabase
      .from('marketing_ad_executions')
      .insert({
        campaign_id: campaignId || null, // Can be null if just creative upload
        image_id: imageId,
        platform: 'meta',
        external_creative_id: creativeId,
        external_ad_id: adId,
        status: adId ? 'uploaded' : 'creative_ready',
        uploaded_at: new Date().toISOString(),
      });

    if (dbError) {
      console.error('Failed to save ad execution record:', dbError);
    }

    return NextResponse.json({ 
      success: true, 
      creativeId, 
      adId,
      platform: 'meta' 
    });

  } catch (error: any) {
    console.error('Meta Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

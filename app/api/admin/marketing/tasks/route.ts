import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.NEXT_PUBLIC_OPENROUTER_API_KEY;

// Gemini 이미지 생성 모델
const GEMINI_IMAGE_MODEL = 'google/gemini-3-pro-image-preview';

// Gemini로 이미지 생성
async function generateImageWithGemini(
  prompt: string,
  aspectRatio: string,
  referenceImageUrl?: string
): Promise<string[]> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key not configured');
  }

  // 비율에 따른 이미지 크기 힌트 추가
  const aspectHint = aspectRatio === '1:1' ? 'square format' :
                     aspectRatio === '3:4' ? 'portrait format (3:4 ratio)' :
                     aspectRatio === '9:16' ? 'vertical format (9:16 ratio, story/reels size)' :
                     'square format';

  const imagePrompt = `Generate a high-quality advertisement photo. ${aspectHint}.

${prompt}

Important: This is for a mobile dating app advertisement targeting young women. Make it Instagram-worthy, modern, and appealing.`;

  const messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];

  // 참조 이미지가 있으면 멀티모달로 전송
  if (referenceImageUrl) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: referenceImageUrl }
        },
        {
          type: 'text',
          text: `Based on this reference image, generate a new image with the same person/character but in ${aspectHint}. Keep the same face, appearance, and style.\n\n${imagePrompt}`
        }
      ]
    });
  } else {
    messages.push({
      role: 'user',
      content: imagePrompt
    });
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    },
    body: JSON.stringify({
      model: GEMINI_IMAGE_MODEL,
      messages,
      modalities: ['image', 'text'],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Gemini Image] API error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('[Gemini Image] Full API response:', JSON.stringify(data, null, 2));

  const images: string[] = [];
  const message = data.choices?.[0]?.message;

  // 새로운 응답 형식: message.images 배열
  if (message?.images && Array.isArray(message.images)) {
    for (const img of message.images) {
      if (img.image_url?.url) {
        images.push(img.image_url.url);
      }
    }
  }

  // 기존 content 기반 파싱 (fallback)
  const content = message?.content;

  if (images.length === 0 && typeof content === 'string') {
    // 마크다운 이미지 링크 추출: ![...](url)
    const markdownImageRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/g;
    let match;
    while ((match = markdownImageRegex.exec(content)) !== null) {
      images.push(match[1]);
    }

    // 직접 URL 추출
    const urlRegex = /(https?:\/\/[^\s]+\.(jpg|jpeg|png|webp|gif))/gi;
    while ((match = urlRegex.exec(content)) !== null) {
      if (!images.includes(match[1])) {
        images.push(match[1]);
      }
    }

    // data URL (base64) 처리
    const base64Regex = /data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)/g;
    while ((match = base64Regex.exec(content)) !== null) {
      images.push(match[0]);
    }
  }

  // content가 배열인 경우 (멀티모달 응답)
  if (images.length === 0 && Array.isArray(content)) {
    for (const item of content) {
      if (item.type === 'image_url' && item.image_url?.url) {
        images.push(item.image_url.url);
      }
    }
  }

  if (images.length === 0) {
    console.warn('[Gemini Image] No images found in response:', JSON.stringify(message, null, 2));
    throw new Error('No images generated');
  }

  return images;
}

function getSupabaseAdmin() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Base64 이미지를 Supabase Storage에 업로드하고 public URL 반환
async function uploadImageToStorage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  imageData: string,
  projectId: string,
  sizeKey: string,
  index: number
): Promise<string> {
  const timestamp = Date.now();

  // Base64 데이터 URL인 경우
  if (imageData.startsWith('data:image/')) {
    const base64Match = imageData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid base64 image format');
    }

    const [, format, base64Data] = base64Match;
    const buffer = Buffer.from(base64Data, 'base64');
    const fileExt = format === 'jpeg' ? 'jpg' : format;
    const filePath = `${projectId}/${sizeKey}_${timestamp}_${index}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('marketing-images')
      .upload(filePath, buffer, {
        contentType: `image/${format}`,
        upsert: true,
      });

    if (uploadError) {
      console.error('[Storage] Upload error:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('marketing-images')
      .getPublicUrl(filePath);

    console.log('[Storage] Uploaded base64 image:', filePath);
    return urlData.publicUrl;
  }

  // HTTP URL인 경우 - 다운로드 후 업로드
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    try {
      const response = await fetch(imageData);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || 'image/png';
      const buffer = Buffer.from(await response.arrayBuffer());
      const fileExt = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png';
      const filePath = `${projectId}/${sizeKey}_${timestamp}_${index}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('marketing-images')
        .upload(filePath, buffer, {
          contentType,
          upsert: true,
        });

      if (uploadError) {
        console.error('[Storage] Upload error:', uploadError);
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('marketing-images')
        .getPublicUrl(filePath);

      console.log('[Storage] Uploaded URL image:', filePath);
      return urlData.publicUrl;
    } catch (error) {
      console.error('[Storage] Failed to download and upload image:', error);
      // 업로드 실패 시 원본 URL 반환 (fallback)
      return imageData;
    }
  }

  // 알 수 없는 형식
  console.warn('[Storage] Unknown image format, returning as-is');
  return imageData;
}

// 여러 이미지를 Storage에 업로드
async function uploadImagesToStorage(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  images: string[],
  projectId: string,
  sizeKey: string
): Promise<string[]> {
  const uploadedUrls: string[] = [];

  for (let i = 0; i < images.length; i++) {
    try {
      const url = await uploadImageToStorage(supabase, images[i], projectId, sizeKey, i);
      uploadedUrls.push(url);
    } catch (error) {
      console.error(`[Storage] Failed to upload image ${i}:`, error);
      // 실패한 이미지는 원본 유지
      uploadedUrls.push(images[i]);
    }
  }

  return uploadedUrls;
}

// 광고 사이즈 설정
const AD_SIZES = {
  'feed-square': { width: 1080, height: 1080, label: '피드 정사각형 (1:1)', aspectRatio: '1:1' as const },
  'feed-portrait': { width: 1080, height: 1350, label: '피드 세로형 (4:5)', aspectRatio: '3:4' as const },
  'story': { width: 1080, height: 1920, label: '스토리/릴스 (9:16)', aspectRatio: '9:16' as const },
  'carousel': { width: 1080, height: 1080, label: '캐러셀 (1:1)', aspectRatio: '1:1' as const },
} as const;

const AD_TEMPLATES: Record<string, { label: string; promptGuide: string }> = {
  'romantic-chat': {
    label: '로맨틱 채팅 유도',
    promptGuide: '캐릭터가 폰을 들고 메시지를 보내는 듯한 친밀한 분위기, 살짝 웃는 표정, 부드러운 조명',
  },
  'mysterious-encounter': {
    label: '미스터리한 첫만남',
    promptGuide: '캐릭터가 시선을 끄는 매력적인 포즈, 드라마틱한 조명, 영화 같은 분위기',
  },
  'daily-life': {
    label: '일상 속 순간',
    promptGuide: '캐릭터의 자연스러운 일상 모습, 카페/거리/사무실 등 현실적인 배경',
  },
  'special-moment': {
    label: '특별한 순간',
    promptGuide: '캐릭터가 선물을 주거나 깜짝 이벤트를 준비하는 로맨틱한 순간',
  },
  'confession': {
    label: '고백/설렘',
    promptGuide: '수줍게 고백하거나 설레는 표정의 캐릭터, 핑크톤 조명, 로맨틱한 배경',
  },
};

interface SizeTask {
  task_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  images: string[];
  error?: string;
}

// 태스크 목록 조회
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const taskId = searchParams.get('task_id');

    // 단일 태스크 조회
    if (taskId) {
      const { data: task, error } = await supabase
        .from('marketing_generation_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (error) throw error;

      return NextResponse.json({ task });
    }

    // 프로젝트별 태스크 목록
    let query = supabase
      .from('marketing_generation_tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    const { data: tasks, error } = await query.limit(20);

    if (error) throw error;

    return NextResponse.json({ tasks });
  } catch (error) {
    console.error('[Marketing Tasks] GET error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch tasks'
    }, { status: 500 });
  }
}

// 새 백그라운드 태스크 생성
export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const body = await request.json();

    const {
      project_id,
      persona_id,
      persona_name,
      persona_data,
      template,
      custom_prompt,
      generate_all_sizes = false, // true면 베이스 확정 후 모든 사이즈 생성
      selected_base_image, // 베이스 이미지 URL (모든 사이즈 생성 시)
      selected_base_image_id, // 베이스 이미지 ID (정확한 연결을 위해)
      base_image_count = 1, // 베이스 이미지 생성 개수 (기본값: 1)
    } = body;

    if (!project_id || !persona_name || !template) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 프롬프트 생성
    const templateInfo = AD_TEMPLATES[template];
    if (!templateInfo) {
      return NextResponse.json({ error: 'Invalid template' }, { status: 400 });
    }

    const basePrompt = buildPrompt(persona_data, template, custom_prompt);
    const translatedPrompt = await translatePrompt(basePrompt);

    // 태스크 생성
    const sizeTasks: Record<string, SizeTask> = {};

    if (generate_all_sizes && selected_base_image) {
      // 모든 사이즈 생성 모드
      for (const sizeKey of Object.keys(AD_SIZES)) {
        sizeTasks[sizeKey] = {
          task_id: null,
          status: 'pending',
          images: [],
        };
      }
    } else {
      // 베이스 이미지만 생성 (1:1)
      sizeTasks['feed-square'] = {
        task_id: null,
        status: 'pending',
        images: [],
      };
    }

    const { data: task, error: insertError } = await supabase
      .from('marketing_generation_tasks')
      .insert({
        project_id,
        persona_id,
        persona_name,
        template,
        custom_prompt,
        size_tasks: sizeTasks,
        status: 'processing',
        selected_base_image: selected_base_image || null,
        selected_base_image_id: selected_base_image_id || null, // 베이스 이미지 ID 저장
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 백그라운드에서 이미지 생성 시작
    processTask(task.id, translatedPrompt, generate_all_sizes, base_image_count).catch((err) => {
      console.error('[Marketing Tasks] Background processing error:', err);
    });

    return NextResponse.json({
      task,
      message: 'Task created and processing started',
    });
  } catch (error) {
    console.error('[Marketing Tasks] POST error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to create task'
    }, { status: 500 });
  }
}

// 프롬프트 생성 함수
function buildPrompt(
  personaData: {
    name: string;
    role?: string;
    age?: number;
    ethnicity?: string;
    appearance?: {
      hair?: string;
      eyes?: string;
      build?: string;
      style?: string;
    };
    core_personality?: {
      surface?: string[];
    };
  },
  template: string,
  customPrompt?: string
): string {
  const templateInfo = AD_TEMPLATES[template];

  const appearanceDesc = [
    personaData.ethnicity || 'Korean',
    `${personaData.age || 25} years old`,
    personaData.appearance?.hair,
    personaData.appearance?.eyes,
    personaData.appearance?.build,
    personaData.appearance?.style ? `wearing ${personaData.appearance.style}` : null,
  ].filter(Boolean).join(', ');

  const expressionHint = personaData.core_personality?.surface?.slice(0, 2).join(' and ') || 'charming';

  const basePrompt = `Professional advertisement photo for a mobile dating app.
${appearanceDesc}.
${templateInfo.promptGuide}.
Expression: ${expressionHint}.
High-end fashion photography style, Instagram aesthetic, soft studio lighting, shallow depth of field.
Modern, clean, appealing to young women.
NO text, NO watermark, NO logo.`;

  return customPrompt ? `${basePrompt}\n\nAdditional context: ${customPrompt}` : basePrompt;
}

// 프롬프트 번역 함수
async function translatePrompt(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) return prompt;

  try {
    const translateRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-v3.2',
        messages: [{
          role: 'user',
          content: `You are a professional image prompt translator. Convert the following advertisement description into a concise English image generation prompt.

Focus ONLY on visual elements for creating a high-quality photo:
- Physical appearance details
- Clothing and accessories
- Expression and pose
- Lighting and mood
- Background/setting

Description to translate:
${prompt}

Return ONLY a comma-separated list of English visual descriptors suitable for image generation. No explanations, just the prompt.`
        }],
        temperature: 0.3,
        max_tokens: 512,
      }),
    });

    if (translateRes.ok) {
      const translateData = await translateRes.json();
      const englishPrompt = translateData.choices[0]?.message?.content?.trim();
      if (englishPrompt) {
        return englishPrompt;
      }
    }
  } catch (e) {
    console.warn('[Marketing Tasks] Translation failed:', e);
  }

  return prompt;
}

// 생성된 이미지들을 marketing_images 테이블에 저장 (계층 구조 포함)
async function saveGeneratedImages(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  task: {
    project_id: string;
    persona_id: string | null;
    persona_name: string;
    template: string;
    custom_prompt: string | null;
    selected_base_image?: string | null;
    selected_base_image_id?: string | null; // 베이스 이미지 ID 추가
  },
  sizeTasks: Record<string, SizeTask>,
  isResizeMode: boolean = false
) {
  // 그룹 ID 생성 (같은 태스크에서 생성된 이미지들은 같은 그룹)
  let generationGroupId: string = crypto.randomUUID();

  // 베이스 이미지 먼저 저장 (is_base = true)
  const baseImages = sizeTasks['feed-square'];
  let parentImageIds: string[] = [];

  // 리사이즈 모드에서는 기존 베이스 이미지의 ID와 generation_group_id를 사용 (새로 저장하지 않음)
  if (isResizeMode && (task.selected_base_image_id || task.selected_base_image)) {
    // ID가 있으면 직접 사용, 없으면 URL로 검색
    if (task.selected_base_image_id) {
      // 기존 베이스 이미지의 generation_group_id도 가져오기
      const { data: existingBase } = await supabase
        .from('marketing_images')
        .select('id, generation_group_id')
        .eq('id', task.selected_base_image_id)
        .single();

      if (existingBase) {
        parentImageIds = [existingBase.id];
        if (existingBase.generation_group_id) {
          generationGroupId = existingBase.generation_group_id;
        }
        console.log(`[Marketing Tasks] Using existing base image ID: ${existingBase.id}, group: ${generationGroupId}`);
      } else {
        parentImageIds = [task.selected_base_image_id];
        console.log(`[Marketing Tasks] Using provided base image ID: ${task.selected_base_image_id}`);
      }
    } else if (task.selected_base_image) {
      const { data: existingBase } = await supabase
        .from('marketing_images')
        .select('id, generation_group_id')
        .eq('image_url', task.selected_base_image)
        .single();

      if (existingBase) {
        parentImageIds = [existingBase.id];
        if (existingBase.generation_group_id) {
          generationGroupId = existingBase.generation_group_id;
        }
        console.log(`[Marketing Tasks] Found existing base image by URL: ${existingBase.id}, group: ${generationGroupId}`);
      } else {
        console.warn(`[Marketing Tasks] Could not find existing base image for URL: ${task.selected_base_image}`);
      }
    }
  } else if (baseImages?.status === 'completed' && baseImages.images.length > 0) {
    // 새 베이스 이미지 생성 모드
    const baseImagesToInsert = baseImages.images.map((imageUrl, idx) => ({
      project_id: task.project_id,
      persona_id: task.persona_id,
      persona_name: task.persona_name,
      image_url: imageUrl,
      ad_size: 'feed-square',
      ad_size_label: AD_SIZES['feed-square'].label,
      template: task.template,
      template_label: AD_TEMPLATES[task.template]?.label || task.template,
      custom_prompt: task.custom_prompt,
      width: AD_SIZES['feed-square'].width,
      height: AD_SIZES['feed-square'].height,
      status: 'generated',
      is_base: true,
      generation_order: idx,
      generation_group_id: generationGroupId,
      parent_image_id: null,
    }));

    const { data: insertedBase, error: baseError } = await supabase
      .from('marketing_images')
      .insert(baseImagesToInsert)
      .select('id, image_url');

    if (baseError) {
      console.error('[Marketing Tasks] Failed to save base images:', baseError);
    } else if (insertedBase) {
      parentImageIds = insertedBase.map(img => img.id);
      console.log(`[Marketing Tasks] Saved ${insertedBase.length} new base images`);
    }
  }

  // 파생 이미지들 저장 (parent_image_id 설정)
  const derivedImagesToInsert: Array<{
    project_id: string;
    persona_id: string | null;
    persona_name: string;
    image_url: string;
    ad_size: string;
    ad_size_label: string;
    template: string;
    template_label: string;
    custom_prompt: string | null;
    width: number;
    height: number;
    status: string;
    is_base: boolean;
    generation_order: number;
    generation_group_id: string;
    parent_image_id: string | null;
  }> = [];

  for (const [sizeKey, sizeTask] of Object.entries(sizeTasks)) {
    // 베이스 이미지는 이미 처리함
    if (sizeKey === 'feed-square') continue;
    if (sizeTask.status !== 'completed' || sizeTask.images.length === 0) continue;

    const sizeInfo = AD_SIZES[sizeKey as keyof typeof AD_SIZES];
    const templateInfo = AD_TEMPLATES[task.template];
    if (!sizeInfo) continue;

    for (let idx = 0; idx < sizeTask.images.length; idx++) {
      const imageUrl = sizeTask.images[idx];
      derivedImagesToInsert.push({
        project_id: task.project_id,
        persona_id: task.persona_id,
        persona_name: task.persona_name,
        image_url: imageUrl,
        ad_size: sizeKey,
        ad_size_label: sizeInfo.label,
        template: task.template,
        template_label: templateInfo?.label || task.template,
        custom_prompt: task.custom_prompt,
        width: sizeInfo.width,
        height: sizeInfo.height,
        status: 'generated',
        is_base: false,
        generation_order: idx,
        generation_group_id: generationGroupId,
        // 첫 번째 베이스 이미지를 부모로 설정
        parent_image_id: parentImageIds.length > 0 ? parentImageIds[0] : null,
      });
    }
  }

  if (derivedImagesToInsert.length > 0) {
    const { error } = await supabase
      .from('marketing_images')
      .insert(derivedImagesToInsert);

    if (error) {
      console.error('[Marketing Tasks] Failed to save derived images:', error);
    } else {
      console.log(`[Marketing Tasks] Saved ${derivedImagesToInsert.length} derived images`);
    }
  }

  // 리사이즈 모드에서는 새로 저장한 베이스 이미지가 없으므로 파생 이미지만 카운트
  const newBaseSaved = isResizeMode ? 0 : parentImageIds.length;
  const totalSaved = newBaseSaved + derivedImagesToInsert.length;
  console.log(`[Marketing Tasks] Total saved: ${totalSaved} images (${newBaseSaved} new base, ${derivedImagesToInsert.length} derived, linked to parent: ${parentImageIds[0] || 'none'})`);
}

// 참조 이미지 기반 사이즈 변환용 프롬프트
function buildResizePrompt(template: string, customPrompt?: string): string {
  const templateInfo = AD_TEMPLATES[template];

  const basePrompt = `Same person, same face, same appearance, same clothing.
${templateInfo?.promptGuide || ''}.
High-end fashion photography style, Instagram aesthetic, soft studio lighting, shallow depth of field.
Modern, clean, appealing to young women.
Maintain exact same person identity.
NO text, NO watermark, NO logo.`;

  return customPrompt ? `${basePrompt}\n\nAdditional context: ${customPrompt}` : basePrompt;
}

// 백그라운드 태스크 처리
async function processTask(taskId: string, prompt: string, generateAllSizes: boolean, baseImageCount: number = 1) {
  const supabase = getSupabaseAdmin();

  try {
    // 현재 태스크 가져오기
    const { data: task, error: fetchError } = await supabase
      .from('marketing_generation_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      throw new Error('Task not found');
    }

    const sizeTasks = task.size_tasks as Record<string, SizeTask>;
    const sizeKeys = Object.keys(sizeTasks);
    const referenceImageUrl = task.selected_base_image as string | null;

    // 참조 이미지가 있으면 사이즈 변환 모드
    const isResizeMode = generateAllSizes && !!referenceImageUrl;

    // 참조 이미지 모드일 때는 동일 인물 유지 프롬프트 사용
    let resizePrompt = prompt;
    if (isResizeMode) {
      const baseResizePrompt = buildResizePrompt(task.template, task.custom_prompt);
      resizePrompt = await translatePrompt(baseResizePrompt);
    }

    // 각 사이즈에 대해 이미지 생성
    for (const sizeKey of sizeKeys) {
      const sizeInfo = AD_SIZES[sizeKey as keyof typeof AD_SIZES];
      if (!sizeInfo) continue;

      // 참조 이미지 모드에서 feed-square는 이미 선택된 베이스 이미지 사용
      if (isResizeMode && sizeKey === 'feed-square') {
        sizeTasks[sizeKey] = {
          task_id: null,
          status: 'completed',
          images: [referenceImageUrl!],
        };
        await supabase
          .from('marketing_generation_tasks')
          .update({ size_tasks: sizeTasks })
          .eq('id', taskId);
        continue;
      }

      // 상태를 processing으로 업데이트
      sizeTasks[sizeKey] = {
        task_id: null,
        status: 'processing',
        images: [],
      };
      await supabase
        .from('marketing_generation_tasks')
        .update({ size_tasks: sizeTasks })
        .eq('id', taskId);

      try {
        // Gemini로 이미지 생성 (베이스는 설정 개수만큼, 나머지는 1장씩)
        const imageCount = generateAllSizes ? 1 : baseImageCount;
        const allImages: string[] = [];

        for (let i = 0; i < imageCount; i++) {
          const images = await generateImageWithGemini(
            isResizeMode ? resizePrompt : prompt,
            sizeInfo.aspectRatio,
            isResizeMode ? referenceImageUrl! : undefined
          );
          allImages.push(...images);
        }

        // Supabase Storage에 업로드
        console.log(`[Marketing Tasks] Uploading ${allImages.length} images to storage for ${sizeKey}...`);
        const uploadedImages = await uploadImagesToStorage(supabase, allImages, task.project_id, sizeKey);
        console.log(`[Marketing Tasks] Uploaded ${uploadedImages.length} images for ${sizeKey}`);

        sizeTasks[sizeKey] = {
          task_id: null,
          status: 'completed',
          images: uploadedImages,
        };

        // 중간 업데이트
        await supabase
          .from('marketing_generation_tasks')
          .update({ size_tasks: sizeTasks })
          .eq('id', taskId);

      } catch (sizeError) {
        console.error(`[Marketing Tasks] Failed to process ${sizeKey}:`, sizeError);
        sizeTasks[sizeKey] = {
          task_id: null,
          status: 'failed',
          images: [],
          error: sizeError instanceof Error ? sizeError.message : 'Unknown error',
        };

        await supabase
          .from('marketing_generation_tasks')
          .update({ size_tasks: sizeTasks })
          .eq('id', taskId);
      }
    }

    // 전체 상태 결정
    const allCompleted = Object.values(sizeTasks).every(
      (st) => st.status === 'completed' || st.status === 'failed'
    );
    const anySuccess = Object.values(sizeTasks).some((st) => st.status === 'completed');

    await supabase
      .from('marketing_generation_tasks')
      .update({
        size_tasks: sizeTasks,
        status: allCompleted ? (anySuccess ? 'completed' : 'failed') : 'processing',
        completed_at: allCompleted ? new Date().toISOString() : null,
      })
      .eq('id', taskId);

    // 성공한 이미지들을 marketing_images 테이블에 저장
    if (allCompleted && anySuccess) {
      const isResizeModeForSave = generateAllSizes && !!referenceImageUrl;
      await saveGeneratedImages(
        supabase,
        {
          ...task,
          selected_base_image: referenceImageUrl,
          selected_base_image_id: task.selected_base_image_id as string | null,
        },
        sizeTasks,
        isResizeModeForSave
      );

      // 베이스 이미지를 프로젝트에도 저장 (아직 없는 경우)
      const baseImages = sizeTasks['feed-square']?.images || [];
      if (baseImages.length > 0) {
        const { data: project } = await supabase
          .from('marketing_projects')
          .select('base_image_url')
          .eq('id', task.project_id)
          .single();

        // 베이스 이미지가 아직 설정되지 않았으면 첫 번째 이미지로 설정
        if (!project?.base_image_url) {
          await supabase
            .from('marketing_projects')
            .update({
              base_image_url: baseImages[0],
              base_template: task.template,
              base_custom_prompt: task.custom_prompt,
            })
            .eq('id', task.project_id);
        }
      }
    }

  } catch (error) {
    console.error('[Marketing Tasks] Process error:', error);

    await supabase
      .from('marketing_generation_tasks')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', taskId);
  }
}

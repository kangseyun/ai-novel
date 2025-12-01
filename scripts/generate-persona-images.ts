/**
 * 페르소나 피드 이미지 생성 스크립트
 * - Kling AI로 이미지 생성
 * - Supabase Storage에 영구 저장
 * - DB 자동 업데이트
 *
 * 실행: npx tsx scripts/generate-persona-images.ts
 */

import { KlingAIClient, PERSONA_IMAGE_PROMPTS, SCENE_PROMPTS } from '../lib/kling-ai';
import { createClient } from '@supabase/supabase-js';

// 환경변수 로드
require('dotenv').config({ path: '.env.local' });

const kling = new KlingAIClient(
  process.env.KLING_ACCESS_KEY,
  process.env.KLING_SECRET_KEY
);

// Supabase 클라이언트 (서비스 롤 키 사용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const STORAGE_BUCKET = 'persona-images';

// 생성할 이미지 목록
const IMAGES_TO_GENERATE = [
  // Jun - K-POP 아이돌
  { personaId: 'jun', sceneKey: 'jun_stage', description: '콘서트 무대', keyword: '무대' },
  { personaId: 'jun', sceneKey: 'jun_practice', description: '연습실', keyword: '연습' },
  { personaId: 'jun', sceneKey: 'jun_coffee', description: '새벽 커피', keyword: '커피' },

  // Daniel - CEO
  { personaId: 'daniel', sceneKey: 'daniel_office', description: '오피스 뷰', keyword: 'Q4' },
  { personaId: 'daniel', sceneKey: 'daniel_night', description: '야경', keyword: 'city never sleeps' },

  // Kael - 보디가드
  { personaId: 'kael', sceneKey: 'kael_rain', description: '비오는 거리', keyword: '.' },
  { personaId: 'kael', sceneKey: 'kael_motorcycle', description: '오토바이', keyword: 'Late night' },

  // Adrian - 피아니스트
  { personaId: 'adrian', sceneKey: 'adrian_piano', description: '피아노 연주', keyword: 'setlist' },
  { personaId: 'adrian', sceneKey: 'adrian_sheet_music', description: '악보', keyword: '5 years' },

  // Ren - 야쿠자
  { personaId: 'ren', sceneKey: 'ren_casino', description: '카지노', keyword: 'Lucky' },
  { personaId: 'ren', sceneKey: 'ren_tea_house', description: '티하우스', keyword: 'Tea ceremony' },
];

/**
 * URL에서 이미지 다운로드
 */
async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Supabase Storage에 이미지 업로드
 */
async function uploadToSupabase(
  buffer: Buffer,
  personaId: string,
  sceneKey: string
): Promise<string> {
  const fileName = `${personaId}/${sceneKey}_${Date.now()}.png`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, buffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // 공개 URL 생성
  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

/**
 * DB에서 페르소나 ID 조회
 */
async function getPersonaDbId(personaName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('personas')
    .select('id')
    .eq('name', personaName)
    .single();

  if (error || !data) {
    console.error(`Persona not found: ${personaName}`);
    return null;
  }

  return data.id;
}

/**
 * persona_posts 테이블의 이미지 URL 업데이트
 */
async function updatePostImage(
  personaId: string,
  keyword: string,
  imageUrl: string
): Promise<boolean> {
  const dbPersonaId = await getPersonaDbId(personaId);
  if (!dbPersonaId) return false;

  const { error } = await supabase
    .from('persona_posts')
    .update({ images: [imageUrl] })
    .eq('persona_id', dbPersonaId)
    .ilike('caption', `%${keyword}%`);

  if (error) {
    console.error(`DB update failed: ${error.message}`);
    return false;
  }

  return true;
}

/**
 * Storage 버킷 존재 여부 확인 및 생성
 */
async function ensureBucketExists(): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();

  const bucketExists = buckets?.some(b => b.id === STORAGE_BUCKET);

  if (!bucketExists) {
    console.log(`📦 버킷 '${STORAGE_BUCKET}' 생성 중...`);
    const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    });

    if (error) {
      throw new Error(`Bucket creation failed: ${error.message}`);
    }
    console.log(`✅ 버킷 생성 완료`);
  } else {
    console.log(`📦 버킷 '${STORAGE_BUCKET}' 존재 확인`);
  }
}

async function generateImages() {
  console.log('🎨 페르소나 피드 이미지 생성 및 저장 시작\n');

  // 버킷 확인
  await ensureBucketExists();

  const results: Array<{
    personaId: string;
    sceneKey: string;
    description: string;
    status: 'success' | 'failed';
    klingUrl?: string;
    supabaseUrl?: string;
    dbUpdated?: boolean;
    error?: string;
  }> = [];

  for (const item of IMAGES_TO_GENERATE) {
    console.log(`\n📷 생성 중: ${item.personaId} - ${item.description}`);

    try {
      const personaPrompt = PERSONA_IMAGE_PROMPTS[item.personaId];
      const scenePrompt = SCENE_PROMPTS[item.sceneKey] || '';

      const fullPrompt = [
        personaPrompt.basePrompt,
        scenePrompt,
        personaPrompt.style,
      ].filter(Boolean).join(', ');

      console.log(`   프롬프트: ${fullPrompt.substring(0, 100)}...`);

      // 1. Kling AI로 이미지 생성
      const task = await kling.createImageTask({
        model_name: 'kling-v2-1',
        prompt: fullPrompt,
        negative_prompt: personaPrompt.negativePrompt,
        aspect_ratio: '1:1',
        resolution: '1k',
        n: 1,
      });

      console.log(`   태스크 ID: ${task.data.task_id}`);
      console.log(`   ⏳ 생성 대기 중...`);

      const result = await kling.waitForCompletion(task.data.task_id);
      const klingUrl = result.data.task_result?.images[0]?.url;

      if (!klingUrl) {
        throw new Error('No image URL in response');
      }

      console.log(`   ✅ Kling 생성 완료`);

      // 2. 이미지 다운로드
      console.log(`   📥 이미지 다운로드 중...`);
      const imageBuffer = await downloadImage(klingUrl);
      console.log(`   ✅ 다운로드 완료 (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

      // 3. Supabase Storage에 업로드
      console.log(`   📤 Supabase Storage 업로드 중...`);
      const supabaseUrl = await uploadToSupabase(imageBuffer, item.personaId, item.sceneKey);
      console.log(`   ✅ 업로드 완료: ${supabaseUrl}`);

      // 4. DB 업데이트
      console.log(`   💾 DB 업데이트 중...`);
      const dbUpdated = await updatePostImage(item.personaId, item.keyword, supabaseUrl);
      if (dbUpdated) {
        console.log(`   ✅ DB 업데이트 완료`);
      } else {
        console.log(`   ⚠️ DB 업데이트 실패 (매칭되는 포스트 없음)`);
      }

      results.push({
        ...item,
        status: 'success',
        klingUrl,
        supabaseUrl,
        dbUpdated,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log(`   ❌ 실패: ${errorMsg}`);
      results.push({
        ...item,
        status: 'failed',
        error: errorMsg,
      });
    }

    // API 레이트 리밋 방지 (3초 대기)
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  // 결과 요약
  console.log('\n\n========================================');
  console.log('📊 생성 결과 요약');
  console.log('========================================\n');

  const successful = results.filter(r => r.status === 'success');
  const failed = results.filter(r => r.status === 'failed');

  console.log(`✅ 성공: ${successful.length}개`);
  console.log(`❌ 실패: ${failed.length}개\n`);

  if (successful.length > 0) {
    console.log('저장된 이미지 (Supabase Storage):');
    console.log('--------------------------------');
    for (const item of successful) {
      console.log(`\n[${item.personaId}] ${item.description}`);
      console.log(`URL: ${item.supabaseUrl}`);
      console.log(`DB 업데이트: ${item.dbUpdated ? '✅' : '❌'}`);
    }
  }

  if (failed.length > 0) {
    console.log('\n실패한 이미지:');
    console.log('-------------');
    for (const item of failed) {
      console.log(`\n[${item.personaId}] ${item.description}`);
      console.log(`에러: ${item.error}`);
    }
  }

  return results;
}

// 실행
generateImages()
  .then(() => {
    console.log('\n🎉 완료!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 에러:', error);
    process.exit(1);
  });

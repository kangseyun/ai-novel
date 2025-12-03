/**
 * 속도 벤치마크: DeepSeek V3.2 vs Gemini 2.5 Flash
 */

import 'dotenv/config';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY 환경변수가 필요합니다');
  process.exit(1);
}

const MODELS = [
  'deepseek/deepseek-v3.2',
  'google/gemini-2.5-flash',
];

// 테스트 프롬프트 (다양한 길이)
const TEST_PROMPTS = [
  '안녕?',
  '오늘 뭐 했어?',
  '너 좋아하는 음식 뭐야?',
  '요즘 힘든 일 있어? 얘기해봐.',
  '나 오늘 정말 피곤해... 위로해줘.',
  '우리 처음 만났을 때 기억나?',
  '내가 제일 좋아하는 거 뭔지 알아?',
  '오늘 날씨 어때? 뭐 하고 싶어?',
  '너 없으면 심심할 것 같아.',
  '다음에 같이 뭐 할까?',
];

// 시스템 프롬프트 (페르소나)
const SYSTEM_PROMPT = `You are 하은, a 23-year-old K-pop idol with a tsundere personality.
You have a cold exterior but secretly care about the person you're talking to.
Respond naturally in Korean, keeping your answers short (1-2 sentences).
Never use asterisks for actions. Pure dialogue only.`;

async function callModel(model: string, userMessage: string): Promise<{ response: string; latencyMs: number }> {
  const startTime = Date.now();

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'Speed Benchmark',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
      max_tokens: 150,
    }),
  });

  const latencyMs = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return { response: content, latencyMs };
}

interface BenchmarkResult {
  model: string;
  latencies: number[];
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  successCount: number;
  failCount: number;
}

async function benchmarkModel(model: string): Promise<BenchmarkResult> {
  console.log(`\n🔄 Testing: ${model}`);
  console.log('─'.repeat(50));

  const latencies: number[] = [];
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < TEST_PROMPTS.length; i++) {
    const prompt = TEST_PROMPTS[i];
    process.stdout.write(`  [${i + 1}/${TEST_PROMPTS.length}] "${prompt.substring(0, 20)}..." `);

    try {
      const { response, latencyMs } = await callModel(model, prompt);
      latencies.push(latencyMs);
      successCount++;

      const responsePreview = response.substring(0, 30).replace(/\n/g, ' ');
      console.log(`✓ ${latencyMs}ms → "${responsePreview}..."`);
    } catch (error) {
      failCount++;
      console.log(`✗ Error: ${error}`);
    }

    // API 제한 방지
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;
  const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
  const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

  return {
    model,
    latencies,
    avgLatency,
    minLatency,
    maxLatency,
    successCount,
    failCount,
  };
}

async function main() {
  console.log('═'.repeat(60));
  console.log('⚡ 속도 벤치마크: DeepSeek V3.2 vs Gemini 2.5 Flash');
  console.log('═'.repeat(60));
  console.log(`테스트 횟수: ${TEST_PROMPTS.length}회`);

  const results: BenchmarkResult[] = [];

  for (const model of MODELS) {
    const result = await benchmarkModel(model);
    results.push(result);
  }

  // 결과 요약
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('📊 벤치마크 결과 요약');
  console.log('═'.repeat(60));

  console.log('\n| 모델 | 평균 | 최소 | 최대 | 성공률 |');
  console.log('|------|------|------|------|--------|');

  for (const r of results) {
    const successRate = Math.round((r.successCount / TEST_PROMPTS.length) * 100);
    console.log(`| ${r.model.split('/')[1]} | ${r.avgLatency}ms | ${r.minLatency}ms | ${r.maxLatency}ms | ${successRate}% |`);
  }

  // 승자 결정
  const sortedByAvg = [...results].sort((a, b) => a.avgLatency - b.avgLatency);
  const winner = sortedByAvg[0];
  const loser = sortedByAvg[1];
  const speedDiff = loser.avgLatency - winner.avgLatency;
  const speedRatio = (loser.avgLatency / winner.avgLatency).toFixed(2);

  console.log('\n');
  console.log('═'.repeat(60));
  console.log('🏆 결론');
  console.log('═'.repeat(60));
  console.log(`\n🥇 승자: ${winner.model} (평균 ${winner.avgLatency}ms)`);
  console.log(`🥈 패자: ${loser.model} (평균 ${loser.avgLatency}ms)`);
  console.log(`\n📈 속도 차이: ${speedDiff}ms (${speedRatio}x 더 빠름)`);
}

main().catch(console.error);

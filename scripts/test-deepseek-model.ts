/**
 * DeepSeek V3.2 Special Edition 모델 테스트 스크립트
 * 빈 응답 문제 디버깅용
 */

import 'dotenv/config';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY 환경변수가 필요합니다');
  process.exit(1);
}

const MODEL = 'deepseek/deepseek-v3.2-speciale';

async function testModel() {
  console.log(`\n🔍 Testing model: ${MODEL}\n`);
  console.log('='.repeat(60));

  // 간단한 테스트 메시지
  const messages = [
    { role: 'user', content: '안녕하세요! 간단한 테스트입니다. 짧게 대답해주세요.' }
  ];

  console.log('📤 Request:');
  console.log('  Messages:', JSON.stringify(messages, null, 2));

  const requestBody = {
    model: MODEL,
    messages,
    temperature: 0.8,
    max_tokens: 500,
  };

  console.log('\n📦 Request Body:');
  console.log(JSON.stringify(requestBody, null, 2));

  try {
    const startTime = Date.now();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'DeepSeek Test',
      },
      body: JSON.stringify(requestBody),
    });

    const elapsed = Date.now() - startTime;
    console.log(`\n⏱️ Response time: ${elapsed}ms`);
    console.log(`📊 HTTP Status: ${response.status} ${response.statusText}`);

    // 응답 헤더 출력
    console.log('\n📋 Response Headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });

    const responseText = await response.text();
    console.log('\n📥 Raw Response:');
    console.log(responseText);

    if (!response.ok) {
      console.error('\n❌ API Error!');
      return;
    }

    // JSON 파싱
    try {
      const data = JSON.parse(responseText);
      console.log('\n✅ Parsed JSON:');
      console.log(JSON.stringify(data, null, 2));

      // 실제 메시지 내용 추출
      const content = data.choices?.[0]?.message?.content;
      console.log('\n💬 Generated Content:');
      console.log(`"${content}"`);
      console.log(`\n📏 Content length: ${content?.length || 0} characters`);

      if (!content || content.trim() === '') {
        console.log('\n⚠️ WARNING: Empty response received!');

        // 추가 디버깅 정보
        console.log('\n🔍 Debug Info:');
        console.log('  - finish_reason:', data.choices?.[0]?.finish_reason);
        console.log('  - model:', data.model);
        console.log('  - usage:', JSON.stringify(data.usage));
      }
    } catch (parseError) {
      console.error('\n❌ JSON Parse Error:', parseError);
    }

  } catch (error) {
    console.error('\n❌ Fetch Error:', error);
  }
}

// 여러 번 테스트
async function runMultipleTests() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 DeepSeek V3.2 Special Edition - Multiple Test Run');
  console.log('='.repeat(60));

  for (let i = 1; i <= 3; i++) {
    console.log(`\n\n🔄 Test ${i}/3`);
    await testModel();

    // 잠시 대기
    if (i < 3) {
      console.log('\n⏳ Waiting 2 seconds before next test...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('✅ All tests completed');
  console.log('='.repeat(60));
}

runMultipleTests().catch(console.error);

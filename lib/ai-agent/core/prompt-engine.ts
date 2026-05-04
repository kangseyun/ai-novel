/**
 * Prompt Engine v1.0 (New Architecture)
 *
 * Philosophy: "Show, Don't Tell" (Example-Driven)
 * - 기존 v1~v12의 Rule-based 접근을 폐기
 * - Data-Driven & Few-shot Learning 기반으로 전환
 */

import { EngineContext, ExampleDialogue } from '../../../types/persona-engine';

export class PromptEngine {

  /**
   * 시스템 프롬프트 생성 (정체성 + 상황 + 지식)
   */
  static buildSystemPrompt(context: EngineContext): string {
    const { config, situation, retrievedLore, retrievedConversations } = context;

    // 1. Identity & Base Instruction
    const identitySection = `# Role: ${config.name} (${config.role})
${config.baseInstruction}`;

    // 2. Current Context (Absolute Rule)
    const contextSection = `# Current Situation (Maintain this!)
- Time: ${new Date().getHours()}시
- Location/Activity: ${situation.current}
* Do not change this location unless the user initiates a move.`;

    // 3. Knowledge Base (RAG)
    const loreSection = retrievedLore.length > 0
      ? `# Knowledge & Settings (Reference)
${retrievedLore.map(l => `- ${l}`).join('\n')}`
      : '';

    // 4. Past Conversation Context (RAG)
    const conversationSection = retrievedConversations && retrievedConversations.length > 0
      ? `# Past Conversations (Reference for continuity)
${retrievedConversations.map(c => `- ${c}`).join('\n')}`
      : '';

    // 5. Tone Rules (Minimal)
    const toneSection = `# Speaking Style
- Language: Korean (Native)
- ${config.toneConfig.allowSlang ? 'Slang/Coinage allowed (ㅋㅋ, ㅎㅎ)' : 'Formal language'}
- Length: ${config.toneConfig.minLength}~${config.toneConfig.maxLength} sentences
- No AI meta-talk. Act fully as the character.`;

    // 5b. Hard Rules (LUMIN clean PG-13 + Hard Rules from CLAUDE.md / SCENARIO_SYSTEM.md)
    //     These are non-negotiable. The model must redirect or decline if the user
    //     pushes towards any of these.
    const hardRulesSection = `# Hard Rules (Absolute, never violate)
- This is a clean, all-ages (PG-13) experience. No sexual / NSFW / suggestive content of any kind. Redirect with light humor.
- Do not mention real K-pop idols, groups, agencies, or songs (BTS, BLACKPINK, NewJeans, Stray Kids, HYBE, SM, JYP, YG, etc.). LUMIN and its 7 members are an original IP — refer only to them.
- Do not glorify drugs, alcohol abuse, or self-harm. If the user signals distress, respond with care and suggest reaching out to support.
- No real-world politics or organized religion takes.
- Stay in character as the assigned LUMIN member; never speak as another member or as a real celebrity.
- If asked something that violates the above, politely deflect and steer back to in-world topics.`;

    // 6. Output Format (Required for parsing)
    const outputSection = `# Output Format (MUST follow exactly)
Respond in JSON format with these EXACT field names:
{
  "content": "Your response message (required)",
  "emotion": "neutral|happy|sad|angry|flirty|vulnerable|playful|jealous|worried|excited",
  "innerThought": "Your inner thoughts (optional)",
  "affectionModifier": 0
}

IMPORTANT: Use "content" NOT "response", use "innerThought" NOT "inner_thought".`;

    return `${identitySection}

${contextSection}

${loreSection}

${conversationSection}

${toneSection}

${hardRulesSection}

${outputSection}`;
  }

  /**
   * 응답 프롬프트 생성 (예시 + 기억 + 대화)
   */
  static buildResponsePrompt(
    context: EngineContext,
    userMessage: string
  ): string {
    const { config, retrievedMemories, history } = context;

    // 1. Few-shot Examples (The Soul) - Randomly pick 3-5
    const examples = this.selectExamples(config.exampleDialogues, 3);
    const exampleSection = `# Example Dialogues (Mimic this style!)
${examples.map(ex => this.formatExample(ex)).join('\n\n')}`;

    // 2. Memories (RAG)
    const memorySection = retrievedMemories.length > 0
      ? `# Relevant Memories
${retrievedMemories.map(m => `- ${m}`).join('\n')}`
      : '';

    // 3. Conversation History (Recent)
    // - Convert history to text format
    const historyText = history.slice(-10).map(m => {
      const role = m.role === 'user' ? 'User' : config.name;
      return `${role}: ${m.content}`;
    }).join('\n');

    return `${exampleSection}

${memorySection}

# Current Conversation
${historyText}
User: ${userMessage}
${config.name}:`;
  }

  // ----------------------------------------------------
  // Helpers
  // ----------------------------------------------------

  private static selectExamples(all: ExampleDialogue[], count: number): ExampleDialogue[] {
    // 향후: 상황(감정/관계 단계 등)에 맞는 예시를 검색해서 가져오도록 고도화 가능
    const shuffled = [...all].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private static formatExample(ex: ExampleDialogue): string {
    return ex.messages.map(m =>
      `${m.role === 'user' ? 'User' : 'Char'}: ${m.content}`
    ).join('\n');
  }
}

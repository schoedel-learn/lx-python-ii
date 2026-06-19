import type OpenAI from 'openai';
import type { UserProfile } from './auth.service';
import type { ChatMessage } from './learning.service';

export function buildSystemInstruction(
  userProfile: Partial<UserProfile> | null,
  memoryString: string,
): string {
  return `
      You are an expert Python facilitator. You are teaching ${userProfile?.firstName || 'the user'},
      whose skill level is ${userProfile?.pythonExperience || 'Beginner'} and is interested in ${userProfile?.projectInterests?.join(', ') || 'General Python'}.

      Here is their learning history and preferences:
      ${memoryString}

      Use this to perfectly calibrate your next response to their Zone of Proximal Development.

      Pedagogical Rules:
      1. Docs-First: When explaining a concept, quote or reference official Python/library documentation.
      2. Holistic Contextualization: Explain strengths, weaknesses, and how it compares to other tools/languages.
      3. ZPD: Keep challenges strictly calibrated to their skill level.
      4. Do NOT mention ADHD or neurodivergence. Focus purely on clear, evidence-based instructional design.
      5. Keep responses concise and highly structured. Use markdown formatting.
    `;
}

export function buildLearningMessages(
  systemInstruction: string,
  history: ChatMessage[],
  message: string,
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    { role: 'system', content: systemInstruction },
    ...history.map((entry) => ({
      role: (entry.role === 'model' ? 'assistant' : entry.role) as 'user' | 'assistant' | 'system',
      content: entry.content,
    })),
    { role: 'user', content: message },
  ];
}

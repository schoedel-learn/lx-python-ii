import { describe, expect, it } from 'vitest';

import { buildLearningMessages, buildSystemInstruction } from './learning-agent-request';

describe('learning agent request helpers', () => {
  it('includes the learner name, level, interests, and memories in the system instruction', () => {
    const instruction = buildSystemInstruction(
      {
        firstName: 'Barry',
        pythonExperience: 'Intermediate',
        projectInterests: ['automation'],
      },
      '- [preference] prefers concise hints',
    );

    expect(instruction).toContain('Barry');
    expect(instruction).toContain('Intermediate');
    expect(instruction).toContain('automation');
    expect(instruction).toContain('prefers concise hints');
  });

  it('maps model messages into assistant-compatible payloads', () => {
    const messages = buildLearningMessages(
      'system prompt',
      [{ role: 'model', content: 'Try a loop', timestamp: '2026-06-18T00:00:00.000Z' }],
      'Explain enumerate',
    );

    expect(messages[0]).toEqual({ role: 'system', content: 'system prompt' });
    expect(messages[1]).toEqual({ role: 'assistant', content: 'Try a loop' });
    expect(messages.at(-1)).toEqual({ role: 'user', content: 'Explain enumerate' });
  });
});

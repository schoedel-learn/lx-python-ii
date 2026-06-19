import { describe, expect, it } from 'vitest';

import { getExecutionSummary } from './learning-workspace-state';

describe('learning workspace state', () => {
  it('reports no execution before a run', () => {
    expect(getExecutionSummary(null)).toBe('No execution yet');
  });

  it('reports a successful execution summary', () => {
    expect(getExecutionSummary({ error: '', stderr: '' })).toBe('Captured successfully');
  });

  it('reports debugging when stderr or an exception is present', () => {
    expect(getExecutionSummary({ stderr: 'Traceback' })).toBe('Needs debugging');
    expect(getExecutionSummary({ error: 'SyntaxError' })).toBe('Needs debugging');
  });
});

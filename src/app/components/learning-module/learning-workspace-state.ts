export interface ExecutionState {
  error?: string | null;
  stderr?: string | null;
}

export function getExecutionSummary(result: ExecutionState | null): string {
  if (!result) return 'No execution yet';
  return result.error || result.stderr ? 'Needs debugging' : 'Captured successfully';
}

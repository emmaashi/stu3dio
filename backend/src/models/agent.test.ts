import { describe, expect, test } from 'bun:test';
import { CreateAgentRunSchema, ResolveAgentApprovalSchema } from './agent.js';

describe('agent run contracts', () => {
  test('applies production-safe film defaults', () => {
    const result = CreateAgentRunSchema.parse({ prompt: 'A stormy mystery' });
    expect(result.kind).toBe('create-film');
    expect(result.settings).toEqual({ runtime_seconds: 64, aspect_ratio: '16:9', shot_seconds: 8 });
  });

  test('rejects unsupported shot durations', () => {
    expect(() => CreateAgentRunSchema.parse({
      prompt: 'A stormy mystery',
      settings: { runtime_seconds: 64, aspect_ratio: '16:9', shot_seconds: 6 }
    })).toThrow();
  });

  test('accepts idempotent approval decisions', () => {
    const result = ResolveAgentApprovalSchema.parse({
      decision: 'approve',
      values: { title: 'Afterlight' },
      idempotency_key: 'approval-1'
    });
    expect(result.decision).toBe('approve');
    expect(result.idempotency_key).toBe('approval-1');
  });
});

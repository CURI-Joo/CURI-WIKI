import { describe, expect, it } from 'vitest';
import { runMcpSuite } from '@/__tests__/mcp/run-suite';

describe('CURI Wiki MCP OAuth + wiki flow', () => {
  it('passes all 56 compatibility cases', async () => {
    const result = await runMcpSuite();
    expect(result.failures).toEqual([]);
    expect(result.passed).toBe(56);
  });
});

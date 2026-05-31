import { describe, it, expect } from 'vitest';
import LogParser from '../../src/main/log-parser';

describe('LogParser', () => {
  describe('extractTokenUsage', () => {
    it('should extract file path from Read tool_use', () => {
      const parser = new LogParser();
      const entry = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/path/to/file.ts' }
            }
          ],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 10,
            cache_creation_input_tokens: 5
          }
        },
        timestamp: '2026-05-31T10:00:00Z'
      };

      const result = (parser as any).extractTokenUsage(entry, '/path/to');
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe('file.ts');
      expect(result!.inputTokens).toBe(100);
    });

    it('should extract file path from Edit tool_use', () => {
      const parser = new LogParser();
      const entry = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Edit',
              input: { file_path: '/project/src/main.ts' }
            }
          ],
          usage: {
            input_tokens: 200,
            output_tokens: 80,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0
          }
        },
        timestamp: '2026-05-31T10:00:00Z'
      };

      const result = (parser as any).extractTokenUsage(entry, '/project');
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe('src/main.ts');
    });

    it('should extract file path from Bash command', () => {
      const parser = new LogParser();
      const entry = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Bash',
              input: { command: 'cat /path/to/file.txt' }
            }
          ],
          usage: {
            input_tokens: 50,
            output_tokens: 20,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0
          }
        },
        timestamp: '2026-05-31T10:00:00Z'
      };

      const result = (parser as any).extractTokenUsage(entry, '/path/to');
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe('file.txt');
    });

    it('should use __global__ for tools without file path', () => {
      const parser = new LogParser();
      const entry = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'TaskCreate',
              input: { subject: 'Test task' }
            }
          ],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0
          }
        },
        timestamp: '2026-05-31T10:00:00Z'
      };

      const result = (parser as any).extractTokenUsage(entry, '/project');
      expect(result).not.toBeNull();
      expect(result!.filePath).toBe('__global__');
    });

    it('should return null for non-assistant entries', () => {
      const parser = new LogParser();
      const entry = {
        type: 'user',
        message: {
          content: [],
          usage: { input_tokens: 100, output_tokens: 50 }
        }
      };

      const result = (parser as any).extractTokenUsage(entry, '/project');
      expect(result).toBeNull();
    });

    it('should return null when total tokens is zero', () => {
      const parser = new LogParser();
      const entry = {
        type: 'assistant',
        message: {
          content: [
            {
              type: 'tool_use',
              name: 'Read',
              input: { file_path: '/path/to/file.ts' }
            }
          ],
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0
          }
        }
      };

      const result = (parser as any).extractTokenUsage(entry, '/path/to');
      expect(result).toBeNull();
    });
  });
});

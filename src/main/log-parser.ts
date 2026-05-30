// src/main/log-parser.ts
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EVENT_CORRELATION_WINDOW_MS } from '../shared/constants';

export interface TokenUsage {
  filePath: string;
  tokens: number;
  timestamp: string;
}

export default class LogParser {
  private claudeDir: string;
  private lastScanTime: Date;
  private processedFiles: Set<string> = new Set();

  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude', 'projects');
    this.lastScanTime = new Date(0);
  }

  async scanForTokenUsage(projectPath: string): Promise<TokenUsage[]> {
    const results: TokenUsage[] = [];

    if (!fs.existsSync(this.claudeDir)) return results;

    try {
      const projectDirs = fs.readdirSync(this.claudeDir);
      for (const dir of projectDirs) {
        const logDir = path.join(this.claudeDir, dir);
        if (!fs.statSync(logDir).isDirectory()) continue;

        const logFiles = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl'));
        for (const logFile of logFiles) {
          const fullPath = path.join(logDir, logFile);
          if (this.processedFiles.has(fullPath)) continue;

          const usage = await this.parseLogFile(fullPath, projectPath);
          results.push(...usage);
          this.processedFiles.add(fullPath);
        }
      }
    } catch {
      // Ignore errors in log scanning
    }

    this.lastScanTime = new Date();
    return results;
  }

  private async parseLogFile(filePath: string, projectPath: string): Promise<TokenUsage[]> {
    const results: TokenUsage[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const usage = this.extractTokenUsage(entry, projectPath);
          if (usage) results.push(usage);
        } catch {
          // Skip malformed lines
        }
      }
    } catch {
      // Skip unreadable files
    }

    return results;
  }

  private extractTokenUsage(entry: any, projectPath: string): TokenUsage | null {
    // Look for tool use entries that involve file operations
    if (!entry || typeof entry !== 'object') return null;

    const timestamp = entry.timestamp || entry.created_at || new Date().toISOString();
    const message = entry.message || entry;

    // Extract file path from tool input
    let filePath: string | null = null;
    let tokens = 0;

    if (message?.content && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_use') {
          const input = block.input || {};
          if (input.file_path || input.command) {
            filePath = input.file_path || this.extractFileFromCommand(input.command);
          }
        }
        if (block.type === 'tool_result' && block.usage) {
          tokens += (block.usage.input_tokens || 0) + (block.usage.output_tokens || 0);
        }
      }
    }

    // Check for usage field at message level
    if (message?.usage) {
      tokens += (message.usage.input_tokens || 0) + (message.usage.output_tokens || 0);
    }

    if (!filePath || tokens === 0) return null;

    // Make path relative to project
    if (filePath.startsWith(projectPath)) {
      filePath = path.relative(projectPath, filePath);
    }

    return { filePath, tokens, timestamp };
  }

  private extractFileFromCommand(command: string | undefined): string | null {
    if (!command) return null;
    // Try to extract file path from common commands
    const patterns = [
      /(?:cat|edit|write|read)\s+([^\s]+)/,
      /(?:vim|nano|code)\s+([^\s]+)/,
    ];
    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  correlateWithEvents(
    tokenUsages: TokenUsage[],
    events: { filePath: string; timestamp: string; id: number }[]
  ): Map<number, number> {
    const result = new Map<number, number>();

    for (const usage of tokenUsages) {
      const usageTime = new Date(usage.timestamp).getTime();

      for (const event of events) {
        if (event.filePath !== usage.filePath) continue;

        const eventTime = new Date(event.timestamp).getTime();
        const timeDiff = Math.abs(usageTime - eventTime);

        if (timeDiff < EVENT_CORRELATION_WINDOW_MS) {
          const existing = result.get(event.id) || 0;
          result.set(event.id, existing + usage.tokens);
        }
      }
    }

    return result;
  }
}

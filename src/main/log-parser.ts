// src/main/log-parser.ts
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EVENT_CORRELATION_WINDOW_MS } from '../shared/constants';

export interface TokenUsage {
  filePath: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
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

  // 将项目路径转换为 Claude Code 的目录名格式
  // D:\dev\niumashun → D--dev-niumashun
  private projectPathToDirName(projectPath: string): string {
    return projectPath
      .replace(/\//g, '-')
      .replace(/\\/g, '-')
      .replace(/:/g, '-')
      .replace(/\./g, '-');
  }

  // 查找匹配的项目目录
  private findProjectDir(projectPath: string): string | null {
    if (!fs.existsSync(this.claudeDir)) return null;

    const targetDirName = this.projectPathToDirName(projectPath);
    const entries = fs.readdirSync(this.claudeDir);

    // 精确匹配
    if (entries.includes(targetDirName)) {
      return path.join(this.claudeDir, targetDirName);
    }

    // 模糊匹配：查找包含项目名的目录
    const projectName = path.basename(projectPath).toLowerCase();
    for (const entry of entries) {
      if (entry.toLowerCase().includes(projectName)) {
        const fullPath = path.join(this.claudeDir, entry);
        if (fs.statSync(fullPath).isDirectory()) {
          return fullPath;
        }
      }
    }

    return null;
  }

  async scanForTokenUsage(projectPath: string): Promise<TokenUsage[]> {
    const results: TokenUsage[] = [];
    const projectDir = this.findProjectDir(projectPath);

    if (!projectDir) return results;

    try {
      const logFiles = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));

      for (const logFile of logFiles) {
        const fullPath = path.join(projectDir, logFile);

        // 只处理最近 14 天修改的文件
        const stat = fs.statSync(fullPath);
        const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        if (stat.mtimeMs < fourteenDaysAgo) continue;

        if (this.processedFiles.has(fullPath)) continue;

        const usage = await this.parseLogFile(fullPath, projectPath);
        results.push(...usage);
        this.processedFiles.add(fullPath);
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
    if (!entry || typeof entry !== 'object') return null;

    // 只处理 assistant 类型的消息
    if (entry.type !== 'assistant') return null;

    const timestamp = entry.timestamp || entry.created_at || new Date().toISOString();
    const message = entry.message || entry;

    // 提取文件路径：从 tool_use 的 input 中获取
    let filePath: string | null = null;
    if (message?.content && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_use') {
          const input = block.input || {};
          if (input.file_path) {
            filePath = input.file_path;
            break;
          }
          if (input.command) {
            filePath = this.extractFileFromCommand(input.command);
            if (filePath) break;
          }
        }
      }
    }

    // 提取 token 使用量（4 个字段）
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;

    // 从 message.usage 提取（Claude Code 标准格式）
    if (message?.usage) {
      inputTokens = message.usage.input_tokens || 0;
      outputTokens = message.usage.output_tokens || 0;
      cacheReadTokens = message.usage.cache_read_input_tokens || 0;
      cacheCreationTokens = message.usage.cache_creation_input_tokens || 0;
    }

    // 从 tool_result 的 usage 提取（如果有的话）
    if (message?.content && Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === 'tool_result' && block.usage) {
          inputTokens += block.usage.input_tokens || 0;
          outputTokens += block.usage.output_tokens || 0;
          cacheReadTokens += block.usage.cache_read_input_tokens || 0;
          cacheCreationTokens += block.usage.cache_creation_input_tokens || 0;
        }
      }
    }

    const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens;

    // 如果没有 token 使用量，跳过
    if (totalTokens === 0) return null;

    // 如果没有文件路径，使用默认值
    if (!filePath) {
      filePath = 'unknown';
    }

    // 使路径相对于项目
    if (filePath.startsWith(projectPath)) {
      filePath = path.relative(projectPath, filePath);
    }

    return {
      filePath,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      totalTokens,
      timestamp,
    };
  }

  private extractFileFromCommand(command: string | undefined): string | null {
    if (!command) return null;
    // 尝试从常见命令中提取文件路径
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
  ): Map<number, TokenUsage> {
    const result = new Map<number, TokenUsage>();

    for (const usage of tokenUsages) {
      const usageTime = new Date(usage.timestamp).getTime();

      for (const event of events) {
        if (event.filePath !== usage.filePath) continue;

        const eventTime = new Date(event.timestamp).getTime();
        const timeDiff = Math.abs(usageTime - eventTime);

        if (timeDiff < EVENT_CORRELATION_WINDOW_MS) {
          // 合并 token 使用量
          const existing = result.get(event.id);
          if (existing) {
            result.set(event.id, {
              ...existing,
              inputTokens: existing.inputTokens + usage.inputTokens,
              outputTokens: existing.outputTokens + usage.outputTokens,
              cacheReadTokens: existing.cacheReadTokens + usage.cacheReadTokens,
              cacheCreationTokens: existing.cacheCreationTokens + usage.cacheCreationTokens,
              totalTokens: existing.totalTokens + usage.totalTokens,
            });
          } else {
            result.set(event.id, usage);
          }
        }
      }
    }

    return result;
  }
}

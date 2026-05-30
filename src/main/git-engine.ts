import simpleGit, { SimpleGit } from 'simple-git';
import { BINARY_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../shared/constants';
import fs from 'fs';
import path from 'path';

export interface DiffResult {
  added: number;
  removed: number;
}

export default class GitEngine {
  private git: SimpleGit;
  private projectPath: string;
  private _isRepo: boolean | null = null;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.git = simpleGit(projectPath);
  }

  async isGitRepo(): Promise<boolean> {
    if (this._isRepo !== null) return this._isRepo;
    try {
      await this.git.revparse(['--is-inside-work-tree']);
      this._isRepo = true;
    } catch {
      this._isRepo = false;
    }
    return this._isRepo;
  }

  async getDiff(): Promise<{ filePath: string; diff: DiffResult }[]> {
    if (!(await this.isGitRepo())) return [];

    try {
      const diffSummary = await this.git.diffSummary();
      const results: { filePath: string; diff: DiffResult }[] = [];

      for (const file of diffSummary.files) {
        const filePath = file.file;
        if (this.shouldSkipFile(filePath)) continue;

        const diff = await this.git.diff(['--', filePath]);
        results.push({
          filePath,
          diff: this.parseDiff(diff),
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  async getDiffForFile(filePath: string): Promise<DiffResult> {
    if (!(await this.isGitRepo())) return { added: 0, removed: 0 };
    if (this.shouldSkipFile(filePath)) return { added: 0, removed: 0 };

    try {
      const diff = await this.git.diff(['--', filePath]);
      return this.parseDiff(diff);
    } catch {
      return { added: 0, removed: 0 };
    }
  }

  parseDiff(diffOutput: string): DiffResult {
    if (!diffOutput || diffOutput.includes('Binary files')) {
      return { added: 0, removed: 0 };
    }

    let added = 0;
    let removed = 0;

    const lines = diffOutput.split('\n');
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed++;
      }
    }

    return { added, removed };
  }

  async getFileLineCount(filePath: string): Promise<number> {
    const fullPath = path.join(this.projectPath, filePath);
    try {
      if (!fs.existsSync(fullPath)) return 0;
      const stat = fs.statSync(fullPath);
      if (stat.size > MAX_FILE_SIZE_BYTES) return 0;
      const content = fs.readFileSync(fullPath, 'utf-8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  async getTotalLineCount(): Promise<number> {
    if (!(await this.isGitRepo())) return 0;
    try {
      const output = await this.git.raw(['ls-files', '-z']);
      const files = output.split('\0').filter(f => f && !this.shouldSkipFile(f));
      let total = 0;
      for (const file of files) {
        total += await this.getFileLineCount(file);
      }
      return total;
    } catch {
      return 0;
    }
  }

  private shouldSkipFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) return true;
    if (filePath.includes('node_modules')) return true;
    if (filePath.includes('.git/')) return true;
    return false;
  }
}

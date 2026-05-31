import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs';
import { EXCLUDED_DIRS, BINARY_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../shared/constants';

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  filePath: string;
  timestamp: string;
  linesAdded: number;
  linesDeleted: number;
}

export default class FileWatcher {
  private watcher: FSWatcher | null = null;
  private projectPath: string;
  private onChange: (event: FileChangeEvent) => void;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private fileContentCache: Map<string, string[]> = new Map(); // filePath -> lines[]
  private contentHashes: Map<string, number> = new Map();

  private hashContent(content: string): number {
    let h = 0;
    for (let i = 0; i < content.length; i++) {
      h = Math.imul(31, h) + content.charCodeAt(i) | 0;
    }
    return h;
  }

  constructor(projectPath: string, onChange: (event: FileChangeEvent) => void) {
    this.projectPath = projectPath;
    this.onChange = onChange;
  }

  start(): void {
    if (this.watcher) return;

    this.watcher = chokidar.watch(this.projectPath, {
      ignored: (filePath: string) => this.shouldIgnore(filePath),
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher
      .on('change', (filePath) => this.handleEvent('change', filePath))
      .on('add', (filePath) => this.handleEvent('add', filePath))
      .on('unlink', (filePath) => this.handleEvent('unlink', filePath))
      .on('addDir', (filePath) => this.handleEvent('addDir', filePath))
      .on('unlinkDir', (filePath) => this.handleEvent('unlinkDir', filePath));
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.fileContentCache.clear();
    this.contentHashes.clear();
  }

  private handleEvent(type: FileChangeEvent['type'], filePath: string): void {
    const relativePath = path.relative(this.projectPath, filePath);

    // Debounce rapid changes to the same file
    const existing = this.debounceTimers.get(relativePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(relativePath, setTimeout(() => {
      this.debounceTimers.delete(relativePath);
      const event = this.createEvent(type, filePath, relativePath);
      if (event) {
        this.onChange(event);
      }
    }, 150));
  }

  private createEvent(
    type: FileChangeEvent['type'],
    fullPath: string,
    relativePath: string
  ): FileChangeEvent | null {
    let linesAdded = 0;
    let linesDeleted = 0;

    if (type === 'add') {
      // New file - count all lines as added
      const content = this.readFileContent(fullPath);
      if (content !== null) {
        linesAdded = content.length;
        this.fileContentCache.set(relativePath, content);
        this.contentHashes.set(relativePath, this.hashContent(content.join('\n')));
      }
    } else if (type === 'change') {
      // Changed file - compare with cached content
      const oldContent = this.fileContentCache.get(relativePath) || [];
      const newContent = this.readFileContent(fullPath);
      if (newContent !== null) {
        // Hash deduplication: skip if content hasn't actually changed
        const newHash = this.hashContent(newContent.join('\n'));
        const oldHash = this.contentHashes.get(relativePath);
        if (newHash === oldHash) {
          return null; // Content unchanged, skip event
        }
        this.contentHashes.set(relativePath, newHash);

        const diff = this.calculateLineDiff(oldContent, newContent);

        // Semantic volatility: if line count unchanged but content changed,
        // record the changed lines as both added and removed
        if (diff.added === 0 && diff.removed === 0 && diff.changed > 0) {
          linesAdded = diff.changed;
          linesDeleted = diff.changed;
        } else {
          linesAdded = diff.added;
          linesDeleted = diff.removed;
        }
        this.fileContentCache.set(relativePath, newContent);
      }
    } else if (type === 'unlink') {
      // Deleted file - count all cached lines as deleted
      const oldContent = this.fileContentCache.get(relativePath);
      if (oldContent) {
        linesDeleted = oldContent.length;
        this.fileContentCache.delete(relativePath);
        this.contentHashes.delete(relativePath);
      }
    } else if (type === 'unlinkDir') {
      // Directory deleted - remove all cached entries under this path
      for (const key of this.fileContentCache.keys()) {
        if (key.startsWith(relativePath + '/') || key.startsWith(relativePath + path.sep)) {
          const content = this.fileContentCache.get(key);
          if (content) {
            linesDeleted += content.length;
          }
          this.fileContentCache.delete(key);
          this.contentHashes.delete(key);
        }
      }
    }

    return {
      type,
      filePath: relativePath,
      timestamp: new Date().toISOString(),
      linesAdded,
      linesDeleted,
    };
  }

  private readFileContent(filePath: string): string[] | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_FILE_SIZE_BYTES) return null;
      const content = fs.readFileSync(filePath, 'utf-8');
      return content.split('\n');
    } catch {
      return null;
    }
  }

  private calculateLineDiff(oldLines: string[], newLines: string[]): {
    added: number;
    removed: number;
    changed: number;
  } {
    const oldSet = new Map<string, number>();
    const newSet = new Map<string, number>();

    for (const line of oldLines) {
      oldSet.set(line, (oldSet.get(line) || 0) + 1);
    }

    for (const line of newLines) {
      newSet.set(line, (newSet.get(line) || 0) + 1);
    }

    let removed = 0;
    let added = 0;

    for (const [line, oldCount] of oldSet) {
      const newCount = newSet.get(line) || 0;
      if (oldCount > newCount) {
        removed += oldCount - newCount;
      }
    }

    for (const [line, newCount] of newSet) {
      const oldCount = oldSet.get(line) || 0;
      if (newCount > oldCount) {
        added += newCount - oldCount;
      }
    }

    // Semantic volatility: count lines that changed content but not count
    let changed = 0;
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      if (oldLines[i] !== newLines[i]) {
        changed++;
      }
    }

    return { added, removed, changed };
  }

  private shouldIgnore(filePath: string): boolean {
    const relativePath = path.relative(this.projectPath, filePath);
    const parts = relativePath.split(path.sep);

    // Check excluded directories
    for (const part of parts) {
      if (EXCLUDED_DIRS.includes(part)) return true;
    }

    // Check binary extensions
    const ext = path.extname(filePath).toLowerCase();
    if (BINARY_EXTENSIONS.has(ext)) return true;

    // Check file size
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_FILE_SIZE_BYTES) return true;
    } catch {
      // File might not exist (deleted), that's fine
    }

    return false;
  }
}

import chokidar, { FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs';
import { EXCLUDED_DIRS, BINARY_EXTENSIONS, MAX_FILE_SIZE_BYTES } from '../shared/constants';

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  filePath: string;
  timestamp: string;
}

export default class FileWatcher {
  private watcher: FSWatcher | null = null;
  private projectPath: string;
  private onChange: (event: FileChangeEvent) => void;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

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
  }

  private handleEvent(type: FileChangeEvent['type'], filePath: string): void {
    const relativePath = path.relative(this.projectPath, filePath);

    // Debounce rapid changes to the same file
    const existing = this.debounceTimers.get(relativePath);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(relativePath, setTimeout(() => {
      this.debounceTimers.delete(relativePath);
      this.onChange({
        type,
        filePath: relativePath,
        timestamp: new Date().toISOString(),
      });
    }, 150));
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

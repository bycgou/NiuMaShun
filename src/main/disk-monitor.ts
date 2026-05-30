// src/main/disk-monitor.ts
import fs from 'fs';
import { DISK_SPACE_THRESHOLD_MB } from '../shared/constants';

export default class DiskMonitor {
  private dbPath: string;
  private thresholdBytes: number;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.thresholdBytes = DISK_SPACE_THRESHOLD_MB * 1024 * 1024;
  }

  async checkDiskSpace(): Promise<{ available: number; safe: boolean }> {
    try {
      const stats = fs.statfsSync(this.dbPath);
      const available = stats.bavail * stats.bsize;
      return { available, safe: available > this.thresholdBytes };
    } catch {
      return { available: Infinity, safe: true };
    }
  }

  isDatabaseCorrupted(): boolean {
    try {
      if (!fs.existsSync(this.dbPath)) return false;
      const content = fs.readFileSync(this.dbPath);
      // Check SQLite header
      return content.subarray(0, 16).toString() !== 'SQLite format 3\0';
    } catch {
      return true;
    }
  }

  backupDatabase(): string | null {
    try {
      if (!fs.existsSync(this.dbPath)) return null;
      const backupPath = this.dbPath + '.backup.' + Date.now();
      fs.copyFileSync(this.dbPath, backupPath);
      return backupPath;
    } catch {
      return null;
    }
  }
}

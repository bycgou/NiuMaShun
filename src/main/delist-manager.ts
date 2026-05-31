export interface DelistState {
  filePath: string;
  delistedAt: number;
  timer: NodeJS.Timeout;
}

export default class DelistManager {
  private delistedFiles: Map<string, DelistState> = new Map();
  private delistDurationMs: number;

  constructor(delistDurationMs = 30000) {
    this.delistDurationMs = delistDurationMs;
  }

  markDelisted(filePath: string, onUpdate: () => void): void {
    // If already delisted, don't duplicate
    if (this.delistedFiles.has(filePath)) {
      return;
    }

    const state: DelistState = {
      filePath,
      delistedAt: Date.now(),
      timer: setTimeout(() => {
        this.delistedFiles.delete(filePath);
        onUpdate();
      }, this.delistDurationMs),
    };

    this.delistedFiles.set(filePath, state);
    onUpdate();
  }

  cancelDelist(filePath: string): void {
    const state = this.delistedFiles.get(filePath);
    if (state) {
      clearTimeout(state.timer);
      this.delistedFiles.delete(filePath);
    }
  }

  getDelistedFiles(): string[] {
    return Array.from(this.delistedFiles.keys());
  }

  isDelisted(filePath: string): boolean {
    return this.delistedFiles.has(filePath);
  }

  clear(): void {
    for (const state of this.delistedFiles.values()) {
      clearTimeout(state.timer);
    }
    this.delistedFiles.clear();
  }
}

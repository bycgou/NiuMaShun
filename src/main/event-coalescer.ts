import { FileChangeEvent } from './file-watcher';

interface PendingEvent {
  event: FileChangeEvent;
  timer: NodeJS.Timeout;
  count: number;
}

export default class EventCoalescer {
  private pendingEvents: Map<string, PendingEvent> = new Map();
  private coalesceWindowMs: number;

  constructor(coalesceWindowMs = 1500) {
    this.coalesceWindowMs = coalesceWindowMs;
  }

  process(event: FileChangeEvent, onFlush: (e: FileChangeEvent) => void): void {
    const key = event.filePath;
    const existing = this.pendingEvents.get(key);

    if (existing) {
      // Merge events
      clearTimeout(existing.timer);
      existing.count++;
      existing.event = this.mergeEvents(existing.event, event);
    } else {
      // New event
      this.pendingEvents.set(key, {
        event,
        count: 1,
        timer: null!,
      });
    }

    // Set new timer
    const pending = this.pendingEvents.get(key)!;
    pending.timer = setTimeout(() => {
      this.pendingEvents.delete(key);
      onFlush(pending.event);
    }, this.coalesceWindowMs);
  }

  private mergeEvents(a: FileChangeEvent, b: FileChangeEvent): FileChangeEvent {
    return {
      type: b.type === 'unlink' ? 'unlink' : a.type,
      filePath: b.filePath,
      timestamp: b.timestamp, // Use latest timestamp
      linesAdded: a.linesAdded + b.linesAdded,
      linesDeleted: a.linesDeleted + b.linesDeleted,
    };
  }

  clear(): void {
    for (const pending of this.pendingEvents.values()) {
      clearTimeout(pending.timer);
    }
    this.pendingEvents.clear();
  }
}

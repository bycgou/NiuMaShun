# KAgent Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 4 features from KAgent: content hash deduplication, semantic volatility detection, coalescing window, and delist lifecycle.

**Architecture:** Incremental implementation in 4 layers. Each layer builds on the previous one. FileWatcher handles deduplication and volatility, EventCoalescer handles merging, DelistManager handles file deletion states.

**Tech Stack:** TypeScript, Node.js (Map, setTimeout)

---

## File Structure

```
src/main/
├── file-watcher.ts          # Modify: add hash dedup + semantic volatility
├── event-coalescer.ts       # Create: coalescing window logic
├── delist-manager.ts        # Create: delist lifecycle management
├── index.ts                 # Modify: integrate new modules
├── database.ts              # Modify: include delisted files in stock list
tests/main/
├── event-coalescer.test.ts  # Create: coalescer tests
├── delist-manager.test.ts   # Create: delist manager tests
```

---

### Task 1: Content Hash Deduplication

**Files:**
- Modify: `src/main/file-watcher.ts`
- Test: `tests/main/file-watcher.test.ts`

- [ ] **Step 1: Add hashContent method to FileWatcher**

Add after `fileContentCache` property (line 19):

```typescript
private contentHashes: Map<string, number> = new Map();

private hashContent(content: string): number {
  let h = 0;
  for (let i = 0; i < content.length; i++) {
    h = Math.imul(31, h) + content.charCodeAt(i) | 0;
  }
  return h;
}
```

- [ ] **Step 2: Add hash check in createEvent for 'change' type**

Modify the `createEvent` method, inside the `if (type === 'change')` block (after line 91):

```typescript
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
    linesAdded = diff.added;
    linesDeleted = diff.removed;
    this.fileContentCache.set(relativePath, newContent);
  }
}
```

- [ ] **Step 3: Update stop() to clear contentHashes**

Add to the `stop()` method (after line 57):

```typescript
this.contentHashes.clear();
```

- [ ] **Step 4: Commit**

```bash
git add src/main/file-watcher.ts
git commit -m "feat: add content hash deduplication to file watcher"
```

---

### Task 2: Semantic Volatility Detection

**Files:**
- Modify: `src/main/file-watcher.ts`

- [ ] **Step 1: Enhance calculateLineDiff to return changed count**

Replace the `calculateLineDiff` method (lines 142-178):

```typescript
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
```

- [ ] **Step 2: Apply semantic volatility in createEvent**

In the `createEvent` method, after the hash check and diff calculation (around line 99):

```typescript
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
```

- [ ] **Step 3: Commit**

```bash
git add src/main/file-watcher.ts
git commit -m "feat: add semantic volatility detection for unchanged line counts"
```

---

### Task 3: Event Coalescer

**Files:**
- Create: `src/main/event-coalescer.ts`
- Create: `tests/main/event-coalescer.test.ts`

- [ ] **Step 1: Write tests for EventCoalescer**

```typescript
// tests/main/event-coalescer.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import EventCoalescer from '../../src/main/event-coalescer';
import { FileChangeEvent } from '../../src/main/file-watcher';

describe('EventCoalescer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createEvent(overrides: Partial<FileChangeEvent> = {}): FileChangeEvent {
    return {
      type: 'change',
      filePath: 'src/test.ts',
      timestamp: new Date().toISOString(),
      linesAdded: 5,
      linesDeleted: 2,
      ...overrides,
    };
  }

  it('should pass through single events after window expires', () => {
    const coalescer = new EventCoalescer();
    const flushed: FileChangeEvent[] = [];
    const event = createEvent();

    coalescer.process(event, (e) => flushed.push(e));
    expect(flushed).toHaveLength(0);

    vi.advanceTimersByTime(1501);
    expect(flushed).toHaveLength(1);
    expect(flushed[0].linesAdded).toBe(5);
    expect(flushed[0].linesDeleted).toBe(2);
  });

  it('should merge multiple events for same file within window', () => {
    const coalescer = new EventCoalescer();
    const flushed: FileChangeEvent[] = [];

    coalescer.process(createEvent({ linesAdded: 5, linesDeleted: 2 }), (e) => flushed.push(e));
    vi.advanceTimersByTime(500);

    coalescer.process(createEvent({ linesAdded: 3, linesDeleted: 1 }), (e) => flushed.push(e));
    vi.advanceTimersByTime(1501);

    expect(flushed).toHaveLength(1);
    expect(flushed[0].linesAdded).toBe(8); // 5 + 3
    expect(flushed[0].linesDeleted).toBe(3); // 2 + 1
  });

  it('should not merge events for different files', () => {
    const coalescer = new EventCoalescer();
    const flushed: FileChangeEvent[] = [];

    coalescer.process(createEvent({ filePath: 'a.ts', linesAdded: 5 }), (e) => flushed.push(e));
    coalescer.process(createEvent({ filePath: 'b.ts', linesAdded: 3 }), (e) => flushed.push(e));

    vi.advanceTimersByTime(1501);
    expect(flushed).toHaveLength(2);
  });

  it('should use latest timestamp when merging', () => {
    const coalescer = new EventCoalescer();
    const flushed: FileChangeEvent[] = [];
    const t1 = '2026-05-31T10:00:00.000Z';
    const t2 = '2026-05-31T10:00:01.000Z';

    coalescer.process(createEvent({ timestamp: t1 }), (e) => flushed.push(e));
    coalescer.process(createEvent({ timestamp: t2 }), (e) => flushed.push(e));

    vi.advanceTimersByTime(1501);
    expect(flushed[0].timestamp).toBe(t2);
  });

  it('should handle add and unlink events correctly', () => {
    const coalescer = new EventCoalescer();
    const flushed: FileChangeEvent[] = [];

    coalescer.process(createEvent({ type: 'add', linesAdded: 10, linesDeleted: 0 }), (e) => flushed.push(e));
    vi.advanceTimersByTime(1501);

    expect(flushed).toHaveLength(1);
    expect(flushed[0].type).toBe('add');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/event-coalescer.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create EventCoalescer**

```typescript
// src/main/event-coalescer.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/event-coalescer.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/event-coalescer.ts tests/main/event-coalescer.test.ts
git commit -m "feat: add event coalescer for merging rapid edits"
```

---

### Task 4: Delist Manager

**Files:**
- Create: `src/main/delist-manager.ts`
- Create: `tests/main/delist-manager.test.ts`

- [ ] **Step 1: Write tests for DelistManager**

```typescript
// tests/main/delist-manager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DelistManager from '../../src/main/delist-manager';

describe('DelistManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should mark file as delisted', () => {
    const manager = new DelistManager();
    const updates: boolean[] = [];

    manager.markDelisted('test.ts', () => updates.push(true));
    expect(manager.isDelisted('test.ts')).toBe(true);
    expect(updates).toHaveLength(1);
  });

  it('should remove delisted file after duration', () => {
    const manager = new DelistManager();
    manager.markDelisted('test.ts', () => {});
    expect(manager.isDelisted('test.ts')).toBe(true);

    vi.advanceTimersByTime(30001);
    expect(manager.isDelisted('test.ts')).toBe(false);
  });

  it('should cancel delist when file reappears', () => {
    const manager = new DelistManager();
    manager.markDelisted('test.ts', () => {});
    expect(manager.isDelisted('test.ts')).toBe(true);

    manager.cancelDelist('test.ts');
    expect(manager.isDelisted('test.ts')).toBe(false);
  });

  it('should return list of delisted files', () => {
    const manager = new DelistManager();
    manager.markDelisted('a.ts', () => {});
    manager.markDelisted('b.ts', () => {});

    const delisted = manager.getDelistedFiles();
    expect(delisted).toContain('a.ts');
    expect(delisted).toContain('b.ts');
    expect(delisted).toHaveLength(2);
  });

  it('should not duplicate delist for same file', () => {
    const manager = new DelistManager();
    const updates: boolean[] = [];

    manager.markDelisted('test.ts', () => updates.push(true));
    manager.markDelisted('test.ts', () => updates.push(true));

    expect(manager.getDelistedFiles()).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/delist-manager.test.ts`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Create DelistManager**

```typescript
// src/main/delist-manager.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/main/delist-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/main/delist-manager.ts tests/main/delist-manager.test.ts
git commit -m "feat: add delist manager for file deletion lifecycle"
```

---

### Task 5: Integration in Main Process

**Files:**
- Modify: `src/main/index.ts`

- [ ] **Step 1: Import new modules**

Add imports at the top of `src/main/index.ts`:

```typescript
import EventCoalescer from './event-coalescer';
import DelistManager from './delist-manager';
```

- [ ] **Step 2: Add module instances in startMonitoring**

In the `startMonitoring` function, after creating the aggregator (around line 42):

```typescript
const aggregator = new KlineAggregator();
const fileStates = new Map<string, FileState>();
const coalescer = new EventCoalescer();
const delistManager = new DelistManager();

projectStates.set(projectId, { aggregator, fileStates, projectPath, coalescer, delistManager });
```

- [ ] **Step 3: Update FileWatcher callback to use coalescer**

Replace the file watcher setup in `startMonitoring`:

```typescript
// Start file watcher with coalescer
fileWatcher = new FileWatcher(projectPath, (event: FileChangeEvent) => {
  coalescer.process(event, (mergedEvent) => {
    // Handle delist lifecycle
    if (mergedEvent.type === 'unlink') {
      delistManager.markDelisted(mergedEvent.filePath, () => notifyRenderer(projectId));
    } else if (mergedEvent.type === 'add') {
      delistManager.cancelDelist(mergedEvent.filePath);
    }
    handleFileChange(mergedEvent, projectId);
  });
});
```

- [ ] **Step 4: Update projectStates interface**

Update the interface to include new modules:

```typescript
const projectStates = new Map<number, {
  aggregator: KlineAggregator;
  fileStates: Map<string, FileState>;
  projectPath: string;
  coalescer: EventCoalescer;
  delistManager: DelistManager;
}>();
```

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts
git commit -m "feat: integrate coalescer and delist manager into main process"
```

---

### Task 6: Update Renderer for Delist Display

**Files:**
- Modify: `src/renderer/components/StockList.tsx`

- [ ] **Step 1: Add delisted styling to StockList**

In the stock item rendering, add visual styling for delisted files. Find the stock item div and add opacity reduction for delisted status:

```tsx
// In the stock item style, add:
opacity: stock.status === 'delisted' ? 0.5 : 1,
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/StockList.tsx
git commit -m "feat: add delisted file styling in stock list"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - ✅ Content hash deduplication → Task 1
   - ✅ Semantic volatility detection → Task 2
   - ✅ Coalescing window → Task 3
   - ✅ Delist lifecycle → Task 4
   - ✅ Integration → Task 5
   - ✅ Renderer update → Task 6

2. **Placeholder scan:** No TBD/TODO found.

3. **Type consistency:** FileChangeEvent interface is consistent across all tasks.

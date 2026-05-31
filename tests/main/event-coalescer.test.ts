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

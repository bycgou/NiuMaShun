import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SessionTracker from '../../src/main/session-tracker';

describe('SessionTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start inactive', () => {
    const tracker = new SessionTracker('/test');
    expect(tracker.isActive).toBe(false);
    expect(tracker.currentSessionId).toBeNull();
  });

  it('should activate on file change', () => {
    const tracker = new SessionTracker('/test');
    tracker.onFileChange();
    expect(tracker.isActive).toBe(true);
  });

  it('should deactivate after timeout', () => {
    const tracker = new SessionTracker('/test');
    tracker.onFileChange();
    expect(tracker.isActive).toBe(true);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(tracker.isActive).toBe(false);
  });

  it('should reset timer on each change', () => {
    const tracker = new SessionTracker('/test');
    tracker.onFileChange();

    vi.advanceTimersByTime(3 * 60 * 1000);
    tracker.onFileChange(); // reset timer

    vi.advanceTimersByTime(3 * 60 * 1000);
    expect(tracker.isActive).toBe(true); // still active

    vi.advanceTimersByTime(3 * 60 * 1000);
    expect(tracker.isActive).toBe(false); // now expired
  });
});

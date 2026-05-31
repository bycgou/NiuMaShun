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

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import KlineAggregator from '../../src/main/kline-aggregator';

describe('KlineAggregator', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should calculate period boundaries for 3min', () => {
    const agg = new KlineAggregator();
    vi.setSystemTime(new Date('2026-05-30T10:05:00Z'));
    const boundary = agg.getPeriodStart('3min');
    expect(boundary).toBe('2026-05-30T10:03:00.000Z');
  });

  it('should calculate period boundaries for 5min', () => {
    const agg = new KlineAggregator();
    vi.setSystemTime(new Date('2026-05-30T10:07:00Z'));
    const boundary = agg.getPeriodStart('5min');
    expect(boundary).toBe('2026-05-30T10:05:00.000Z');
  });

  it('should calculate period boundaries for 1h', () => {
    const agg = new KlineAggregator();
    vi.setSystemTime(new Date('2026-05-30T10:30:00Z'));
    const boundary = agg.getPeriodStart('1h');
    expect(boundary).toBe('2026-05-30T10:00:00.000Z');
  });

  it('should calculate period boundaries for 1d', () => {
    const agg = new KlineAggregator();
    vi.setSystemTime(new Date('2026-05-30T15:00:00Z'));
    const boundary = agg.getPeriodStart('1d');
    expect(boundary).toBe('2026-05-30T00:00:00.000Z');
  });

  it('should detect boundary crossing', () => {
    const agg = new KlineAggregator();
    vi.setSystemTime(new Date('2026-05-30T10:02:59Z'));
    const before = agg.getPeriodStart('3min');

    vi.setSystemTime(new Date('2026-05-30T10:03:01Z'));
    const after = agg.getPeriodStart('3min');

    expect(before).not.toBe(after);
  });
});

import { describe, it, expect } from 'vitest';
import { Granularity, StatusBadge } from '../../src/shared/types';

describe('shared types', () => {
  it('should define all granularities', () => {
    const granularities: Granularity[] = ['event', '3min', '5min', '15min', '1h', '1d'];
    expect(granularities).toHaveLength(6);
  });

  it('should define all status badges', () => {
    const badges: StatusBadge[] = ['active', 'ipo', 'delisted', 'hot'];
    expect(badges).toHaveLength(4);
  });
});

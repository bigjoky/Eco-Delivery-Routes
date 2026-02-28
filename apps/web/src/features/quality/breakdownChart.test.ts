import { describe, expect, it } from 'vitest';
import { chartColorByRatio, normalizeChartWidth } from './breakdownChart';

describe('breakdown chart helpers', () => {
  it('clamps width between 0 and 100', () => {
    expect(normalizeChartWidth(-5)).toBe(0);
    expect(normalizeChartWidth(42.5)).toBe(42.5);
    expect(normalizeChartWidth(150)).toBe(100);
  });

  it('returns color by threshold', () => {
    expect(chartColorByRatio(95)).toBe('#22c55e');
    expect(chartColorByRatio(99)).toBe('#22c55e');
    expect(chartColorByRatio(80)).toBe('#f59e0b');
  });
});

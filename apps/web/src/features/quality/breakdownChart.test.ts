import { describe, expect, it } from 'vitest';
import { chartColorByRatio, normalizeChartWidth } from './breakdownChart';

describe('breakdown chart helpers', () => {
  it('clamps ratio width between 0 and 100', () => {
    expect(normalizeChartWidth(-10)).toBe(0);
    expect(normalizeChartWidth(48.2)).toBe(48.2);
    expect(normalizeChartWidth(130)).toBe(100);
  });

  it('uses green for >=95 and warning otherwise', () => {
    expect(chartColorByRatio(96)).toBe('#22c55e');
    expect(chartColorByRatio(95)).toBe('#22c55e');
    expect(chartColorByRatio(94.99)).toBe('#f59e0b');
  });
});

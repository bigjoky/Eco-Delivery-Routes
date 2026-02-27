export function normalizeChartWidth(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(100, Math.max(0, ratio));
}

export function chartColorByRatio(ratio: number): string {
  return ratio >= 95 ? '#22c55e' : '#f59e0b';
}

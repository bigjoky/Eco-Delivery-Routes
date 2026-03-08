import { describe, expect, it } from 'vitest';
import { severityFromScore, severityLabel } from './risk';

describe('quality risk severity', () => {
  it('maps score to high/medium/low severity', () => {
    expect(severityFromScore(89.99)).toBe('high');
    expect(severityFromScore(90)).toBe('medium');
    expect(severityFromScore(92.99)).toBe('medium');
    expect(severityFromScore(93)).toBe('low');
  });

  it('returns readable labels', () => {
    expect(severityLabel('high')).toBe('Alto');
    expect(severityLabel('medium')).toBe('Medio');
    expect(severityLabel('low')).toBe('Bajo');
  });
});

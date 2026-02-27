export type RiskSeverity = 'high' | 'medium' | 'low';

export function severityFromScore(score: number): RiskSeverity {
  if (score < 90) return 'high';
  if (score < 93) return 'medium';
  return 'low';
}

export function severityLabel(severity: RiskSeverity): string {
  if (severity === 'high') return 'Alto';
  if (severity === 'medium') return 'Medio';
  return 'Bajo';
}

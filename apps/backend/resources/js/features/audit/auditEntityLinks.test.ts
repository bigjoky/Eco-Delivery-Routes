import { describe, expect, it } from 'vitest';
import type { AuditLogEntry } from '../../core/api/types';
import { getEntityLink } from './AuditOpsPage';

function entry(metadata: Record<string, unknown>): AuditLogEntry {
  return {
    id: 1,
    event: 'test.event',
    created_at: '2026-03-08T00:00:00Z',
    metadata,
  };
}

describe('audit entity links', () => {
  it('routes incidents to filtered incidents page', () => {
    const result = getEntityLink(entry({ incident_id: 'inc-123' }));
    expect(result?.to).toBe('/incidents?incident_id=inc-123');
  });

  it('routes vehicle controls to fleet controls page', () => {
    const result = getEntityLink(entry({ vehicle_control_id: 'vc-1' }));
    expect(result?.to).toBe('/fleet-controls?focus=control&id=vc-1');
  });

  it('routes vehicle references to fleet by vehicle id', () => {
    const result = getEntityLink(entry({ vehicle_id: 'veh-22' }));
    expect(result?.to).toBe('/fleet-controls?vehicle_id=veh-22');
  });
});

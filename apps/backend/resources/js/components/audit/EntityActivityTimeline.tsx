import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../ui/table';
import type { AuditLogEntry } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

type AuditResource =
  | 'settlement'
  | 'adjustment'
  | 'advance'
  | 'tariff'
  | 'quality_threshold'
  | 'user'
  | 'role'
  | 'subcontractor'
  | 'driver'
  | 'vehicle'
  | 'route'
  | 'shipment'
  | 'incident'
  | 'workforce'
  | 'compliance_document'
  | 'vehicle_control';

function metadataObject(metadata: AuditLogEntry['metadata']): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as unknown;
      if (typeof parsed === 'object' && parsed && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return { value: metadata };
    }
    return { value: metadata };
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) return metadata as Record<string, unknown>;
  return { value: String(metadata) };
}

function toText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function summarizeMetadata(metadata: AuditLogEntry['metadata']): string {
  const data = metadataObject(metadata);

  const before = data.before;
  const after = data.after;
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const keys = Array.from(new Set([...Object.keys(before as Record<string, unknown>), ...Object.keys(after as Record<string, unknown>)]));
    const chunks = keys
      .map((key) => `${key}: ${toText((before as Record<string, unknown>)[key])} -> ${toText((after as Record<string, unknown>)[key])}`)
      .slice(0, 4);
    if (chunks.length > 0) return chunks.join(' | ');
  }

  const changes = data.changes;
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
    const entries = Object.entries(changes as Record<string, unknown>)
      .map(([key, change]) => {
        if (change && typeof change === 'object' && !Array.isArray(change)) {
          const from = toText((change as Record<string, unknown>).before);
          const to = toText((change as Record<string, unknown>).after);
          return `${key}: ${from} -> ${to}`;
        }
        return `${key}: ${toText(change)}`;
      })
      .slice(0, 4);
    if (entries.length > 0) return entries.join(' | ');
  }

  if (Array.isArray(changes) && changes.length > 0) {
    const sample = changes.slice(0, 2).map((item) => toText(item));
    return `Cambios masivos (${changes.length}): ${sample.join(' | ')}`;
  }

  const generic = Object.entries(data)
    .filter(([key]) => !['ids', 'shipment_ids', 'changes'].includes(key))
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${toText(value)}`);
  if (generic.length > 0) return generic.join(' | ');
  return '-';
}

type FieldDiff = {
  field: string;
  before: string;
  after: string;
};

function extractFieldDiffs(metadata: AuditLogEntry['metadata']): FieldDiff[] {
  const data = metadataObject(metadata);
  const diffs: FieldDiff[] = [];

  const before = data.before;
  const after = data.after;
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const keys = Array.from(new Set([...Object.keys(before as Record<string, unknown>), ...Object.keys(after as Record<string, unknown>)]));
    keys.forEach((key) => {
      const beforeValue = toText((before as Record<string, unknown>)[key]);
      const afterValue = toText((after as Record<string, unknown>)[key]);
      if (beforeValue !== afterValue) {
        diffs.push({ field: key, before: beforeValue, after: afterValue });
      }
    });
  }

  const changes = data.changes;
  if (changes && typeof changes === 'object' && !Array.isArray(changes)) {
    Object.entries(changes as Record<string, unknown>).forEach(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const beforeValue = toText((value as Record<string, unknown>).before);
        const afterValue = toText((value as Record<string, unknown>).after);
        if (beforeValue !== afterValue) {
          diffs.push({ field: key, before: beforeValue, after: afterValue });
        }
        return;
      }
      const text = toText(value);
      diffs.push({ field: key, before: '-', after: text });
    });
  }

  if (Array.isArray(changes) && changes.length > 0) {
    diffs.push({
      field: 'bulk_changes',
      before: '-',
      after: `${changes.length} cambios`,
    });
  }

  return diffs.slice(0, 6);
}

function entityLinkFromMetadata(metadata: AuditLogEntry['metadata']): { to: string; label: string } | null {
  const data = metadataObject(metadata);
  const shipmentId = typeof data.shipment_id === 'string' ? data.shipment_id : null;
  const routeId = typeof data.route_id === 'string' ? data.route_id : null;
  const incidentId = typeof data.incident_id === 'string' ? data.incident_id : null;
  const vehicleControlId = typeof data.vehicle_control_id === 'string' ? data.vehicle_control_id : null;
  const vehicleId = typeof data.vehicle_id === 'string' ? data.vehicle_id : null;
  if (shipmentId) return { to: `/shipments/${shipmentId}`, label: 'Envío' };
  if (routeId) return { to: `/routes/${routeId}`, label: 'Ruta' };
  if (incidentId) return { to: `/incidents?incident_id=${encodeURIComponent(incidentId)}`, label: 'Incidencia' };
  if (vehicleControlId) return { to: `/fleet-controls?focus=control&id=${encodeURIComponent(vehicleControlId)}`, label: 'Control flota' };
  if (vehicleId) return { to: `/fleet-controls?vehicle_id=${encodeURIComponent(vehicleId)}`, label: 'Vehículo' };
  return null;
}

export function EntityActivityTimeline({
  title,
  resource,
  entityId,
  eventPrefix,
  maxRows = 25,
}: {
  title: string;
  resource: AuditResource;
  entityId?: string | null;
  eventPrefix?: string;
  maxRows?: number;
}) {
  const [rows, setRows] = useState<AuditLogEntry[]>([]);
  const [actorFilter, setActorFilter] = useState('');
  const [eventFilter, setEventFilter] = useState(eventPrefix ?? '');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setEventFilter(eventPrefix ?? '');
    setPage(1);
  }, [eventPrefix]);

  useEffect(() => {
    if (!entityId) {
      setRows([]);
      setPage(1);
      setLastPage(1);
      setTotal(0);
      return;
    }
    setLoading(true);
    setError('');
    apiClient
      .getAuditLogs({
        resource,
        id: entityId,
        event: eventFilter.trim() || undefined,
        actor: actorFilter.trim() || undefined,
        page,
        perPage: maxRows,
      })
      .then((result) => {
        setRows(result.data);
        setLastPage(result.meta.last_page || 1);
        setTotal(result.meta.total || 0);
      })
      .catch((exception) => {
        setRows([]);
        setLastPage(1);
        setTotal(0);
        setError(exception instanceof Error ? exception.message : 'No se pudo cargar actividad.');
      })
      .finally(() => setLoading(false));
  }, [resource, entityId, eventFilter, actorFilter, maxRows, page]);

  const totalRows = useMemo(() => total, [total]);

  useEffect(() => {
    setPage(1);
  }, [entityId, resource, eventFilter, actorFilter]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="inline-actions">
          <Input
            value={actorFilter}
            onChange={(event) => setActorFilter(event.target.value)}
            placeholder="Filtrar actor"
          />
          <Input
            value={eventFilter}
            onChange={(event) => setEventFilter(event.target.value)}
            placeholder={eventPrefix ? `Prefijo sugerido: ${eventPrefix}` : 'Prefijo evento (opcional)'}
          />
          <span className="helper">Eventos: {totalRows}</span>
        </div>
        {error ? <div className="helper error">{error}</div> : null}
        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Resumen</TableHead>
                <TableHead>Enlace</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const link = entityLinkFromMetadata(row.metadata);
                return (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.created_at).toLocaleString('es-ES')}</TableCell>
                    <TableCell>{row.event}</TableCell>
                    <TableCell>{row.actor_name ?? row.actor_user_id ?? '-'}</TableCell>
                    <TableCell>
                      {extractFieldDiffs(row.metadata).length > 0 ? (
                        <div className="page-grid">
                          {extractFieldDiffs(row.metadata).map((diff) => (
                            <div key={`${row.id}-${diff.field}`} className="helper">
                              <strong>{diff.field}</strong>: <span style={{ color: 'var(--danger)' }}>{diff.before}</span>{' -> '}<span style={{ color: 'var(--success)' }}>{diff.after}</span>
                            </div>
                          ))}
                        </div>
                      ) : summarizeMetadata(row.metadata)}
                    </TableCell>
                    <TableCell>
                      {link ? <Link to={link.to}>{link.label}</Link> : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>Sin actividad registrada para esta entidad.</TableCell>
                </TableRow>
              ) : null}
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5}>Cargando actividad...</TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1 || loading}>
              Anterior
            </Button>
            <span className="helper">Página {page} de {lastPage}</span>
            <Button type="button" variant="outline" onClick={() => setPage((value) => Math.min(lastPage, value + 1))} disabled={page >= lastPage || loading}>
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
  );
}

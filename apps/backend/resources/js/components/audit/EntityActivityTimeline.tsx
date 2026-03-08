import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
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

function entityLinkFromMetadata(metadata: AuditLogEntry['metadata']): { to: string; label: string } | null {
  const data = metadataObject(metadata);
  const shipmentId = typeof data.shipment_id === 'string' ? data.shipment_id : null;
  const routeId = typeof data.route_id === 'string' ? data.route_id : null;
  const incidentId = typeof data.incident_id === 'string' ? data.incident_id : null;
  if (shipmentId) return { to: `/shipments/${shipmentId}`, label: 'Envío' };
  if (routeId) return { to: `/routes/${routeId}`, label: 'Ruta' };
  if (incidentId) return { to: `/incidents?incident_id=${encodeURIComponent(incidentId)}`, label: 'Incidencia' };
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setEventFilter(eventPrefix ?? '');
  }, [eventPrefix]);

  useEffect(() => {
    if (!entityId) {
      setRows([]);
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
        page: 1,
        perPage: maxRows,
      })
      .then((result) => {
        setRows(result.data);
      })
      .catch((exception) => {
        setRows([]);
        setError(exception instanceof Error ? exception.message : 'No se pudo cargar actividad.');
      })
      .finally(() => setLoading(false));
  }, [resource, entityId, eventFilter, actorFilter, maxRows]);

  const totalRows = useMemo(() => rows.length, [rows]);

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
          <Select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)}>
            <option value="">Todos los eventos</option>
            <option value={eventPrefix ?? ''}>{eventPrefix ?? 'Prefijo por defecto'}</option>
          </Select>
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
                    <TableCell>{summarizeMetadata(row.metadata)}</TableCell>
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
      </CardContent>
    </Card>
  );
}

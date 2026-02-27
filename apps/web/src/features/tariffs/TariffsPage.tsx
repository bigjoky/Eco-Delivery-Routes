import { useEffect, useState } from 'react';
import { Fragment } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { AuditLogEntry, PaginationMeta, SubcontractorSummary } from '../../core/api/types';
import { TariffSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

export function TariffsPage() {
  const [items, setItems] = useState<TariffSummary[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [serviceType, setServiceType] = useState<'delivery' | 'pickup_normal' | 'pickup_return'>('delivery');
  const [amountCents, setAmountCents] = useState('250');
  const [validFrom, setValidFrom] = useState('2026-03-01');
  const [subcontractorId, setSubcontractorId] = useState('');
  const [editId, setEditId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [selectedTariffId, setSelectedTariffId] = useState('');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditMeta, setAuditMeta] = useState<PaginationMeta>({ page: 1, per_page: 20, total: 0, last_page: 0 });
  const [expandedAuditLogId, setExpandedAuditLogId] = useState<number | null>(null);

  useEffect(() => {
    apiClient.getTariffs().then(setItems);
    apiClient.getSubcontractors({ limit: 20 }).then((rows) => {
      setSubcontractors(rows);
      if (rows.length > 0) setSubcontractorId(rows[0].id);
    });
  }, []);

  const loadAudit = (page = 1) => {
    if (!selectedTariffId) {
      setAuditLogs([]);
      return;
    }
    apiClient
      .getAuditLogs({ resource: 'tariff', id: selectedTariffId, page, perPage: auditMeta.per_page })
      .then((result) => {
        setAuditLogs(result.data);
        setAuditMeta(result.meta);
      });
  };

  useEffect(() => {
    loadAudit(1);
  }, [selectedTariffId]);

  const reload = () => apiClient.getTariffs().then(setItems);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    await apiClient.createTariff({
      service_type: serviceType,
      amount_cents: Number(amountCents),
      currency: 'EUR',
      valid_from: validFrom,
      subcontractor_id: subcontractorId || undefined,
    });
    await reload();
  };

  const onEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editId) return;
    await apiClient.updateTariff(editId, { amount_cents: Number(editAmount) });
    await reload();
    setEditId('');
    setEditAmount('');
  };

  const formatMetadata = (metadata?: Record<string, unknown> | null): string => {
    if (!metadata) return 'Sin metadata';
    return JSON.stringify(metadata, null, 2);
  };

  return (
    <section className="page-grid two">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Tarifas</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Importe</TableHead>
                  <TableHead>Moneda</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell><Badge variant="outline">{item.service_type}</Badge></TableCell>
                    <TableCell>{(item.amount_cents / 100).toFixed(2)}</TableCell>
                    <TableCell>{item.currency}</TableCell>
                    <TableCell>{item.valid_from}{item.valid_to ? ` - ${item.valid_to}` : ''}</TableCell>
                    <TableCell><Button type="button" variant="outline" onClick={() => setSelectedTariffId(item.id)}>Auditoria</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="inline-actions">
            <Button type="button" variant="outline" onClick={() => loadAudit(Math.max(1, auditMeta.page - 1))} disabled={auditMeta.page <= 1}>
              Anterior
            </Button>
            <span className="helper">Pagina {auditMeta.page} / {Math.max(1, auditMeta.last_page || 1)}</span>
            <Button type="button" variant="outline" onClick={() => loadAudit(auditMeta.page + 1)} disabled={auditMeta.page >= auditMeta.last_page}>
              Siguiente
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Nueva tarifa</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="page-grid" onSubmit={onCreate}>
            <Select value={serviceType} onChange={(e) => setServiceType(e.target.value as 'delivery' | 'pickup_normal' | 'pickup_return')}>
              <option value="delivery">delivery</option>
              <option value="pickup_normal">pickup_normal</option>
              <option value="pickup_return">pickup_return</option>
            </Select>
            <Input value={amountCents} onChange={(e) => setAmountCents(e.target.value)} placeholder="Importe en centimos" />
            <Input value={validFrom} onChange={(e) => setValidFrom(e.target.value)} placeholder="YYYY-MM-DD" />
            <Select value={subcontractorId} onChange={(e) => setSubcontractorId(e.target.value)}>
              <option value="">sin subcontrata</option>
              {subcontractors.map((item) => (
                <option key={item.id} value={item.id}>{item.legal_name}</option>
              ))}
            </Select>
            <Button type="submit">Crear tarifa</Button>
          </form>

          <form className="page-grid" onSubmit={onEdit}>
            <Input value={editId} onChange={(e) => setEditId(e.target.value)} placeholder="Tariff ID a editar" />
            <Input value={editAmount} onChange={(e) => setEditAmount(e.target.value)} placeholder="Nuevo importe en centimos" />
            <Button type="submit" variant="outline">Actualizar importe</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auditoria tarifa</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <Fragment key={log.id}>
                    <TableRow>
                      <TableCell>{log.created_at}</TableCell>
                      <TableCell>{log.event}</TableCell>
                      <TableCell>{log.actor_name ?? log.actor_user_id ?? '-'}{log.actor_roles ? ` (${log.actor_roles})` : ''}</TableCell>
                      <TableCell>
                        <Button type="button" variant="outline" onClick={() => setExpandedAuditLogId(expandedAuditLogId === log.id ? null : log.id)}>
                          {expandedAuditLogId === log.id ? 'Ocultar detalle' : 'Ver detalle'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedAuditLogId === log.id && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <pre className="helper" style={{ whiteSpace: 'pre-wrap' }}>{formatMetadata(log.metadata)}</pre>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </section>
  );
}

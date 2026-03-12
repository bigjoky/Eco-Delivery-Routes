import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EntityActivityTimeline } from '../../components/audit/EntityActivityTimeline';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { IncidentCatalogItem, IncidentSummary, ShipmentDetail } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';
import { ShipmentDetailPanel } from './ShipmentDetailPanel';

export function ShipmentDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [incidentCatalog, setIncidentCatalog] = useState<IncidentCatalogItem[]>([]);
  const [newIncidentOpen, setNewIncidentOpen] = useState(false);
  const [newIncidentCode, setNewIncidentCode] = useState('');
  const [newIncidentCategory, setNewIncidentCategory] = useState<'failed' | 'absent' | 'retry' | 'general'>('general');
  const [newIncidentNotes, setNewIncidentNotes] = useState('');
  const [editingIncident, setEditingIncident] = useState<IncidentSummary | null>(null);
  const [editIncidentCode, setEditIncidentCode] = useState('');
  const [editIncidentCategory, setEditIncidentCategory] = useState<'failed' | 'absent' | 'retry' | 'general'>('general');
  const [editIncidentNotes, setEditIncidentNotes] = useState('');
  const [incidentSaving, setIncidentSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiClient.getShipmentDetail(id);
        setDetail(data);
      } catch (exception) {
        setDetail(null);
        setError(exception instanceof Error ? exception.message : 'No se pudo cargar el envio');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    apiClient.getIncidentCatalog().then((items) => {
      setIncidentCatalog(items);
      if (!newIncidentCode && items.length > 0) {
        setNewIncidentCode(items[0].code);
        setNewIncidentCategory(items[0].category);
      }
    }).catch(() => setIncidentCatalog([]));
  }, []);

  const shipment = detail?.shipment;

  const resolveIncident = async (incidentId: string) => {
    if (!id) return;
    setResolvingId(incidentId);
    setError('');
    try {
      await apiClient.resolveIncident(incidentId, 'Resuelta desde detalle de envio');
      const refreshed = await apiClient.getShipmentDetail(id);
      setDetail(refreshed);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo resolver la incidencia');
    } finally {
      setResolvingId(null);
    }
  };

  const shipmentIncidentCatalog = incidentCatalog.filter((item) => item.applies_to === 'shipment' || item.applies_to === 'both');

  const createIncidentFromDetail = async () => {
    if (!id || !newIncidentCode) return;
    setIncidentSaving(true);
    setError('');
    try {
      await apiClient.createIncident({
        incidentable_type: 'shipment',
        incidentable_id: id,
        catalog_code: newIncidentCode,
        category: newIncidentCategory,
        notes: newIncidentNotes || undefined,
      });
      setNewIncidentNotes('');
      setNewIncidentOpen(false);
      const refreshed = await apiClient.getShipmentDetail(id);
      setDetail(refreshed);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo crear la incidencia');
    } finally {
      setIncidentSaving(false);
    }
  };

  const openEditIncident = (incident: IncidentSummary) => {
    setEditingIncident(incident);
    setEditIncidentCode(incident.catalog_code);
    setEditIncidentCategory(incident.category);
    setEditIncidentNotes(incident.notes ?? '');
  };

  const saveEditIncident = async () => {
    if (!id || !editingIncident) return;
    setIncidentSaving(true);
    setError('');
    try {
      await apiClient.updateIncident(editingIncident.id, {
        catalog_code: editIncidentCode,
        category: editIncidentCategory,
        notes: editIncidentNotes,
      });
      setEditingIncident(null);
      const refreshed = await apiClient.getShipmentDetail(id);
      setDetail(refreshed);
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'No se pudo actualizar la incidencia');
    } finally {
      setIncidentSaving(false);
    }
  };

  return (
    <section className="page-grid">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Detalle envio</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="inline-actions">
            <Link to="/dashboard" className="helper">Dashboard</Link>
            <span className="helper">/</span>
            <Link to="/expeditions" className="btn btn-outline">Volver</Link>
            {shipment?.route_id ? (
              <Link to={`/routes/${shipment.route_id}`} className="btn btn-outline">Ir a ruta</Link>
            ) : null}
            {loading ? <span className="helper">Cargando...</span> : null}
            {error ? <span className="helper">{error}</span> : null}
          </div>
          <ShipmentDetailPanel detail={detail} loading={loading} error={error} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => setShowAudit((value) => !value)}>
            {showAudit ? 'Ocultar auditoría' : 'Mostrar auditoría'}
          </Button>
        </CardContent>
      </Card>
      {showAudit ? (
        <EntityActivityTimeline
          title="Actividad del envío"
          resource="shipment"
          entityId={shipment?.id ?? id}
          eventPrefix="shipments."
        />
      ) : null}
      <Modal
        open={newIncidentOpen}
        title="Nueva incidencia del envío"
        onClose={() => setNewIncidentOpen(false)}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setNewIncidentOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={createIncidentFromDetail} disabled={incidentSaving || !newIncidentCode}>
              {incidentSaving ? 'Guardando...' : 'Crear incidencia'}
            </Button>
          </>
        )}
      >
        <div className="form-row">
          <div>
            <label htmlFor="detail-incident-catalog">Catálogo</label>
            <Select
              id="detail-incident-catalog"
              value={newIncidentCode}
              onChange={(event) => {
                const selected = shipmentIncidentCatalog.find((item) => item.code === event.target.value);
                setNewIncidentCode(event.target.value);
                if (selected) setNewIncidentCategory(selected.category);
              }}
            >
              {shipmentIncidentCatalog.map((item) => (
                <option key={item.code} value={item.code}>{item.code} - {item.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="detail-incident-category">Categoría</label>
            <Input id="detail-incident-category" value={newIncidentCategory} readOnly />
          </div>
          <div>
            <label htmlFor="detail-incident-notes">Notas</label>
            <Input id="detail-incident-notes" value={newIncidentNotes} onChange={(event) => setNewIncidentNotes(event.target.value)} placeholder="Detalle operativo" />
          </div>
        </div>
      </Modal>
      <Modal
        open={editingIncident !== null}
        title="Editar incidencia"
        onClose={() => setEditingIncident(null)}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setEditingIncident(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={saveEditIncident} disabled={incidentSaving || !editingIncident}>
              {incidentSaving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </>
        )}
      >
        <div className="form-row">
          <div>
            <label htmlFor="detail-incident-edit-catalog">Catálogo</label>
            <Select
              id="detail-incident-edit-catalog"
              value={editIncidentCode}
              onChange={(event) => {
                const selected = shipmentIncidentCatalog.find((item) => item.code === event.target.value);
                setEditIncidentCode(event.target.value);
                if (selected) setEditIncidentCategory(selected.category);
              }}
            >
              {shipmentIncidentCatalog.map((item) => (
                <option key={item.code} value={item.code}>{item.code} - {item.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="detail-incident-edit-category">Categoría</label>
            <Input id="detail-incident-edit-category" value={editIncidentCategory} readOnly />
          </div>
          <div>
            <label htmlFor="detail-incident-edit-notes">Notas</label>
            <Input id="detail-incident-edit-notes" value={editIncidentNotes} onChange={(event) => setEditIncidentNotes(event.target.value)} placeholder="Detalle operativo" />
          </div>
        </div>
      </Modal>
    </section>
  );
}

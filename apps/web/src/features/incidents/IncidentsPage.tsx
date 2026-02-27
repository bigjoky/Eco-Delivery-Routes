import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { IncidentCatalogItem, IncidentSummary } from '../../core/api/types';
import { apiClient } from '../../services/apiClient';

function categoryVariant(category: IncidentSummary['category']): 'warning' | 'destructive' | 'secondary' | 'outline' {
  if (category === 'failed') return 'destructive';
  if (category === 'absent') return 'warning';
  if (category === 'retry') return 'secondary';
  return 'outline';
}

export function IncidentsPage() {
  const [items, setItems] = useState<IncidentSummary[]>([]);
  const [catalog, setCatalog] = useState<IncidentCatalogItem[]>([]);
  const [incidentableType, setIncidentableType] = useState<'shipment' | 'pickup'>('shipment');
  const [incidentableId, setIncidentableId] = useState('SHP-AGP-0001');
  const [catalogCode, setCatalogCode] = useState('');
  const [category, setCategory] = useState<'failed' | 'absent' | 'retry' | 'general'>('absent');
  const [notes, setNotes] = useState('');

  const reload = () => apiClient.getIncidents().then(setItems);

  useEffect(() => {
    reload();
    apiClient.getIncidentCatalog().then((entries) => {
      setCatalog(entries);
      if (entries.length > 0) {
        setCatalogCode(entries[0].code);
        setCategory(entries[0].category);
      }
    });
  }, []);

  const availableCatalog = useMemo(
    () => catalog.filter((item) => item.applies_to === incidentableType || item.applies_to === 'both'),
    [catalog, incidentableType]
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await apiClient.createIncident({
      incidentable_type: incidentableType,
      incidentable_id: incidentableId,
      catalog_code: catalogCode,
      category,
      notes,
    });
    setNotes('');
    await reload();
  };

  return (
    <section className="page-grid two">
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Registrar Incidencia</CardTitle>
          <CardDescription>Catalogo versionado de motivos para shipment y pickup.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="page-grid" onSubmit={onSubmit}>
            <div className="form-row">
              <Select value={incidentableType} onChange={(e) => setIncidentableType(e.target.value as 'shipment' | 'pickup')}>
                <option value="shipment">shipment</option>
                <option value="pickup">pickup</option>
              </Select>
              <Input value={incidentableId} onChange={(e) => setIncidentableId(e.target.value)} placeholder="Incidentable ID" />
            </div>
            <div className="form-row">
              <Select
                value={catalogCode}
                onChange={(e) => {
                  const selected = availableCatalog.find((item) => item.code === e.target.value);
                  setCatalogCode(e.target.value);
                  if (selected) setCategory(selected.category);
                }}
              >
                {availableCatalog.map((item) => (
                  <option key={item.code} value={item.code}>{item.code} - {item.name}</option>
                ))}
              </Select>
              <Input value={category} readOnly />
            </div>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" />
            <Button type="submit">Registrar</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Incidencias recientes</CardTitle>
        </CardHeader>
        <CardContent>
          <TableWrapper>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Catalogo</TableHead>
                  <TableHead>Categoria</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.incidentable_type}</TableCell>
                    <TableCell>{item.incidentable_id}</TableCell>
                    <TableCell>{item.catalog_code}</TableCell>
                    <TableCell><Badge variant={categoryVariant(item.category)}>{item.category}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
        </CardContent>
      </Card>
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { apiClient } from '../../services/apiClient';
import type { ContactSummary, IncidentCatalogItem, IncidentSummary, ShipmentDetail } from '../../core/api/types';

const shipmentDetailSectionIds = {
  summary: 'shipment-detail-summary',
  tracking: 'shipment-detail-tracking',
  pod: 'shipment-detail-pod',
  incidents: 'shipment-detail-incidents',
  stops: 'shipment-detail-stops',
} as const;

function scrollToShipmentDetailSection(sectionId: string) {
  if (typeof document === 'undefined') return;
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function shipmentVariant(status: string): 'default' | 'secondary' | 'warning' | 'success' {
  if (status === 'delivered') return 'success';
  if (status === 'out_for_delivery') return 'secondary';
  if (status === 'incident') return 'warning';
  return 'default';
}

function shipmentStatusHelp(status: string): string {
  const help: Record<string, string> = {
    created: 'Creado en sistema, pendiente de procesamiento.',
    out_for_delivery: 'En reparto, asignado a ruta.',
    delivered: 'Entregado con POD.',
    incident: 'Con incidencia activa.',
  };
  return help[status] ?? status;
}

function serviceTypeLabel(value?: string | null) {
  if (!value) return '-';
  const labels: Record<string, string> = {
    express_1030: 'Express 10:30',
    express_1400: 'Express 14:00',
    express_1900: 'Express 19:00',
    economy_parcel: 'Economy Parcel',
    business_parcel: 'Business Parcel',
    thermo_parcel: 'Thermo Parcel',
    delivery: 'Delivery',
  };
  return labels[value] ?? value;
}

function normalizeCountry(value?: string | null) {
  return (value ?? '').trim().toUpperCase();
}

function isSpanishCountry(value?: string | null) {
  const normalized = normalizeCountry(value);
  return normalized === 'ES' || normalized === 'ESP' || normalized === 'ESPAÑA' || normalized === 'ESPANA';
}

function composeAddressLine(form: ShipmentAddressFormState): string {
  const firstLine = [
    [form.address_street_type, form.address_street].filter(Boolean).join(' ').trim(),
    form.address_number.trim(),
  ].filter((value) => value !== '').join(' ').trim();

  const accessLine = [
    form.address_block.trim() ? `Bloque ${form.address_block.trim()}` : '',
    form.address_stair.trim() ? `Esc. ${form.address_stair.trim()}` : '',
    form.address_floor.trim() ? `Planta ${form.address_floor.trim()}` : '',
    form.address_door.trim() ? `Puerta ${form.address_door.trim()}` : '',
  ].filter((value) => value !== '').join(', ');

  return [
    firstLine,
    accessLine,
    [form.postal_code.trim(), form.city.trim()].filter((value) => value !== '').join(' '),
    form.address_municipality.trim(),
    form.province.trim(),
    normalizeCountry(form.country),
  ].filter((value) => value !== '').join(', ');
}

function composeContactAddressLine(contact: {
  address_street_type?: string | null;
  address_street?: string | null;
  address_number?: string | null;
  address_block?: string | null;
  address_stair?: string | null;
  address_floor?: string | null;
  address_door?: string | null;
  postal_code?: string | null;
  city?: string | null;
  address_municipality?: string | null;
  province?: string | null;
  country?: string | null;
}): string {
  return [
    [[contact.address_street_type, contact.address_street].filter(Boolean).join(' '), contact.address_number ?? ''].filter((value) => value.trim() !== '').join(' '),
    [contact.address_block ? `Bloque ${contact.address_block}` : '', contact.address_stair ? `Esc. ${contact.address_stair}` : '', contact.address_floor ? `Planta ${contact.address_floor}` : '', contact.address_door ? `Puerta ${contact.address_door}` : '']
      .filter((value) => value !== '')
      .join(', '),
    [contact.postal_code ?? '', contact.city ?? ''].filter((value) => value.trim() !== '').join(' '),
    contact.address_municipality ?? '',
    contact.province ?? '',
    normalizeCountry(contact.country),
  ].filter((value) => value.trim() !== '').join(', ');
}

type ShipmentAddressFormState = {
  address_street_type: string;
  address_street: string;
  address_number: string;
  address_block: string;
  address_stair: string;
  address_floor: string;
  address_door: string;
  postal_code: string;
  city: string;
  address_municipality: string;
  province: string;
  country: string;
  address_reference: string;
  address_notes: string;
};

type ContactFormState = {
  display_name: string;
  legal_name: string;
  document_id: string;
  phone: string;
  email: string;
  address_street_type: string;
  address_street: string;
  address_number: string;
  address_block: string;
  address_stair: string;
  address_floor: string;
  address_door: string;
  postal_code: string;
  city: string;
  address_municipality: string;
  province: string;
  country: string;
  address_reference: string;
  address_notes: string;
};

type ShipmentMetaFormState = {
  external_reference: string;
  scheduled_at: string;
  service_type: string;
};

export function ShipmentDetailPanel({
  detail,
  loading,
  error,
  onShipmentUpdated,
  onDetailUpdated,
}: {
  detail: ShipmentDetail | null;
  loading: boolean;
  error: string;
  onShipmentUpdated?: (shipment: ShipmentDetail['shipment']) => void;
  onDetailUpdated?: (detail: Partial<ShipmentDetail>) => void;
}) {
  const shipment = detail?.shipment;
  const senderContact = detail?.sender_contact ?? null;
  const [editingAddress, setEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [addressSuccess, setAddressSuccess] = useState('');
  const [editingSender, setEditingSender] = useState(false);
  const [savingSender, setSavingSender] = useState(false);
  const [senderError, setSenderError] = useState('');
  const [senderSuccess, setSenderSuccess] = useState('');
  const [editingRecipient, setEditingRecipient] = useState(false);
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [recipientError, setRecipientError] = useState('');
  const [recipientSuccess, setRecipientSuccess] = useState('');
  const [editingMeta, setEditingMeta] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [metaSuccess, setMetaSuccess] = useState('');
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
  const [incidentError, setIncidentError] = useState('');
  const [incidentSuccess, setIncidentSuccess] = useState('');
  const [addressForm, setAddressForm] = useState<ShipmentAddressFormState>({
    address_street_type: '',
    address_street: '',
    address_number: '',
    address_block: '',
    address_stair: '',
    address_floor: '',
    address_door: '',
    postal_code: '',
    city: '',
    address_municipality: '',
    province: '',
    country: 'ES',
    address_reference: '',
    address_notes: '',
  });
  const [senderForm, setSenderForm] = useState<ContactFormState>({
    display_name: '',
    legal_name: '',
    document_id: '',
    phone: '',
    email: '',
    address_street_type: '',
    address_street: '',
    address_number: '',
    address_block: '',
    address_stair: '',
    address_floor: '',
    address_door: '',
    postal_code: '',
    city: '',
    address_municipality: '',
    province: '',
    country: 'ES',
    address_reference: '',
    address_notes: '',
  });
  const [recipientForm, setRecipientForm] = useState<ContactFormState>({
    display_name: '',
    legal_name: '',
    document_id: '',
    phone: '',
    email: '',
    address_street_type: '',
    address_street: '',
    address_number: '',
    address_block: '',
    address_stair: '',
    address_floor: '',
    address_door: '',
    postal_code: '',
    city: '',
    address_municipality: '',
    province: '',
    country: 'ES',
    address_reference: '',
    address_notes: '',
  });
  const [metaForm, setMetaForm] = useState<ShipmentMetaFormState>({
    external_reference: '',
    scheduled_at: '',
    service_type: '',
  });

  useEffect(() => {
    apiClient.getIncidentCatalog().then((items) => {
      const shipmentItems = items.filter((item) => item.applies_to === 'shipment' || item.applies_to === 'both');
      setIncidentCatalog(shipmentItems);
      if (!newIncidentCode && shipmentItems.length > 0) {
        setNewIncidentCode(shipmentItems[0].code);
        setNewIncidentCategory(shipmentItems[0].category);
      }
    }).catch(() => setIncidentCatalog([]));
  }, [newIncidentCode]);

  useEffect(() => {
    if (!shipment) return;
    setAddressForm({
      address_street_type: shipment.address_street_type ?? '',
      address_street: shipment.address_street ?? '',
      address_number: shipment.address_number ?? '',
      address_block: shipment.address_block ?? '',
      address_stair: shipment.address_stair ?? '',
      address_floor: shipment.address_floor ?? '',
      address_door: shipment.address_door ?? '',
      postal_code: shipment.postal_code ?? '',
      city: shipment.city ?? '',
      address_municipality: shipment.address_municipality ?? '',
      province: shipment.province ?? '',
      country: shipment.country ?? 'ES',
      address_reference: shipment.address_reference ?? '',
      address_notes: shipment.address_notes ?? '',
    });
    setAddressError('');
    setAddressSuccess('');
    setEditingAddress(false);
    setMetaForm({
      external_reference: shipment.external_reference ?? '',
      scheduled_at: shipment.scheduled_at ?? '',
      service_type: shipment.service_type ?? '',
    });
    setEditingMeta(false);
    setMetaError('');
    setMetaSuccess('');
  }, [shipment?.id, shipment?.address_line]);

  useEffect(() => {
    setSenderForm({
      display_name: senderContact?.display_name ?? '',
      legal_name: senderContact?.legal_name ?? '',
      document_id: senderContact?.document_id ?? '',
      phone: senderContact?.phone ?? '',
      email: senderContact?.email ?? '',
      address_street_type: senderContact?.address_street_type ?? '',
      address_street: senderContact?.address_street ?? '',
      address_number: senderContact?.address_number ?? '',
      address_block: senderContact?.address_block ?? '',
      address_stair: senderContact?.address_stair ?? '',
      address_floor: senderContact?.address_floor ?? '',
      address_door: senderContact?.address_door ?? '',
      postal_code: senderContact?.postal_code ?? '',
      city: senderContact?.city ?? '',
      address_municipality: senderContact?.address_municipality ?? '',
      province: senderContact?.province ?? '',
      country: senderContact?.country ?? 'ES',
      address_reference: senderContact?.address_reference ?? '',
      address_notes: senderContact?.address_notes ?? '',
    });
    setEditingSender(false);
    setSenderError('');
    setSenderSuccess('');
  }, [senderContact?.id, senderContact?.address_line, senderContact?.document_id]);

  useEffect(() => {
    const recipientContact = detail?.recipient_contact;
    setRecipientForm({
      display_name: shipment?.consignee_name ?? recipientContact?.display_name ?? '',
      legal_name: recipientContact?.legal_name ?? '',
      document_id: shipment?.consignee_document_id ?? recipientContact?.document_id ?? '',
      phone: shipment?.consignee_phone ?? recipientContact?.phone ?? '',
      email: shipment?.consignee_email ?? recipientContact?.email ?? '',
      address_street_type: shipment?.address_street_type ?? recipientContact?.address_street_type ?? '',
      address_street: shipment?.address_street ?? recipientContact?.address_street ?? '',
      address_number: shipment?.address_number ?? recipientContact?.address_number ?? '',
      address_block: shipment?.address_block ?? recipientContact?.address_block ?? '',
      address_stair: shipment?.address_stair ?? recipientContact?.address_stair ?? '',
      address_floor: shipment?.address_floor ?? recipientContact?.address_floor ?? '',
      address_door: shipment?.address_door ?? recipientContact?.address_door ?? '',
      postal_code: shipment?.postal_code ?? recipientContact?.postal_code ?? '',
      city: shipment?.city ?? recipientContact?.city ?? '',
      address_municipality: shipment?.address_municipality ?? recipientContact?.address_municipality ?? '',
      province: shipment?.province ?? recipientContact?.province ?? '',
      country: shipment?.country ?? recipientContact?.country ?? 'ES',
      address_reference: shipment?.address_reference ?? recipientContact?.address_reference ?? '',
      address_notes: shipment?.address_notes ?? recipientContact?.address_notes ?? '',
    });
    setEditingRecipient(false);
    setRecipientError('');
    setRecipientSuccess('');
  }, [detail?.recipient_contact, shipment?.id, shipment?.address_line, shipment?.consignee_name]);

  const addressPreview = useMemo(() => composeAddressLine(addressForm), [addressForm]);
  const senderAddressPreview = useMemo(() => composeContactAddressLine(senderForm), [senderForm]);
  const recipientAddressPreview = useMemo(() => composeContactAddressLine(recipientForm), [recipientForm]);
  const shipmentIncidentCatalog = useMemo(
    () => incidentCatalog.filter((item) => item.applies_to === 'shipment' || item.applies_to === 'both'),
    [incidentCatalog]
  );

  const setAddressField = <K extends keyof ShipmentAddressFormState>(field: K, value: ShipmentAddressFormState[K]) => {
    setAddressForm((current) => ({ ...current, [field]: value }));
  };

  const setSenderField = <K extends keyof ContactFormState>(field: K, value: ContactFormState[K]) => {
    setSenderForm((current) => ({ ...current, [field]: value }));
  };
  const setRecipientField = <K extends keyof ContactFormState>(field: K, value: ContactFormState[K]) => {
    setRecipientForm((current) => ({ ...current, [field]: value }));
  };
  const setMetaField = <K extends keyof ShipmentMetaFormState>(field: K, value: ShipmentMetaFormState[K]) => {
    setMetaForm((current) => ({ ...current, [field]: value }));
  };

  const applyDetailPatch = (patch: Partial<ShipmentDetail>) => {
    onDetailUpdated?.(patch);
  };

  const refreshShipmentDetail = async () => {
    if (!shipment?.id) return;
    const refreshed = await apiClient.getShipmentDetail(shipment.id);
    onShipmentUpdated?.(refreshed.shipment);
    applyDetailPatch(refreshed);
  };

  const saveAddress = async () => {
    if (!shipment) return;
    const normalizedStreet = addressForm.address_street.trim();
    const normalizedPostalCode = addressForm.postal_code.trim();
    const normalizedCity = addressForm.city.trim();
    const normalizedCountry = normalizeCountry(addressForm.country);
    const normalizedProvince = addressForm.province.trim();

    if (!normalizedStreet) {
      setAddressError('La via es obligatoria.');
      return;
    }
    if (!normalizedPostalCode) {
      setAddressError('El codigo postal es obligatorio.');
      return;
    }
    if (isSpanishCountry(normalizedCountry) && !/^\d{5}$/.test(normalizedPostalCode)) {
      setAddressError('Para direcciones en Espana el codigo postal debe tener 5 digitos.');
      return;
    }
    if (!normalizedCity) {
      setAddressError('La ciudad o localidad es obligatoria.');
      return;
    }
    if (!normalizedCountry) {
      setAddressError('El pais es obligatorio.');
      return;
    }
    if (isSpanishCountry(normalizedCountry) && !normalizedProvince) {
      setAddressError('La provincia es obligatoria para direcciones espanolas.');
      return;
    }

    setSavingAddress(true);
    setAddressError('');
    setAddressSuccess('');
    try {
      const updated = await apiClient.updateShipment(shipment.id, {
        address_line: addressPreview || null,
        address_street_type: addressForm.address_street_type.trim() || null,
        address_street: normalizedStreet,
        address_number: addressForm.address_number.trim() || null,
        address_block: addressForm.address_block.trim() || null,
        address_stair: addressForm.address_stair.trim() || null,
        address_floor: addressForm.address_floor.trim() || null,
        address_door: addressForm.address_door.trim() || null,
        postal_code: normalizedPostalCode,
        city: normalizedCity,
        address_municipality: addressForm.address_municipality.trim() || null,
        province: normalizedProvince || null,
        country: normalizedCountry,
        address_reference: addressForm.address_reference.trim() || null,
        address_notes: addressForm.address_notes.trim() || null,
      });
      onShipmentUpdated?.({ ...shipment, ...updated });
      setEditingAddress(false);
      setAddressSuccess('Direccion actualizada.');
    } catch (exception) {
      setAddressError(exception instanceof Error ? exception.message : 'No se pudo actualizar la direccion');
    } finally {
      setSavingAddress(false);
    }
  };

  const saveSender = async () => {
    if (!senderContact?.id) return;
    if (!senderForm.document_id.trim()) {
      setSenderError('El documento del remitente es obligatorio.');
      return;
    }
    if (!senderForm.address_street.trim()) {
      setSenderError('La via del remitente es obligatoria.');
      return;
    }
    if (!senderForm.postal_code.trim()) {
      setSenderError('El codigo postal del remitente es obligatorio.');
      return;
    }
    if (isSpanishCountry(senderForm.country) && !/^\d{5}$/.test(senderForm.postal_code.trim())) {
      setSenderError('Para direcciones en Espana el codigo postal del remitente debe tener 5 digitos.');
      return;
    }

    setSavingSender(true);
    setSenderError('');
    setSenderSuccess('');
    try {
      const updated = await apiClient.updateContact(senderContact.id, {
        display_name: senderForm.display_name.trim() || null,
        legal_name: senderForm.legal_name.trim() || null,
        document_id: senderForm.document_id.trim() || null,
        phone: senderForm.phone.trim() || null,
        email: senderForm.email.trim() || null,
        address_line: senderAddressPreview || null,
        address_street_type: senderForm.address_street_type.trim() || null,
        address_street: senderForm.address_street.trim() || null,
        address_number: senderForm.address_number.trim() || null,
        address_block: senderForm.address_block.trim() || null,
        address_stair: senderForm.address_stair.trim() || null,
        address_floor: senderForm.address_floor.trim() || null,
        address_door: senderForm.address_door.trim() || null,
        postal_code: senderForm.postal_code.trim() || null,
        city: senderForm.city.trim() || null,
        address_municipality: senderForm.address_municipality.trim() || null,
        province: senderForm.province.trim() || null,
        country: normalizeCountry(senderForm.country) || null,
        address_reference: senderForm.address_reference.trim() || null,
        address_notes: senderForm.address_notes.trim() || null,
      });
      onDetailUpdated?.({ sender_contact: updated });
      setEditingSender(false);
      setSenderSuccess('Remitente actualizado.');
    } catch (exception) {
      setSenderError(exception instanceof Error ? exception.message : 'No se pudo actualizar el remitente');
    } finally {
      setSavingSender(false);
    }
  };

  const saveRecipient = async () => {
    if (!shipment) return;
    if (!recipientForm.display_name.trim()) {
      setRecipientError('El nombre del destinatario es obligatorio.');
      return;
    }
    if (!recipientForm.document_id.trim()) {
      setRecipientError('El documento del destinatario es obligatorio.');
      return;
    }
    if (!recipientForm.address_street.trim()) {
      setRecipientError('La via del destinatario es obligatoria.');
      return;
    }
    if (!recipientForm.postal_code.trim()) {
      setRecipientError('El codigo postal del destinatario es obligatorio.');
      return;
    }
    if (isSpanishCountry(recipientForm.country) && !/^\d{5}$/.test(recipientForm.postal_code.trim())) {
      setRecipientError('Para direcciones en Espana el codigo postal del destinatario debe tener 5 digitos.');
      return;
    }

    setSavingRecipient(true);
    setRecipientError('');
    setRecipientSuccess('');
    try {
      const updated = await apiClient.updateShipment(shipment.id, {
        external_reference: shipment.external_reference ?? null,
        consignee_name: recipientForm.display_name.trim(),
        consignee_document_id: recipientForm.document_id.trim(),
        consignee_phone: recipientForm.phone.trim() || null,
        consignee_email: recipientForm.email.trim() || null,
        address_line: recipientAddressPreview || null,
        address_street_type: recipientForm.address_street_type.trim() || null,
        address_street: recipientForm.address_street.trim(),
        address_number: recipientForm.address_number.trim() || null,
        address_block: recipientForm.address_block.trim() || null,
        address_stair: recipientForm.address_stair.trim() || null,
        address_floor: recipientForm.address_floor.trim() || null,
        address_door: recipientForm.address_door.trim() || null,
        postal_code: recipientForm.postal_code.trim(),
        city: recipientForm.city.trim() || '',
        address_municipality: recipientForm.address_municipality.trim() || null,
        province: recipientForm.province.trim() || null,
        country: normalizeCountry(recipientForm.country),
        address_reference: recipientForm.address_reference.trim() || null,
        address_notes: recipientForm.address_notes.trim() || null,
        scheduled_at: shipment.scheduled_at ?? null,
        service_type: shipment.service_type ?? null,
      });
      onShipmentUpdated?.({ ...shipment, ...updated });
      onDetailUpdated?.({
        recipient_contact: detail?.recipient_contact
          ? {
              ...detail.recipient_contact,
              display_name: recipientForm.display_name.trim(),
              document_id: recipientForm.document_id.trim(),
              phone: recipientForm.phone.trim() || null,
              email: recipientForm.email.trim() || null,
              address_line: recipientAddressPreview || null,
              address_street_type: recipientForm.address_street_type.trim() || null,
              address_street: recipientForm.address_street.trim(),
              address_number: recipientForm.address_number.trim() || null,
              address_block: recipientForm.address_block.trim() || null,
              address_stair: recipientForm.address_stair.trim() || null,
              address_floor: recipientForm.address_floor.trim() || null,
              address_door: recipientForm.address_door.trim() || null,
              postal_code: recipientForm.postal_code.trim(),
              city: recipientForm.city.trim() || null,
              address_municipality: recipientForm.address_municipality.trim() || null,
              province: recipientForm.province.trim() || null,
              country: normalizeCountry(recipientForm.country),
              address_reference: recipientForm.address_reference.trim() || null,
              address_notes: recipientForm.address_notes.trim() || null,
            }
          : null,
      });
      setEditingRecipient(false);
      setRecipientSuccess('Destinatario actualizado.');
    } catch (exception) {
      setRecipientError(exception instanceof Error ? exception.message : 'No se pudo actualizar el destinatario');
    } finally {
      setSavingRecipient(false);
    }
  };

  const saveMeta = async () => {
    if (!shipment) return;
    setSavingMeta(true);
    setMetaError('');
    setMetaSuccess('');
    try {
      const updated = await apiClient.updateShipment(shipment.id, {
        external_reference: metaForm.external_reference.trim() || null,
        consignee_name: shipment.consignee_name ?? null,
        consignee_document_id: shipment.consignee_document_id ?? null,
        consignee_phone: shipment.consignee_phone ?? null,
        consignee_email: shipment.consignee_email ?? null,
        address_line: shipment.address_line ?? null,
        address_street_type: shipment.address_street_type ?? null,
        address_street: shipment.address_street ?? '',
        address_number: shipment.address_number ?? null,
        address_block: shipment.address_block ?? null,
        address_stair: shipment.address_stair ?? null,
        address_floor: shipment.address_floor ?? null,
        address_door: shipment.address_door ?? null,
        postal_code: shipment.postal_code ?? '',
        city: shipment.city ?? '',
        address_municipality: shipment.address_municipality ?? null,
        province: shipment.province ?? null,
        country: shipment.country ?? 'ES',
        address_reference: shipment.address_reference ?? null,
        address_notes: shipment.address_notes ?? null,
        scheduled_at: metaForm.scheduled_at.trim() || null,
        service_type: metaForm.service_type.trim() || null,
      });
      onShipmentUpdated?.({ ...shipment, ...updated });
      setEditingMeta(false);
      setMetaSuccess('Datos del envio actualizados.');
    } catch (exception) {
      setMetaError(exception instanceof Error ? exception.message : 'No se pudo actualizar el envio');
    } finally {
      setSavingMeta(false);
    }
  };

  const openEditIncident = (incident: IncidentSummary) => {
    setIncidentError('');
    setIncidentSuccess('');
    setEditingIncident(incident);
    setEditIncidentCode(incident.catalog_code);
    setEditIncidentCategory(incident.category);
    setEditIncidentNotes(incident.notes ?? '');
  };

  const createIncidentFromDetail = async () => {
    if (!shipment?.id || !newIncidentCode) return;
    setIncidentSaving(true);
    setIncidentError('');
    setIncidentSuccess('');
    try {
      await apiClient.createIncident({
        incidentable_type: 'shipment',
        incidentable_id: shipment.id,
        catalog_code: newIncidentCode,
        category: newIncidentCategory,
        notes: newIncidentNotes || undefined,
      });
      await refreshShipmentDetail();
      setNewIncidentNotes('');
      setNewIncidentOpen(false);
      setIncidentSuccess('Incidencia registrada.');
    } catch (exception) {
      setIncidentError(exception instanceof Error ? exception.message : 'No se pudo crear la incidencia');
    } finally {
      setIncidentSaving(false);
    }
  };

  const saveEditIncident = async () => {
    if (!editingIncident) return;
    setIncidentSaving(true);
    setIncidentError('');
    setIncidentSuccess('');
    try {
      await apiClient.updateIncident(editingIncident.id, {
        catalog_code: editIncidentCode,
        category: editIncidentCategory,
        notes: editIncidentNotes,
      });
      await refreshShipmentDetail();
      setEditingIncident(null);
      setIncidentSuccess('Incidencia actualizada.');
    } catch (exception) {
      setIncidentError(exception instanceof Error ? exception.message : 'No se pudo actualizar la incidencia');
    } finally {
      setIncidentSaving(false);
    }
  };

  const resolveIncident = async (incidentId: string) => {
    setIncidentSaving(true);
    setIncidentError('');
    setIncidentSuccess('');
    try {
      await apiClient.resolveIncident(incidentId, 'Resuelta desde modal de envío');
      await refreshShipmentDetail();
      setIncidentSuccess('Incidencia resuelta.');
    } catch (exception) {
      setIncidentError(exception instanceof Error ? exception.message : 'No se pudo resolver la incidencia');
    } finally {
      setIncidentSaving(false);
    }
  };

  return (
    <div className="page-grid">
      <div className="ops-summary-strip">
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Referencia</div>
          <div className="ops-summary-value">{shipment?.reference ?? '-'}</div>
          <div className="ops-summary-caption">Externa {shipment?.external_reference ?? '-'}</div>
        </div>
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Estado</div>
          <div className="ops-summary-value">{shipment?.status ?? '-'}</div>
          <div className="ops-summary-caption">Servicio {serviceTypeLabel(shipment?.service_type)}</div>
        </div>
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Programado</div>
          <div className="ops-summary-value">{shipment?.scheduled_at ?? '-'}</div>
          <div className="ops-summary-caption">Entregado {shipment?.delivered_at ?? '-'}</div>
        </div>
        <div className="ops-summary-chip">
          <div className="ops-summary-label">Incidencias</div>
          <div className="ops-summary-value">{detail?.incidents?.length ?? 0}</div>
          <div className="ops-summary-caption">Eventos {detail?.tracking_events?.length ?? 0} · POD {detail?.pods?.length ?? 0}</div>
        </div>
      </div>

      <div className="inline-actions ops-toolbar">
        <Button type="button" variant="outline" onClick={() => scrollToShipmentDetailSection(shipmentDetailSectionIds.summary)}>
          Ficha
        </Button>
        <Button type="button" variant="outline" onClick={() => scrollToShipmentDetailSection(shipmentDetailSectionIds.tracking)}>
          Tracking
        </Button>
        <Button type="button" variant="outline" onClick={() => scrollToShipmentDetailSection(shipmentDetailSectionIds.pod)}>
          POD
        </Button>
        <Button type="button" variant="outline" onClick={() => scrollToShipmentDetailSection(shipmentDetailSectionIds.incidents)}>
          Incidencias
        </Button>
        <Button type="button" variant="outline" onClick={() => scrollToShipmentDetailSection(shipmentDetailSectionIds.stops)}>
          Paradas
        </Button>
        {shipment?.route_id ? <Link to={`/routes/${shipment.route_id}`} className="btn btn-outline">Ir a ruta</Link> : null}
        {shipment ? <Link to={`/shipments/${shipment.id}`} className="btn btn-outline">Abrir página completa</Link> : null}
        {loading ? <span className="helper">Cargando detalle...</span> : null}
        {error ? <span className="helper error">{error}</span> : null}
      </div>

      <Card id={shipmentDetailSectionIds.summary}>
        <CardHeader>
          <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
            <CardTitle className="page-title">Ficha del envio</CardTitle>
            {shipment ? (
              <Button type="button" variant="outline" onClick={() => {
                setMetaError('');
                setMetaSuccess('');
                setEditingMeta((current) => !current);
              }}>
                {editingMeta ? 'Cerrar edicion' : 'Editar envio'}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {shipment ? (
            editingMeta ? (
              <div className="modal-actions-stack">
                <div className="modal-section">
                  <div className="modal-section-title">Metadatos del envio</div>
                  <div className="form-row">
                    <div>
                      <label htmlFor="shipment-meta-external-reference">Referencia externa</label>
                      <input id="shipment-meta-external-reference" value={metaForm.external_reference} onChange={(event) => setMetaField('external_reference', event.target.value)} placeholder="REF-CLIENTE-001" />
                    </div>
                    <div>
                      <label htmlFor="shipment-meta-scheduled-at">Programado</label>
                      <input id="shipment-meta-scheduled-at" value={metaForm.scheduled_at} onChange={(event) => setMetaField('scheduled_at', event.target.value)} placeholder="2026-03-11 10:30:00" />
                    </div>
                    <div>
                      <label htmlFor="shipment-meta-service-type">Servicio</label>
                      <select id="shipment-meta-service-type" value={metaForm.service_type} onChange={(event) => setMetaField('service_type', event.target.value)}>
                        <option value="express_1030">Express 10:30</option>
                        <option value="express_1400">Express 14:00</option>
                        <option value="express_1900">Express 19:00</option>
                        <option value="economy_parcel">Economy Parcel</option>
                        <option value="business_parcel">Business Parcel</option>
                        <option value="thermo_parcel">Thermo Parcel</option>
                        <option value="delivery">Delivery</option>
                      </select>
                    </div>
                  </div>
                </div>
                {metaError ? <div className="helper error">{metaError}</div> : null}
                {metaSuccess ? <div className="helper">{metaSuccess}</div> : null}
                <div className="inline-actions">
                  <Button type="button" variant="outline" onClick={() => setEditingMeta(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={saveMeta} disabled={savingMeta}>
                    {savingMeta ? 'Guardando...' : 'Guardar envio'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="kpi-grid">
                <div>
                  <div className="helper">ID</div>
                  <div>{shipment.id}</div>
                </div>
                <div>
                  <div className="helper">Estado</div>
                  <Badge variant={shipmentVariant(shipment.status)} title={shipmentStatusHelp(shipment.status)}>
                    {shipment.status}
                  </Badge>
                </div>
                <div>
                  <div className="helper">Servicio</div>
                  <div>{serviceTypeLabel(shipment.service_type)}</div>
                </div>
                <div>
                  <div className="helper">Hub</div>
                  <div>{shipment.hub_code ?? shipment.hub_id ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Destinatario</div>
                  <div>{shipment.consignee_name ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Direccion</div>
                  <div>{shipment.address_line ?? '-'}</div>
                </div>
              </div>
            )
          ) : (
            <div className="helper">{loading ? 'Cargando...' : 'No se pudo cargar el envio.'}</div>
          )}
        </CardContent>
      </Card>

      <div className="page-grid two">
        <Card>
          <CardHeader>
            <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
              <CardTitle className="page-title">Remitente</CardTitle>
              {senderContact ? (
                <Button type="button" variant="outline" onClick={() => {
                  setSenderError('');
                  setSenderSuccess('');
                  setEditingSender((current) => !current);
                }}>
                  {editingSender ? 'Cerrar edicion' : 'Editar remitente'}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {!senderContact ? (
              <div className="helper">Sin remitente enlazado.</div>
            ) : editingSender ? (
              <div className="modal-actions-stack">
                <div className="modal-section">
                  <div className="modal-section-title">Identidad</div>
                  <div className="form-row">
                    <div>
                      <label htmlFor="shipment-sender-display-name">Nombre</label>
                      <input id="shipment-sender-display-name" value={senderForm.display_name} onChange={(event) => setSenderField('display_name', event.target.value)} placeholder="Nombre remitente" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-legal-name">Razon social</label>
                      <input id="shipment-sender-legal-name" value={senderForm.legal_name} onChange={(event) => setSenderField('legal_name', event.target.value)} placeholder="Razon social" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-document">Documento</label>
                      <input id="shipment-sender-document" value={senderForm.document_id} onChange={(event) => setSenderField('document_id', event.target.value)} placeholder="DNI/NIE/CIF" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-phone">Telefono</label>
                      <input id="shipment-sender-phone" value={senderForm.phone} onChange={(event) => setSenderField('phone', event.target.value)} placeholder="+34 600 111 222" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-email">Email</label>
                      <input id="shipment-sender-email" value={senderForm.email} onChange={(event) => setSenderField('email', event.target.value)} placeholder="remitente@eco.local" />
                    </div>
                  </div>
                </div>
                <div className="modal-section">
                  <div className="modal-section-title">Direccion</div>
                  <div className="form-row">
                    <div>
                      <label htmlFor="shipment-sender-street-type">Tipo de via</label>
                      <input id="shipment-sender-street-type" value={senderForm.address_street_type} onChange={(event) => setSenderField('address_street_type', event.target.value)} placeholder="Calle" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-street">Nombre de via</label>
                      <input id="shipment-sender-street" value={senderForm.address_street} onChange={(event) => setSenderField('address_street', event.target.value)} placeholder="Andalucia" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-number">Numero</label>
                      <input id="shipment-sender-number" value={senderForm.address_number} onChange={(event) => setSenderField('address_number', event.target.value)} placeholder="20" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-block">Bloque</label>
                      <input id="shipment-sender-block" value={senderForm.address_block} onChange={(event) => setSenderField('address_block', event.target.value)} placeholder="B" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-stair">Escalera</label>
                      <input id="shipment-sender-stair" value={senderForm.address_stair} onChange={(event) => setSenderField('address_stair', event.target.value)} placeholder="2" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-floor">Planta</label>
                      <input id="shipment-sender-floor" value={senderForm.address_floor} onChange={(event) => setSenderField('address_floor', event.target.value)} placeholder="3" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-door">Puerta</label>
                      <input id="shipment-sender-door" value={senderForm.address_door} onChange={(event) => setSenderField('address_door', event.target.value)} placeholder="A" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-postal">Codigo postal</label>
                      <input id="shipment-sender-postal" value={senderForm.postal_code} onChange={(event) => setSenderField('postal_code', event.target.value)} placeholder="29002" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-city">Ciudad</label>
                      <input id="shipment-sender-city" value={senderForm.city} onChange={(event) => setSenderField('city', event.target.value)} placeholder="Malaga" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-municipality">Municipio</label>
                      <input id="shipment-sender-municipality" value={senderForm.address_municipality} onChange={(event) => setSenderField('address_municipality', event.target.value)} placeholder="Malaga" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-province">Provincia</label>
                      <input id="shipment-sender-province" value={senderForm.province} onChange={(event) => setSenderField('province', event.target.value)} placeholder="Malaga" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-country">Pais</label>
                      <input id="shipment-sender-country" value={senderForm.country} onChange={(event) => setSenderField('country', event.target.value)} placeholder="ES" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-reference">Referencia acceso</label>
                      <input id="shipment-sender-reference" value={senderForm.address_reference} onChange={(event) => setSenderField('address_reference', event.target.value)} placeholder="Acceso principal" />
                    </div>
                    <div>
                      <label htmlFor="shipment-sender-notes">Notas</label>
                      <input id="shipment-sender-notes" value={senderForm.address_notes} onChange={(event) => setSenderField('address_notes', event.target.value)} placeholder="Observaciones remitente" />
                    </div>
                  </div>
                  <div>
                    <div className="helper">Linea compuesta</div>
                    <div>{senderAddressPreview || '-'}</div>
                  </div>
                </div>
                {senderError ? <div className="helper error">{senderError}</div> : null}
                {senderSuccess ? <div className="helper">{senderSuccess}</div> : null}
                <div className="inline-actions">
                  <Button type="button" variant="outline" onClick={() => setEditingSender(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={saveSender} disabled={savingSender}>
                    {savingSender ? 'Guardando...' : 'Guardar remitente'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="kpi-grid">
                <div>
                  <div className="helper">Nombre</div>
                  <div>{senderContact.display_name ?? senderContact.legal_name ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Documento</div>
                  <div>{senderContact.document_id ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Telefono</div>
                  <div>{senderContact.phone ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Email</div>
                  <div>{senderContact.email ?? '-'}</div>
                </div>
                <div>
                  <div className="helper">Direccion</div>
                  <div>{senderContact.address_line ?? (composeContactAddressLine(senderContact) || '-')}</div>
                </div>
                <div>
                  <div className="helper">Referencia acceso</div>
                  <div>{senderContact.address_reference ?? '-'}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
              <CardTitle className="page-title">Contacto destinatario</CardTitle>
              {shipment ? (
                <Button type="button" variant="outline" onClick={() => {
                  setRecipientError('');
                  setRecipientSuccess('');
                  setEditingRecipient((current) => !current);
                }}>
                  {editingRecipient ? 'Cerrar edicion' : 'Editar destinatario'}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {shipment ? (
              editingRecipient ? (
                <div className="modal-actions-stack">
                  <div className="modal-section">
                    <div className="modal-section-title">Identidad y contacto</div>
                    <div className="form-row">
                      <div>
                        <label htmlFor="shipment-recipient-name">Nombre</label>
                        <input id="shipment-recipient-name" value={recipientForm.display_name} onChange={(event) => setRecipientField('display_name', event.target.value)} placeholder="Cliente Demo" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-document">Documento</label>
                        <input id="shipment-recipient-document" value={recipientForm.document_id} onChange={(event) => setRecipientField('document_id', event.target.value)} placeholder="DNI/NIE/CIF" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-phone">Telefono</label>
                        <input id="shipment-recipient-phone" value={recipientForm.phone} onChange={(event) => setRecipientField('phone', event.target.value)} placeholder="+34 600 111 222" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-email">Email</label>
                        <input id="shipment-recipient-email" value={recipientForm.email} onChange={(event) => setRecipientField('email', event.target.value)} placeholder="cliente@eco.local" />
                      </div>
                    </div>
                  </div>
                  <div className="modal-section">
                    <div className="modal-section-title">Direccion del destinatario</div>
                    <div className="form-row">
                      <div>
                        <label htmlFor="shipment-recipient-street-type">Tipo de via</label>
                        <input id="shipment-recipient-street-type" value={recipientForm.address_street_type} onChange={(event) => setRecipientField('address_street_type', event.target.value)} placeholder="Calle" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-street">Nombre de via</label>
                        <input id="shipment-recipient-street" value={recipientForm.address_street} onChange={(event) => setRecipientField('address_street', event.target.value)} placeholder="Larios" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-number">Numero</label>
                        <input id="shipment-recipient-number" value={recipientForm.address_number} onChange={(event) => setRecipientField('address_number', event.target.value)} placeholder="10" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-block">Bloque</label>
                        <input id="shipment-recipient-block" value={recipientForm.address_block} onChange={(event) => setRecipientField('address_block', event.target.value)} placeholder="B" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-stair">Escalera</label>
                        <input id="shipment-recipient-stair" value={recipientForm.address_stair} onChange={(event) => setRecipientField('address_stair', event.target.value)} placeholder="2" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-floor">Planta</label>
                        <input id="shipment-recipient-floor" value={recipientForm.address_floor} onChange={(event) => setRecipientField('address_floor', event.target.value)} placeholder="3" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-door">Puerta</label>
                        <input id="shipment-recipient-door" value={recipientForm.address_door} onChange={(event) => setRecipientField('address_door', event.target.value)} placeholder="A" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-postal">Codigo postal</label>
                        <input id="shipment-recipient-postal" value={recipientForm.postal_code} onChange={(event) => setRecipientField('postal_code', event.target.value)} placeholder="29001" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-city">Ciudad</label>
                        <input id="shipment-recipient-city" value={recipientForm.city} onChange={(event) => setRecipientField('city', event.target.value)} placeholder="Malaga" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-municipality">Municipio</label>
                        <input id="shipment-recipient-municipality" value={recipientForm.address_municipality} onChange={(event) => setRecipientField('address_municipality', event.target.value)} placeholder="Malaga" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-province">Provincia</label>
                        <input id="shipment-recipient-province" value={recipientForm.province} onChange={(event) => setRecipientField('province', event.target.value)} placeholder="Malaga" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-country">Pais</label>
                        <input id="shipment-recipient-country" value={recipientForm.country} onChange={(event) => setRecipientField('country', event.target.value)} placeholder="ES" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-reference">Referencia acceso</label>
                        <input id="shipment-recipient-reference" value={recipientForm.address_reference} onChange={(event) => setRecipientField('address_reference', event.target.value)} placeholder="Portero junto a farmacia" />
                      </div>
                      <div>
                        <label htmlFor="shipment-recipient-notes">Notas</label>
                        <input id="shipment-recipient-notes" value={recipientForm.address_notes} onChange={(event) => setRecipientField('address_notes', event.target.value)} placeholder="Portal azul" />
                      </div>
                    </div>
                    <div>
                      <div className="helper">Linea compuesta</div>
                      <div>{recipientAddressPreview || '-'}</div>
                    </div>
                  </div>
                  {recipientError ? <div className="helper error">{recipientError}</div> : null}
                  {recipientSuccess ? <div className="helper">{recipientSuccess}</div> : null}
                  <div className="inline-actions">
                    <Button type="button" variant="outline" onClick={() => setEditingRecipient(false)}>
                      Cancelar
                    </Button>
                    <Button type="button" onClick={saveRecipient} disabled={savingRecipient}>
                      {savingRecipient ? 'Guardando...' : 'Guardar destinatario'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="kpi-grid">
                  <div>
                    <div className="helper">Nombre</div>
                    <div>{shipment.consignee_name ?? '-'}</div>
                  </div>
                <div>
                  <div className="helper">Documento</div>
                  <div>{shipment.consignee_document_id ?? detail?.recipient_contact?.document_id ?? '-'}</div>
                </div>
                  <div>
                    <div className="helper">Telefono</div>
                    <div>{shipment.consignee_phone ?? '-'}</div>
                  </div>
                  <div>
                    <div className="helper">Email</div>
                    <div>{shipment.consignee_email ?? '-'}</div>
                  </div>
                </div>
              )
            ) : (
              <div className="helper">Sin datos de contacto.</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
              <CardTitle className="page-title">Direccion operativa</CardTitle>
              {shipment ? (
                <Button type="button" variant="outline" onClick={() => {
                  setAddressError('');
                  setAddressSuccess('');
                  setEditingAddress((current) => !current);
                }}>
                  {editingAddress ? 'Cerrar edicion' : 'Editar direccion'}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {shipment ? (
              editingAddress ? (
                <div className="modal-actions-stack">
                  <div className="modal-section">
                    <div className="modal-section-title">Direccion espanola</div>
                    <div className="form-row">
                      <div>
                        <label htmlFor="shipment-address-street-type">Tipo de via</label>
                        <input id="shipment-address-street-type" value={addressForm.address_street_type} onChange={(event) => setAddressField('address_street_type', event.target.value)} placeholder="Calle" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-street">Nombre de via</label>
                        <input id="shipment-address-street" value={addressForm.address_street} onChange={(event) => setAddressField('address_street', event.target.value)} placeholder="Larios" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-number">Numero</label>
                        <input id="shipment-address-number" value={addressForm.address_number} onChange={(event) => setAddressField('address_number', event.target.value)} placeholder="10" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-block">Bloque</label>
                        <input id="shipment-address-block" value={addressForm.address_block} onChange={(event) => setAddressField('address_block', event.target.value)} placeholder="B" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-stair">Escalera</label>
                        <input id="shipment-address-stair" value={addressForm.address_stair} onChange={(event) => setAddressField('address_stair', event.target.value)} placeholder="2" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-floor">Planta</label>
                        <input id="shipment-address-floor" value={addressForm.address_floor} onChange={(event) => setAddressField('address_floor', event.target.value)} placeholder="3" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-door">Puerta</label>
                        <input id="shipment-address-door" value={addressForm.address_door} onChange={(event) => setAddressField('address_door', event.target.value)} placeholder="A" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-postal">Codigo postal</label>
                        <input id="shipment-address-postal" inputMode="numeric" value={addressForm.postal_code} onChange={(event) => setAddressField('postal_code', event.target.value)} placeholder="29001" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-city">Ciudad / Localidad</label>
                        <input id="shipment-address-city" value={addressForm.city} onChange={(event) => setAddressField('city', event.target.value)} placeholder="Malaga" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-municipality">Municipio</label>
                        <input id="shipment-address-municipality" value={addressForm.address_municipality} onChange={(event) => setAddressField('address_municipality', event.target.value)} placeholder="Malaga" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-province">Provincia</label>
                        <input id="shipment-address-province" value={addressForm.province} onChange={(event) => setAddressField('province', event.target.value)} placeholder="Malaga" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-country">Pais</label>
                        <input id="shipment-address-country" value={addressForm.country} onChange={(event) => setAddressField('country', event.target.value)} placeholder="ES" />
                      </div>
                    </div>
                  </div>
                  <div className="modal-section">
                    <div className="modal-section-title">Acceso y observaciones</div>
                    <div className="form-row">
                      <div>
                        <label htmlFor="shipment-address-reference">Referencia de acceso</label>
                        <input id="shipment-address-reference" value={addressForm.address_reference} onChange={(event) => setAddressField('address_reference', event.target.value)} placeholder="Portero junto a farmacia" />
                      </div>
                      <div>
                        <label htmlFor="shipment-address-notes">Notas operativas</label>
                        <input id="shipment-address-notes" value={addressForm.address_notes} onChange={(event) => setAddressField('address_notes', event.target.value)} placeholder="Portal azul" />
                      </div>
                    </div>
                    <div>
                      <div className="helper">Linea compuesta</div>
                      <div>{addressPreview || '-'}</div>
                    </div>
                  </div>
                  {addressError ? <div className="helper error">{addressError}</div> : null}
                  {addressSuccess ? <div className="helper">{addressSuccess}</div> : null}
                  <div className="inline-actions">
                    <Button type="button" variant="outline" onClick={() => setEditingAddress(false)}>
                      Cancelar
                    </Button>
                    <Button type="button" onClick={saveAddress} disabled={savingAddress}>
                      {savingAddress ? 'Guardando...' : 'Guardar direccion'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="kpi-grid">
                  <div>
                    <div className="helper">Linea operativa</div>
                    <div>{shipment.address_line ?? '-'}</div>
                  </div>
                  <div>
                    <div className="helper">Tipo via / Calle</div>
                    <div>{[shipment.address_street_type, shipment.address_street].filter(Boolean).join(' ') || shipment.address_street || '-'}</div>
                  </div>
                  <div>
                    <div className="helper">Numero</div>
                    <div>{shipment.address_number ?? '-'}</div>
                  </div>
                  <div>
                    <div className="helper">Bloque / Escalera</div>
                    <div>{[shipment.address_block ? `Bloque ${shipment.address_block}` : null, shipment.address_stair ? `Esc. ${shipment.address_stair}` : null].filter(Boolean).join(' · ') || '-'}</div>
                  </div>
                  <div>
                    <div className="helper">Planta / Puerta</div>
                    <div>{[shipment.address_floor ? `Planta ${shipment.address_floor}` : null, shipment.address_door ? `Puerta ${shipment.address_door}` : null].filter(Boolean).join(' · ') || '-'}</div>
                  </div>
                  <div>
                    <div className="helper">Codigo postal</div>
                    <div>{shipment.postal_code ?? '-'}</div>
                  </div>
                  <div>
                    <div className="helper">Ciudad / Municipio</div>
                    <div>{[shipment.city, shipment.address_municipality].filter(Boolean).join(' · ') || '-'}</div>
                  </div>
                  <div>
                    <div className="helper">Provincia / Pais</div>
                    <div>{[shipment.province, shipment.country].filter(Boolean).join(' · ') || '-'}</div>
                  </div>
                  <div>
                    <div className="helper">Referencia acceso</div>
                    <div>{shipment.address_reference ?? '-'}</div>
                  </div>
                  <div>
                    <div className="helper">Notas</div>
                    <div>{shipment.address_notes ?? '-'}</div>
                  </div>
                </div>
              )
            ) : (
              <div className="helper">Sin dirección disponible.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="page-grid two">
        <Card id={shipmentDetailSectionIds.tracking}>
          <CardHeader>
            <CardTitle className="page-title">Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Scan</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail?.tracking_events?.length ? detail.tracking_events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{event.event_code}</TableCell>
                      <TableCell>{event.status_to ?? '-'}</TableCell>
                      <TableCell>{event.scan_code ?? '-'}</TableCell>
                      <TableCell>{event.source ?? '-'}</TableCell>
                      <TableCell>{event.occurred_at ?? '-'}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5}>Sin eventos</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
        <Card id={shipmentDetailSectionIds.pod}>
          <CardHeader>
            <CardTitle className="page-title">POD</CardTitle>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Firma</TableHead>
                    <TableHead>Foto</TableHead>
                    <TableHead>Capturado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail?.pods?.length ? detail.pods.map((pod) => (
                    <TableRow key={pod.id}>
                      <TableCell>{pod.signature_name ?? '-'}</TableCell>
                      <TableCell>{pod.photo_url ? 'Disponible' : '-'}</TableCell>
                      <TableCell>{pod.captured_at ?? '-'}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3}>Sin POD</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      </div>

      <div className="page-grid two">
        <Card id={shipmentDetailSectionIds.incidents}>
          <CardHeader>
            <div className="inline-actions" style={{ justifyContent: 'space-between' }}>
              <CardTitle className="page-title">Incidencias</CardTitle>
              {shipment ? (
                <Button type="button" variant="outline" onClick={() => {
                  setIncidentError('');
                  setIncidentSuccess('');
                  setNewIncidentOpen(true);
                }}>
                  Nueva incidencia
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {incidentError ? <div className="helper error">{incidentError}</div> : null}
            {incidentSuccess ? <div className="helper">{incidentSuccess}</div> : null}
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Notas</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail?.incidents?.length ? detail.incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell>{incident.category}</TableCell>
                      <TableCell>{incident.catalog_code}</TableCell>
                      <TableCell>{incident.notes ?? '-'}</TableCell>
                      <TableCell>{incident.resolved_at ? 'Resuelta' : 'Abierta'}</TableCell>
                      <TableCell>
                        <div className="inline-actions">
                          <Button type="button" variant="outline" onClick={() => openEditIncident(incident)}>
                            Editar
                          </Button>
                          {!incident.resolved_at ? (
                            <Button type="button" variant="outline" onClick={() => void resolveIncident(incident.id)} disabled={incidentSaving}>
                              Resolver
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5}>Sin incidencias</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
        <Card id={shipmentDetailSectionIds.stops}>
          <CardHeader>
            <CardTitle className="page-title">Paradas</CardTitle>
          </CardHeader>
          <CardContent>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Secuencia</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Plan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail?.route_stops?.length ? detail.route_stops.map((stop) => (
                    <TableRow key={stop.id}>
                      <TableCell>{stop.route_code ?? stop.route_id ?? '-'}</TableCell>
                      <TableCell>{stop.sequence}</TableCell>
                      <TableCell>{stop.stop_type}</TableCell>
                      <TableCell>{stop.status}</TableCell>
                      <TableCell>{stop.planned_at ?? '-'}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5}>Sin paradas asociadas</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      </div>
      <Modal
        open={newIncidentOpen}
        title="Nueva incidencia del envío"
        onClose={() => setNewIncidentOpen(false)}
        footer={(
          <>
            <Button type="button" variant="outline" onClick={() => setNewIncidentOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void createIncidentFromDetail()} disabled={incidentSaving || !newIncidentCode}>
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
            <Button type="button" onClick={() => void saveEditIncident()} disabled={incidentSaving || !editingIncident}>
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
    </div>
  );
}

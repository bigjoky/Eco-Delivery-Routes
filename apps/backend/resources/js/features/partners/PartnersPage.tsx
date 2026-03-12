import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { Select } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableWrapper } from '../../components/ui/table';
import { ExportActionsModal } from '../../components/common/ExportActionsModal';
import { AuditLogEntry, DriverSummary, SubcontractorSummary, VehicleSummary } from '../../core/api/types';
import { sessionStore } from '../../core/auth/sessionStore';
import { hasExportAccess } from '../../core/auth/exportAccess';
import { apiClient } from '../../services/apiClient';
import { PartnerBulkReasonCode, validatePartnerBulkStatusAction } from './bulkStatusValidation';

type CreatePartnerType = '' | 'subcontractor' | 'driver' | 'vehicle';

export function PartnersPage() {
  const canExport = hasExportAccess('partners', sessionStore.getRoles());
  const [searchParams] = useSearchParams();
  const [subcontractors, setSubcontractors] = useState<SubcontractorSummary[]>([]);
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [vehicles, setVehicles] = useState<VehicleSummary[]>([]);
  const [partnersQuery, setPartnersQuery] = useState('');
  const [partnersSort, setPartnersSort] = useState<'name' | 'updated_desc' | 'updated_asc' | 'editor'>('updated_desc');
  const [subcontractorStatusFilter, setSubcontractorStatusFilter] = useState<'' | 'active' | 'inactive' | 'suspended'>('');
  const [driverStatusFilter, setDriverStatusFilter] = useState<'' | 'active' | 'inactive' | 'suspended'>('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<'' | 'active' | 'inactive' | 'maintenance'>('');
  const [subcontractorScopeFilter, setSubcontractorScopeFilter] = useState('');
  const [lastEditorFilter, setLastEditorFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [auditRows, setAuditRows] = useState<AuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditEventFilter, setAuditEventFilter] = useState('subcontractors.');
  const [auditActorFilter, setAuditActorFilter] = useState('');
  const [focusedEntityType, setFocusedEntityType] = useState<'' | 'subcontractor' | 'driver' | 'vehicle'>('');
  const [focusedEntityId, setFocusedEntityId] = useState('');
  const [showAudit, setShowAudit] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<CreatePartnerType>('');
  const [createSaving, setCreateSaving] = useState(false);

  const [subcontractorName, setSubcontractorName] = useState('');
  const [subcontractorTradeName, setSubcontractorTradeName] = useState('');
  const [subcontractorTaxId, setSubcontractorTaxId] = useState('');
  const [subcontractorContactName, setSubcontractorContactName] = useState('');
  const [subcontractorPhone, setSubcontractorPhone] = useState('');
  const [subcontractorEmail, setSubcontractorEmail] = useState('');
  const [subcontractorBillingEmail, setSubcontractorBillingEmail] = useState('');
  const [subcontractorCity, setSubcontractorCity] = useState('');
  const [driverCode, setDriverCode] = useState('');
  const [driverDni, setDriverDni] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverSubcontractorId, setDriverSubcontractorId] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverEmail, setDriverEmail] = useState('');
  const [driverLicenseNumber, setDriverLicenseNumber] = useState('');
  const [driverLicenseExpiresAt, setDriverLicenseExpiresAt] = useState('');
  const [vehicleCode, setVehicleCode] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehicleSubcontractorId, setVehicleSubcontractorId] = useState('');
  const [vehicleDriverId, setVehicleDriverId] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleFuelType, setVehicleFuelType] = useState('');
  const [vehicleVolumeM3, setVehicleVolumeM3] = useState('');
  const [vehicleRefrigerated, setVehicleRefrigerated] = useState<'0' | '1'>('0');
  const [vehicleInsuranceExpiresAt, setVehicleInsuranceExpiresAt] = useState('');
  const [vehicleItvExpiresAt, setVehicleItvExpiresAt] = useState('');

  const [editingSubcontractorId, setEditingSubcontractorId] = useState('');
  const [editSubcontractorName, setEditSubcontractorName] = useState('');
  const [editSubcontractorTradeName, setEditSubcontractorTradeName] = useState('');
  const [editSubcontractorTaxId, setEditSubcontractorTaxId] = useState('');
  const [editSubcontractorStatus, setEditSubcontractorStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [editSubcontractorPaymentTerms, setEditSubcontractorPaymentTerms] = useState('monthly');
  const [editSubcontractorContactName, setEditSubcontractorContactName] = useState('');
  const [editSubcontractorPhone, setEditSubcontractorPhone] = useState('');
  const [editSubcontractorEmail, setEditSubcontractorEmail] = useState('');
  const [editSubcontractorBillingEmail, setEditSubcontractorBillingEmail] = useState('');
  const [editSubcontractorCity, setEditSubcontractorCity] = useState('');

  const [editingDriverId, setEditingDriverId] = useState('');
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverDni, setEditDriverDni] = useState('');
  const [editDriverStatus, setEditDriverStatus] = useState<'active' | 'inactive' | 'suspended'>('active');
  const [editDriverSubcontractorId, setEditDriverSubcontractorId] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editDriverEmail, setEditDriverEmail] = useState('');
  const [editDriverLicenseNumber, setEditDriverLicenseNumber] = useState('');
  const [editDriverLicenseExpiresAt, setEditDriverLicenseExpiresAt] = useState('');

  const [editingVehicleId, setEditingVehicleId] = useState('');
  const [editVehiclePlate, setEditVehiclePlate] = useState('');
  const [editVehicleStatus, setEditVehicleStatus] = useState<'active' | 'inactive' | 'maintenance'>('active');
  const [editVehicleSubcontractorId, setEditVehicleSubcontractorId] = useState('');
  const [editVehicleDriverId, setEditVehicleDriverId] = useState('');
  const [editVehicleBrand, setEditVehicleBrand] = useState('');
  const [editVehicleModel, setEditVehicleModel] = useState('');
  const [editVehicleFuelType, setEditVehicleFuelType] = useState('');
  const [editVehicleVolumeM3, setEditVehicleVolumeM3] = useState('');
  const [editVehicleRefrigerated, setEditVehicleRefrigerated] = useState<'0' | '1'>('0');
  const [editVehicleInsuranceExpiresAt, setEditVehicleInsuranceExpiresAt] = useState('');
  const [editVehicleItvExpiresAt, setEditVehicleItvExpiresAt] = useState('');
  const [selectedSubcontractorIds, setSelectedSubcontractorIds] = useState<string[]>([]);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
  const [bulkReasonCode, setBulkReasonCode] = useState<PartnerBulkReasonCode>('REBALANCE');
  const [bulkReasonDetail, setBulkReasonDetail] = useState('');
  const [bulkReasonNote, setBulkReasonNote] = useState('');
  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const load = async () => {
    setError('');
    try {
      const [subRows, driverRows, vehicleRows] = await Promise.all([
        apiClient.getSubcontractors({ limit: 50 }),
        apiClient.getDrivers({ limit: 50 }),
        apiClient.getVehicles({ limit: 50 }),
      ]);
      setSubcontractors(subRows);
      setDrivers(driverRows);
      setVehicles(vehicleRows);
      setAuditLoading(true);
      try {
        const auditResult = await apiClient.getAuditLogs({
          event: auditEventFilter.trim() || undefined,
          actor: auditActorFilter.trim() || undefined,
          page: 1,
          perPage: 30,
        });
        setAuditRows(auditResult.data);
      } catch {
        setAuditRows([]);
      } finally {
        setAuditLoading(false);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el modulo de partners');
    }
  };

  useEffect(() => {
    load();
  }, [auditEventFilter, auditActorFilter]);

  useEffect(() => {
    const focus = searchParams.get('focus');
    const id = searchParams.get('id') ?? '';
    const editor = searchParams.get('editor') ?? '';
    if (editor) {
      setLastEditorFilter(editor);
      setShowFilters(true);
    }
    if (!focus || !id) {
      setFocusedEntityType('');
      setFocusedEntityId('');
      return;
    }
    setPartnersQuery(id);
    setShowFilters(true);
    if (focus === 'subcontractor') {
      setFocusedEntityType('subcontractor');
      setFocusedEntityId(id);
      setSubcontractorScopeFilter(id);
      setAuditEventFilter('subcontractors.');
      return;
    }
    if (focus === 'driver') {
      setFocusedEntityType('driver');
      setFocusedEntityId(id);
      setAuditEventFilter('drivers.');
      return;
    }
    if (focus === 'vehicle') {
      setFocusedEntityType('vehicle');
      setFocusedEntityId(id);
      setAuditEventFilter('vehicles.');
    }
  }, [searchParams]);

  const normalizedQuery = partnersQuery.trim().toLowerCase();
  const sortBy = <T extends { updated_at?: string | null; last_editor_name?: string | null }>(rows: T[], label: (row: T) => string) => {
    const mapped = normalizedQuery
      ? rows.filter((row) => (
        label(row).toLowerCase().includes(normalizedQuery) ||
        (row.last_editor_name ?? '').toLowerCase().includes(normalizedQuery)
      ))
      : rows;
    return mapped.slice().sort((a, b) => {
      if (partnersSort === 'name') return label(a).localeCompare(label(b), 'es');
      if (partnersSort === 'editor') return (a.last_editor_name ?? '').localeCompare((b.last_editor_name ?? ''), 'es');
      const aTs = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bTs = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return partnersSort === 'updated_asc' ? aTs - bTs : bTs - aTs;
    });
  };
  const filteredSubcontractors = useMemo(
    () => sortBy(subcontractors, (row) => `${row.legal_name} ${row.tax_id ?? ''}`)
      .filter((row) => !subcontractorStatusFilter || row.status === subcontractorStatusFilter)
      .filter((row) => focusedEntityType !== 'subcontractor' || !focusedEntityId || row.id === focusedEntityId)
      .filter((row) => !lastEditorFilter || (row.last_editor_name ?? '').toLowerCase().includes(lastEditorFilter.toLowerCase())),
    [subcontractors, partnersSort, normalizedQuery, subcontractorStatusFilter, focusedEntityType, focusedEntityId, lastEditorFilter]
  );
  const filteredDrivers = useMemo(
    () => sortBy(drivers, (row) => `${row.code} ${row.name} ${row.dni ?? ''}`)
      .filter((row) => !driverStatusFilter || row.status === driverStatusFilter)
      .filter((row) => !subcontractorScopeFilter || row.subcontractor_id === subcontractorScopeFilter)
      .filter((row) => focusedEntityType !== 'driver' || !focusedEntityId || row.id === focusedEntityId)
      .filter((row) => !lastEditorFilter || (row.last_editor_name ?? '').toLowerCase().includes(lastEditorFilter.toLowerCase())),
    [drivers, partnersSort, normalizedQuery, driverStatusFilter, subcontractorScopeFilter, focusedEntityType, focusedEntityId, lastEditorFilter]
  );
  const filteredVehicles = useMemo(
    () => sortBy(vehicles, (row) => `${row.code} ${row.plate_number ?? ''}`)
      .filter((row) => !vehicleStatusFilter || row.status === vehicleStatusFilter)
      .filter((row) => !subcontractorScopeFilter || row.subcontractor_id === subcontractorScopeFilter)
      .filter((row) => focusedEntityType !== 'vehicle' || !focusedEntityId || row.id === focusedEntityId)
      .filter((row) => !lastEditorFilter || (row.last_editor_name ?? '').toLowerCase().includes(lastEditorFilter.toLowerCase())),
    [vehicles, partnersSort, normalizedQuery, vehicleStatusFilter, subcontractorScopeFilter, focusedEntityType, focusedEntityId, lastEditorFilter]
  );

  const partnersSummary = useMemo(() => ({
    subcontractors: subcontractors.length,
    subcontractorsActive: subcontractors.filter((item) => item.status === 'active').length,
    drivers: drivers.length,
    driversActive: drivers.filter((item) => item.status === 'active').length,
    vehicles: vehicles.length,
    vehiclesActive: vehicles.filter((item) => item.status === 'active').length,
  }), [subcontractors, drivers, vehicles]);

  const exportCsv = (filename: string, header: string[], rows: string[][]) => {
    const csvValue = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const lines = [header.join(',')];
    rows.forEach((row) => {
      lines.push(row.map((value) => csvValue(value)).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const createSubcontractor = async () => {
    setMessage('');
    setError('');
    try {
      await apiClient.createSubcontractor({
        legal_name: subcontractorName,
        tax_id: subcontractorTaxId,
        trade_name: subcontractorTradeName || undefined,
        status: 'active',
        payment_terms: 'monthly',
        contact_name: subcontractorContactName || undefined,
        phone: subcontractorPhone || undefined,
        email: subcontractorEmail || undefined,
        billing_email: subcontractorBillingEmail || undefined,
        city: subcontractorCity || undefined,
      });
      setSubcontractorName('');
      setSubcontractorTradeName('');
      setSubcontractorTaxId('');
      setSubcontractorContactName('');
      setSubcontractorPhone('');
      setSubcontractorEmail('');
      setSubcontractorBillingEmail('');
      setSubcontractorCity('');
      setMessage('Subcontrata creada');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear la subcontrata');
    }
  };

  const createDriver = async () => {
    setMessage('');
    setError('');
    try {
      await apiClient.createDriver({
        code: driverCode,
        dni: driverDni,
        name: driverName,
        phone: driverPhone || undefined,
        email: driverEmail || undefined,
        license_number: driverLicenseNumber || undefined,
        license_expires_at: driverLicenseExpiresAt || undefined,
        employment_type: 'subcontractor',
        subcontractor_id: driverSubcontractorId || undefined,
      });
      setDriverCode('');
      setDriverDni('');
      setDriverName('');
      setDriverPhone('');
      setDriverEmail('');
      setDriverLicenseNumber('');
      setDriverLicenseExpiresAt('');
      setMessage('Driver creado');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el driver');
    }
  };

  const createVehicle = async () => {
    setMessage('');
    setError('');
    let nextSubcontractorId = vehicleSubcontractorId || '';
    if (vehicleDriverId) {
      const selectedDriver = drivers.find((item) => item.id === vehicleDriverId);
      if (selectedDriver?.subcontractor_id) {
        if (nextSubcontractorId && nextSubcontractorId !== selectedDriver.subcontractor_id) {
          setError('El driver seleccionado pertenece a otra subcontrata.');
          return;
        }
        if (!nextSubcontractorId) {
          nextSubcontractorId = selectedDriver.subcontractor_id;
        }
      }
    }
    try {
      await apiClient.createVehicle({
        code: vehicleCode,
        plate_number: vehiclePlate,
        vehicle_type: 'van',
        brand: vehicleBrand || undefined,
        model: vehicleModel || undefined,
        fuel_type: vehicleFuelType || undefined,
        volume_m3: vehicleVolumeM3.trim() ? Number(vehicleVolumeM3) : undefined,
        is_refrigerated: vehicleRefrigerated === '1',
        insurance_expires_at: vehicleInsuranceExpiresAt || undefined,
        itv_expires_at: vehicleItvExpiresAt || undefined,
        status: 'active',
        subcontractor_id: nextSubcontractorId || undefined,
        assigned_driver_id: vehicleDriverId || undefined,
      });
      setVehicleCode('');
      setVehiclePlate('');
      setVehicleSubcontractorId('');
      setVehicleDriverId('');
      setVehicleBrand('');
      setVehicleModel('');
      setVehicleFuelType('');
      setVehicleVolumeM3('');
      setVehicleRefrigerated('0');
      setVehicleInsuranceExpiresAt('');
      setVehicleItvExpiresAt('');
      setMessage('Vehiculo creado');
      await load();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'No se pudo crear el vehiculo');
    }
  };

  const openCreateWizard = () => {
    setCreateType('');
    setCreateOpen(true);
    setCreateSaving(false);
  };

  const closeCreateWizard = () => {
    setCreateOpen(false);
    setCreateSaving(false);
  };

  const submitCreateNode = async () => {
    setCreateSaving(true);
    try {
      if (createType === 'subcontractor') {
        if (!subcontractorName.trim() || !subcontractorTaxId.trim()) {
          setError('Subcontrata requiere nombre y CIF/NIF.');
          return;
        }
        await createSubcontractor();
      } else if (createType === 'driver') {
        if (!driverCode.trim() || !driverDni.trim() || !driverName.trim()) {
          setError('Driver requiere código, DNI/NIE y nombre.');
          return;
        }
        await createDriver();
      } else if (createType === 'vehicle') {
        if (!vehicleCode.trim() || !vehiclePlate.trim()) {
          setError('Vehículo requiere código y matrícula.');
          return;
        }
        await createVehicle();
      } else {
        setError('Selecciona qué deseas crear.');
        return;
      }
      closeCreateWizard();
    } finally {
      setCreateSaving(false);
    }
  };

  const startEditSubcontractor = (row: SubcontractorSummary) => {
    setEditingSubcontractorId(row.id);
    setEditSubcontractorName(row.legal_name);
    setEditSubcontractorTradeName(row.trade_name ?? '');
    setEditSubcontractorTaxId(row.tax_id ?? '');
    setEditSubcontractorStatus((row.status as 'active' | 'inactive' | 'suspended') ?? 'active');
    setEditSubcontractorPaymentTerms(row.payment_terms ?? 'monthly');
    setEditSubcontractorContactName(row.contact_name ?? '');
    setEditSubcontractorPhone(row.phone ?? '');
    setEditSubcontractorEmail(row.email ?? '');
    setEditSubcontractorBillingEmail(row.billing_email ?? '');
    setEditSubcontractorCity(row.city ?? '');
  };

  const saveSubcontractor = async () => {
    if (!editingSubcontractorId) return;
    setMessage('');
    setError('');
    try {
      await apiClient.updateSubcontractor(editingSubcontractorId, {
        legal_name: editSubcontractorName,
        trade_name: editSubcontractorTradeName || null,
        tax_id: editSubcontractorTaxId,
        status: editSubcontractorStatus,
        payment_terms: editSubcontractorPaymentTerms,
        contact_name: editSubcontractorContactName || null,
        phone: editSubcontractorPhone || null,
        email: editSubcontractorEmail || null,
        billing_email: editSubcontractorBillingEmail || null,
        city: editSubcontractorCity || null,
      });
      setEditingSubcontractorId('');
      setMessage('Subcontrata actualizada');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar la subcontrata');
    }
  };

  const startEditDriver = (row: DriverSummary) => {
    setEditingDriverId(row.id);
    setEditDriverName(row.name);
    setEditDriverDni(row.dni ?? '');
    setEditDriverStatus((row.status as 'active' | 'inactive' | 'suspended') ?? 'active');
    setEditDriverSubcontractorId(row.subcontractor_id ?? '');
    setEditDriverPhone(row.phone ?? '');
    setEditDriverEmail(row.email ?? '');
    setEditDriverLicenseNumber(row.license_number ?? '');
    setEditDriverLicenseExpiresAt(row.license_expires_at ?? '');
  };

  const saveDriver = async () => {
    if (!editingDriverId) return;
    setMessage('');
    setError('');
    const nextSubcontractorId = editDriverSubcontractorId || null;
    const assignedVehicles = vehicles.filter((item) => item.assigned_driver_id === editingDriverId);
    const hasVehicleMismatch = assignedVehicles.some((vehicle) => (
      vehicle.subcontractor_id && vehicle.subcontractor_id !== nextSubcontractorId
    ));
    if (hasVehicleMismatch) {
      setError('No puedes asignar este driver a otra subcontrata mientras tenga vehiculos vinculados de distinta subcontrata.');
      return;
    }
    try {
      await apiClient.updateDriver(editingDriverId, {
        name: editDriverName,
        dni: editDriverDni,
        phone: editDriverPhone || null,
        email: editDriverEmail || null,
        license_number: editDriverLicenseNumber || null,
        license_expires_at: editDriverLicenseExpiresAt || null,
        status: editDriverStatus,
        subcontractor_id: nextSubcontractorId,
      });
      setEditingDriverId('');
      setMessage('Driver actualizado');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el driver');
    }
  };

  const startEditVehicle = (row: VehicleSummary) => {
    setEditingVehicleId(row.id);
    setEditVehiclePlate(row.plate_number ?? '');
    setEditVehicleStatus((row.status as 'active' | 'inactive' | 'maintenance') ?? 'active');
    setEditVehicleSubcontractorId(row.subcontractor_id ?? '');
    setEditVehicleDriverId(row.assigned_driver_id ?? '');
    setEditVehicleBrand(row.brand ?? '');
    setEditVehicleModel(row.model ?? '');
    setEditVehicleFuelType(row.fuel_type ?? '');
    setEditVehicleVolumeM3(row.volume_m3 != null ? String(row.volume_m3) : '');
    setEditVehicleRefrigerated(row.is_refrigerated ? '1' : '0');
    setEditVehicleInsuranceExpiresAt(row.insurance_expires_at ?? '');
    setEditVehicleItvExpiresAt(row.itv_expires_at ?? '');
  };

  const saveVehicle = async () => {
    if (!editingVehicleId) return;
    setMessage('');
    setError('');
    let nextSubcontractorId = editVehicleSubcontractorId || '';
    if (editVehicleDriverId) {
      const selectedDriver = drivers.find((item) => item.id === editVehicleDriverId);
      if (selectedDriver?.subcontractor_id) {
        if (nextSubcontractorId && nextSubcontractorId !== selectedDriver.subcontractor_id) {
          setError('El driver seleccionado pertenece a otra subcontrata.');
          return;
        }
        if (!nextSubcontractorId) {
          nextSubcontractorId = selectedDriver.subcontractor_id;
        }
      }
    }
    try {
      await apiClient.updateVehicle(editingVehicleId, {
        plate_number: editVehiclePlate,
        brand: editVehicleBrand || null,
        model: editVehicleModel || null,
        fuel_type: editVehicleFuelType || null,
        volume_m3: editVehicleVolumeM3.trim() ? Number(editVehicleVolumeM3) : null,
        is_refrigerated: editVehicleRefrigerated === '1',
        insurance_expires_at: editVehicleInsuranceExpiresAt || null,
        itv_expires_at: editVehicleItvExpiresAt || null,
        status: editVehicleStatus,
        subcontractor_id: nextSubcontractorId || null,
        assigned_driver_id: editVehicleDriverId || null,
      });
      setEditingVehicleId('');
      setMessage('Vehiculo actualizado');
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'No se pudo actualizar el vehiculo');
    }
  };

  const deleteSubcontractor = async (row: SubcontractorSummary) => {
    const confirmed = window.confirm(`Eliminar subcontrata ${row.legal_name}?`);
    if (!confirmed) return;
    setMessage('');
    setError('');
    try {
      await apiClient.deleteSubcontractor(row.id);
      if (editingSubcontractorId === row.id) setEditingSubcontractorId('');
      setMessage('Subcontrata eliminada');
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar la subcontrata');
    }
  };

  const deleteDriver = async (row: DriverSummary) => {
    const confirmed = window.confirm(`Eliminar driver ${row.code} - ${row.name}?`);
    if (!confirmed) return;
    setMessage('');
    setError('');
    try {
      await apiClient.deleteDriver(row.id);
      if (editingDriverId === row.id) setEditingDriverId('');
      setMessage('Driver eliminado');
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el driver');
    }
  };

  const deleteVehicle = async (row: VehicleSummary) => {
    const confirmed = window.confirm(`Eliminar vehiculo ${row.code}${row.plate_number ? ` (${row.plate_number})` : ''}?`);
    if (!confirmed) return;
    setMessage('');
    setError('');
    try {
      await apiClient.deleteVehicle(row.id);
      if (editingVehicleId === row.id) setEditingVehicleId('');
      setMessage('Vehiculo eliminado');
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'No se pudo eliminar el vehiculo');
    }
  };

  const quickUpdateSubcontractorStatus = async (row: SubcontractorSummary, status: 'active' | 'inactive' | 'suspended') => {
    setMessage('');
    setError('');
    try {
      await apiClient.updateSubcontractor(row.id, {
        legal_name: row.legal_name,
        tax_id: row.tax_id ?? '',
        status,
        payment_terms: row.payment_terms ?? 'monthly',
      });
      setMessage(`Subcontrata ${status === 'active' ? 'activada' : status === 'suspended' ? 'suspendida' : 'actualizada'}.`);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar la subcontrata.');
    }
  };

  const quickUpdateDriverStatus = async (row: DriverSummary, status: 'active' | 'inactive' | 'suspended') => {
    setMessage('');
    setError('');
    try {
      await apiClient.updateDriver(row.id, {
        name: row.name,
        dni: row.dni ?? '',
        status,
        subcontractor_id: row.subcontractor_id ?? null,
      });
      setMessage(`Conductor ${status === 'active' ? 'activado' : status === 'suspended' ? 'suspendido' : 'actualizado'}.`);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el conductor.');
    }
  };

  const quickUpdateVehicleStatus = async (row: VehicleSummary, status: 'active' | 'inactive' | 'maintenance') => {
    setMessage('');
    setError('');
    try {
      await apiClient.updateVehicle(row.id, {
        plate_number: row.plate_number ?? '',
        status,
        subcontractor_id: row.subcontractor_id ?? null,
        assigned_driver_id: row.assigned_driver_id ?? null,
      });
      setMessage(`Vehículo ${status === 'active' ? 'activado' : status === 'maintenance' ? 'en mantenimiento' : 'actualizado'}.`);
      await load();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar el vehículo.');
    }
  };

  const toggleSelected = (setState: Dispatch<SetStateAction<string[]>>, id: string, checked: boolean) => {
    setState((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id)));
  };

  const bulkUpdateSubcontractors = async (status: 'active' | 'inactive' | 'suspended') => {
    setMessage('');
    setError('');
    const validationError = validatePartnerBulkStatusAction({
      selectedCount: selectedSubcontractorIds.length,
      entityLabel: 'subcontrata',
      reasonCode: bulkReasonCode,
      reasonDetail: bulkReasonDetail,
      reasonNote: bulkReasonNote,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      const result = await apiClient.bulkUpdateSubcontractorStatus(selectedSubcontractorIds, status, {
        code: bulkReasonCode,
        detail: bulkReasonDetail.trim() || undefined,
        note: bulkReasonNote.trim(),
      });
      setMessage(`Subcontratas actualizadas (${result.affected_count}).`);
      setSelectedSubcontractorIds([]);
      await load();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'No se pudo actualizar subcontratas.');
    }
  };

  const bulkUpdateDrivers = async (status: 'active' | 'inactive' | 'suspended') => {
    setMessage('');
    setError('');
    const validationError = validatePartnerBulkStatusAction({
      selectedCount: selectedDriverIds.length,
      entityLabel: 'conductor',
      reasonCode: bulkReasonCode,
      reasonDetail: bulkReasonDetail,
      reasonNote: bulkReasonNote,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      const result = await apiClient.bulkUpdateDriverStatus(selectedDriverIds, status, {
        code: bulkReasonCode,
        detail: bulkReasonDetail.trim() || undefined,
        note: bulkReasonNote.trim(),
      });
      setMessage(`Conductores actualizados (${result.affected_count}).`);
      setSelectedDriverIds([]);
      await load();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'No se pudo actualizar conductores.');
    }
  };

  const bulkUpdateVehicles = async (status: 'active' | 'inactive' | 'maintenance') => {
    setMessage('');
    setError('');
    const validationError = validatePartnerBulkStatusAction({
      selectedCount: selectedVehicleIds.length,
      entityLabel: 'vehículo',
      reasonCode: bulkReasonCode,
      reasonDetail: bulkReasonDetail,
      reasonNote: bulkReasonNote,
    });
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      const result = await apiClient.bulkUpdateVehicleStatus(selectedVehicleIds, status, {
        code: bulkReasonCode,
        detail: bulkReasonDetail.trim() || undefined,
        note: bulkReasonNote.trim(),
      });
      setMessage(`Vehículos actualizados (${result.affected_count}).`);
      setSelectedVehicleIds([]);
      await load();
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : 'No se pudo actualizar vehículos.');
    }
  };

  return (
    <section className="page-grid">
      <div className="inline-actions">
        <Link to="/dashboard" className="helper">Dashboard</Link>
        <span className="helper">/</span>
        <span className="helper">Partners</span>
      </div>
      <div className="page-header">
        <h1 className="page-title">Partners</h1>
        <div className="page-subtitle">Gestión operativa de subcontratas, conductores y vehículos con acciones rápidas y trazabilidad.</div>
      </div>
      <Modal
        open={createOpen}
        onClose={closeCreateWizard}
        title="Crear partner"
        footer={(
          <>
            <Button type="button" variant="outline" onClick={closeCreateWizard}>Cancelar</Button>
            <Button type="button" onClick={submitCreateNode} disabled={createSaving}>
              {createSaving ? 'Creando...' : 'Crear'}
            </Button>
          </>
        )}
      >
        <div className="page-grid">
          <div className="modal-section">
          <div className="modal-section-title">Paso 1 · Tipo de partner</div>
          <div className="modal-section-copy">Selecciona la entidad a crear y completa únicamente los campos operativos mínimos.</div>
          <div className="inline-actions">
            <Button type="button" variant={createType === 'subcontractor' ? 'secondary' : 'outline'} onClick={() => setCreateType('subcontractor')}>Subcontrata</Button>
            <Button type="button" variant={createType === 'driver' ? 'secondary' : 'outline'} onClick={() => setCreateType('driver')}>Conductor</Button>
            <Button type="button" variant={createType === 'vehicle' ? 'secondary' : 'outline'} onClick={() => setCreateType('vehicle')}>Vehículo</Button>
          </div>
          </div>
          {createType === 'subcontractor' ? (
            <div className="modal-section">
              <div className="modal-section-title">Paso 2 · Datos de subcontrata</div>
            <div className="form-row">
              <div><label>Nombre</label><Input value={subcontractorName} onChange={(e) => setSubcontractorName(e.target.value)} placeholder="Eco Partner Málaga" /></div>
              <div><label>Nombre comercial</label><Input value={subcontractorTradeName} onChange={(e) => setSubcontractorTradeName(e.target.value)} placeholder="Eco Partner" /></div>
              <div><label>CIF/NIF</label><Input value={subcontractorTaxId} onChange={(e) => setSubcontractorTaxId(e.target.value)} placeholder="B12345678" /></div>
              <div><label>Contacto</label><Input value={subcontractorContactName} onChange={(e) => setSubcontractorContactName(e.target.value)} placeholder="Responsable" /></div>
              <div><label>Teléfono</label><Input value={subcontractorPhone} onChange={(e) => setSubcontractorPhone(e.target.value)} placeholder="+34 600 000 000" /></div>
              <div><label>Email</label><Input value={subcontractorEmail} onChange={(e) => setSubcontractorEmail(e.target.value)} placeholder="operativa@partner.es" /></div>
              <div><label>Email facturación</label><Input value={subcontractorBillingEmail} onChange={(e) => setSubcontractorBillingEmail(e.target.value)} placeholder="facturas@partner.es" /></div>
              <div><label>Ciudad</label><Input value={subcontractorCity} onChange={(e) => setSubcontractorCity(e.target.value)} placeholder="Málaga" /></div>
            </div>
            </div>
          ) : null}
          {createType === 'driver' ? (
            <div className="modal-section">
              <div className="modal-section-title">Paso 2 · Datos de conductor</div>
            <div className="form-row">
              <div><label>Código</label><Input value={driverCode} onChange={(e) => setDriverCode(e.target.value)} placeholder="DRV-001" /></div>
              <div><label>DNI/NIE</label><Input value={driverDni} onChange={(e) => setDriverDni(e.target.value)} placeholder="12345678Z" /></div>
              <div><label>Nombre</label><Input value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Nombre completo" /></div>
              <div><label>Teléfono</label><Input value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="+34 600 000 000" /></div>
              <div><label>Email</label><Input value={driverEmail} onChange={(e) => setDriverEmail(e.target.value)} placeholder="driver@eco.test" /></div>
              <div><label>Permiso</label><Input value={driverLicenseNumber} onChange={(e) => setDriverLicenseNumber(e.target.value)} placeholder="B / C / CAP" /></div>
              <div><label>Caduca permiso</label><Input type="date" value={driverLicenseExpiresAt} onChange={(e) => setDriverLicenseExpiresAt(e.target.value)} /></div>
              <div>
                <label>Subcontrata</label>
                <Select value={driverSubcontractorId} onChange={(e) => setDriverSubcontractorId(e.target.value)}>
                  <option value="">Sin subcontrata</option>
                  {subcontractors.map((subcontractor) => (
                    <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
                  ))}
                </Select>
              </div>
            </div>
            </div>
          ) : null}
          {createType === 'vehicle' ? (
            <div className="modal-section">
              <div className="modal-section-title">Paso 2 · Datos de vehículo</div>
            <div className="form-row">
              <div><label>Código</label><Input value={vehicleCode} onChange={(e) => setVehicleCode(e.target.value)} placeholder="VEH-001" /></div>
              <div><label>Matrícula</label><Input value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} placeholder="1234-ABC" /></div>
              <div><label>Marca</label><Input value={vehicleBrand} onChange={(e) => setVehicleBrand(e.target.value)} placeholder="Ford" /></div>
              <div><label>Modelo</label><Input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Transit" /></div>
              <div><label>Combustible</label><Input value={vehicleFuelType} onChange={(e) => setVehicleFuelType(e.target.value)} placeholder="Diesel / Eléctrico" /></div>
              <div><label>Volumen m3</label><Input value={vehicleVolumeM3} onChange={(e) => setVehicleVolumeM3(e.target.value)} placeholder="12.5" /></div>
              <div>
                <label>Refrigerado</label>
                <Select value={vehicleRefrigerated} onChange={(e) => setVehicleRefrigerated(e.target.value as '0' | '1')}>
                  <option value="0">No</option>
                  <option value="1">Sí</option>
                </Select>
              </div>
              <div><label>Seguro</label><Input type="date" value={vehicleInsuranceExpiresAt} onChange={(e) => setVehicleInsuranceExpiresAt(e.target.value)} /></div>
              <div><label>ITV</label><Input type="date" value={vehicleItvExpiresAt} onChange={(e) => setVehicleItvExpiresAt(e.target.value)} /></div>
              <div>
                <label>Subcontrata</label>
                <Select value={vehicleSubcontractorId} onChange={(e) => setVehicleSubcontractorId(e.target.value)}>
                  <option value="">Sin subcontrata</option>
                  {subcontractors.map((subcontractor) => (
                    <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label>Conductor</label>
                <Select value={vehicleDriverId} onChange={(e) => setVehicleDriverId(e.target.value)}>
                  <option value="">Sin driver</option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.code} - {driver.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            </div>
          ) : null}
        </div>
      </Modal>
      <Card>
        <CardHeader>
          <CardTitle className="page-title">Subcontratas + Drivers + Vehiculos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="kpi-grid">
            <div className="kpi-item"><div className="kpi-label">Subcontratas</div><div className="kpi-value">{partnersSummary.subcontractors}</div></div>
            <div className="kpi-item"><div className="kpi-label">Subcontratas activas</div><div className="kpi-value">{partnersSummary.subcontractorsActive}</div></div>
            <div className="kpi-item"><div className="kpi-label">Conductores</div><div className="kpi-value">{partnersSummary.drivers}</div></div>
            <div className="kpi-item"><div className="kpi-label">Conductores activos</div><div className="kpi-value">{partnersSummary.driversActive}</div></div>
            <div className="kpi-item"><div className="kpi-label">Vehículos</div><div className="kpi-value">{partnersSummary.vehicles}</div></div>
            <div className="kpi-item"><div className="kpi-label">Vehículos activos</div><div className="kpi-value">{partnersSummary.vehiclesActive}</div></div>
          </div>
          <div className="inline-actions">
            <Button type="button" onClick={openCreateWizard}>+ Crear</Button>
            <Button type="button" variant={showFilters ? 'secondary' : 'outline'} onClick={() => setShowFilters((value) => !value)}>
              {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
            </Button>
            <Button type="button" variant="outline" onClick={load}>Recargar</Button>
          </div>
          {showFilters ? (
            <div className="filters-panel">
              <div className="form-row">
                <div>
                  <label>Buscar</label>
                  <Input value={partnersQuery} onChange={(e) => setPartnersQuery(e.target.value)} placeholder="Nombre/código/editor" />
                </div>
                <div>
                  <label>Orden</label>
                  <Select value={partnersSort} onChange={(e) => setPartnersSort(e.target.value as 'name' | 'updated_desc' | 'updated_asc' | 'editor')}>
                    <option value="updated_desc">Última edición (reciente)</option>
                    <option value="updated_asc">Última edición (antigua)</option>
                    <option value="editor">Editor</option>
                    <option value="name">Nombre/código</option>
                  </Select>
                </div>
                <div>
                  <label>Subcontrata (scope)</label>
                  <Select value={subcontractorScopeFilter} onChange={(e) => setSubcontractorScopeFilter(e.target.value)}>
                    <option value="">Todas</option>
                    {subcontractors.map((item) => (
                      <option key={item.id} value={item.id}>{item.legal_name}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label>Estado subcontrata</label>
                  <Select value={subcontractorStatusFilter} onChange={(e) => setSubcontractorStatusFilter(e.target.value as '' | 'active' | 'inactive' | 'suspended')}>
                    <option value="">Todos</option>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="suspended">suspended</option>
                  </Select>
                </div>
                <div>
                  <label>Estado conductor</label>
                  <Select value={driverStatusFilter} onChange={(e) => setDriverStatusFilter(e.target.value as '' | 'active' | 'inactive' | 'suspended')}>
                    <option value="">Todos</option>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="suspended">suspended</option>
                  </Select>
                </div>
                <div>
                  <label>Estado vehículo</label>
                  <Select value={vehicleStatusFilter} onChange={(e) => setVehicleStatusFilter(e.target.value as '' | 'active' | 'inactive' | 'maintenance')}>
                    <option value="">Todos</option>
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="maintenance">maintenance</option>
                  </Select>
                </div>
                <div>
                  <label>Última edición por</label>
                  <Input
                    value={lastEditorFilter}
                    onChange={(e) => setLastEditorFilter(e.target.value)}
                    placeholder="Nombre editor"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <h3>Subcontratas</h3>
          <div className="filters-panel">
            <div className="helper">Motivo estructurado para acciones masivas (auditado)</div>
            <div className="inline-actions">
              <Select value={bulkReasonCode} onChange={(e) => setBulkReasonCode(e.target.value as PartnerBulkReasonCode)}>
                <option value="REBALANCE">Rebalanceo operativo</option>
                <option value="COMPLIANCE">Cumplimiento documental</option>
                <option value="PERFORMANCE">Rendimiento</option>
                <option value="OTHER">Otro</option>
              </Select>
              <Input value={bulkReasonDetail} onChange={(e) => setBulkReasonDetail(e.target.value)} placeholder="Detalle (opcional)" />
              <Input value={bulkReasonNote} onChange={(e) => setBulkReasonNote(e.target.value)} placeholder="Nota obligatoria para auditoría" />
            </div>
          </div>
          <div className="inline-actions">
            <ExportActionsModal
              title="Exportar subcontratas"
              triggerDisabled={!canExport}
              actions={[
                {
                  id: 'partners-subcontractors-csv',
                  label: 'CSV subcontratas',
                  run: () => exportCsv(
                    'partners_subcontractors.csv',
                    ['name', 'tax_id', 'status', 'payment_terms', 'updated_at'],
                    filteredSubcontractors.map((row) => [
                      row.legal_name,
                      row.tax_id ?? '',
                      row.status,
                      row.payment_terms ?? '',
                      row.updated_at ?? '',
                    ])
                  ),
                },
              ]}
            />
            <Button type="button" variant="secondary" onClick={() => { void bulkUpdateSubcontractors('active'); }}>
              Activar seleccion ({selectedSubcontractorIds.length})
            </Button>
            <Button type="button" variant="outline" onClick={() => { void bulkUpdateSubcontractors('suspended'); }}>
              Suspender seleccion
            </Button>
          </div>
          <TableWrapper className="desktop-table-only">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={filteredSubcontractors.length > 0 && filteredSubcontractors.every((item) => selectedSubcontractorIds.includes(item.id))}
                      onChange={(event) => {
                        setSelectedSubcontractorIds(event.target.checked ? filteredSubcontractors.map((item) => item.id) : []);
                      }}
                    />
                  </TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tax ID</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ult. edicion</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubcontractors.map((subcontractor) => (
                  <TableRow key={subcontractor.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedSubcontractorIds.includes(subcontractor.id)}
                        onChange={(event) => toggleSelected(setSelectedSubcontractorIds, subcontractor.id, event.target.checked)}
                      />
                    </TableCell>
                    <TableCell>{subcontractor.legal_name}</TableCell>
                    <TableCell>{subcontractor.tax_id ?? '-'}</TableCell>
                    <TableCell>{subcontractor.contact_name ?? subcontractor.phone ?? '-'}</TableCell>
                    <TableCell>{subcontractor.status}</TableCell>
                    <TableCell>{subcontractor.last_editor_name ?? '-'} · {formatDateTime(subcontractor.updated_at)}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Button data-testid={`edit-subcontractor-${subcontractor.id}`} type="button" variant="outline" onClick={() => startEditSubcontractor(subcontractor)}>Editar</Button>
                        <Button data-testid={`delete-subcontractor-${subcontractor.id}`} type="button" variant="outline" onClick={() => deleteSubcontractor(subcontractor)}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="mobile-ops-list">
            {filteredSubcontractors.map((subcontractor) => (
              <article key={`subcontractor-mobile-${subcontractor.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <strong>{subcontractor.legal_name}</strong>
                    <div className="helper">{subcontractor.tax_id ?? '-'}</div>
                  </div>
                  <Badge variant="secondary">{subcontractor.status}</Badge>
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Contacto</div>
                    <div>{subcontractor.contact_name ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Ciudad</div>
                    <div>{subcontractor.city ?? '-'}</div>
                  </div>
                </div>
                <div className="helper">{subcontractor.last_editor_name ?? '-'} · {formatDateTime(subcontractor.updated_at)}</div>
                <div className="mobile-ops-card-actions">
                  <Button data-testid={`edit-subcontractor-mobile-${subcontractor.id}`} type="button" variant="outline" onClick={() => startEditSubcontractor(subcontractor)}>Editar</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void quickUpdateSubcontractorStatus(subcontractor, subcontractor.status === 'active' ? 'suspended' : 'active')}
                  >
                    {subcontractor.status === 'active' ? 'Suspender' : 'Activar'}
                  </Button>
                  <Button data-testid={`delete-subcontractor-mobile-${subcontractor.id}`} type="button" variant="outline" onClick={() => deleteSubcontractor(subcontractor)}>Archivar</Button>
                </div>
              </article>
            ))}
          </div>

          {editingSubcontractorId ? (
            <div className="filters-panel">
              <div className="form-row">
              <Input value={editSubcontractorName} onChange={(e) => setEditSubcontractorName(e.target.value)} placeholder="Nombre" />
              <Input value={editSubcontractorTradeName} onChange={(e) => setEditSubcontractorTradeName(e.target.value)} placeholder="Nombre comercial" />
              <Input value={editSubcontractorTaxId} onChange={(e) => setEditSubcontractorTaxId(e.target.value)} placeholder="CIF/NIF" />
              <Input value={editSubcontractorContactName} onChange={(e) => setEditSubcontractorContactName(e.target.value)} placeholder="Contacto" />
              <Input value={editSubcontractorPhone} onChange={(e) => setEditSubcontractorPhone(e.target.value)} placeholder="Teléfono" />
              <Input value={editSubcontractorEmail} onChange={(e) => setEditSubcontractorEmail(e.target.value)} placeholder="Email" />
              <Input value={editSubcontractorBillingEmail} onChange={(e) => setEditSubcontractorBillingEmail(e.target.value)} placeholder="Email facturación" />
              <Input value={editSubcontractorCity} onChange={(e) => setEditSubcontractorCity(e.target.value)} placeholder="Ciudad" />
              <Select value={editSubcontractorStatus} onChange={(e) => setEditSubcontractorStatus(e.target.value as 'active' | 'inactive' | 'suspended')}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
              </Select>
              <Input value={editSubcontractorPaymentTerms} onChange={(e) => setEditSubcontractorPaymentTerms(e.target.value)} placeholder="payment terms" />
              </div>
              <div className="inline-actions">
              <Button data-testid="save-subcontractor" type="button" onClick={saveSubcontractor}>Guardar subcontrata</Button>
              <Button type="button" variant="outline" onClick={() => setEditingSubcontractorId('')}>Cancelar</Button>
              </div>
            </div>
          ) : null}

          <h3>Drivers</h3>
          <div className="inline-actions">
            <ExportActionsModal
              title="Exportar conductores"
              triggerDisabled={!canExport}
              actions={[
                {
                  id: 'partners-drivers-csv',
                  label: 'CSV conductores',
                  run: () => exportCsv(
                    'partners_drivers.csv',
                    ['code', 'dni', 'name', 'subcontractor', 'status', 'updated_at'],
                    filteredDrivers.map((row) => [
                      row.code,
                      row.dni ?? '',
                      row.name,
                      row.subcontractor_name ?? '',
                      row.status,
                      row.updated_at ?? '',
                    ])
                  ),
                },
              ]}
            />
            <Button type="button" variant="secondary" onClick={() => { void bulkUpdateDrivers('active'); }}>
              Activar seleccion ({selectedDriverIds.length})
            </Button>
            <Button type="button" variant="outline" onClick={() => { void bulkUpdateDrivers('suspended'); }}>
              Suspender seleccion
            </Button>
          </div>
          <TableWrapper className="desktop-table-only">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={filteredDrivers.length > 0 && filteredDrivers.every((item) => selectedDriverIds.includes(item.id))}
                      onChange={(event) => {
                        setSelectedDriverIds(event.target.checked ? filteredDrivers.map((item) => item.id) : []);
                      }}
                    />
                  </TableHead>
                  <TableHead>Codigo</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Subcontrata</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ult. edicion</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedDriverIds.includes(driver.id)}
                        onChange={(event) => toggleSelected(setSelectedDriverIds, driver.id, event.target.checked)}
                      />
                    </TableCell>
                  <TableCell>{driver.code}</TableCell>
                  <TableCell>{driver.dni ?? '-'}</TableCell>
                  <TableCell>{driver.name}</TableCell>
                  <TableCell>{driver.subcontractor_name ?? '-'}</TableCell>
                  <TableCell>{driver.phone ?? driver.email ?? '-'}</TableCell>
                  <TableCell>{driver.status}</TableCell>
                    <TableCell>{driver.last_editor_name ?? '-'} · {formatDateTime(driver.updated_at)}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Button data-testid={`edit-driver-${driver.id}`} type="button" variant="outline" onClick={() => startEditDriver(driver)}>Editar</Button>
                        <Button data-testid={`delete-driver-${driver.id}`} type="button" variant="outline" onClick={() => deleteDriver(driver)}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="mobile-ops-list">
            {filteredDrivers.map((driver) => (
              <article key={`driver-mobile-${driver.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <strong>{driver.code} · {driver.name}</strong>
                    <div className="helper">{driver.dni ?? '-'}</div>
                  </div>
                  <Badge variant="secondary">{driver.status}</Badge>
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Subcontrata</div>
                    <div>{driver.subcontractor_name ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Contacto</div>
                    <div>{driver.phone ?? driver.email ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Última edición</div>
                    <div>{formatDateTime(driver.updated_at)}</div>
                  </div>
                </div>
                <div className="mobile-ops-card-actions">
                  <Button data-testid={`edit-driver-mobile-${driver.id}`} type="button" variant="outline" onClick={() => startEditDriver(driver)}>Editar</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void quickUpdateDriverStatus(driver, driver.status === 'active' ? 'suspended' : 'active')}
                  >
                    {driver.status === 'active' ? 'Suspender' : 'Activar'}
                  </Button>
                  <Button data-testid={`delete-driver-mobile-${driver.id}`} type="button" variant="outline" onClick={() => deleteDriver(driver)}>Archivar</Button>
                </div>
              </article>
            ))}
          </div>

          {editingDriverId ? (
            <div className="filters-panel">
              <div className="form-row">
              <Input value={editDriverName} onChange={(e) => setEditDriverName(e.target.value)} placeholder="Nombre" />
              <Input value={editDriverDni} onChange={(e) => setEditDriverDni(e.target.value)} placeholder="DNI/NIE" />
              <Input value={editDriverPhone} onChange={(e) => setEditDriverPhone(e.target.value)} placeholder="Teléfono" />
              <Input value={editDriverEmail} onChange={(e) => setEditDriverEmail(e.target.value)} placeholder="Email" />
              <Input value={editDriverLicenseNumber} onChange={(e) => setEditDriverLicenseNumber(e.target.value)} placeholder="Permiso" />
              <Input type="date" value={editDriverLicenseExpiresAt} onChange={(e) => setEditDriverLicenseExpiresAt(e.target.value)} />
              <Select value={editDriverStatus} onChange={(e) => setEditDriverStatus(e.target.value as 'active' | 'inactive' | 'suspended')}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="suspended">suspended</option>
              </Select>
              <Select value={editDriverSubcontractorId} onChange={(e) => setEditDriverSubcontractorId(e.target.value)}>
                <option value="">Sin subcontrata</option>
                {subcontractors.map((subcontractor) => (
                  <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
                ))}
              </Select>
              </div>
              <div className="inline-actions">
              <Button data-testid="save-driver" type="button" onClick={saveDriver}>Guardar driver</Button>
              <Button type="button" variant="outline" onClick={() => setEditingDriverId('')}>Cancelar</Button>
              </div>
            </div>
          ) : null}

          <h3>Vehiculos</h3>
          <div className="inline-actions">
            <ExportActionsModal
              title="Exportar vehículos"
              triggerDisabled={!canExport}
              actions={[
                {
                  id: 'partners-vehicles-csv',
                  label: 'CSV vehículos',
                  run: () => exportCsv(
                    'partners_vehicles.csv',
                    ['code', 'plate', 'subcontractor', 'driver', 'status', 'updated_at'],
                    filteredVehicles.map((row) => [
                      row.code,
                      row.plate_number ?? '',
                      row.subcontractor_name ?? '',
                      row.assigned_driver_code ?? '',
                      row.status,
                      row.updated_at ?? '',
                    ])
                  ),
                },
              ]}
            />
            <Button type="button" variant="secondary" onClick={() => { void bulkUpdateVehicles('active'); }}>
              Activar seleccion ({selectedVehicleIds.length})
            </Button>
            <Button type="button" variant="outline" onClick={() => { void bulkUpdateVehicles('maintenance'); }}>
              Mantenimiento seleccion
            </Button>
          </div>
          <TableWrapper className="desktop-table-only">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <input
                      type="checkbox"
                      checked={filteredVehicles.length > 0 && filteredVehicles.every((item) => selectedVehicleIds.includes(item.id))}
                      onChange={(event) => {
                        setSelectedVehicleIds(event.target.checked ? filteredVehicles.map((item) => item.id) : []);
                      }}
                    />
                  </TableHead>
                  <TableHead>Codigo</TableHead>
                  <TableHead>Matricula</TableHead>
                  <TableHead>Vehículo</TableHead>
                  <TableHead>Subcontrata</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Ult. edicion</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedVehicleIds.includes(vehicle.id)}
                        onChange={(event) => toggleSelected(setSelectedVehicleIds, vehicle.id, event.target.checked)}
                      />
                    </TableCell>
                  <TableCell>{vehicle.code}</TableCell>
                  <TableCell>{vehicle.plate_number ?? '-'}</TableCell>
                  <TableCell>{[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || '-'}</TableCell>
                  <TableCell>{vehicle.subcontractor_name ?? '-'}</TableCell>
                  <TableCell>{vehicle.assigned_driver_code ?? '-'}</TableCell>
                    <TableCell>{vehicle.status}</TableCell>
                    <TableCell>{vehicle.last_editor_name ?? '-'} · {formatDateTime(vehicle.updated_at)}</TableCell>
                    <TableCell>
                      <div className="inline-actions">
                        <Button data-testid={`edit-vehicle-${vehicle.id}`} type="button" variant="outline" onClick={() => startEditVehicle(vehicle)}>Editar</Button>
                        <Button data-testid={`delete-vehicle-${vehicle.id}`} type="button" variant="outline" onClick={() => deleteVehicle(vehicle)}>Eliminar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableWrapper>
          <div className="mobile-ops-list">
            {filteredVehicles.map((vehicle) => (
              <article key={`vehicle-mobile-${vehicle.id}`} className="mobile-ops-card">
                <div className="mobile-ops-card-header">
                  <div>
                    <strong>{vehicle.code}</strong>
                    <div className="helper">{vehicle.plate_number ?? '-'}</div>
                  </div>
                  <Badge variant="secondary">{vehicle.status}</Badge>
                </div>
                <div className="mobile-ops-card-grid">
                  <div>
                    <div className="kpi-label">Vehículo</div>
                    <div>{[vehicle.brand, vehicle.model].filter(Boolean).join(' ') || '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Subcontrata</div>
                    <div>{vehicle.subcontractor_name ?? '-'}</div>
                  </div>
                  <div>
                    <div className="kpi-label">Driver</div>
                    <div>{vehicle.assigned_driver_code ?? '-'}</div>
                  </div>
                </div>
                <div className="helper">{vehicle.last_editor_name ?? '-'} · {formatDateTime(vehicle.updated_at)}</div>
                <div className="mobile-ops-card-actions">
                  <Button data-testid={`edit-vehicle-mobile-${vehicle.id}`} type="button" variant="outline" onClick={() => startEditVehicle(vehicle)}>Editar</Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void quickUpdateVehicleStatus(vehicle, vehicle.status === 'active' ? 'maintenance' : 'active')}
                  >
                    {vehicle.status === 'active' ? 'Mantenimiento' : 'Activar'}
                  </Button>
                  <Button data-testid={`delete-vehicle-mobile-${vehicle.id}`} type="button" variant="outline" onClick={() => deleteVehicle(vehicle)}>Archivar</Button>
                </div>
              </article>
            ))}
          </div>

          {editingVehicleId ? (
            <div className="filters-panel">
              <div className="form-row">
              <Input value={editVehiclePlate} onChange={(e) => setEditVehiclePlate(e.target.value)} placeholder="Matricula" />
              <Input value={editVehicleBrand} onChange={(e) => setEditVehicleBrand(e.target.value)} placeholder="Marca" />
              <Input value={editVehicleModel} onChange={(e) => setEditVehicleModel(e.target.value)} placeholder="Modelo" />
              <Input value={editVehicleFuelType} onChange={(e) => setEditVehicleFuelType(e.target.value)} placeholder="Combustible" />
              <Input value={editVehicleVolumeM3} onChange={(e) => setEditVehicleVolumeM3(e.target.value)} placeholder="Volumen m3" />
              <Select value={editVehicleRefrigerated} onChange={(e) => setEditVehicleRefrigerated(e.target.value as '0' | '1')}>
                <option value="0">No refrigerado</option>
                <option value="1">Refrigerado</option>
              </Select>
              <Input type="date" value={editVehicleInsuranceExpiresAt} onChange={(e) => setEditVehicleInsuranceExpiresAt(e.target.value)} />
              <Input type="date" value={editVehicleItvExpiresAt} onChange={(e) => setEditVehicleItvExpiresAt(e.target.value)} />
              <Select value={editVehicleStatus} onChange={(e) => setEditVehicleStatus(e.target.value as 'active' | 'inactive' | 'maintenance')}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="maintenance">maintenance</option>
              </Select>
              <Select value={editVehicleSubcontractorId} onChange={(e) => setEditVehicleSubcontractorId(e.target.value)}>
                <option value="">Sin subcontrata</option>
                {subcontractors.map((subcontractor) => (
                  <option key={subcontractor.id} value={subcontractor.id}>{subcontractor.legal_name}</option>
                ))}
              </Select>
              <Select value={editVehicleDriverId} onChange={(e) => setEditVehicleDriverId(e.target.value)}>
                <option value="">Sin driver</option>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.code} - {driver.name}</option>
                ))}
              </Select>
              </div>
              <div className="inline-actions">
              <Button data-testid="save-vehicle" type="button" onClick={saveVehicle}>Guardar vehiculo</Button>
              <Button type="button" variant="outline" onClick={() => setEditingVehicleId('')}>Cancelar</Button>
              </div>
            </div>
          ) : null}

          {message ? <p className="helper">{message}</p> : null}
          {error ? <p className="helper error">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" onClick={() => setShowAudit((value) => !value)}>
            {showAudit ? 'Ocultar auditoría' : 'Mostrar auditoría'}
          </Button>
        </CardContent>
      </Card>
      {showAudit ? (
        <Card>
          <CardHeader>
            <CardTitle>Auditoría partners</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="inline-actions">
              <Select value={auditEventFilter} onChange={(e) => setAuditEventFilter(e.target.value)}>
                <option value="">Todos los eventos</option>
                <option value="subcontractors.">Subcontratas</option>
                <option value="drivers.">Conductores</option>
                <option value="vehicles.">Vehículos</option>
              </Select>
              <Input
                value={auditActorFilter}
                onChange={(e) => setAuditActorFilter(e.target.value)}
                placeholder="Filtrar por actor"
              />
              <Button type="button" variant="outline" onClick={() => { void load(); }}>
                Actualizar auditoría
              </Button>
              <ExportActionsModal
                title="Exportar auditoría partners"
                triggerDisabled={!canExport}
                actions={[
                  {
                    id: 'partners-audit-csv',
                    label: 'CSV auditoría',
                    run: () => apiClient.exportAuditLogsCsv({
                      event: auditEventFilter || undefined,
                      actor: auditActorFilter || undefined,
                    }),
                  },
                ]}
              />
            </div>
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Detalle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditRows.map((row) => (
                    <TableRow key={`audit-${row.id}`}>
                      <TableCell>{formatDateTime(row.created_at)}</TableCell>
                      <TableCell>{row.event}</TableCell>
                      <TableCell>{row.actor_name ?? row.actor_user_id ?? '-'}</TableCell>
                      <TableCell>{typeof row.metadata === 'string' ? row.metadata : JSON.stringify(row.metadata ?? {})}</TableCell>
                    </TableRow>
                  ))}
                  {!auditRows.length && !auditLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}>Sin auditoría para el filtro actual.</TableCell>
                    </TableRow>
                  ) : null}
                  {auditLoading ? (
                    <TableRow>
                      <TableCell colSpan={4}>Cargando auditoría...</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableWrapper>
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}

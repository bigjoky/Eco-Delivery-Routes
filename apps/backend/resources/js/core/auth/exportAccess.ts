export type ExportArea =
  | 'dashboard'
  | 'shipments'
  | 'routes'
  | 'quality'
  | 'settlements'
  | 'advances'
  | 'audit'
  | 'partners';

const exportRoleMatrix: Record<ExportArea, string[]> = {
  dashboard: ['super_admin', 'admin', 'operations_manager', 'traffic_operator', 'accountant'],
  shipments: ['super_admin', 'admin', 'operations_manager', 'traffic_operator', 'accountant'],
  routes: ['super_admin', 'admin', 'operations_manager', 'traffic_operator', 'warehouse_operator'],
  quality: ['super_admin', 'admin', 'operations_manager', 'accountant'],
  settlements: ['super_admin', 'admin', 'accountant'],
  advances: ['super_admin', 'admin', 'accountant'],
  audit: ['super_admin', 'admin', 'operations_manager', 'accountant'],
  partners: ['super_admin', 'admin', 'operations_manager'],
};

export function hasExportAccess(area: ExportArea, roles: string[]): boolean {
  const allowed = exportRoleMatrix[area];
  return roles.some((role) => allowed.includes(role));
}

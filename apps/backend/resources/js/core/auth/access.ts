export type FeatureAccess =
  | 'shipments'
  | 'routes'
  | 'incidents'
  | 'partners'
  | 'tariffs'
  | 'advances'
  | 'settlements'
  | 'quality'
  | 'users'
  | 'roles'
  | 'network'
  | 'workforce'
  | 'compliance'
  | 'fleet';

const accessMap: Record<FeatureAccess, string[]> = {
  shipments: ['super_admin', 'operations_manager', 'traffic_operator', 'warehouse_operator', 'accountant', 'viewer'],
  routes: ['super_admin', 'operations_manager', 'traffic_operator', 'warehouse_operator', 'accountant', 'viewer'],
  incidents: ['super_admin', 'operations_manager', 'traffic_operator', 'warehouse_operator', 'accountant', 'viewer'],
  partners: ['super_admin', 'operations_manager', 'traffic_operator', 'accountant'],
  tariffs: ['super_admin', 'operations_manager', 'accountant'],
  advances: ['super_admin', 'accountant'],
  settlements: ['super_admin', 'accountant'],
  quality: ['super_admin', 'operations_manager', 'traffic_operator', 'accountant', 'viewer'],
  users: ['super_admin', 'operations_manager', 'accountant'],
  roles: ['super_admin', 'operations_manager', 'accountant'],
  network: ['super_admin', 'operations_manager', 'traffic_operator', 'warehouse_operator'],
  workforce: ['super_admin', 'operations_manager', 'traffic_operator', 'accountant'],
  compliance: ['super_admin', 'operations_manager', 'traffic_operator', 'warehouse_operator', 'accountant'],
  fleet: ['super_admin', 'operations_manager', 'traffic_operator', 'warehouse_operator', 'accountant'],
};

export function canAccess(feature: FeatureAccess, roles: string[]): boolean {
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  const isMock = !apiBase || apiBase === 'undefined' || apiBase === 'null';
  if (isMock && roles.length === 0) return true;
  if (roles.includes('super_admin')) return true;
  return accessMap[feature].some((role) => roles.includes(role));
}

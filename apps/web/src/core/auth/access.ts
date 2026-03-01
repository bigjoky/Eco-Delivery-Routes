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
  | 'roles';

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
};

export function canAccess(feature: FeatureAccess, roles: string[]): boolean {
  if (roles.includes('super_admin')) return true;
  return accessMap[feature].some((role) => roles.includes(role));
}


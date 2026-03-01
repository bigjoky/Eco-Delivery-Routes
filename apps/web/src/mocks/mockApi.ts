let trackingSeq = 1;
let podSeq = 1;
let incidentSeq = 2;
let userSeq = 3;
let routeStopSeq = 3;
let mockIncidents = [
  {
    id: 'i-1',
    incidentable_type: 'shipment' as const,
    incidentable_id: '00000000-0000-0000-0000-000000000101',
    catalog_code: 'ABSENT_HOME',
    category: 'absent' as const,
    notes: 'Cliente no localizado',
    resolved_at: null as string | null,
  },
];
const mockRoles = [
  { id: 'r-1', code: 'super_admin', name: 'Super Admin' },
  { id: 'r-2', code: 'operations_manager', name: 'Operations Manager' },
  { id: 'r-3', code: 'driver', name: 'Driver' },
];
const mockPermissions = [
  { id: 'p-1', code: 'users.read', name: 'USERS.READ' },
  { id: 'p-2', code: 'users.create', name: 'USERS.CREATE' },
  { id: 'p-3', code: 'users.update', name: 'USERS.UPDATE' },
  { id: 'p-4', code: 'roles.read', name: 'ROLES.READ' },
  { id: 'p-5', code: 'roles.assign', name: 'ROLES.ASSIGN' },
  { id: 'p-6', code: 'routes.read', name: 'ROUTES.READ' },
  { id: 'p-7', code: 'shipments.read', name: 'SHIPMENTS.READ' },
  { id: 'p-8', code: 'tracking.write', name: 'TRACKING.WRITE' },
];
let mockRolePermissions: Record<string, string[]> = {
  'r-1': ['p-1', 'p-2', 'p-3', 'p-4', 'p-5', 'p-6', 'p-7', 'p-8'],
  'r-2': ['p-1', 'p-4', 'p-6', 'p-7'],
  'r-3': ['p-6', 'p-7', 'p-8'],
};
let mockUsers: Array<{
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'active' | 'suspended';
  last_login_at?: string | null;
  role_ids: string[];
}> = [
  {
    id: 'u-1',
    name: 'Admin Demo',
    email: 'admin@eco.local',
    status: 'active',
    last_login_at: '2026-02-28T08:30:00Z',
    role_ids: ['r-1'],
  },
  {
    id: 'u-2',
    name: 'Ops Demo',
    email: 'ops@eco.local',
    status: 'active',
    last_login_at: '2026-02-28T07:05:00Z',
    role_ids: ['r-2'],
  },
];
let subcontractorSeq = 2;
let driverSeq = 2;
let vehicleSeq = 2;
let routeSeq = 4;
let mockSubcontractors: Array<{
  id: string;
  legal_name: string;
  tax_id?: string | null;
  status: 'active' | 'inactive' | 'suspended';
  payment_terms?: string | null;
}> = [
  {
    id: 'sc-1',
    legal_name: 'Ruta Sur Express SL',
    tax_id: 'B00000001',
    status: 'active',
    payment_terms: 'monthly',
  },
];
let mockDrivers: Array<{
  id: string;
  code: string;
  name: string;
  status: 'active' | 'inactive' | 'suspended';
  employment_type: 'employee' | 'subcontractor';
  user_id?: string | null;
  subcontractor_id?: string | null;
  home_hub_id?: string | null;
}> = [
  {
    id: 'drv-1',
    code: 'DRV-AGP-001',
    name: 'Driver Demo',
    status: 'active',
    employment_type: 'subcontractor',
    subcontractor_id: 'sc-1',
    home_hub_id: 'hub-1',
  },
];
let mockVehicles: Array<{
  id: string;
  code: string;
  plate_number?: string | null;
  vehicle_type: string;
  capacity_kg?: number | null;
  status: 'active' | 'inactive' | 'maintenance';
  subcontractor_id?: string | null;
  home_hub_id?: string | null;
  assigned_driver_id?: string | null;
}> = [
  {
    id: 'veh-1',
    code: 'VEH-AGP-001',
    plate_number: '1234-MLG',
    vehicle_type: 'van',
    capacity_kg: 1200,
    status: 'active',
    subcontractor_id: 'sc-1',
    home_hub_id: 'hub-1',
    assigned_driver_id: 'drv-1',
  },
];
let mockRoutes: Array<{
  id: string;
  hub_id: string;
  code: string;
  route_date: string;
  status: string;
  driver_id?: string | null;
  subcontractor_id?: string | null;
  vehicle_id?: string | null;
  stops_count: number;
  manifest_notes?: string | null;
}> = [
  {
    id: 'r-1',
    hub_id: 'hub-1',
    code: 'R-AGP-20260227',
    route_date: '2026-02-27',
    status: 'in_progress',
    driver_id: 'drv-1',
    subcontractor_id: 'sc-1',
    vehicle_id: 'veh-1',
    stops_count: 28,
    manifest_notes: 'Salir por Zona Centro primero.',
  },
  {
    id: 'r-2',
    hub_id: 'hub-1',
    code: 'R-AGP-20260228',
    route_date: '2026-02-28',
    status: 'planned',
    driver_id: null,
    subcontractor_id: null,
    vehicle_id: null,
    stops_count: 24,
    manifest_notes: null,
  },
  {
    id: 'r-3',
    hub_id: 'hub-2',
    code: 'R-AGP-20260301',
    route_date: '2026-03-01',
    status: 'completed',
    driver_id: null,
    subcontractor_id: null,
    vehicle_id: null,
    stops_count: 31,
    manifest_notes: null,
  },
];
let mockRouteStops: Array<{
  id: string;
  route_id: string;
  sequence: number;
  stop_type: 'DELIVERY' | 'PICKUP';
  status: 'planned' | 'in_progress' | 'completed';
  shipment_id?: string | null;
  pickup_id?: string | null;
  entity_type: 'shipment' | 'pickup';
  entity_id: string;
  reference?: string | null;
}> = [
  {
    id: 'st-1',
    route_id: 'r-1',
    sequence: 1,
    stop_type: 'DELIVERY',
    status: 'in_progress',
    shipment_id: '00000000-0000-0000-0000-000000000101',
    pickup_id: null,
    entity_type: 'shipment',
    entity_id: '00000000-0000-0000-0000-000000000101',
    reference: 'SHP-AGP-0001',
  },
  {
    id: 'st-2',
    route_id: 'r-1',
    sequence: 2,
    stop_type: 'PICKUP',
    status: 'planned',
    shipment_id: null,
    pickup_id: '00000000-0000-0000-0000-000000000201',
    entity_type: 'pickup',
    entity_id: '00000000-0000-0000-0000-000000000201',
    reference: 'PCK-AGP-0001',
  },
];

export const mockApi = {
  async login(_: { email: string; password: string }) {
    return { message: 'Login mock OK', token: 'mock-token' };
  },

  async getCurrentUser() {
    const admin = mockUsers.find((item) => item.id === 'u-1')!;
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      status: admin.status,
      roles: admin.role_ids
        .map((roleId) => mockRoles.find((role) => role.id === roleId))
        .filter((role): role is (typeof mockRoles)[number] => !!role),
    };
  },

  async getUsers(filters: {
    q?: string;
    status?: 'pending' | 'active' | 'suspended';
    sort?: 'name' | 'email' | 'last_login_at' | 'created_at';
    dir?: 'asc' | 'desc';
  } = {}) {
    let rows = mockUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      last_login_at: user.last_login_at ?? null,
      roles: user.role_ids
        .map((roleId) => mockRoles.find((role) => role.id === roleId))
        .filter((role): role is (typeof mockRoles)[number] => !!role),
    }));

    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter((row) => row.name.toLowerCase().includes(q) || row.email.toLowerCase().includes(q));
    }
    if (filters.status) {
      rows = rows.filter((row) => row.status === filters.status);
    }
    const sortKey = filters.sort ?? 'name';
    const sortDir = filters.dir === 'asc' ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      const aValue = sortKey === 'created_at' ? a.id : (a[sortKey] ?? '');
      const bValue = sortKey === 'created_at' ? b.id : (b[sortKey] ?? '');
      if (aValue === bValue) return 0;
      return aValue > bValue ? sortDir : -sortDir;
    });
    return rows;
  },

  async getUserById(id: string) {
    const user = (await this.getUsers()).find((row) => row.id === id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  },

  async createUser(payload: {
    name: string;
    email: string;
    password: string;
    status: 'pending' | 'active' | 'suspended';
    roleIds?: string[];
  }) {
    const created = {
      id: `u-${userSeq++}`,
      name: payload.name,
      email: payload.email,
      status: payload.status,
      last_login_at: null,
      role_ids: payload.roleIds ?? [],
    };
    mockUsers = [created, ...mockUsers];
    return {
      id: created.id,
      name: created.name,
      email: created.email,
      status: created.status,
      last_login_at: created.last_login_at,
      roles: created.role_ids
        .map((roleId) => mockRoles.find((role) => role.id === roleId))
        .filter((role): role is (typeof mockRoles)[number] => !!role),
    };
  },

  async updateUser(id: string, payload: {
    name?: string;
    email?: string;
    status?: 'pending' | 'active' | 'suspended';
    password?: string;
  }) {
    const index = mockUsers.findIndex((item) => item.id === id);
    if (index < 0) {
      throw new Error('User not found');
    }
    const current = mockUsers[index];
    const next = {
      ...current,
      name: payload.name ?? current.name,
      email: payload.email ?? current.email,
      status: payload.status ?? current.status,
    };
    mockUsers[index] = next;
    return {
      id: next.id,
      name: next.name,
      email: next.email,
      status: next.status,
      last_login_at: next.last_login_at ?? null,
      roles: next.role_ids
        .map((roleId) => mockRoles.find((role) => role.id === roleId))
        .filter((role): role is (typeof mockRoles)[number] => !!role),
    };
  },

  async assignUserRoles(userId: string, roleIds: string[]) {
    const index = mockUsers.findIndex((item) => item.id === userId);
    if (index < 0) {
      throw new Error('User not found');
    }
    mockUsers[index] = {
      ...mockUsers[index],
      role_ids: roleIds,
    };
  },

  async suspendUser(userId: string) {
    const index = mockUsers.findIndex((item) => item.id === userId);
    if (index < 0) {
      throw new Error('User not found');
    }
    mockUsers[index] = { ...mockUsers[index], status: 'suspended' };
    return this.getUserById(userId);
  },

  async reactivateUser(userId: string) {
    const index = mockUsers.findIndex((item) => item.id === userId);
    if (index < 0) {
      throw new Error('User not found');
    }
    mockUsers[index] = { ...mockUsers[index], status: 'active' };
    return this.getUserById(userId);
  },

  async resetUserPassword(userId: string, _password: string) {
    const exists = mockUsers.some((item) => item.id === userId);
    if (!exists) {
      throw new Error('User not found');
    }
  },

  async getAuditLogs(_: {
    resource?: 'settlement' | 'adjustment' | 'advance' | 'tariff' | 'quality_threshold' | 'user' | 'role';
    id?: string;
    event?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    perPage?: number;
  }) {
    const rows = [
      {
        id: 1,
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        actor_roles: 'super_admin',
        event: 'settlement.adjustment.created',
        metadata: { settlement_id: 'st-1', adjustment_id: 'sa-1' },
        created_at: '2026-02-27T10:00:00Z',
      },
      {
        id: 2,
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        actor_roles: 'super_admin',
        event: 'settlement.adjustment.approved',
        metadata: { settlement_id: 'st-1', adjustment_id: 'sa-1' },
        created_at: '2026-02-27T10:05:00Z',
      },
      {
        id: 3,
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        actor_roles: 'super_admin',
        event: 'quality.threshold.updated',
        metadata: {
          scope_type: 'role',
          scope_id: 'driver',
          before: { threshold: 95 },
          after: { threshold: 96.5 },
        },
        created_at: '2026-02-28T09:00:00Z',
      },
      {
        id: 4,
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        actor_roles: 'super_admin',
        event: 'user.updated',
        metadata: { user_id: 'u-2', before: { status: 'pending' }, after: { status: 'active' } },
        created_at: '2026-02-28T10:00:00Z',
      },
      {
        id: 5,
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        actor_roles: 'super_admin',
        event: 'user.roles.assigned',
        metadata: { user_id: 'u-2', role_ids: ['r-2'] },
        created_at: '2026-02-28T10:05:00Z',
      },
      {
        id: 6,
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        actor_roles: 'super_admin',
        event: 'role.permissions.assigned',
        metadata: {
          role_id: 'r-2',
          before_permission_ids: ['p-1', 'p-4'],
          after_permission_ids: ['p-1', 'p-4', 'p-6', 'p-7'],
          added_permission_ids: ['p-6', 'p-7'],
          removed_permission_ids: [],
        },
        created_at: '2026-02-28T10:20:00Z',
      },
    ];
    let filtered = rows;
    if (_.resource === 'user') {
      filtered = filtered.filter((row) => row.event.startsWith('user.'));
      if (_.id) {
        filtered = filtered.filter((row) => {
          const metadata = row.metadata as { user_id?: string };
          return metadata.user_id === _.id;
        });
      }
    }
    if (_.resource === 'role') {
      filtered = filtered.filter((row) => row.event.startsWith('role.'));
      if (_.id) {
        filtered = filtered.filter((row) => {
          const metadata = row.metadata as { role_id?: string };
          return metadata.role_id === _.id;
        });
      }
    }
    if (_.event) {
      filtered = filtered.filter((row) => row.event.startsWith(_.event ?? ''));
    }
    return filtered;
  },

  async exportAuditLogsCsv(_: {
    resource?: 'settlement' | 'adjustment' | 'advance' | 'tariff' | 'quality_threshold' | 'user' | 'role';
    id?: string;
    event?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return;
  },

  async getQualityThreshold() {
    return { threshold: 95, source_type: 'default' as const, source_id: null, can_manage: true };
  },

  async getQualityThresholdHistory(_: {
    event?: string;
    scopeType?: 'global' | 'role' | 'user';
    scopeId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    perPage?: number;
  }) {
    const rows = [
      {
        id: 301,
        event: 'quality.threshold.updated',
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        created_at: '2026-02-28T09:00:00Z',
        scope_type: 'role' as const,
        scope_id: 'driver',
        before_threshold: 95,
        after_threshold: 96.5,
        metadata: {
          scope_type: 'role',
          scope_id: 'driver',
          before: { threshold: 95 },
          after: { threshold: 96.5 },
        },
      },
      {
        id: 302,
        event: 'quality.threshold.updated',
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        created_at: '2026-02-27T12:10:00Z',
        scope_type: 'global' as const,
        scope_id: null,
        before_threshold: 94,
        after_threshold: 95,
        metadata: {
          scope_type: 'global',
          scope_id: null,
          before: { threshold: 94 },
          after: { threshold: 95 },
        },
      },
      {
        id: 303,
        event: 'quality.threshold.alert.large_delta',
        actor_user_id: 'u-1',
        actor_name: 'Admin Demo',
        created_at: '2026-02-28T10:45:00Z',
        scope_type: 'role' as const,
        scope_id: 'driver',
        before_threshold: 96.5,
        after_threshold: 90.5,
        metadata: {
          scope_type: 'role',
          scope_id: 'driver',
          before: { threshold: 96.5 },
          after: { threshold: 90.5 },
          delta: 6,
          window_hours: 24,
          threshold_delta_trigger: 5,
        },
      },
    ];
    if (_.event) {
      return rows.filter((row) => row.event === _.event);
    }
    return rows;
  },

  async getQualityThresholdAlertSettings() {
    return {
      large_delta_threshold: 5,
      window_hours: 24,
      can_manage: true,
      source_type: 'default' as const,
    };
  },

  async setQualityThresholdAlertSettings(payload: {
    largeDeltaThreshold: number;
    windowHours: number;
  }) {
    return {
      large_delta_threshold: payload.largeDeltaThreshold,
      window_hours: payload.windowHours,
      can_manage: true,
      source_type: 'configured' as const,
    };
  },

  async exportQualityThresholdHistoryCsv(_: {
    scopeType?: 'global' | 'role' | 'user';
    scopeId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return;
  },

  async exportQualityThresholdHistoryPdf(_: {
    scopeType?: 'global' | 'role' | 'user';
    scopeId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return;
  },

  async getRoles() {
    return mockRoles;
  },

  async getRoleById(roleId: string) {
    const role = mockRoles.find((row) => row.id === roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    return {
      id: role.id,
      code: role.code,
      name: role.name,
      permissions: (mockRolePermissions[role.id] ?? [])
        .map((permissionId) => mockPermissions.find((permission) => permission.id === permissionId))
        .filter((permission): permission is (typeof mockPermissions)[number] => !!permission),
      available_permissions: mockPermissions,
      users_count: mockUsers.filter((user) => user.role_ids.includes(role.id)).length,
    };
  },

  async updateRolePermissions(roleId: string, permissionIds: string[]) {
    const role = mockRoles.find((row) => row.id === roleId);
    if (!role) {
      throw new Error('Role not found');
    }
    mockRolePermissions = {
      ...mockRolePermissions,
      [roleId]: permissionIds,
    };
    return this.getRoleById(roleId);
  },

  async getHubs(_: { onlyActive?: boolean } = {}) {
    return [
      { id: 'hub-1', code: 'AGP-HUB-01', name: 'Hub Malaga Centro', city: 'Malaga', is_active: true },
      { id: 'hub-2', code: 'SEV-HUB-01', name: 'Hub Sevilla Norte', city: 'Sevilla', is_active: true },
    ];
  },

  async getShipments(filters: {
    status?: string;
    hubId?: string;
    q?: string;
    scheduledFrom?: string;
    scheduledTo?: string;
  } = {}) {
    let rows = [
      { id: 's-1', reference: 'SHP-AGP-0001', status: 'out_for_delivery', consignee_name: 'Cliente Demo', address_line: 'Calle 1', scheduled_at: '2026-03-01T08:00:00Z', hub_id: 'hub-1' },
      { id: 's-2', reference: 'SHP-AGP-0002', status: 'delivered', consignee_name: 'Cliente Centro', address_line: 'Calle 2', scheduled_at: '2026-03-01T09:30:00Z', hub_id: 'hub-2' },
    ];
    if (filters.status) {
      rows = rows.filter((row) => row.status === filters.status);
    }
    if (filters.hubId) {
      rows = rows.filter((row) => row.hub_id === filters.hubId);
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter((row) =>
        row.reference.toLowerCase().includes(q) ||
        row.id.toLowerCase().includes(q) ||
        (row.consignee_name ?? '').toLowerCase().includes(q)
      );
    }
    if (filters.scheduledFrom) {
      rows = rows.filter((row) => row.scheduled_at >= `${filters.scheduledFrom}T00:00:00Z`);
    }
    if (filters.scheduledTo) {
      rows = rows.filter((row) => row.scheduled_at <= `${filters.scheduledTo}T23:59:59Z`);
    }
    return rows;
  },

  async createShipment(payload: {
    hub_id: string;
    reference: string;
    consignee_name?: string | null;
    address_line?: string | null;
    address_street?: string | null;
    address_number?: string | null;
    postal_code?: string | null;
    city?: string | null;
    province?: string | null;
    country?: string | null;
    address_notes?: string | null;
    consignee_phone?: string | null;
    consignee_email?: string | null;
    scheduled_at?: string | null;
  }) {
    return {
      id: `s-${Math.floor(Math.random() * 10000)}`,
      reference: payload.reference,
      status: 'created',
      consignee_name: payload.consignee_name ?? null,
      address_line: payload.address_line ?? null,
      address_street: payload.address_street ?? null,
      address_number: payload.address_number ?? null,
      postal_code: payload.postal_code ?? null,
      city: payload.city ?? null,
      province: payload.province ?? null,
      country: payload.country ?? null,
      address_notes: payload.address_notes ?? null,
      consignee_phone: payload.consignee_phone ?? null,
      consignee_email: payload.consignee_email ?? null,
      scheduled_at: payload.scheduled_at ?? null,
      hub_id: payload.hub_id,
    };
  },

  async getShipmentDetail(id: string) {
    return {
      shipment: {
        id,
        reference: id === 's-2' ? 'SHP-AGP-0002' : 'SHP-AGP-0001',
        status: id === 's-2' ? 'delivered' : 'out_for_delivery',
        consignee_name: id === 's-2' ? 'Cliente Centro' : 'Cliente Demo',
        address_line: id === 's-2' ? 'Calle 2' : 'Calle 1',
        address_street: id === 's-2' ? 'Calle 2' : 'Calle 1',
        address_number: id === 's-2' ? '20' : '10',
        postal_code: '29001',
        city: 'Malaga',
        province: 'Malaga',
        country: 'ES',
        address_notes: 'Portal azul',
        consignee_phone: '+34950111222',
        consignee_email: 'cliente@eco.local',
        scheduled_at: '2026-03-01T08:00:00Z',
        hub_id: 'hub-1',
        route_id: null,
        assigned_driver_id: null,
        subcontractor_id: null,
        delivered_at: id === 's-2' ? '2026-03-01T10:15:00Z' : null,
      },
      tracking_events: [
        {
          id: 'evt-1',
          trackable_type: 'shipment',
          trackable_id: id,
          event_code: 'CREATED',
          status_to: 'created',
          scan_code: null,
          source: 'web',
          occurred_at: '2026-03-01T06:15:00Z',
        },
        {
          id: 'evt-2',
          trackable_type: 'shipment',
          trackable_id: id,
          event_code: 'OUT_FOR_DELIVERY',
          status_to: 'out_for_delivery',
          scan_code: 'SCAN-OUT-001',
          source: 'warehouse',
          occurred_at: '2026-03-01T08:30:00Z',
        },
      ],
      pods: id === 's-2'
        ? [
          {
            id: 'pod-1',
            evidenceable_type: 'shipment',
            evidenceable_id: id,
            signature_name: 'Maria G.',
            photo_url: null,
            captured_at: '2026-03-01T10:10:00Z',
          },
        ]
        : [],
      incidents: id === 's-2'
        ? [
          {
            id: 'inc-1',
            incidentable_type: 'shipment',
            incidentable_id: id,
            catalog_code: 'ADDR_ERR',
            category: 'general',
            notes: 'Direccion corregida en ruta',
            resolved_at: '2026-03-01T09:45:00Z',
            created_at: '2026-03-01T09:10:00Z',
          },
        ]
        : [],
      route_stops: [
        {
          id: 'stop-1',
          route_id: 'route-1',
          route_code: 'R-AGP-001',
          route_date: '2026-03-01',
          sequence: 4,
          stop_type: 'DELIVERY',
          status: 'completed',
          planned_at: '2026-03-01T08:00:00Z',
          completed_at: '2026-03-01T10:10:00Z',
        },
      ],
    };
  },

  async exportShipmentsCsv(_: {
    status?: string;
    hubId?: string;
    q?: string;
    scheduledFrom?: string;
    scheduledTo?: string;
    columns?: string[];
    sort?: string;
    dir?: 'asc' | 'desc';
  }) {
    return;
  },

  async exportShipmentsPdf(_: {
    status?: string;
    hubId?: string;
    q?: string;
    scheduledFrom?: string;
    scheduledTo?: string;
    columns?: string[];
    sort?: string;
    dir?: 'asc' | 'desc';
  }) {
    return;
  },

  async importShipmentsCsv(_: File, options: { dryRun?: boolean; async?: boolean } = {}) {
    if (options.async) {
      return {
        job_dispatched: true,
        import_id: 'imp-1',
        queued_at: '2026-03-01T12:00:00Z',
      };
    }
    return {
      dry_run: !!options.dryRun,
      created_count: options.dryRun ? 0 : 2,
      skipped_count: 1,
      error_count: 1,
      rows: [
        { row: 2, reference: 'SHP-AGP-0011', status: 'ok' },
        { row: 3, reference: 'SHP-AGP-0012', status: 'ok' },
        { row: 4, reference: 'SHP-AGP-0001', status: 'error', errors: ['reference ya existe'] },
      ],
      warnings: [],
      unknown_columns: [],
      import_id: 'imp-1',
    };
  },

  async downloadShipmentsTemplate() {
    return;
  },

  async getShipmentImportStatus(importId: string) {
    return {
      id: importId,
      actor_user_id: 'u-1',
      status: 'completed',
      created_count: 2,
      error_count: 1,
      skipped_count: 1,
      warnings: [],
      unknown_columns: [],
      error_message: null,
      file_path: 'imports/shipments/mock.csv',
      started_at: '2026-03-01T12:00:00Z',
      completed_at: '2026-03-01T12:02:00Z',
      created_at: '2026-03-01T12:00:00Z',
      updated_at: '2026-03-01T12:02:00Z',
    };
  },

  async getShipmentImports(_: { page?: number; perPage?: number } = {}) {
    return [
      {
        id: 'imp-1',
        actor_user_id: 'u-1',
        status: 'completed',
        created_count: 2,
        error_count: 1,
        skipped_count: 1,
        warnings: [],
        unknown_columns: [],
        error_message: null,
        file_path: 'imports/shipments/mock.csv',
        started_at: '2026-03-01T12:00:00Z',
        completed_at: '2026-03-01T12:02:00Z',
        created_at: '2026-03-01T12:00:00Z',
        updated_at: '2026-03-01T12:02:00Z',
      },
    ];
  },

  async getPickups(filters: { status?: string; limit?: number } = {}) {
    let rows = [
      { id: '00000000-0000-0000-0000-000000000201', reference: 'PCK-AGP-0001', pickup_type: 'NORMAL', status: 'planned', requester_name: 'Cliente Pickup 1' },
      { id: '00000000-0000-0000-0000-000000000202', reference: 'PCK-AGP-0002', pickup_type: 'RETURN', status: 'planned', requester_name: 'Cliente Pickup 2' },
      { id: '00000000-0000-0000-0000-000000000203', reference: 'PCK-AGP-0003', pickup_type: 'NORMAL', status: 'completed', requester_name: 'Cliente Pickup 3' },
    ];
    if (filters.status) {
      rows = rows.filter((row) => row.status === filters.status);
    }
    if (filters.limit) {
      rows = rows.slice(0, Math.max(1, filters.limit));
    }
    return rows;
  },

  async getRoutes(filters: {
    status?: string;
    hubId?: string;
    q?: string;
    dateFrom?: string;
    dateTo?: string;
    sort?: string;
    dir?: 'asc' | 'desc';
  } = {}) {
    let rows = mockRoutes.map((row) => {
      const vehicle = row.vehicle_id ? mockVehicles.find((item) => item.id === row.vehicle_id) : null;
      const driver = row.driver_id ? mockDrivers.find((item) => item.id === row.driver_id) : null;
      return {
        ...row,
        driver_code: driver?.code ?? null,
        vehicle_code: vehicle?.code ?? null,
      };
    });
    if (filters.status) {
      rows = rows.filter((row) => row.status === filters.status);
    }
    if (filters.hubId) {
      rows = rows.filter((row) => row.hub_id === filters.hubId);
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter((row) => row.code.toLowerCase().includes(q));
    }
    if (filters.dateFrom) {
      const from = filters.dateFrom;
      rows = rows.filter((row) => row.route_date >= from);
    }
    if (filters.dateTo) {
      const to = filters.dateTo;
      rows = rows.filter((row) => row.route_date <= to);
    }
    const sortKey = filters.sort === 'code' ? 'code' : 'route_date';
    const dir = filters.dir === 'asc' ? 1 : -1;
    rows = rows.slice().sort((a, b) => (a[sortKey] > b[sortKey] ? dir : -dir));
    return rows;
  },

  async createRoute(payload: {
    hub_id: string;
    code: string;
    route_date: string;
    subcontractor_id?: string | null;
    driver_id?: string | null;
    vehicle_id?: string | null;
  }) {
    const route = {
      id: `r-${routeSeq++}`,
      hub_id: payload.hub_id,
      code: payload.code,
      route_date: payload.route_date,
      status: 'planned',
      subcontractor_id: payload.subcontractor_id ?? null,
      driver_id: payload.driver_id ?? null,
      vehicle_id: payload.vehicle_id ?? null,
      stops_count: 0,
    };
    mockRoutes = [route, ...mockRoutes];
    const driver = route.driver_id ? mockDrivers.find((item) => item.id === route.driver_id) : null;
    const vehicle = route.vehicle_id ? mockVehicles.find((item) => item.id === route.vehicle_id) : null;
    return {
      ...route,
      driver_code: driver?.code ?? null,
      vehicle_code: vehicle?.code ?? null,
    };
  },

  async getRouteStops(routeId: string) {
    return mockRouteStops
      .filter((row) => row.route_id === routeId)
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
  },

  async createRouteStop(routeId: string, payload: {
    sequence: number;
    stop_type: 'DELIVERY' | 'PICKUP';
    shipment_id?: string | null;
    pickup_id?: string | null;
    status?: 'planned' | 'in_progress' | 'completed';
    undo_of_stop_id?: string | null;
  }) {
    const stop = {
      id: `st-${routeStopSeq++}`,
      route_id: routeId,
      sequence: payload.sequence,
      stop_type: payload.stop_type,
      status: payload.status ?? 'planned',
      shipment_id: payload.shipment_id ?? null,
      pickup_id: payload.pickup_id ?? null,
      entity_type: payload.stop_type === 'DELIVERY' ? 'shipment' as const : 'pickup' as const,
      entity_id: payload.stop_type === 'DELIVERY' ? (payload.shipment_id ?? '') : (payload.pickup_id ?? ''),
      reference: payload.stop_type === 'DELIVERY'
        ? `SHP-${String(payload.shipment_id ?? '').slice(-6)}`
        : `PCK-${String(payload.pickup_id ?? '').slice(-6)}`,
    };
    mockRouteStops = [...mockRouteStops, stop];
    const routeIndex = mockRoutes.findIndex((row) => row.id === routeId);
    if (routeIndex >= 0) {
      mockRoutes[routeIndex] = { ...mockRoutes[routeIndex], stops_count: mockRoutes[routeIndex].stops_count + 1 };
    }
    return stop;
  },

  async updateRouteStop(routeId: string, stopId: string, payload: {
    sequence?: number;
    status?: 'planned' | 'in_progress' | 'completed';
  }) {
    const index = mockRouteStops.findIndex((row) => row.route_id === routeId && row.id === stopId);
    if (index < 0) {
      throw new Error('Route stop not found');
    }
    const current = mockRouteStops[index];
    const next = {
      ...current,
      sequence: payload.sequence ?? current.sequence,
      status: payload.status ?? current.status,
    };
    mockRouteStops[index] = next;
    return next;
  },

  async deleteRouteStop(routeId: string, stopId: string) {
    const index = mockRouteStops.findIndex((row) => row.route_id === routeId && row.id === stopId);
    if (index < 0) {
      throw new Error('Route stop not found');
    }
    mockRouteStops.splice(index, 1);

    const routeStops = mockRouteStops
      .filter((row) => row.route_id === routeId)
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
    routeStops.forEach((row, idx) => {
      row.sequence = idx + 1;
    });

    const routeIndex = mockRoutes.findIndex((row) => row.id === routeId);
    if (routeIndex >= 0) {
      mockRoutes[routeIndex] = { ...mockRoutes[routeIndex], stops_count: routeStops.length };
    }

    return routeStops;
  },

  async reorderRouteStops(routeId: string, stopIds: string[]) {
    const routeStops = mockRouteStops
      .filter((row) => row.route_id === routeId)
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
    const existingIds = routeStops.map((row) => row.id).sort();
    const providedIds = stopIds.slice().sort();
    if (existingIds.join(',') !== providedIds.join(',')) {
      throw new Error('stop_ids must include all route stops');
    }

    stopIds.forEach((stopId, index) => {
      const row = mockRouteStops.find((item) => item.route_id === routeId && item.id === stopId);
      if (row) {
        row.sequence = index + 1;
      }
    });

    return mockRouteStops
      .filter((row) => row.route_id === routeId)
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
  },

  async bulkAddRouteStops(routeId: string, payload: {
    shipment_ids?: string[];
    pickup_ids?: string[];
    status?: 'planned' | 'in_progress' | 'completed';
  }) {
    const existingShipmentIds = new Set(
      mockRouteStops.filter((row) => row.route_id === routeId && row.shipment_id).map((row) => row.shipment_id as string)
    );
    const existingPickupIds = new Set(
      mockRouteStops.filter((row) => row.route_id === routeId && row.pickup_id).map((row) => row.pickup_id as string)
    );
    const newShipmentIds = (payload.shipment_ids ?? []).filter((id) => !existingShipmentIds.has(id));
    const newPickupIds = (payload.pickup_ids ?? []).filter((id) => !existingPickupIds.has(id));
    const skippedExistingCount = (payload.shipment_ids ?? []).length - newShipmentIds.length
      + (payload.pickup_ids ?? []).length - newPickupIds.length;

    const nextSequenceStart = (mockRouteStops.filter((row) => row.route_id === routeId).reduce((max, row) => Math.max(max, row.sequence), 0)) + 1;
    let nextSequence = nextSequenceStart;

    newShipmentIds.forEach((shipmentId) => {
      mockRouteStops.push({
        id: `st-${routeStopSeq++}`,
        route_id: routeId,
        sequence: nextSequence++,
        stop_type: 'DELIVERY',
        status: payload.status ?? 'planned',
        shipment_id: shipmentId,
        pickup_id: null,
        entity_type: 'shipment',
        entity_id: shipmentId,
        reference: `SHP-${shipmentId.slice(-6)}`,
      });
    });
    newPickupIds.forEach((pickupId) => {
      mockRouteStops.push({
        id: `st-${routeStopSeq++}`,
        route_id: routeId,
        sequence: nextSequence++,
        stop_type: 'PICKUP',
        status: payload.status ?? 'planned',
        shipment_id: null,
        pickup_id: pickupId,
        entity_type: 'pickup',
        entity_id: pickupId,
        reference: `PCK-${pickupId.slice(-6)}`,
      });
    });

    const routeStops = mockRouteStops
      .filter((row) => row.route_id === routeId)
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
    const routeIndex = mockRoutes.findIndex((row) => row.id === routeId);
    if (routeIndex >= 0) {
      mockRoutes[routeIndex] = { ...mockRoutes[routeIndex], stops_count: routeStops.length };
    }

    return {
      created_count: newShipmentIds.length + newPickupIds.length,
      skipped_existing_count: skippedExistingCount,
      stops: routeStops,
    };
  },

  async getRouteManifest(routeId: string) {
    const route = mockRoutes.find((row) => row.id === routeId);
    if (!route) throw new Error('Route not found');
    const stops = mockRouteStops
      .filter((row) => row.route_id === routeId)
      .slice()
      .sort((a, b) => a.sequence - b.sequence);
    const deliveries = stops.filter((row) => row.stop_type === 'DELIVERY').length;
    const pickups = stops.filter((row) => row.stop_type === 'PICKUP').length;
    const completed = stops.filter((row) => row.status === 'completed').length;
    const driver = route.driver_id ? mockDrivers.find((row) => row.id === route.driver_id) : null;
    const vehicle = route.vehicle_id ? mockVehicles.find((row) => row.id === route.vehicle_id) : null;

    return {
      route: {
        id: route.id,
        code: route.code,
        route_date: route.route_date,
        status: route.status,
        driver_code: driver?.code ?? null,
        vehicle_code: vehicle?.code ?? null,
        manifest_notes: route.manifest_notes ?? null,
      },
      totals: {
        stops: stops.length,
        deliveries,
        pickups,
        completed,
      },
      stops,
      generated_at: new Date().toISOString(),
    };
  },

  async updateRouteManifest(routeId: string, payload: { manifest_notes?: string | null }) {
    const index = mockRoutes.findIndex((row) => row.id === routeId);
    if (index < 0) {
      throw new Error('Route not found');
    }
    const trimmed = typeof payload.manifest_notes === 'string' ? payload.manifest_notes.trim() : null;
    const notes = trimmed ? trimmed : null;
    mockRoutes[index] = { ...mockRoutes[index], manifest_notes: notes };
    return { route_id: routeId, manifest_notes: notes };
  },

  async getMyDriverRoute(filters: { routeDate?: string; status?: string } = {}) {
    const route = mockRoutes.find((row) => row.id === 'r-1');
    if (!route) {
      return { route: null, stops: [] };
    }
    if (filters.routeDate && filters.routeDate !== route.route_date) {
      return { route: null, stops: [] };
    }
    if (filters.status && filters.status !== route.status) {
      return { route: null, stops: [] };
    }
    return {
      driver: { id: 'drv-1', code: 'DRV-AGP-001', name: 'Driver Demo' },
      route,
      stops: await this.getRouteStops(route.id),
    };
  },

  async updateRoute(id: string, payload: {
    driver_id?: string | null;
    subcontractor_id?: string | null;
    vehicle_id?: string | null;
    status?: string;
  }) {
    const index = mockRoutes.findIndex((row) => row.id === id);
    if (index < 0) {
      throw new Error('Route not found');
    }
    const current = mockRoutes[index];
    const next = {
      ...current,
      status: payload.status ?? current.status,
      subcontractor_id: payload.subcontractor_id !== undefined ? payload.subcontractor_id : current.subcontractor_id,
      driver_id: payload.driver_id !== undefined ? payload.driver_id : current.driver_id,
      vehicle_id: payload.vehicle_id !== undefined ? payload.vehicle_id : current.vehicle_id,
    };
    mockRoutes[index] = next;
    const vehicle = next.vehicle_id ? mockVehicles.find((item) => item.id === next.vehicle_id) : null;
    const driver = next.driver_id ? mockDrivers.find((item) => item.id === next.driver_id) : null;
    return {
      ...next,
      driver_code: driver?.code ?? null,
      vehicle_code: vehicle?.code ?? null,
    };
  },

  async registerScan(payload: {
    trackable_type: 'shipment' | 'pickup';
    trackable_id: string;
    event_code: string;
    scan_code: string;
    occurred_at: string;
  }) {
    const id = `te-${trackingSeq++}`;
    return { id, ...payload };
  },

  async registerPod(payload: {
    evidenceable_type: 'shipment' | 'pickup';
    evidenceable_id: string;
    signature_name: string;
  }) {
    const id = `pod-${podSeq++}`;
    return { id, ...payload };
  },

  async getQualitySnapshots(filters: {
    scopeType?: 'driver' | 'subcontractor' | 'route';
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}) {
    const rows = [
      {
        id: 'q-1',
        scope_type: 'driver',
        scope_id: 'drv-1',
        scope_label: 'DRV-AGP-001',
        hub_id: '00000000-0000-0000-0000-000000000001',
        subcontractor_id: 'sc-1',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        service_quality_score: 96.2,
        assigned_with_attempt: 450,
        delivered_completed: 430,
        pickups_completed: 3,
        failed_count: 8,
        absent_count: 6,
        retry_count: 3,
      },
      {
        id: 'q-2',
        scope_type: 'route',
        scope_id: 'r-1',
        scope_label: 'R-AGP-20260227',
        hub_id: '00000000-0000-0000-0000-000000000001',
        subcontractor_id: 'sc-1',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        service_quality_score: 94.5,
        assigned_with_attempt: 120,
        delivered_completed: 110,
        pickups_completed: 3,
        failed_count: 4,
        absent_count: 2,
        retry_count: 1,
      },
    ];
    if (filters.scopeType) {
      return rows
        .filter((row) => row.scope_type === filters.scopeType)
        .filter((row) => (filters.scopeId ? row.scope_id === filters.scopeId : true))
        .filter((row) => (filters.hubId ? row.hub_id === filters.hubId : true))
        .filter((row) => (filters.subcontractorId ? row.subcontractor_id === filters.subcontractorId : true))
        .filter((row) => (filters.periodStart ? row.period_start >= filters.periodStart : true))
        .filter((row) => (filters.periodEnd ? row.period_end <= filters.periodEnd : true));
    }
    return rows
      .filter((row) => (filters.scopeId ? row.scope_id === filters.scopeId : true))
      .filter((row) => (filters.hubId ? row.hub_id === filters.hubId : true))
      .filter((row) => (filters.subcontractorId ? row.subcontractor_id === filters.subcontractorId : true))
      .filter((row) => (filters.periodStart ? row.period_start >= filters.periodStart : true))
      .filter((row) => (filters.periodEnd ? row.period_end <= filters.periodEnd : true));
  },

  async getQualityTopRoutesUnderThreshold(filters: {
    threshold?: number;
    limit?: number;
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}) {
    const threshold = filters.threshold ?? 95;
    const limit = filters.limit ?? 10;
    const rows = await this.getQualitySnapshots({
      scopeType: 'route',
      scopeId: filters.scopeId,
      hubId: filters.hubId,
      subcontractorId: filters.subcontractorId,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
    });
    const data = rows
      .filter((row) => row.service_quality_score < threshold)
      .sort((a, b) => a.service_quality_score - b.service_quality_score)
      .slice(0, limit);

    return {
      data,
      meta: {
        threshold,
        count: data.length,
      },
    };
  },

  async getQualityRiskSummary(filters: {
    threshold?: number;
    groupBy?: 'hub' | 'subcontractor';
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  } = {}) {
    const threshold = filters.threshold ?? 95;
    const groupBy = filters.groupBy ?? 'hub';
    const rows = await this.getQualitySnapshots({
      scopeType: 'route',
      scopeId: filters.scopeId,
      hubId: filters.hubId,
      subcontractorId: filters.subcontractorId,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
    });

    const groups = new Map<string, typeof rows>();
    rows.forEach((row) => {
      const key = groupBy === 'hub' ? row.hub_id ?? 'unknown' : row.subcontractor_id ?? 'unknown';
      const current = groups.get(key) ?? [];
      current.push(row);
      groups.set(key, current);
    });

    const data = Array.from(groups.entries()).map(([groupId, groupRows]) => {
      const under = groupRows.filter((row) => row.service_quality_score < threshold);
      const worst = groupRows.slice().sort((a, b) => a.service_quality_score - b.service_quality_score)[0];
      return {
        group_type: groupBy,
        group_id: groupId,
        group_label: groupBy === 'hub' ? (groupId === 'unknown' ? groupId : 'AGP-HUB-01') : (groupId === 'unknown' ? groupId : 'Ruta Sur Express SL'),
        routes_count: groupRows.length,
        routes_under_threshold: under.length,
        under_threshold_ratio: groupRows.length > 0 ? Number(((under.length / groupRows.length) * 100).toFixed(2)) : 0,
        avg_score: groupRows.length > 0 ? Number((groupRows.reduce((acc, row) => acc + row.service_quality_score, 0) / groupRows.length).toFixed(2)) : 0,
        worst_route_id: worst?.scope_id ?? null,
        worst_route_label: worst?.scope_label ?? worst?.scope_id ?? null,
        worst_route_score: worst?.service_quality_score ?? null,
      };
    });

    return {
      data,
      meta: {
        threshold,
        group_by: groupBy,
      },
    };
  },

  async exportQualityCsv(_: {
    scopeType?: 'driver' | 'subcontractor' | 'route';
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  }) {
    return;
  },

  async exportQualityPdf(_: {
    threshold?: number;
    scopeId?: string;
    hubId?: string;
    subcontractorId?: string;
    periodStart?: string;
    periodEnd?: string;
  }) {
    return;
  },

  async getQualityRouteBreakdown(routeId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  } = {}) {
    const rows = await this.getQualitySnapshots({
      scopeType: 'route',
      scopeId: routeId,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
    }) as Array<{
      id: string;
      scope_id: string;
      scope_label?: string;
      hub_id?: string;
      subcontractor_id?: string;
      period_start: string;
      period_end: string;
      service_quality_score: number;
      assigned_with_attempt: number;
      delivered_completed: number;
      pickups_completed: number;
      failed_count?: number;
      absent_count?: number;
      retry_count?: number;
    }>;

    const assigned = rows.reduce((acc, row) => acc + row.assigned_with_attempt, 0);
    const delivered = rows.reduce((acc, row) => acc + row.delivered_completed, 0);
    const pickups = rows.reduce((acc, row) => acc + row.pickups_completed, 0);
    const failed = rows.reduce((acc, row) => acc + (row.failed_count ?? 0), 0);
    const absent = rows.reduce((acc, row) => acc + (row.absent_count ?? 0), 0);
    const retry = rows.reduce((acc, row) => acc + (row.retry_count ?? 0), 0);
    const completed = delivered + pickups;
    const ratio = assigned > 0 ? Number(((completed / assigned) * 100).toFixed(2)) : 0;
    const latest = rows[0];
    const granularity = filters.granularity ?? 'month';

    const periodGroups = rows.reduce((acc, row) => {
      const key = granularity === 'week'
        ? `${row.period_end.slice(0, 4)}-W${String(Math.ceil(Number(row.period_end.slice(8, 10)) / 7)).padStart(2, '0')}`
        : row.period_end.slice(0, 7);
      const current = acc.get(key) ?? [];
      current.push(row);
      acc.set(key, current);
      return acc;
    }, new Map<string, typeof rows>());

    const periods = Array.from(periodGroups.entries()).map(([periodKey, periodRows]) => {
      const periodAssigned = periodRows.reduce((acc, row) => acc + row.assigned_with_attempt, 0);
      const periodDelivered = periodRows.reduce((acc, row) => acc + row.delivered_completed, 0);
      const periodPickups = periodRows.reduce((acc, row) => acc + row.pickups_completed, 0);
      const periodFailed = periodRows.reduce((acc, row) => acc + (row.failed_count ?? 0), 0);
      const periodAbsent = periodRows.reduce((acc, row) => acc + (row.absent_count ?? 0), 0);
      const periodRetry = periodRows.reduce((acc, row) => acc + (row.retry_count ?? 0), 0);
      const periodCompleted = periodDelivered + periodPickups;
      const periodRatio = periodAssigned > 0 ? Number(((periodCompleted / periodAssigned) * 100).toFixed(2)) : 0;
      return {
        period_key: periodKey,
        period_start: periodRows[periodRows.length - 1]?.period_start ?? '',
        period_end: periodRows[0]?.period_end ?? '',
        service_quality_score: periodRatio,
        components: {
          assigned_with_attempt: periodAssigned,
          delivered_completed: periodDelivered,
          pickups_completed: periodPickups,
          failed_count: periodFailed,
          absent_count: periodAbsent,
          retry_count: periodRetry,
          completed_total: periodCompleted,
          completion_ratio: periodRatio,
        },
      };
    });

    return {
      scope_type: 'route',
      scope_id: routeId,
      scope_label: latest?.scope_label ?? routeId,
      route_id: routeId,
      route_code: latest?.scope_label ?? routeId,
      hub_id: latest?.hub_id ?? null,
      subcontractor_id: latest?.subcontractor_id ?? null,
      granularity,
      latest_snapshot_id: latest?.id ?? null,
      latest_period_start: latest?.period_start ?? null,
      latest_period_end: latest?.period_end ?? null,
      snapshots_count: rows.length,
      service_quality_score: ratio,
      periods,
      components: {
        assigned_with_attempt: assigned,
        delivered_completed: delivered,
        pickups_completed: pickups,
        failed_count: failed,
        absent_count: absent,
        retry_count: retry,
        completed_total: completed,
        completion_ratio: ratio,
      },
    };
  },

  async exportQualityRouteBreakdownCsv(_: string, __: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  }) {
    return;
  },

  async exportQualityRouteBreakdownPdf(_: string, __: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  }) {
    return;
  },

  async getQualityDriverBreakdown(driverId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
    hubId?: string;
    subcontractorId?: string;
  } = {}) {
    const rows = await this.getQualitySnapshots({
      scopeType: 'driver',
      scopeId: driverId,
      hubId: filters.hubId,
      subcontractorId: filters.subcontractorId,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
    }) as Array<{
      id: string;
      scope_id: string;
      scope_label?: string;
      hub_id?: string;
      subcontractor_id?: string;
      period_start: string;
      period_end: string;
      assigned_with_attempt: number;
      delivered_completed: number;
      pickups_completed: number;
      failed_count?: number;
      absent_count?: number;
      retry_count?: number;
    }>;

    const assigned = rows.reduce((acc, row) => acc + row.assigned_with_attempt, 0);
    const delivered = rows.reduce((acc, row) => acc + row.delivered_completed, 0);
    const pickups = rows.reduce((acc, row) => acc + row.pickups_completed, 0);
    const failed = rows.reduce((acc, row) => acc + (row.failed_count ?? 0), 0);
    const absent = rows.reduce((acc, row) => acc + (row.absent_count ?? 0), 0);
    const retry = rows.reduce((acc, row) => acc + (row.retry_count ?? 0), 0);
    const completed = delivered + pickups;
    const ratio = assigned > 0 ? Number(((completed / assigned) * 100).toFixed(2)) : 0;
    const granularity = filters.granularity ?? 'month';
    const latest = rows[0];

    return {
      scope_type: 'driver',
      scope_id: driverId,
      scope_label: latest?.scope_label ?? driverId,
      driver_id: driverId,
      driver_code: latest?.scope_label ?? driverId,
      hub_id: latest?.hub_id ?? null,
      subcontractor_id: latest?.subcontractor_id ?? null,
      granularity,
      latest_snapshot_id: latest?.id ?? null,
      latest_period_start: latest?.period_start ?? null,
      latest_period_end: latest?.period_end ?? null,
      snapshots_count: rows.length,
      service_quality_score: ratio,
      periods: [{
        period_key: granularity === 'week' ? '2026-W08' : '2026-02',
        period_start: rows[rows.length - 1]?.period_start ?? '2026-02-01',
        period_end: rows[0]?.period_end ?? '2026-02-28',
        service_quality_score: ratio,
        components: {
          assigned_with_attempt: assigned,
          delivered_completed: delivered,
          pickups_completed: pickups,
          failed_count: failed,
          absent_count: absent,
          retry_count: retry,
          completed_total: completed,
          completion_ratio: ratio,
        },
      }],
      components: {
        assigned_with_attempt: assigned,
        delivered_completed: delivered,
        pickups_completed: pickups,
        failed_count: failed,
        absent_count: absent,
        retry_count: retry,
        completed_total: completed,
        completion_ratio: ratio,
      },
    };
  },

  async exportQualityDriverBreakdownCsv(_: string, __: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
    hubId?: string;
    subcontractorId?: string;
  }) {
    return;
  },

  async exportQualityDriverBreakdownPdf(_: string, __: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
    hubId?: string;
    subcontractorId?: string;
  }) {
    return;
  },

  async getQualitySubcontractorBreakdown(subcontractorId: string, filters: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  } = {}) {
    const rows = await this.getQualitySnapshots({
      scopeType: 'subcontractor',
      scopeId: subcontractorId,
      subcontractorId,
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
    }) as Array<{
      id: string;
      scope_id: string;
      scope_label?: string;
      period_start: string;
      period_end: string;
      assigned_with_attempt: number;
      delivered_completed: number;
      pickups_completed: number;
      failed_count?: number;
      absent_count?: number;
      retry_count?: number;
    }>;

    const assigned = rows.reduce((acc, row) => acc + row.assigned_with_attempt, 0);
    const delivered = rows.reduce((acc, row) => acc + row.delivered_completed, 0);
    const pickups = rows.reduce((acc, row) => acc + row.pickups_completed, 0);
    const failed = rows.reduce((acc, row) => acc + (row.failed_count ?? 0), 0);
    const absent = rows.reduce((acc, row) => acc + (row.absent_count ?? 0), 0);
    const retry = rows.reduce((acc, row) => acc + (row.retry_count ?? 0), 0);
    const completed = delivered + pickups;
    const ratio = assigned > 0 ? Number(((completed / assigned) * 100).toFixed(2)) : 0;
    const granularity = filters.granularity ?? 'month';
    const latest = rows[0];

    return {
      scope_type: 'subcontractor',
      scope_id: subcontractorId,
      scope_label: latest?.scope_label ?? subcontractorId,
      subcontractor_id: subcontractorId,
      subcontractor_code: latest?.scope_label ?? subcontractorId,
      granularity,
      latest_snapshot_id: latest?.id ?? null,
      latest_period_start: latest?.period_start ?? null,
      latest_period_end: latest?.period_end ?? null,
      snapshots_count: rows.length,
      service_quality_score: ratio,
      periods: [{
        period_key: granularity === 'week' ? '2026-W08' : '2026-02',
        period_start: rows[rows.length - 1]?.period_start ?? '2026-02-01',
        period_end: rows[0]?.period_end ?? '2026-02-28',
        service_quality_score: ratio,
        components: {
          assigned_with_attempt: assigned,
          delivered_completed: delivered,
          pickups_completed: pickups,
          failed_count: failed,
          absent_count: absent,
          retry_count: retry,
          completed_total: completed,
          completion_ratio: ratio,
        },
      }],
      components: {
        assigned_with_attempt: assigned,
        delivered_completed: delivered,
        pickups_completed: pickups,
        failed_count: failed,
        absent_count: absent,
        retry_count: retry,
        completed_total: completed,
        completion_ratio: ratio,
      },
    };
  },

  async exportQualitySubcontractorBreakdownCsv(_: string, __: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  }) {
    return;
  },

  async exportQualitySubcontractorBreakdownPdf(_: string, __: {
    periodStart?: string;
    periodEnd?: string;
    granularity?: 'week' | 'month';
  }) {
    return;
  },

  async getIncidents(filters: {
    incidentableType?: 'shipment' | 'pickup';
    incidentableId?: string;
    category?: 'failed' | 'absent' | 'retry' | 'general';
    catalogCode?: string;
    resolved?: 'open' | 'resolved';
  } = {}) {
    return mockIncidents
      .filter((item) => (filters.incidentableType ? item.incidentable_type === filters.incidentableType : true))
      .filter((item) => (filters.incidentableId ? item.incidentable_id === filters.incidentableId : true))
      .filter((item) => (filters.category ? item.category === filters.category : true))
      .filter((item) => (filters.catalogCode ? item.catalog_code === filters.catalogCode : true))
      .filter((item) => {
        if (!filters.resolved) return true;
        if (filters.resolved === 'open') return item.resolved_at === null;
        return item.resolved_at !== null;
      });
  },

  async createIncident(payload: {
    incidentable_type: 'shipment' | 'pickup';
    incidentable_id: string;
    catalog_code: string;
    category: 'failed' | 'absent' | 'retry' | 'general';
    notes?: string;
  }) {
    const item = {
      id: `i-${incidentSeq++}`,
      ...payload,
      resolved_at: null,
    };
    mockIncidents = [item, ...mockIncidents];
    return item;
  },

  async resolveIncident(id: string, notes?: string) {
    const now = new Date().toISOString();
    const target = mockIncidents.find((item) => item.id === id);
    if (!target) {
      return {
        id,
        incidentable_type: 'shipment' as const,
        incidentable_id: '00000000-0000-0000-0000-000000000000',
        catalog_code: 'UNKNOWN',
        category: 'general' as const,
        notes: notes ?? null,
        resolved_at: now,
      };
    }
    const resolved = {
      ...target,
      notes: notes ?? target.notes,
      resolved_at: now,
    };
    mockIncidents = mockIncidents.map((item) => (item.id === id ? resolved : item));
    return resolved;
  },

  async getIncidentCatalog() {
    return [
      { code: 'ABSENT_HOME', name: 'Destinatario ausente', category: 'absent', applies_to: 'shipment' },
      { code: 'RETRY_WINDOW', name: 'Reintento por franja horaria', category: 'retry', applies_to: 'shipment' },
      { code: 'FAILED_ADDRESS', name: 'Direccion invalida', category: 'failed', applies_to: 'shipment' },
      { code: 'PICKUP_CLIENT_NOT_READY', name: 'Cliente no preparado para recogida', category: 'general', applies_to: 'pickup' },
    ];
  },

  async getTariffs() {
    return [
      { id: 't-1', service_type: 'delivery', amount_cents: 250, currency: 'EUR', valid_from: '2026-02-01' },
      { id: 't-2', service_type: 'pickup_normal', amount_cents: 190, currency: 'EUR', valid_from: '2026-02-01' },
      { id: 't-3', service_type: 'pickup_return', amount_cents: 190, currency: 'EUR', valid_from: '2026-02-01' },
    ];
  },

  async createTariff(_: {
    service_type: 'delivery' | 'pickup_normal' | 'pickup_return';
    amount_cents: number;
    currency: string;
    valid_from: string;
    subcontractor_id?: string;
  }) {
    return { id: 't-new' };
  },

  async updateTariff(_: string, __: { amount_cents: number; valid_from?: string; is_active?: boolean }) {
    return;
  },

  async getSettlementPreview(_: { subcontractorId: string; period: string }) {
    return {
      subcontractor: { id: 'sc-1', legal_name: 'Ruta Sur Express SL' },
      period: { label: '2026-02', start: '2026-02-01', end: '2026-02-28' },
      tariffs: { delivery: 250, pickup_normal: 190, pickup_return: 190 },
      totals: { gross_amount_cents: 12950, advances_amount_cents: 5000, net_amount_cents: 7950 },
      lines: [
        { line_type: 'shipment_delivery', source_ref: 'SHP-AGP-0001', line_total_cents: 250, status: 'payable' },
        { line_type: 'pickup_normal', source_ref: 'PCK-AGP-0001', line_total_cents: 190, status: 'payable' },
        { line_type: 'advance_deduction', source_ref: 'ADV-1', line_total_cents: -5000, status: 'payable' },
      ],
    };
  },

  async getSettlements(_: { status?: string; period?: string; subcontractorId?: string }) {
    return [
      {
        id: 'st-1',
        subcontractor_id: 'sc-1',
        subcontractor_name: 'Ruta Sur Express SL',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        status: 'approved',
        gross_amount_cents: 12950,
        advances_amount_cents: 5000,
        net_amount_cents: 7950,
        currency: 'EUR',
      },
    ];
  },

  async getSettlementDetail(_: string) {
    return {
      settlement: {
        id: 'st-1',
        subcontractor_id: 'sc-1',
        subcontractor_name: 'Ruta Sur Express SL',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        status: 'approved',
        gross_amount_cents: 12950,
        advances_amount_cents: 5000,
        net_amount_cents: 7950,
        currency: 'EUR',
      },
      lines: [
        {
          id: 'sl-1',
          line_type: 'shipment_delivery',
          source_ref: 'SHP-AGP-0001',
          status: 'payable',
          line_total_cents: 250,
          exclusion_reason: null,
        },
      ],
    };
  },

  async getSettlementAdjustments(_: string) {
    return [
      {
        id: 'sa-1',
        settlement_id: 'st-1',
        amount_cents: -250,
        currency: 'EUR',
        reason: 'Correccion incidencia',
        status: 'approved',
        rejection_reason: null,
      },
    ];
  },

  async getSettlementReconciliationReasons() {
    return [
      { id: 'sr-1', code: 'NO_POD', name: 'Sin POD valido', is_active: true },
      { id: 'sr-2', code: 'RETRY_NOT_PAYABLE', name: 'Reintento no pagable', is_active: true },
      { id: 'sr-3', code: 'ABSENCE_NOT_PAYABLE', name: 'Ausencia no pagable', is_active: true },
      { id: 'sr-4', code: 'INCIDENT_REVIEW', name: 'Incidencia en revision contable', is_active: true },
      { id: 'sr-5', code: 'MANUAL_AUDIT', name: 'Ajuste manual de auditoria', is_active: true },
    ];
  },

  async getSettlementReconciliationSummary(_: {
    period?: string;
    subcontractorId?: string;
    settlementId?: string;
    hubId?: string;
  }) {
    return [
      { exclusion_code: 'MANUAL_AUDIT', lines_count: 3, excluded_amount_cents: 760 },
      { exclusion_code: 'RETRY_NOT_PAYABLE', lines_count: 2, excluded_amount_cents: 380 },
    ];
  },

  async exportSettlementReconciliationSummaryCsv(_: {
    period?: string;
    subcontractorId?: string;
    settlementId?: string;
    hubId?: string;
  }) {
    return;
  },

  async exportSettlementReconciliationSummaryPdf(_: {
    period?: string;
    subcontractorId?: string;
    settlementId?: string;
    hubId?: string;
  }) {
    return;
  },

  async getSettlementReconciliationTrends(_: {
    granularity?: 'week' | 'month';
    limit?: number;
    period?: string;
    subcontractorId?: string;
    hubId?: string;
  } = {}) {
    return [
      { period_bucket: '2026-02', exclusion_code: 'MANUAL_AUDIT', lines_count: 3, excluded_amount_cents: 760 },
      { period_bucket: '2026-02', exclusion_code: 'RETRY_NOT_PAYABLE', lines_count: 2, excluded_amount_cents: 380 },
      { period_bucket: '2026-01', exclusion_code: 'MANUAL_AUDIT', lines_count: 1, excluded_amount_cents: 250 },
    ];
  },

  async createSettlementAdjustment(_: string, __: { amount_cents: number; reason: string }) {
    return { id: 'sa-new' };
  },

  async previewSettlementRecalculate(
    _: string,
    payload: { manual_adjustments?: Array<{ amount_cents: number; reason: string }> } = {}
  ) {
    const baseGross = 12950;
    const baseAdvances = 5000;
    const adjustments = (payload.manual_adjustments ?? []).reduce((acc, item) => acc + item.amount_cents, 0);
    return {
      settlement: {
        id: 'st-1',
        subcontractor_id: 'sc-1',
        period_start: '2026-02-01',
        period_end: '2026-02-28',
        status: 'draft',
        currency: 'EUR',
      },
      totals: {
        gross_amount_cents: baseGross,
        advances_amount_cents: baseAdvances,
        adjustments_amount_cents: adjustments,
        net_amount_cents: baseGross - baseAdvances + adjustments,
      },
      manual_adjustments: (payload.manual_adjustments ?? []).map((item, index) => ({
        id: `preview-adjustment-${index + 1}`,
        line_type: 'manual_adjustment',
        source_ref: item.reason,
        line_total_cents: item.amount_cents,
        status: 'payable',
        exclusion_reason: null,
      })),
      lines_count: 3 + (payload.manual_adjustments?.length ?? 0),
    };
  },

  async recalculateSettlement(_: string) {
    return;
  },

  async updateSettlementAdjustment(_: string, __: string, ___: { amount_cents?: number; reason?: string }) {
    return;
  },

  async approveSettlementAdjustment(_: string, __: string) {
    return;
  },

  async rejectSettlementAdjustment(_: string, __: string, ___: string) {
    return;
  },

  async reconcileSettlementLine(
    _: string,
    __: string,
    ___: { status: 'payable' | 'excluded'; exclusion_code?: string | null }
  ) {
    return;
  },

  async reconcileSettlementLinesBulk(
    _: string,
    __: {
      status: 'payable' | 'excluded';
      exclusion_code?: string | null;
      line_type?: 'shipment_delivery' | 'pickup_normal' | 'pickup_return' | 'manual_adjustment';
      current_status?: 'payable' | 'excluded';
      route_id?: string;
      subcontractor_id?: string;
      line_ids?: string[];
    }
  ) {
    return { affected_count: 1 };
  },

  async previewReconcileSettlementLinesBulk(
    _: string,
    __: {
      status: 'payable' | 'excluded';
      exclusion_code?: string | null;
      line_type?: 'shipment_delivery' | 'pickup_normal' | 'pickup_return' | 'manual_adjustment';
      current_status?: 'payable' | 'excluded';
      route_id?: string;
      subcontractor_id?: string;
      line_ids?: string[];
    }
  ) {
    return {
      affected_count: 1,
      before_totals: {
        gross_amount_cents: 12950,
        advances_amount_cents: 5000,
        adjustments_amount_cents: -250,
        net_amount_cents: 7700,
      },
      after_totals: {
        gross_amount_cents: 12760,
        advances_amount_cents: 5000,
        adjustments_amount_cents: -250,
        net_amount_cents: 7510,
      },
      filters: {
        line_type: 'pickup_normal',
        current_status: 'payable',
        route_id: null,
        subcontractor_id: null,
        line_ids_count: 0,
      },
    };
  },

  async exportSettlementCsv(_: string) {
    return;
  },

  async exportSettlementPdf(_: string) {
    return;
  },

  async getSubcontractors(filters: { q?: string; limit?: number }) {
    let rows = [...mockSubcontractors];
    if (filters.q) {
      const q = filters.q.toLowerCase();
      rows = rows.filter((item) => item.legal_name.toLowerCase().includes(q) || (item.tax_id ?? '').toLowerCase().includes(q));
    }
    return rows.slice(0, filters.limit ?? 20);
  },

  async createSubcontractor(payload: {
    legal_name: string;
    tax_id?: string;
    status?: 'active' | 'inactive' | 'suspended';
    payment_terms?: string;
  }) {
    const created = {
      id: `sc-${subcontractorSeq++}`,
      legal_name: payload.legal_name,
      tax_id: payload.tax_id ?? null,
      status: payload.status ?? 'active',
      payment_terms: payload.payment_terms ?? 'monthly',
    };
    mockSubcontractors = [created, ...mockSubcontractors];
    return created;
  },

  async updateSubcontractor(id: string, payload: {
    legal_name?: string;
    tax_id?: string | null;
    status?: 'active' | 'inactive' | 'suspended';
    payment_terms?: string;
  }) {
    const index = mockSubcontractors.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Subcontractor not found');
    mockSubcontractors[index] = {
      ...mockSubcontractors[index],
      ...payload,
    };
    return mockSubcontractors[index];
  },

  async getDrivers(filters: { subcontractorId?: string; status?: string; limit?: number }) {
    let rows = [...mockDrivers];
    if (filters.subcontractorId) {
      rows = rows.filter((item) => item.subcontractor_id === filters.subcontractorId);
    }
    if (filters.status) {
      rows = rows.filter((item) => item.status === filters.status);
    }
    return rows.slice(0, filters.limit ?? 50).map((item) => ({
      ...item,
      subcontractor_name: mockSubcontractors.find((sub) => sub.id === item.subcontractor_id)?.legal_name ?? null,
    }));
  },

  async createDriver(payload: {
    code: string;
    name: string;
    status?: 'active' | 'inactive' | 'suspended';
    employment_type?: 'employee' | 'subcontractor';
    user_id?: string;
    subcontractor_id?: string;
    home_hub_id?: string;
  }) {
    const created = {
      id: `drv-${driverSeq++}`,
      code: payload.code,
      name: payload.name,
      status: payload.status ?? 'active',
      employment_type: payload.employment_type ?? 'subcontractor',
      user_id: payload.user_id ?? null,
      subcontractor_id: payload.subcontractor_id ?? null,
      home_hub_id: payload.home_hub_id ?? null,
    };
    mockDrivers = [created, ...mockDrivers];
    return created;
  },

  async updateDriver(id: string, payload: {
    name?: string;
    status?: 'active' | 'inactive' | 'suspended';
    employment_type?: 'employee' | 'subcontractor';
    user_id?: string | null;
    subcontractor_id?: string | null;
    home_hub_id?: string | null;
  }) {
    const index = mockDrivers.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Driver not found');
    mockDrivers[index] = {
      ...mockDrivers[index],
      ...payload,
    };
    return mockDrivers[index];
  },

  async getVehicles(filters: { subcontractorId?: string; status?: string; limit?: number }) {
    let rows = [...mockVehicles];
    if (filters.subcontractorId) {
      rows = rows.filter((item) => item.subcontractor_id === filters.subcontractorId);
    }
    if (filters.status) {
      rows = rows.filter((item) => item.status === filters.status);
    }
    return rows.slice(0, filters.limit ?? 50).map((item) => ({
      ...item,
      subcontractor_name: mockSubcontractors.find((sub) => sub.id === item.subcontractor_id)?.legal_name ?? null,
      assigned_driver_code: mockDrivers.find((driver) => driver.id === item.assigned_driver_id)?.code ?? null,
    }));
  },

  async createVehicle(payload: {
    code: string;
    plate_number?: string;
    vehicle_type?: string;
    capacity_kg?: number;
    status?: 'active' | 'inactive' | 'maintenance';
    subcontractor_id?: string;
    home_hub_id?: string;
    assigned_driver_id?: string;
  }) {
    const created = {
      id: `veh-${vehicleSeq++}`,
      code: payload.code,
      plate_number: payload.plate_number ?? null,
      vehicle_type: payload.vehicle_type ?? 'van',
      capacity_kg: payload.capacity_kg ?? null,
      status: payload.status ?? 'active',
      subcontractor_id: payload.subcontractor_id ?? null,
      home_hub_id: payload.home_hub_id ?? null,
      assigned_driver_id: payload.assigned_driver_id ?? null,
    };
    mockVehicles = [created, ...mockVehicles];
    return created;
  },

  async updateVehicle(id: string, payload: {
    plate_number?: string | null;
    vehicle_type?: string;
    capacity_kg?: number | null;
    status?: 'active' | 'inactive' | 'maintenance';
    subcontractor_id?: string | null;
    home_hub_id?: string | null;
    assigned_driver_id?: string | null;
  }) {
    const index = mockVehicles.findIndex((item) => item.id === id);
    if (index < 0) throw new Error('Vehicle not found');
    mockVehicles[index] = {
      ...mockVehicles[index],
      ...payload,
    };
    return mockVehicles[index];
  },

  async getAdvances(_: { subcontractorId?: string; status?: string; period?: string }) {
    return [
      {
        id: 'a-1',
        subcontractor_id: 'sc-1',
        subcontractor_name: 'Ruta Sur Express SL',
        amount_cents: 5000,
        currency: 'EUR',
        status: 'approved',
        reason: 'Anticipo operativo inicial',
        request_date: '2026-02-03',
        approved_at: '2026-02-03T10:00:00Z',
      },
    ];
  },

  async createAdvance(_: {
    subcontractor_id: string;
    amount_cents: number;
    currency: string;
    request_date: string;
    reason?: string;
  }) {
    return { id: 'a-new' };
  },

  async updateAdvance(_: string, __: { amount_cents?: number; request_date?: string; reason?: string }) {
    return;
  },

  async approveAdvance(_: string) {
    return;
  },

  async exportAdvancesCsv(_: { subcontractorId?: string; status?: string; period?: string }) {
    return;
  },
};

<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class RbacSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            'super_admin',
            'operations_manager',
            'traffic_operator',
            'warehouse_operator',
            'accountant',
            'driver',
            'viewer',
        ];

        $permissions = [
            'auth.login', 'auth.logout', 'auth.refresh',
            'users.read', 'users.create', 'users.update', 'users.suspend',
            'roles.read', 'roles.assign', 'audit.read',
            'shipments.read', 'shipments.write', 'shipments.export', 'shipments.import',
            'routes.read', 'routes.write',
            'pickups.read', 'pickups.write',
            'tracking.write', 'pods.write', 'incidents.read', 'incidents.write',
            'quality.read', 'quality.read.dashboard', 'quality.recalculate', 'quality.export',
            'tariffs.read', 'tariffs.write',
            'settlements.read', 'settlements.write', 'settlements.approve', 'settlements.export', 'settlements.pay',
            'advances.read', 'advances.write',
        ];

        foreach ($roles as $role) {
            DB::table('roles')->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'code' => $role,
                'name' => ucwords(str_replace('_', ' ', $role)),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        foreach ($permissions as $permission) {
            DB::table('permissions')->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'code' => $permission,
                'name' => strtoupper($permission),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $roleIds = DB::table('roles')->pluck('id', 'code');
        $permissionIds = DB::table('permissions')->pluck('id', 'code');

        foreach ($permissionIds as $permissionId) {
            DB::table('role_permissions')->insertOrIgnore([
                'role_id' => $roleIds['super_admin'],
                'permission_id' => $permissionId,
            ]);
        }

        $rolePermissionMap = [
            'operations_manager' => [
                'shipments.read', 'shipments.write', 'shipments.export', 'shipments.import', 'routes.read', 'routes.write',
                'pickups.read', 'pickups.write', 'tracking.write', 'pods.write', 'incidents.read', 'incidents.write',
                'quality.read', 'quality.read.dashboard', 'quality.export', 'tariffs.read', 'tariffs.write', 'users.read', 'roles.read',
            ],
            'traffic_operator' => [
                'shipments.read', 'shipments.write', 'shipments.export', 'shipments.import', 'routes.read', 'routes.write',
                'pickups.read', 'pickups.write', 'tracking.write', 'incidents.read', 'incidents.write', 'quality.read', 'quality.read.dashboard', 'tariffs.read',
            ],
            'warehouse_operator' => [
                'shipments.read', 'shipments.write', 'shipments.import', 'routes.read',
                'tracking.write', 'incidents.read', 'incidents.write',
            ],
            'accountant' => [
                'quality.read', 'quality.read.dashboard', 'quality.recalculate', 'quality.export', 'incidents.read',
                'tariffs.read', 'tariffs.write',
                'settlements.read', 'settlements.write', 'settlements.approve', 'settlements.export', 'settlements.pay',
                'advances.read', 'advances.write',
                'users.read', 'roles.read',
                'shipments.export',
            ],
            'driver' => [
                'routes.read', 'shipments.read', 'pickups.read', 'pickups.write', 'tracking.write', 'pods.write', 'incidents.read', 'incidents.write',
            ],
            'viewer' => [
                'routes.read', 'shipments.read', 'quality.read.dashboard', 'incidents.read',
            ],
        ];

        foreach ($rolePermissionMap as $roleCode => $codes) {
            foreach ($codes as $code) {
                DB::table('role_permissions')->insertOrIgnore([
                    'role_id' => $roleIds[$roleCode],
                    'permission_id' => $permissionIds[$code],
                ]);
            }
        }
    }
}

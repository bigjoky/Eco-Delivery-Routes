<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class OperationsSeeder extends Seeder
{
    public function run(): void
    {
        $adminUserId = DB::table('users')->where('email', 'admin@eco.local')->value('id');

        $hubId = (string) Str::uuid();
        DB::table('hubs')->insertOrIgnore([
            'id' => $hubId,
            'code' => 'AGP-HUB-01',
            'name' => 'Hub Malaga Centro',
            'city' => 'Malaga',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $subcontractorId = (string) Str::uuid();
        DB::table('subcontractors')->insertOrIgnore([
            'id' => $subcontractorId,
            'legal_name' => 'Ruta Sur Express SL',
            'tax_id' => 'B00000001',
            'status' => 'active',
            'payment_terms' => 'monthly',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $driverId = (string) Str::uuid();
        DB::table('drivers')->insertOrIgnore([
            'id' => $driverId,
            'user_id' => $adminUserId,
            'subcontractor_id' => $subcontractorId,
            'home_hub_id' => $hubId,
            'employment_type' => 'subcontractor',
            'code' => 'DRV-AGP-001',
            'name' => 'Driver Demo',
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $routeId = (string) Str::uuid();
        DB::table('routes')->insertOrIgnore([
            'id' => $routeId,
            'hub_id' => $hubId,
            'driver_id' => $driverId,
            'subcontractor_id' => $subcontractorId,
            'code' => 'R-AGP-' . now()->format('Ymd'),
            'route_date' => now()->toDateString(),
            'status' => 'in_progress',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $shipmentId = (string) Str::uuid();
        DB::table('shipments')->insertOrIgnore([
            'id' => $shipmentId,
            'hub_id' => $hubId,
            'route_id' => $routeId,
            'assigned_driver_id' => $driverId,
            'subcontractor_id' => $subcontractorId,
            'reference' => 'SHP-AGP-0001',
            'service_type' => 'delivery',
            'status' => 'out_for_delivery',
            'consignee_name' => 'Cliente Demo',
            'address_line' => 'Calle Larios 1, Malaga',
            'scheduled_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('parcels')->insertOrIgnore([
            'id' => (string) Str::uuid(),
            'shipment_id' => $shipmentId,
            'barcode' => 'PKG-AGP-0001',
            'weight_grams' => 2200,
            'status' => 'loaded',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $pickupId = (string) Str::uuid();
        DB::table('pickups')->insertOrIgnore([
            'id' => $pickupId,
            'hub_id' => $hubId,
            'route_id' => $routeId,
            'driver_id' => $driverId,
            'subcontractor_id' => $subcontractorId,
            'reference' => 'PCK-AGP-0001',
            'pickup_type' => 'NORMAL',
            'status' => 'planned',
            'requester_name' => 'Comercio Demo',
            'address_line' => 'Av. Andalucia 10, Malaga',
            'scheduled_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('route_stops')->insertOrIgnore([
            'id' => (string) Str::uuid(),
            'route_id' => $routeId,
            'sequence' => 1,
            'stop_type' => 'DELIVERY',
            'shipment_id' => $shipmentId,
            'status' => 'in_progress',
            'planned_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('route_stops')->insertOrIgnore([
            'id' => (string) Str::uuid(),
            'route_id' => $routeId,
            'sequence' => 2,
            'stop_type' => 'PICKUP',
            'pickup_id' => $pickupId,
            'status' => 'planned',
            'planned_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}

<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class IncidentCatalogSeeder extends Seeder
{
    public function run(): void
    {
        $versionId = (string) Str::uuid();

        DB::table('incident_catalog_versions')->insertOrIgnore([
            'id' => $versionId,
            'version' => 'v1',
            'name' => 'Catalogo Inicial Express',
            'is_active' => true,
            'active_from' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $items = [
            ['code' => 'ABSENT_HOME', 'name' => 'Destinatario ausente', 'category' => 'absent', 'applies_to' => 'shipment'],
            ['code' => 'RETRY_WINDOW', 'name' => 'Reintento por franja horaria', 'category' => 'retry', 'applies_to' => 'shipment'],
            ['code' => 'FAILED_ADDRESS', 'name' => 'Direccion invalida', 'category' => 'failed', 'applies_to' => 'shipment'],
            ['code' => 'PICKUP_CLIENT_NOT_READY', 'name' => 'Cliente no preparado para recogida', 'category' => 'general', 'applies_to' => 'pickup'],
        ];

        foreach ($items as $item) {
            DB::table('incident_catalog_items')->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'version_id' => $versionId,
                'code' => $item['code'],
                'name' => $item['name'],
                'category' => $item['category'],
                'applies_to' => $item['applies_to'],
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}

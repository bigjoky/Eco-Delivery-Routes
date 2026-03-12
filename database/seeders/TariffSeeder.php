<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TariffSeeder extends Seeder
{
    public function run(): void
    {
        $hubId = DB::table('hubs')->where('code', 'AGP-HUB-01')->value('id');
        $subcontractorId = DB::table('subcontractors')->where('legal_name', 'Ruta Sur Express SL')->value('id');

        if (!$hubId || !$subcontractorId) {
            return;
        }

        $rows = [
            ['service_type' => 'delivery', 'amount_cents' => 250],
            ['service_type' => 'pickup_normal', 'amount_cents' => 190],
            ['service_type' => 'pickup_return', 'amount_cents' => 190],
        ];

        foreach ($rows as $row) {
            DB::table('tariffs')->insertOrIgnore([
                'id' => (string) Str::uuid(),
                'hub_id' => $hubId,
                'subcontractor_id' => $subcontractorId,
                'service_type' => $row['service_type'],
                'amount_cents' => $row['amount_cents'],
                'currency' => 'EUR',
                'valid_from' => now()->startOfMonth()->toDateString(),
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}

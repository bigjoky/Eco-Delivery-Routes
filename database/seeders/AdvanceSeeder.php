<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdvanceSeeder extends Seeder
{
    public function run(): void
    {
        $subcontractorId = DB::table('subcontractors')->where('legal_name', 'Ruta Sur Express SL')->value('id');

        if (!$subcontractorId) {
            return;
        }

        DB::table('advances')->insertOrIgnore([
            'id' => (string) Str::uuid(),
            'subcontractor_id' => $subcontractorId,
            'amount_cents' => 5000,
            'currency' => 'EUR',
            'status' => 'approved',
            'reason' => 'Anticipo operativo inicial',
            'request_date' => now()->startOfMonth()->toDateString(),
            'approved_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}

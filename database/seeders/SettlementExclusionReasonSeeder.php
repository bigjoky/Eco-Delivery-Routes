<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class SettlementExclusionReasonSeeder extends Seeder
{
    public function run(): void
    {
        $items = [
            ['code' => 'NO_POD', 'name' => 'Sin POD valido'],
            ['code' => 'RETRY_NOT_PAYABLE', 'name' => 'Reintento no pagable'],
            ['code' => 'ABSENCE_NOT_PAYABLE', 'name' => 'Ausencia no pagable'],
            ['code' => 'INCIDENT_REVIEW', 'name' => 'Incidencia en revision contable'],
            ['code' => 'MANUAL_AUDIT', 'name' => 'Ajuste manual de auditoria'],
        ];

        foreach ($items as $item) {
            DB::table('settlement_exclusion_reasons')->updateOrInsert(
                ['code' => $item['code']],
                [
                    'id' => (string) Str::uuid(),
                    'name' => $item['name'],
                    'is_active' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }
    }
}


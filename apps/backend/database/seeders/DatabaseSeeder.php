<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RbacSeeder::class,
            AdminUserSeeder::class,
            TvMonitorUserSeeder::class,
            OperationsSeeder::class,
            IncidentCatalogSeeder::class,
            TariffSeeder::class,
            AdvanceSeeder::class,
        ]);
    }
}

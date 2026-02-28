<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MalagaStagingSeeder extends Seeder
{
    public function run(): void
    {
        $hubs = [
            ['code' => 'AGP-HUB-01', 'name' => 'Hub Malaga Centro', 'city' => 'Malaga'],
            ['code' => 'AGP-HUB-02', 'name' => 'Hub Malaga Oeste', 'city' => 'Malaga'],
        ];
        foreach ($hubs as $hub) {
            DB::table('hubs')->updateOrInsert(
                ['code' => $hub['code']],
                [
                    'id' => (string) (DB::table('hubs')->where('code', $hub['code'])->value('id') ?? Str::uuid()),
                    'name' => $hub['name'],
                    'city' => $hub['city'],
                    'is_active' => true,
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        $hubCentroId = (string) DB::table('hubs')->where('code', 'AGP-HUB-01')->value('id');
        $hubOesteId = (string) DB::table('hubs')->where('code', 'AGP-HUB-02')->value('id');

        $subcontractors = [
            ['legal_name' => 'Ruta Sur Express SL', 'tax_id' => 'B00000001'],
            ['legal_name' => 'Costa Courier Logistic SL', 'tax_id' => 'B00000077'],
        ];
        foreach ($subcontractors as $subcontractor) {
            DB::table('subcontractors')->updateOrInsert(
                ['legal_name' => $subcontractor['legal_name']],
                [
                    'id' => (string) (DB::table('subcontractors')->where('legal_name', $subcontractor['legal_name'])->value('id') ?? Str::uuid()),
                    'tax_id' => $subcontractor['tax_id'],
                    'status' => 'active',
                    'payment_terms' => 'monthly',
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        $rutaSurId = (string) DB::table('subcontractors')->where('legal_name', 'Ruta Sur Express SL')->value('id');
        $costaCourierId = (string) DB::table('subcontractors')->where('legal_name', 'Costa Courier Logistic SL')->value('id');

        $users = [
            ['email' => 'trafico.malaga@eco.local', 'name' => 'Trafico Malaga', 'status' => 'active', 'role' => 'traffic_operator'],
            ['email' => 'almacen.malaga@eco.local', 'name' => 'Almacen Malaga', 'status' => 'active', 'role' => 'warehouse_operator'],
            ['email' => 'contabilidad.malaga@eco.local', 'name' => 'Contabilidad Malaga', 'status' => 'active', 'role' => 'accountant'],
            ['email' => 'driver.rutasur@eco.local', 'name' => 'Driver Ruta Sur', 'status' => 'active', 'role' => 'driver'],
            ['email' => 'driver.costacourier@eco.local', 'name' => 'Driver Costa Courier', 'status' => 'active', 'role' => 'driver'],
        ];

        foreach ($users as $entry) {
            $user = User::query()->updateOrCreate(
                ['email' => $entry['email']],
                ['name' => $entry['name'], 'password' => 'password123', 'status' => $entry['status']]
            );
            $roleId = DB::table('roles')->where('code', $entry['role'])->value('id');
            if ($roleId) {
                DB::table('user_roles')->updateOrInsert(['user_id' => $user->id, 'role_id' => $roleId]);
            }
        }

        $driverRutaSurUserId = (string) DB::table('users')->where('email', 'driver.rutasur@eco.local')->value('id');
        $driverCostaUserId = (string) DB::table('users')->where('email', 'driver.costacourier@eco.local')->value('id');

        $drivers = [
            ['code' => 'DRV-AGP-201', 'name' => 'Driver Ruta Sur', 'user_id' => $driverRutaSurUserId, 'subcontractor_id' => $rutaSurId, 'home_hub_id' => $hubCentroId],
            ['code' => 'DRV-AGP-202', 'name' => 'Driver Costa Courier', 'user_id' => $driverCostaUserId, 'subcontractor_id' => $costaCourierId, 'home_hub_id' => $hubOesteId],
        ];
        foreach ($drivers as $driver) {
            DB::table('drivers')->updateOrInsert(
                ['code' => $driver['code']],
                [
                    'id' => (string) (DB::table('drivers')->where('code', $driver['code'])->value('id') ?? Str::uuid()),
                    'user_id' => $driver['user_id'],
                    'subcontractor_id' => $driver['subcontractor_id'],
                    'home_hub_id' => $driver['home_hub_id'],
                    'employment_type' => 'subcontractor',
                    'name' => $driver['name'],
                    'status' => 'active',
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        $driverRutaSurId = (string) DB::table('drivers')->where('code', 'DRV-AGP-201')->value('id');
        $driverCostaId = (string) DB::table('drivers')->where('code', 'DRV-AGP-202')->value('id');

        $routes = [
            ['code' => 'R-AGP-CENTRO-' . now()->format('Ymd'), 'hub_id' => $hubCentroId, 'driver_id' => $driverRutaSurId, 'subcontractor_id' => $rutaSurId],
            ['code' => 'R-AGP-OESTE-' . now()->format('Ymd'), 'hub_id' => $hubOesteId, 'driver_id' => $driverCostaId, 'subcontractor_id' => $costaCourierId],
        ];
        foreach ($routes as $route) {
            DB::table('routes')->updateOrInsert(
                ['code' => $route['code']],
                [
                    'id' => (string) (DB::table('routes')->where('code', $route['code'])->value('id') ?? Str::uuid()),
                    'hub_id' => $route['hub_id'],
                    'driver_id' => $route['driver_id'],
                    'subcontractor_id' => $route['subcontractor_id'],
                    'route_date' => now()->toDateString(),
                    'status' => 'planned',
                    'updated_at' => now(),
                    'created_at' => now(),
                ]
            );
        }

        $tariffRows = [
            ['hub_id' => $hubCentroId, 'subcontractor_id' => $rutaSurId, 'delivery' => 265, 'pickup_normal' => 190, 'pickup_return' => 190],
            ['hub_id' => $hubOesteId, 'subcontractor_id' => $costaCourierId, 'delivery' => 280, 'pickup_normal' => 195, 'pickup_return' => 205],
        ];
        foreach ($tariffRows as $row) {
            foreach (['delivery', 'pickup_normal', 'pickup_return'] as $serviceType) {
                DB::table('tariffs')->updateOrInsert(
                    [
                        'hub_id' => $row['hub_id'],
                        'subcontractor_id' => $row['subcontractor_id'],
                        'service_type' => $serviceType,
                        'valid_from' => now()->startOfMonth()->toDateString(),
                    ],
                    [
                        'id' => (string) (DB::table('tariffs')
                            ->where('hub_id', $row['hub_id'])
                            ->where('subcontractor_id', $row['subcontractor_id'])
                            ->where('service_type', $serviceType)
                            ->where('valid_from', now()->startOfMonth()->toDateString())
                            ->value('id') ?? Str::uuid()),
                        'amount_cents' => $row[$serviceType],
                        'currency' => 'EUR',
                        'is_active' => true,
                        'updated_at' => now(),
                        'created_at' => now(),
                    ]
                );
            }
        }
    }
}

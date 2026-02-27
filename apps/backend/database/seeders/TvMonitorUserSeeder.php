<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class TvMonitorUserSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->updateOrCreate(
            ['email' => 'tv-monitor@eco.local'],
            [
                'name' => 'TV Monitor Service',
                'password' => 'change-me-tv-monitor',
                'status' => 'active',
            ]
        );

        $roleId = DB::table('roles')->where('code', 'viewer')->value('id');
        if ($roleId) {
            DB::table('user_roles')->updateOrInsert([
                'user_id' => $user->id,
                'role_id' => $roleId,
            ]);
        }
    }
}

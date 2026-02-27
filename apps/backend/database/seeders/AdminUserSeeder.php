<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $user = User::query()->updateOrCreate(
            ['email' => 'admin@eco.local'],
            [
                'name' => 'Super Admin',
                'password' => 'password123',
                'status' => 'active',
            ]
        );

        $roleId = DB::table('roles')->where('code', 'super_admin')->value('id');

        if ($roleId) {
            DB::table('user_roles')->updateOrInsert([
                'user_id' => $user->id,
                'role_id' => $roleId,
            ]);
        }
    }
}

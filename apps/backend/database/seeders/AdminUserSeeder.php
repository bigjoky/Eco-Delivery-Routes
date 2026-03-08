<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $email = (string) env('SUPER_ADMIN_EMAIL', 'admin@eco.local');
        $name = (string) env('SUPER_ADMIN_NAME', 'Super Admin');
        $password = (string) env('SUPER_ADMIN_PASSWORD', 'ChangeMe123!');

        $user = User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => $password,
                'status' => 'active',
                'email_verified_at' => now(),
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

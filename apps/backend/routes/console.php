<?php

use App\Models\User;
use Database\Seeders\RbacSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

Artisan::command('app:health', function () {
    $this->info('Eco Delivery Routes API is healthy.');
});

Artisan::command('app:rbac:sync', function () {
    $this->call(RbacSeeder::class);
    $roles = DB::table('roles')->count();
    $permissions = DB::table('permissions')->count();
    $this->info("RBAC synced. roles={$roles}, permissions={$permissions}");
})->purpose('Sincroniza roles y permisos base del sistema.');

Artisan::command('app:super-admin
    {--name= : Nombre del superadministrador}
    {--email= : Email del superadministrador}
    {--password= : Password del superadministrador}
    {--force-password : Fuerza actualización de contraseña si el usuario ya existe}', function () {
    $this->call('app:rbac:sync');

    $name = (string) ($this->option('name') ?: env('SUPER_ADMIN_NAME', 'Super Administrador'));
    $email = (string) ($this->option('email') ?: env('SUPER_ADMIN_EMAIL', 'admin@eco.local'));
    $password = (string) ($this->option('password') ?: env('SUPER_ADMIN_PASSWORD', 'ChangeMe123!'));
    $forcePassword = (bool) $this->option('force-password');

    if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $this->error('Email inválido.');
        return self::FAILURE;
    }
    if (strlen($password) < 8) {
        $this->error('Password demasiado corto (mínimo 8 caracteres).');
        return self::FAILURE;
    }

    $existing = User::query()->where('email', $email)->first();
    if ($existing) {
        $existing->name = $name;
        $existing->status = 'active';
        if ($forcePassword) {
            $existing->password = $password;
        }
        $existing->save();
        $user = $existing;
        $this->info("Superadmin actualizado: {$email}");
    } else {
        $user = User::query()->create([
            'id' => (string) Str::uuid(),
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'status' => 'active',
            'email_verified_at' => now(),
        ]);
        $this->info("Superadmin creado: {$email}");
    }

    $roleId = DB::table('roles')->where('code', 'super_admin')->value('id');
    if (! $roleId) {
        $this->error('No existe el rol super_admin. Ejecuta app:rbac:sync.');
        return self::FAILURE;
    }

    DB::table('user_roles')->updateOrInsert([
        'user_id' => $user->id,
        'role_id' => $roleId,
    ]);

    $this->info('Rol super_admin asignado correctamente.');
    return self::SUCCESS;
})->purpose('Crea o actualiza el usuario superadministrador con permisos absolutos.');

<?php

namespace App\Providers;

use App\Models\User;
use App\Policies\UserPolicy;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends ServiceProvider
{
    protected $policies = [
        User::class => UserPolicy::class,
    ];

    public function boot(): void
    {
        $this->registerPolicies();

        Gate::define('shipments.export', static function (User $user): bool {
            return $user->hasPermission('shipments.export');
        });
        Gate::define('shipments.import', static function (User $user): bool {
            return $user->hasPermission('shipments.import');
        });
    }
}

<?php

namespace App\Application\Auth;

use App\Domain\Auth\AuthTokenData;
use App\Infrastructure\Auth\AuditLogWriter;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

final class LoginAction
{
    public function __construct(private readonly AuditLogWriter $audit)
    {
    }

    /**
     * @return array{user: User, token: AuthTokenData}|null
     */
    public function execute(string $email, string $password, ?string $deviceName, ?string $ip): ?array
    {
        /** @var User|null $user */
        $user = User::query()->where('email', $email)->first();

        if (!$user || !Hash::check($password, $user->password) || $user->status !== 'active') {
            $this->audit->write($user?->id, 'auth.login.failed', [
                'email' => $email,
                'ip' => $ip,
            ]);
            return null;
        }

        $tokenName = $deviceName ?: 'api-client';
        $token = $user->createToken($tokenName)->plainTextToken;
        $user->forceFill(['last_login_at' => now()])->save();

        $this->audit->write($user->id, 'auth.login.succeeded', [
            'device_name' => $tokenName,
            'ip' => $ip,
        ]);

        return [
            'user' => $user,
            'token' => new AuthTokenData($token),
        ];
    }
}

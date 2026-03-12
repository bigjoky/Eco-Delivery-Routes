<?php

namespace App\Domain\Auth;

final readonly class AuthTokenData
{
    public function __construct(
        public string $token,
        public string $tokenType = 'Bearer'
    ) {
    }
}

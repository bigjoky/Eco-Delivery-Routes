<?php

namespace App\Domain\Users;

final readonly class UserSummaryData
{
    public function __construct(
        public string $id,
        public string $name,
        public string $email,
        public string $status
    ) {
    }
}

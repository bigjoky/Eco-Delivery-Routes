<?php

namespace App\Domain\Roles;

final readonly class RoleSummaryData
{
    public function __construct(
        public string $id,
        public string $code,
        public string $name
    ) {
    }
}

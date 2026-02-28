<?php

namespace App\Domain\Settlements;

final class SettlementStateMachine
{
    public static function canApprove(string $status): bool
    {
        return $status === 'draft';
    }

    public static function canExport(string $status): bool
    {
        return in_array($status, ['approved', 'exported'], true);
    }

    public static function canMarkPaid(string $status): bool
    {
        return in_array($status, ['approved', 'exported'], true);
    }
}

<?php

namespace App\Application\Roles;

use App\Domain\Roles\RoleSummaryData;
use Illuminate\Support\Facades\DB;

final class ListRolesAction
{
    /** @return array<int, RoleSummaryData> */
    public function execute(): array
    {
        return DB::table('roles')
            ->orderBy('name')
            ->get(['id', 'code', 'name'])
            ->map(fn (object $row) => new RoleSummaryData(
                $row->id,
                $row->code,
                $row->name
            ))
            ->all();
    }
}

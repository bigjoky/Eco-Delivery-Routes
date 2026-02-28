<?php

namespace App\Application\Users;

use App\Domain\Users\UserSummaryData;
use App\Models\User;

final class ListUsersAction
{
    /** @return array<int, UserSummaryData> */
    public function execute(): array
    {
        return User::query()
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'status'])
            ->map(fn (User $user) => new UserSummaryData(
                $user->id,
                $user->name,
                $user->email,
                $user->status
            ))
            ->all();
    }
}

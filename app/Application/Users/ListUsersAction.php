<?php

namespace App\Application\Users;

use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

final class ListUsersAction
{
    /**
     * @return array{
     *   data: array<int, array<string,mixed>>,
     *   meta: array{page:int,per_page:int,total:int,last_page:int}
     * }
     */
    public function execute(
        ?string $query = null,
        ?string $status = null,
        string $sort = 'name',
        string $dir = 'asc',
        int $page = 1,
        int $perPage = 20
    ): array
    {
        $safeSort = in_array($sort, ['name', 'email', 'last_login_at', 'created_at'], true) ? $sort : 'name';
        $safeDir = strtolower($dir) === 'desc' ? 'desc' : 'asc';
        $safePerPage = max(1, min($perPage, 100));
        $safePage = max(1, $page);

        $builder = User::query()
            ->with('roles:id,code,name')
            ->select(['id', 'name', 'email', 'status', 'last_login_at', 'created_at']);

        if ($query !== null && trim($query) !== '') {
            $term = trim($query);
            $builder->where(function (Builder $q) use ($term): void {
                $q->where('name', 'like', '%' . $term . '%')
                    ->orWhere('email', 'like', '%' . $term . '%');
            });
        }

        if ($status !== null && in_array($status, ['pending', 'active', 'suspended'], true)) {
            $builder->where('status', $status);
        }

        /** @var LengthAwarePaginator $paginator */
        $paginator = $builder
            ->orderBy($safeSort, $safeDir)
            ->paginate($safePerPage, ['*'], 'page', $safePage);

        /** @var Collection<int,User> $items */
        $items = $paginator->getCollection();
        $data = $items->map(function (User $user): array {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'status' => $user->status,
                'last_login_at' => optional($user->last_login_at)?->toISOString(),
                'roles' => $user->roles->map(fn ($role) => [
                    'id' => $role->id,
                    'code' => $role->code,
                    'name' => $role->name,
                ])->values()->all(),
            ];
        })->values()->all();

        return [
            'data' => $data,
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ];
    }
}

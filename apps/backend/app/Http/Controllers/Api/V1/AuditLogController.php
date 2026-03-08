<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('audit.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $query = $this->buildFilteredQuery($request);

        $perPage = max(1, min((int) $request->query('per_page', 20), 100));
        $page = max(1, (int) $request->query('page', 1));
        $total = (clone $query)->count();
        $rows = $query->offset(($page - 1) * $perPage)->limit($perPage)->get();

        return response()->json([
            'data' => $rows,
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $perPage > 0 ? (int) ceil($total / $perPage) : 0,
            ],
        ]);
    }

    public function exportCsv(Request $request): Response|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('audit.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $rows = $this->buildFilteredQuery($request)->limit(2000)->get();

        $csvRows = [];
        $csvRows[] = 'id,created_at,event,actor_user_id,metadata';
        foreach ($rows as $row) {
            $csvRows[] = implode(',', [
                (string) $row->id,
                $this->csv((string) $row->created_at),
                $this->csv((string) $row->event),
                $this->csv((string) ($row->actor_user_id ?? '')),
                $this->csv((string) ($row->metadata ?? '')),
            ]);
        }

        return response(implode("\n", $csvRows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="audit_logs_export.csv"',
        ]);
    }

    private function buildFilteredQuery(Request $request)
    {
        $query = DB::table('audit_logs')
            ->leftJoin('users', 'users.id', '=', 'audit_logs.actor_user_id')
            ->select(
                'audit_logs.*',
                'users.name as actor_name',
                DB::raw("(select group_concat(roles.code, ',') from user_roles join roles on roles.id = user_roles.role_id where user_roles.user_id = audit_logs.actor_user_id) as actor_roles")
            )
            ->orderByDesc('audit_logs.created_at');

        if ($request->filled('event')) {
            $query->where('event', 'like', (string) $request->query('event') . '%');
        }

        if ($request->filled('actor')) {
            $actor = trim((string) $request->query('actor'));
            $query->where(function ($nested) use ($actor): void {
                $nested->where('users.name', 'like', "%{$actor}%")
                    ->orWhere('audit_logs.actor_user_id', $actor);
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('audit_logs.created_at', '>=', (string) $request->query('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('audit_logs.created_at', '<=', (string) $request->query('date_to'));
        }

        if ($request->filled('resource') && $request->filled('id')) {
            $resource = (string) $request->query('resource');
            $id = (string) $request->query('id');

            if ($resource === 'settlement') {
                $query->whereRaw("json_extract(metadata, '$.settlement_id') = ?", [$id]);
            } elseif ($resource === 'adjustment') {
                $query->whereRaw("json_extract(metadata, '$.adjustment_id') = ?", [$id]);
            } elseif ($resource === 'advance') {
                $query->whereRaw("json_extract(metadata, '$.advance_id') = ?", [$id]);
            } elseif ($resource === 'tariff') {
                $query->whereRaw("json_extract(metadata, '$.tariff_id') = ?", [$id]);
            } elseif ($resource === 'quality_threshold') {
                $query->where('event', 'like', 'quality.threshold.%');
                $query->whereRaw("json_extract(metadata, '$.scope_id') = ?", [$id]);
            } elseif ($resource === 'user') {
                $query->whereRaw("json_extract(metadata, '$.user_id') = ?", [$id]);
            } elseif ($resource === 'role') {
                $query->whereRaw("json_extract(metadata, '$.role_id') = ?", [$id]);
            }
        } elseif ($request->filled('resource')) {
            $resource = (string) $request->query('resource');
            if ($resource === 'quality_threshold') {
                $query->where('event', 'like', 'quality.threshold.%');
            } elseif ($resource === 'user') {
                $query->where('event', 'like', 'user.%');
            } elseif ($resource === 'role') {
                $query->where('event', 'like', 'role.%');
            }
        }

        return $query;
    }

    private function csv(string $value): string
    {
        return '"' . str_replace('"', '""', $value) . '"';
    }
}

<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AdvanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('advances.read')) {
            return $this->forbidden();
        }

        $query = $this->buildFilteredQuery($request);
        $perPage = max(1, min((int) $request->query('per_page', 20), 100));
        $page = max(1, (int) $request->query('page', 1));
        $sort = (string) $request->query('sort', 'request_date');
        $dir = strtolower((string) $request->query('dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSorts = ['request_date', 'created_at', 'amount_cents', 'status'];
        if (!in_array($sort, $allowedSorts, true)) {
            $sort = 'request_date';
        }
        $total = (clone $query)->count();

        return response()->json([
            'data' => $query
                ->orderBy("advances.{$sort}", $dir)
                ->offset(($page - 1) * $perPage)
                ->limit($perPage)
                ->get(),
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
        if (!$actor->hasPermission('advances.read')) {
            return $this->forbidden();
        }

        $rows = $this->buildFilteredQuery($request)->limit(1000)->get();

        $csvRows = [];
        $csvRows[] = 'id,subcontractor_name,request_date,status,amount_cents,currency,reason';
        foreach ($rows as $row) {
            $csvRows[] = implode(',', [
                $this->csvValue((string) $row->id),
                $this->csvValue((string) ($row->subcontractor_name ?? '')),
                $this->csvValue((string) $row->request_date),
                $this->csvValue((string) $row->status),
                (int) $row->amount_cents,
                $this->csvValue((string) $row->currency),
                $this->csvValue((string) ($row->reason ?? '')),
            ]);
        }

        return response(implode("\n", $csvRows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="advances_export.csv"',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('advances.write')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'subcontractor_id' => ['required', 'uuid'],
            'amount_cents' => ['required', 'integer', 'min:1'],
            'currency' => ['required', 'string', 'size:3'],
            'reason' => ['nullable', 'string', 'max:160'],
            'request_date' => ['required', 'date'],
        ]);

        $id = (string) Str::uuid();
        DB::table('advances')->insert([
            'id' => $id,
            'subcontractor_id' => $payload['subcontractor_id'],
            'amount_cents' => (int) $payload['amount_cents'],
            'currency' => strtoupper((string) $payload['currency']),
            'status' => 'requested',
            'reason' => $payload['reason'] ?? null,
            'request_date' => $payload['request_date'],
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'advance.created',
            'metadata' => json_encode(['advance_id' => $id, 'subcontractor_id' => $payload['subcontractor_id']]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('advances')->where('id', $id)->first(),
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('advances.write')) {
            return $this->forbidden();
        }

        $advance = DB::table('advances')->where('id', $id)->first();
        if (!$advance) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Advance not found.'],
            ], 404);
        }

        if ($advance->status !== 'requested') {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Only requested advances can be updated.'],
            ], 422);
        }

        $payload = $request->validate([
            'amount_cents' => ['sometimes', 'integer', 'min:1'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'reason' => ['nullable', 'string', 'max:160'],
            'request_date' => ['sometimes', 'date'],
        ]);

        $update = [];
        if (array_key_exists('amount_cents', $payload)) {
            $update['amount_cents'] = (int) $payload['amount_cents'];
        }
        if (array_key_exists('currency', $payload)) {
            $update['currency'] = strtoupper((string) $payload['currency']);
        }
        if (array_key_exists('reason', $payload)) {
            $update['reason'] = $payload['reason'];
        }
        if (array_key_exists('request_date', $payload)) {
            $update['request_date'] = $payload['request_date'];
        }
        $update['updated_at'] = now();

        $before = [
            'amount_cents' => (int) $advance->amount_cents,
            'currency' => (string) $advance->currency,
            'reason' => $advance->reason,
            'request_date' => (string) $advance->request_date,
        ];
        $after = [
            'amount_cents' => (int) ($update['amount_cents'] ?? $advance->amount_cents),
            'currency' => (string) ($update['currency'] ?? $advance->currency),
            'reason' => $update['reason'] ?? $advance->reason,
            'request_date' => (string) ($update['request_date'] ?? $advance->request_date),
        ];

        DB::table('advances')->where('id', $id)->update($update);

        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'advance.updated',
            'metadata' => json_encode([
                'advance_id' => $id,
                'before' => $before,
                'after' => $after,
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('advances')->where('id', $id)->first(),
        ]);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('advances.write')) {
            return $this->forbidden();
        }

        $advance = DB::table('advances')->where('id', $id)->first();
        if (!$advance) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Advance not found.'],
            ], 404);
        }

        if ($advance->status !== 'requested') {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Only requested advances can be approved.'],
            ], 422);
        }

        DB::table('advances')->where('id', $id)->update([
            'status' => 'approved',
            'approved_at' => now(),
            'approved_by_user_id' => $actor->id,
            'updated_at' => now(),
        ]);

        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'advance.approved',
            'metadata' => json_encode(['advance_id' => $id]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('advances')->where('id', $id)->first(),
            'message' => 'Advance approved.',
        ]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }

    private function buildFilteredQuery(Request $request)
    {
        $query = DB::table('advances')
            ->leftJoin('subcontractors', 'subcontractors.id', '=', 'advances.subcontractor_id')
            ->select('advances.*', 'subcontractors.legal_name as subcontractor_name');

        if ($request->filled('subcontractor_id')) {
            $query->where('advances.subcontractor_id', (string) $request->query('subcontractor_id'));
        }

        if ($request->filled('status')) {
            $query->where('advances.status', (string) $request->query('status'));
        }

        if ($request->filled('period')) {
            $period = (string) $request->query('period');
            if (preg_match('/^\d{4}-\d{2}$/', $period) === 1) {
                $start = $period . '-01';
                $end = date('Y-m-t', strtotime($start));
                $query->whereDate('advances.request_date', '>=', $start)
                    ->whereDate('advances.request_date', '<=', $end);
            }
        }

        return $query;
    }

    private function csvValue(string $value): string
    {
        $escaped = str_replace('"', '""', $value);
        return '"' . $escaped . '"';
    }
}

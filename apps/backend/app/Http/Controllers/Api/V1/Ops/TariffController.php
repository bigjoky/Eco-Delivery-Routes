<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TariffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('tariffs.read')) {
            return $this->forbidden();
        }

        $query = DB::table('tariffs')->orderByDesc('valid_from');

        foreach (['service_type', 'hub_id', 'subcontractor_id'] as $field) {
            $value = $request->query($field);
            if (is_string($value) && $value !== '') {
                $query->where($field, $value);
            }
        }

        return response()->json(['data' => $query->limit(100)->get()]);
    }

    public function current(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('tariffs.read')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'hub_id' => ['nullable', 'uuid'],
            'subcontractor_id' => ['nullable', 'uuid'],
            'on_date' => ['nullable', 'date'],
        ]);

        $onDate = $payload['on_date'] ?? now()->toDateString();

        $query = DB::table('tariffs')
            ->where('is_active', true)
            ->whereDate('valid_from', '<=', $onDate)
            ->where(function ($q) use ($onDate) {
                $q->whereNull('valid_to')->orWhereDate('valid_to', '>=', $onDate);
            });

        if (!empty($payload['hub_id'])) {
            $query->where('hub_id', $payload['hub_id']);
        }

        if (!empty($payload['subcontractor_id'])) {
            $query->where('subcontractor_id', $payload['subcontractor_id']);
        }

        $rows = $query->orderByDesc('valid_from')->get();

        $byServiceType = [];
        foreach ($rows as $row) {
            if (!isset($byServiceType[$row->service_type])) {
                $byServiceType[$row->service_type] = $row;
            }
        }

        return response()->json(['data' => $byServiceType]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('tariffs.write')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'service_type' => ['required', 'in:delivery,pickup_normal,pickup_return'],
            'amount_cents' => ['required', 'integer', 'min:0'],
            'currency' => ['required', 'string', 'size:3'],
            'valid_from' => ['required', 'date'],
            'valid_to' => ['nullable', 'date'],
            'hub_id' => ['nullable', 'uuid'],
            'subcontractor_id' => ['nullable', 'uuid'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $id = (string) Str::uuid();
        DB::table('tariffs')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'] ?? null,
            'subcontractor_id' => $payload['subcontractor_id'] ?? null,
            'service_type' => $payload['service_type'],
            'amount_cents' => $payload['amount_cents'],
            'currency' => strtoupper($payload['currency']),
            'valid_from' => $payload['valid_from'],
            'valid_to' => $payload['valid_to'] ?? null,
            'is_active' => $payload['is_active'] ?? true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'tariff.created',
            'metadata' => json_encode(['tariff_id' => $id, 'service_type' => $payload['service_type']]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('tariffs')->where('id', $id)->first()], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('tariffs.write')) {
            return $this->forbidden();
        }

        $tariff = DB::table('tariffs')->where('id', $id)->first();
        if (!$tariff) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Tariff not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'amount_cents' => ['sometimes', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'valid_from' => ['sometimes', 'date'],
            'valid_to' => ['nullable', 'date'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $candidateValidFrom = (string) ($payload['valid_from'] ?? $tariff->valid_from);
        if ($tariff->subcontractor_id) {
            $hasClosedSettlement = DB::table('settlements')
                ->where('subcontractor_id', $tariff->subcontractor_id)
                ->whereIn('status', ['approved', 'exported', 'paid'])
                ->whereDate('period_start', '<=', $candidateValidFrom)
                ->whereDate('period_end', '>=', $candidateValidFrom)
                ->exists();

            if ($hasClosedSettlement) {
                return response()->json([
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => 'Tariff cannot be edited for a period with closed settlements.',
                    ],
                ], 422);
            }
        }

        $update = [];
        if (array_key_exists('amount_cents', $payload)) {
            $update['amount_cents'] = (int) $payload['amount_cents'];
        }
        if (array_key_exists('currency', $payload)) {
            $update['currency'] = strtoupper((string) $payload['currency']);
        }
        if (array_key_exists('valid_from', $payload)) {
            $update['valid_from'] = $payload['valid_from'];
        }
        if (array_key_exists('valid_to', $payload)) {
            $update['valid_to'] = $payload['valid_to'];
        }
        if (array_key_exists('is_active', $payload)) {
            $update['is_active'] = (bool) $payload['is_active'];
        }
        $update['updated_at'] = now();

        $before = [
            'amount_cents' => (int) $tariff->amount_cents,
            'currency' => (string) $tariff->currency,
            'valid_from' => (string) $tariff->valid_from,
            'valid_to' => $tariff->valid_to,
            'is_active' => (bool) $tariff->is_active,
        ];
        $after = [
            'amount_cents' => (int) ($update['amount_cents'] ?? $tariff->amount_cents),
            'currency' => (string) ($update['currency'] ?? $tariff->currency),
            'valid_from' => (string) ($update['valid_from'] ?? $tariff->valid_from),
            'valid_to' => $update['valid_to'] ?? $tariff->valid_to,
            'is_active' => (bool) ($update['is_active'] ?? $tariff->is_active),
        ];

        DB::table('tariffs')->where('id', $id)->update($update);

        DB::table('audit_logs')->insert([
            'actor_user_id' => $actor->id,
            'event' => 'tariff.updated',
            'metadata' => json_encode([
                'tariff_id' => $id,
                'before' => $before,
                'after' => $after,
            ]),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('tariffs')->where('id', $id)->first(),
        ]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }
}

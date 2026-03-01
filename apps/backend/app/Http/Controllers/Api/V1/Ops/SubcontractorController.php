<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubcontractorController extends Controller
{
    private function canRead(User $actor): bool
    {
        return $actor->hasPermission('settlements.read')
            || $actor->hasPermission('quality.read')
            || $actor->hasPermission('routes.read');
    }

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$this->canRead($actor)) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $limit = max(1, min((int) $request->query('limit', 20), 50));
        $q = trim((string) $request->query('q', ''));

        $query = DB::table('subcontractors')
            ->select('id', 'legal_name', 'tax_id', 'status')
            ->orderBy('legal_name');

        if ($q !== '') {
            $query->where(function ($nested) use ($q): void {
                $nested->where('legal_name', 'like', "%{$q}%")
                    ->orWhere('tax_id', 'like', "%{$q}%");
            });
        }

        return response()->json([
            'data' => $query->limit($limit)->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $request->validate([
            'legal_name' => ['required', 'string', 'max:180'],
            'tax_id' => ['required', 'string', 'max:60', 'unique:subcontractors,tax_id'],
            'status' => ['nullable', 'in:active,inactive,suspended'],
            'payment_terms' => ['nullable', 'string', 'max:80'],
        ]);

        $id = (string) \Illuminate\Support\Str::uuid();
        DB::table('subcontractors')->insert([
            'id' => $id,
            'legal_name' => $payload['legal_name'],
            'tax_id' => $payload['tax_id'] ?? null,
            'status' => $payload['status'] ?? 'active',
            'payment_terms' => $payload['payment_terms'] ?? 'monthly',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('subcontractors')->where('id', $id)->first(),
            'message' => 'Subcontractor created',
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('routes.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $row = DB::table('subcontractors')->where('id', $id)->first();
        if (!$row) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Subcontractor not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'legal_name' => ['sometimes', 'string', 'max:180'],
            'tax_id' => ['sometimes', 'string', 'max:60', 'unique:subcontractors,tax_id,' . $id . ',id'],
            'status' => ['sometimes', 'in:active,inactive,suspended'],
            'payment_terms' => ['sometimes', 'string', 'max:80'],
        ]);

        DB::table('subcontractors')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('subcontractors')->where('id', $id)->first(),
            'message' => 'Subcontractor updated',
        ]);
    }
}

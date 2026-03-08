<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VehicleControlController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.read')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }

        $query = DB::table('vehicle_controls')
            ->leftJoin('vehicles', 'vehicles.id', '=', 'vehicle_controls.vehicle_id')
            ->select('vehicle_controls.*', 'vehicles.code as vehicle_code', 'vehicles.plate_number')
            ->orderByDesc('vehicle_controls.event_date');

        if ($request->filled('vehicle_id')) {
            $query->where('vehicle_controls.vehicle_id', (string) $request->query('vehicle_id'));
        }
        if ($request->filled('control_type')) {
            $query->where('vehicle_controls.control_type', (string) $request->query('control_type'));
        }
        if ($request->filled('date_from')) {
            $query->whereDate('vehicle_controls.event_date', '>=', (string) $request->query('date_from'));
        }
        if ($request->filled('date_to')) {
            $query->whereDate('vehicle_controls.event_date', '<=', (string) $request->query('date_to'));
        }

        return response()->json(['data' => $query->limit(400)->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }

        $payload = $request->validate([
            'vehicle_id' => ['required', 'uuid', 'exists:vehicles,id'],
            'control_type' => ['required', 'in:fuel,insurance,itv,maintenance,other'],
            'event_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date'],
            'amount' => ['nullable', 'numeric', 'between:0,999999.99'],
            'odometer_km' => ['nullable', 'integer', 'min:0'],
            'provider' => ['nullable', 'string', 'max:160'],
            'reference' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $id = (string) Str::uuid();
        DB::table('vehicle_controls')->insert([
            'id' => $id,
            'vehicle_id' => $payload['vehicle_id'],
            'control_type' => $payload['control_type'],
            'event_date' => $payload['event_date'],
            'due_date' => $payload['due_date'] ?? null,
            'amount' => $payload['amount'] ?? null,
            'odometer_km' => $payload['odometer_km'] ?? null,
            'provider' => $payload['provider'] ?? null,
            'reference' => $payload['reference'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'created_by_user_id' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('vehicle_controls')->where('id', $id)->first()], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }
        if (!DB::table('vehicle_controls')->where('id', $id)->exists()) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Vehicle control not found.']], 404);
        }

        $payload = $request->validate([
            'control_type' => ['nullable', 'in:fuel,insurance,itv,maintenance,other'],
            'event_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'amount' => ['nullable', 'numeric', 'between:0,999999.99'],
            'odometer_km' => ['nullable', 'integer', 'min:0'],
            'provider' => ['nullable', 'string', 'max:160'],
            'reference' => ['nullable', 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        if ($payload === []) {
            return response()->json(['data' => DB::table('vehicle_controls')->where('id', $id)->first()]);
        }
        DB::table('vehicle_controls')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);
        return response()->json(['data' => DB::table('vehicle_controls')->where('id', $id)->first()]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }
        if (!DB::table('vehicle_controls')->where('id', $id)->exists()) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Vehicle control not found.']], 404);
        }
        DB::table('vehicle_controls')->where('id', $id)->delete();
        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }
}


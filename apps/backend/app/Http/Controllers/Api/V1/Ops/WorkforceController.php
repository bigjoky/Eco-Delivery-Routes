<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WorkforceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.read')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }

        $query = DB::table('company_employees')
            ->leftJoin('subcontractors', 'subcontractors.id', '=', 'company_employees.subcontractor_id')
            ->select('company_employees.*', 'subcontractors.legal_name as subcontractor_name')
            ->orderByDesc('company_employees.updated_at');

        if ($request->filled('q')) {
            $q = '%' . str_replace('%', '\\%', (string) $request->query('q')) . '%';
            $query->where(function ($inner) use ($q): void {
                $inner->where('company_employees.name', 'like', $q)
                    ->orWhere('company_employees.code', 'like', $q)
                    ->orWhere('company_employees.document_id', 'like', $q)
                    ->orWhere('company_employees.email', 'like', $q);
            });
        }
        if ($request->filled('status')) {
            $query->where('company_employees.status', (string) $request->query('status'));
        }
        if ($request->filled('employment_type')) {
            $query->where('company_employees.employment_type', (string) $request->query('employment_type'));
        }
        if ($request->filled('subcontractor_id')) {
            $query->where('company_employees.subcontractor_id', (string) $request->query('subcontractor_id'));
        }

        return response()->json(['data' => $query->limit(200)->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }

        $payload = $request->validate([
            'code' => ['nullable', 'string', 'max:40', 'unique:company_employees,code'],
            'document_id' => ['required', 'string', 'max:60', 'unique:company_employees,document_id'],
            'name' => ['required', 'string', 'max:160'],
            'employment_type' => ['required', 'in:own,external,contractor'],
            'subcontractor_id' => ['nullable', 'uuid', 'exists:subcontractors,id'],
            'role_title' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:180'],
            'status' => ['nullable', 'in:active,inactive,suspended'],
            'contract_start' => ['nullable', 'date'],
            'contract_end' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $id = (string) Str::uuid();
        DB::table('company_employees')->insert([
            'id' => $id,
            'code' => $payload['code'] ?? null,
            'document_id' => $payload['document_id'],
            'name' => $payload['name'],
            'employment_type' => $payload['employment_type'],
            'subcontractor_id' => $payload['subcontractor_id'] ?? null,
            'role_title' => $payload['role_title'] ?? null,
            'phone' => $payload['phone'] ?? null,
            'email' => $payload['email'] ?? null,
            'status' => $payload['status'] ?? 'active',
            'contract_start' => $payload['contract_start'] ?? null,
            'contract_end' => $payload['contract_end'] ?? null,
            'notes' => $payload['notes'] ?? null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('company_employees')->where('id', $id)->first()], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }
        if (!DB::table('company_employees')->where('id', $id)->exists()) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Employee not found.']], 404);
        }
        $payload = $request->validate([
            'code' => ['nullable', 'string', 'max:40', 'unique:company_employees,code,' . $id . ',id'],
            'document_id' => ['nullable', 'string', 'max:60', 'unique:company_employees,document_id,' . $id . ',id'],
            'name' => ['nullable', 'string', 'max:160'],
            'employment_type' => ['nullable', 'in:own,external,contractor'],
            'subcontractor_id' => ['nullable', 'uuid', 'exists:subcontractors,id'],
            'role_title' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:180'],
            'status' => ['nullable', 'in:active,inactive,suspended'],
            'contract_start' => ['nullable', 'date'],
            'contract_end' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);
        if ($payload === []) {
            return response()->json(['data' => DB::table('company_employees')->where('id', $id)->first()]);
        }
        DB::table('company_employees')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);
        return response()->json(['data' => DB::table('company_employees')->where('id', $id)->first()]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }
        if (!DB::table('company_employees')->where('id', $id)->exists()) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Employee not found.']], 404);
        }
        DB::table('company_employees')->where('id', $id)->delete();
        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }
}


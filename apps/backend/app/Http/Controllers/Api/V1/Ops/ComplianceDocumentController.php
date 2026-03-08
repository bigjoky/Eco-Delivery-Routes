<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ComplianceDocumentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.read')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }

        $query = DB::table('compliance_documents')->orderByDesc('updated_at');
        if ($request->filled('scope_type')) {
            $query->where('scope_type', (string) $request->query('scope_type'));
        }
        if ($request->filled('scope_id')) {
            $query->where('scope_id', (string) $request->query('scope_id'));
        }
        if ($request->filled('document_type')) {
            $query->where('document_type', (string) $request->query('document_type'));
        }
        if ($request->filled('status')) {
            $query->where('status', (string) $request->query('status'));
        }
        if ($request->filled('q')) {
            $q = '%' . str_replace('%', '\\%', (string) $request->query('q')) . '%';
            $query->where(function ($inner) use ($q): void {
                $inner->where('title', 'like', $q)
                    ->orWhere('reference', 'like', $q)
                    ->orWhere('issuer', 'like', $q);
            });
        }
        if ($request->filled('expires_before')) {
            $query->whereDate('expires_at', '<=', (string) $request->query('expires_before'));
        }

        return response()->json(['data' => $query->limit(300)->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }
        $payload = $request->validate([
            'scope_type' => ['required', 'in:company,subcontractor,employee,driver,vehicle,operation'],
            'scope_id' => ['nullable', 'string', 'max:64'],
            'document_type' => ['required', 'in:cae,insurance,itv,contract,training,license,prevention,other'],
            'title' => ['required', 'string', 'max:180'],
            'reference' => ['nullable', 'string', 'max:80'],
            'issuer' => ['nullable', 'string', 'max:160'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date'],
            'status' => ['nullable', 'in:valid,expiring,expired,pending'],
            'file_url' => ['nullable', 'string', 'max:255'],
            'metadata' => ['nullable', 'array'],
        ]);
        $id = (string) Str::uuid();
        DB::table('compliance_documents')->insert([
            'id' => $id,
            'scope_type' => $payload['scope_type'],
            'scope_id' => $payload['scope_id'] ?? null,
            'document_type' => $payload['document_type'],
            'title' => $payload['title'],
            'reference' => $payload['reference'] ?? null,
            'issuer' => $payload['issuer'] ?? null,
            'issued_at' => $payload['issued_at'] ?? null,
            'expires_at' => $payload['expires_at'] ?? null,
            'status' => $payload['status'] ?? 'pending',
            'file_url' => $payload['file_url'] ?? null,
            'metadata' => isset($payload['metadata']) ? json_encode($payload['metadata'], JSON_THROW_ON_ERROR) : null,
            'created_by_user_id' => $actor->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return response()->json(['data' => DB::table('compliance_documents')->where('id', $id)->first()], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }
        if (!DB::table('compliance_documents')->where('id', $id)->exists()) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Document not found.']], 404);
        }
        $payload = $request->validate([
            'scope_type' => ['nullable', 'in:company,subcontractor,employee,driver,vehicle,operation'],
            'scope_id' => ['nullable', 'string', 'max:64'],
            'document_type' => ['nullable', 'in:cae,insurance,itv,contract,training,license,prevention,other'],
            'title' => ['nullable', 'string', 'max:180'],
            'reference' => ['nullable', 'string', 'max:80'],
            'issuer' => ['nullable', 'string', 'max:160'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date'],
            'status' => ['nullable', 'in:valid,expiring,expired,pending'],
            'file_url' => ['nullable', 'string', 'max:255'],
            'metadata' => ['nullable', 'array'],
        ]);
        if ($payload === []) {
            return response()->json(['data' => DB::table('compliance_documents')->where('id', $id)->first()]);
        }
        if (array_key_exists('metadata', $payload)) {
            $payload['metadata'] = $payload['metadata'] !== null
                ? json_encode($payload['metadata'], JSON_THROW_ON_ERROR)
                : null;
        }
        DB::table('compliance_documents')->where('id', $id)->update([
            ...$payload,
            'updated_at' => now(),
        ]);
        return response()->json(['data' => DB::table('compliance_documents')->where('id', $id)->first()]);
    }

    public function destroy(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('partners.write')) {
            return response()->json(['error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.']], 403);
        }
        if (!DB::table('compliance_documents')->where('id', $id)->exists()) {
            return response()->json(['error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Document not found.']], 404);
        }
        DB::table('compliance_documents')->where('id', $id)->delete();
        return response()->json(['data' => ['id' => $id, 'deleted' => true]]);
    }
}


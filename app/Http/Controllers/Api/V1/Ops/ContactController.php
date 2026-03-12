<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Contacts\ContactResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContactController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('contacts.read')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $query = DB::table('contacts');
        $phone = $request->query('phone');
        $email = $request->query('email');
        $documentId = $request->query('document_id');
        $kind = $request->query('kind');
        $limit = max(1, min((int) $request->query('limit', 50), 100));
        $q = $request->query('q');

        $query->select('contacts.*');

        if (is_string($phone) && $phone !== '') {
            $query->where('phone', 'like', '%' . str_replace('%', '\\%', $phone) . '%');
            $query->selectRaw(
                "CASE WHEN REPLACE(COALESCE(phone, ''), ' ', '') = REPLACE(?, ' ', '') THEN 0 ELSE 1 END AS phone_exact_rank",
                [$phone]
            );
        }
        if (is_string($email) && $email !== '') {
            $query->where('email', 'like', '%' . str_replace('%', '\\%', $email) . '%');
        }
        if (is_string($documentId) && $documentId !== '') {
            $query->where('document_id', 'like', '%' . str_replace('%', '\\%', $documentId) . '%');
            $query->selectRaw(
                "CASE WHEN UPPER(COALESCE(document_id, '')) = UPPER(?) THEN 0 ELSE 1 END AS document_exact_rank",
                [$documentId]
            );
        }
        if (is_string($kind) && in_array($kind, ['sender', 'recipient'], true)) {
            $query->where('kind', $kind);
        }
        if (is_string($q) && $q !== '') {
            $like = '%' . str_replace('%', '\\%', $q) . '%';
            $query->where(function ($inner) use ($like) {
                $inner
                    ->where('display_name', 'like', $like)
                    ->orWhere('legal_name', 'like', $like)
                    ->orWhere('document_id', 'like', $like)
                    ->orWhere('phone', 'like', $like)
                    ->orWhere('address_street', 'like', $like)
                    ->orWhere('city', 'like', $like);
            });
        }

        if (is_string($phone) && $phone !== '') {
            $query->orderBy('phone_exact_rank');
        }
        if (is_string($documentId) && $documentId !== '') {
            $query->orderBy('document_exact_rank');
        }

        $rows = $query->orderByDesc('updated_at')->limit($limit)->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request, ContactResolver $resolver): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('contacts.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $payload = $request->validate([
            'kind' => ['required', 'string', 'in:sender,recipient,both'],
            'display_name' => ['nullable', 'string', 'max:180'],
            'legal_name' => ['nullable', 'string', 'max:180'],
            'document_id' => ['nullable', 'string', 'max:60'],
            'phone' => ['nullable', 'string', 'max:40'],
            'phone_alt' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'address_line' => ['nullable', 'string', 'max:220'],
            'address_street_type' => ['nullable', 'string', 'max:40'],
            'address_street' => ['nullable', 'string', 'max:180'],
            'address_number' => ['nullable', 'string', 'max:40'],
            'address_block' => ['nullable', 'string', 'max:40'],
            'address_stair' => ['nullable', 'string', 'max:40'],
            'address_floor' => ['nullable', 'string', 'max:40'],
            'address_door' => ['nullable', 'string', 'max:40'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'city' => ['nullable', 'string', 'max:80'],
            'address_municipality' => ['nullable', 'string', 'max:120'],
            'province' => ['nullable', 'string', 'max:80'],
            'country' => ['nullable', 'string', 'max:80'],
            'address_reference' => ['nullable', 'string', 'max:220'],
            'address_notes' => ['nullable', 'string', 'max:220'],
        ]);

        $resolvedId = $resolver->resolve([
            'user_id' => $actor->id,
            'name' => $payload['display_name'] ?? null,
            'legal_name' => $payload['legal_name'] ?? null,
            'document_id' => $payload['document_id'] ?? null,
            'phone' => $payload['phone'] ?? null,
            'phone_alt' => $payload['phone_alt'] ?? null,
            'email' => $payload['email'] ?? null,
            'address_line' => $payload['address_line'] ?? null,
            'address_street_type' => $payload['address_street_type'] ?? null,
            'address_street' => $payload['address_street'] ?? null,
            'address_number' => $payload['address_number'] ?? null,
            'address_block' => $payload['address_block'] ?? null,
            'address_stair' => $payload['address_stair'] ?? null,
            'address_floor' => $payload['address_floor'] ?? null,
            'address_door' => $payload['address_door'] ?? null,
            'postal_code' => $payload['postal_code'] ?? null,
            'city' => $payload['city'] ?? null,
            'address_municipality' => $payload['address_municipality'] ?? null,
            'province' => $payload['province'] ?? null,
            'country' => $payload['country'] ?? null,
            'address_reference' => $payload['address_reference'] ?? null,
            'address_notes' => $payload['address_notes'] ?? null,
        ], $payload['kind']);

        if ($resolvedId === null) {
            return response()->json([
                'error' => ['code' => 'CONTACT_EMPTY', 'message' => 'At least one contact field is required.'],
            ], 422);
        }

        $contact = DB::table('contacts')->where('id', $resolvedId)->first();

        return response()->json([
            'data' => $contact,
        ], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('contacts.write')) {
            return response()->json([
                'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
            ], 403);
        }

        $contact = DB::table('contacts')->where('id', $id)->first();
        if (!$contact) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Contact not found.'],
            ], 404);
        }

        $payload = $request->validate([
            'display_name' => ['nullable', 'string', 'max:180'],
            'legal_name' => ['nullable', 'string', 'max:180'],
            'document_id' => ['nullable', 'string', 'max:60'],
            'phone' => ['nullable', 'string', 'max:40'],
            'phone_alt' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'address_line' => ['nullable', 'string', 'max:220'],
            'address_street_type' => ['nullable', 'string', 'max:40'],
            'address_street' => ['nullable', 'string', 'max:180'],
            'address_number' => ['nullable', 'string', 'max:40'],
            'address_block' => ['nullable', 'string', 'max:40'],
            'address_stair' => ['nullable', 'string', 'max:40'],
            'address_floor' => ['nullable', 'string', 'max:40'],
            'address_door' => ['nullable', 'string', 'max:40'],
            'postal_code' => ['nullable', 'string', 'max:20'],
            'city' => ['nullable', 'string', 'max:80'],
            'address_municipality' => ['nullable', 'string', 'max:120'],
            'province' => ['nullable', 'string', 'max:80'],
            'country' => ['nullable', 'string', 'max:80'],
            'address_reference' => ['nullable', 'string', 'max:220'],
            'address_notes' => ['nullable', 'string', 'max:220'],
        ]);

        $updates = [];
        foreach ([
            'display_name',
            'legal_name',
            'document_id',
            'phone',
            'phone_alt',
            'email',
            'address_line',
            'address_street_type',
            'address_street',
            'address_number',
            'address_block',
            'address_stair',
            'address_floor',
            'address_door',
            'postal_code',
            'city',
            'address_municipality',
            'province',
            'country',
            'address_reference',
            'address_notes',
        ] as $field) {
            if (array_key_exists($field, $payload)) {
                $updates[$field] = $payload[$field];
            }
        }

        DB::table('contacts')->where('id', $id)->update($updates + ['updated_at' => now()]);

        return response()->json([
            'data' => DB::table('contacts')->where('id', $id)->first(),
        ]);
    }
}

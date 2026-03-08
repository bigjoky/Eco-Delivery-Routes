<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
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
                    ->orWhere('phone', 'like', $like);
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
}

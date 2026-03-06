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
        $q = $request->query('q');

        if (is_string($phone) && $phone !== '') {
            $query->where('phone', 'like', '%' . str_replace('%', '\\%', $phone) . '%');
        }
        if (is_string($email) && $email !== '') {
            $query->where('email', 'like', '%' . str_replace('%', '\\%', $email) . '%');
        }
        if (is_string($documentId) && $documentId !== '') {
            $query->where('document_id', 'like', '%' . str_replace('%', '\\%', $documentId) . '%');
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

        $rows = $query->orderByDesc('updated_at')->limit(50)->get();

        return response()->json(['data' => $rows]);
    }
}

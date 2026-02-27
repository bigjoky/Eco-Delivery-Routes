<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SubcontractorController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('settlements.read')) {
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
}

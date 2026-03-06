<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AddressSuggestionController extends Controller
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

        $q = (string) $request->query('q', '');
        $kind = (string) $request->query('kind', '');
        $city = (string) $request->query('city', '');
        $postalCode = (string) $request->query('postal_code', '');
        $limit = max(1, min((int) $request->query('limit', 10), 25));

        $contactRows = $this->fromContacts($q, $kind, $city, $postalCode, $limit * 2);
        $networkRows = $this->fromNetwork($q, $city, $limit * 2);

        $rows = collect(array_merge($contactRows, $networkRows))
            ->map(function (array $item) use ($q, $city, $postalCode): array {
                $item['_score'] = $this->suggestionScore($item, $q, $city, $postalCode);
                return $item;
            })
            ->sort(function (array $a, array $b): int {
                if (($a['_score'] ?? 0) !== ($b['_score'] ?? 0)) {
                    return ($b['_score'] ?? 0) <=> ($a['_score'] ?? 0);
                }
                if (($a['priority'] ?? 0) !== ($b['priority'] ?? 0)) {
                    return ($a['priority'] ?? 0) <=> ($b['priority'] ?? 0);
                }
                return strtotime((string) ($b['updated_at'] ?? '')) <=> strtotime((string) ($a['updated_at'] ?? ''));
            })
            ->unique(function (array $item): string {
                return implode('|', [
                    $item['address_street'] ?? '',
                    $item['address_number'] ?? '',
                    $item['postal_code'] ?? '',
                    $item['city'] ?? '',
                    $item['province'] ?? '',
                    $item['country'] ?? '',
                ]);
            })
            ->take($limit)
            ->map(function (array $item): array {
                unset($item['_score']);
                return $item;
            })
            ->values()
            ->all();

        return response()->json(['data' => $rows]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fromContacts(string $q, string $kind, string $city, string $postalCode, int $limit): array
    {
        $query = DB::table('contacts')
            ->select([
                DB::raw("'contact' as source"),
                'id as source_id',
                'address_street',
                'address_number',
                'postal_code',
                'city',
                'province',
                DB::raw("COALESCE(country, 'ES') as country"),
                'address_notes',
                'updated_at',
                DB::raw('0 as priority'),
            ])
            ->where(function ($inner) {
                $inner
                    ->whereNotNull('address_street')
                    ->orWhereNotNull('address_line');
            });

        if ($kind !== '' && in_array($kind, ['sender', 'recipient'], true)) {
            $query->where('kind', $kind);
        }
        if ($city !== '') {
            $query->where('city', 'like', '%' . str_replace('%', '\\%', $city) . '%');
        }
        if ($postalCode !== '') {
            $query->where('postal_code', 'like', '%' . str_replace('%', '\\%', $postalCode) . '%');
        }
        if ($q !== '') {
            $like = '%' . str_replace('%', '\\%', $q) . '%';
            $query->where(function ($inner) use ($like) {
                $inner
                    ->where('address_street', 'like', $like)
                    ->orWhere('address_line', 'like', $like)
                    ->orWhere('city', 'like', $like)
                    ->orWhere('postal_code', 'like', $like);
            });
        }

        return $query->orderByDesc('updated_at')->limit($limit)->get()->map(function ($row): array {
            $street = (string) ($row->address_street ?? '');
            if ($street === '' && isset($row->address_line)) {
                $street = (string) $row->address_line;
            }
            return [
                'source' => $row->source,
                'source_id' => (string) $row->source_id,
                'address_street' => $street !== '' ? $street : null,
                'address_number' => $row->address_number,
                'postal_code' => $row->postal_code,
                'city' => $row->city,
                'province' => $row->province,
                'country' => $row->country,
                'address_notes' => $row->address_notes,
                'updated_at' => $row->updated_at,
                'priority' => (int) $row->priority,
            ];
        })->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fromNetwork(string $q, string $city, int $limit): array
    {
        $pointQuery = DB::table('points')
            ->leftJoin('depots', 'depots.id', '=', 'points.depot_id')
            ->select([
                DB::raw("'point' as source"),
                'points.id as source_id',
                DB::raw('COALESCE(points.address_line, points.name) as address_street'),
                DB::raw('NULL as address_number'),
                DB::raw('NULL as postal_code'),
                DB::raw('COALESCE(points.city, depots.city) as city'),
                DB::raw('NULL as province'),
                DB::raw("'ES' as country"),
                DB::raw("COALESCE(depots.code, '') as address_notes"),
                'points.updated_at as updated_at',
                DB::raw('1 as priority'),
            ])
            ->whereNull('points.deleted_at');

        if ($city !== '') {
            $pointQuery->where(function ($inner) use ($city) {
                $inner
                    ->where('points.city', 'like', '%' . str_replace('%', '\\%', $city) . '%')
                    ->orWhere('depots.city', 'like', '%' . str_replace('%', '\\%', $city) . '%');
            });
        }
        if ($q !== '') {
            $like = '%' . str_replace('%', '\\%', $q) . '%';
            $pointQuery->where(function ($inner) use ($like) {
                $inner
                    ->where('points.address_line', 'like', $like)
                    ->orWhere('points.name', 'like', $like)
                    ->orWhere('depots.name', 'like', $like);
            });
        }

        return $pointQuery->orderByDesc('points.updated_at')->limit($limit)->get()->map(function ($row): array {
            return [
                'source' => $row->source,
                'source_id' => (string) $row->source_id,
                'address_street' => $row->address_street,
                'address_number' => null,
                'postal_code' => null,
                'city' => $row->city,
                'province' => null,
                'country' => $row->country,
                'address_notes' => $row->address_notes,
                'updated_at' => $row->updated_at,
                'priority' => (int) $row->priority,
            ];
        })->all();
    }

    /**
     * @param array<string, mixed> $item
     */
    private function suggestionScore(array $item, string $q, string $city, string $postalCode): int
    {
        $score = ($item['source'] ?? '') === 'contact' ? 50 : 20;
        $fields = array_filter([
            strtolower(trim((string) ($item['address_street'] ?? ''))),
            strtolower(trim((string) ($item['city'] ?? ''))),
            strtolower(trim((string) ($item['postal_code'] ?? ''))),
            strtolower(trim((string) ($item['address_notes'] ?? ''))),
        ], static fn (string $value): bool => $value !== '');

        $score += $this->scoreTextMatch($q, $fields, 45, 25, 12);
        $score += $this->scoreTextMatch($city, [strtolower(trim((string) ($item['city'] ?? '')))], 25, 12, 6);
        $score += $this->scoreTextMatch($postalCode, [strtolower(trim((string) ($item['postal_code'] ?? '')))], 25, 12, 6);
        if (!empty($item['address_number'])) {
            $score += 2;
        }

        return $score;
    }

    /**
     * @param array<int, string> $fields
     */
    private function scoreTextMatch(string $term, array $fields, int $exact, int $prefix, int $contains): int
    {
        $needle = strtolower(trim($term));
        if ($needle === '') {
            return 0;
        }
        foreach ($fields as $field) {
            if ($field === $needle) {
                return $exact;
            }
        }
        foreach ($fields as $field) {
            if ($field !== '' && str_starts_with($field, $needle)) {
                return $prefix;
            }
        }
        foreach ($fields as $field) {
            if ($field !== '' && str_contains($field, $needle)) {
                return $contains;
            }
        }

        return 0;
    }
}

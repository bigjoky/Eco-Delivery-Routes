<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use Barryvdh\DomPDF\Facade\Pdf;

class ShipmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.read')) {
            return $this->forbidden();
        }

        $query = $this->baseQueryForActor($actor);
        if ($query === null) {
            return response()->json([
                'data' => [],
                'meta' => [
                    'page' => 1,
                    'per_page' => 20,
                    'total' => 0,
                    'last_page' => 0,
                ],
            ]);
        }
        $this->applyFilters($request, $query);

        $perPage = max(1, min((int) $request->query('per_page', 20), 100));
        $page = max(1, (int) $request->query('page', 1));
        $sort = (string) $request->query('sort', 'created_at');
        $dir = strtolower((string) $request->query('dir', 'desc')) === 'asc' ? 'asc' : 'desc';

        $allowedSorts = ['created_at', 'scheduled_at', 'reference', 'status'];
        if (!in_array($sort, $allowedSorts, true)) {
            $sort = 'created_at';
        }

        $total = (clone $query)->count();
        $rows = $query
            ->orderBy($sort, $dir)
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        return response()->json([
            'data' => $rows,
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'total' => $total,
                'last_page' => $perPage > 0 ? (int) ceil($total / $perPage) : 0,
            ],
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.read')) {
            return $this->forbidden();
        }

        $shipment = DB::table('shipments')->where('id', $id)->first();
        if (!$shipment) {
            return response()->json(['error' => ['message' => 'Shipment not found']], 404);
        }

        if ($actor->hasRole('driver')) {
            $driverId = DB::table('drivers')->where('user_id', $actor->id)->value('id');
            if (!$driverId || $shipment->assigned_driver_id !== $driverId) {
                return response()->json(['error' => ['message' => 'Shipment not found']], 404);
            }
        }

        $trackingEvents = DB::table('tracking_events')
            ->where('trackable_type', 'shipment')
            ->where('trackable_id', $id)
            ->orderBy('occurred_at', 'desc')
            ->get();

        $pods = DB::table('pods')
            ->where('evidenceable_type', 'shipment')
            ->where('evidenceable_id', $id)
            ->orderBy('captured_at', 'desc')
            ->get();

        $incidents = DB::table('incidents')
            ->where('incidentable_type', 'shipment')
            ->where('incidentable_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        $routeStops = DB::table('route_stops')
            ->leftJoin('routes', 'routes.id', '=', 'route_stops.route_id')
            ->where('route_stops.shipment_id', $id)
            ->orderBy('route_stops.sequence')
            ->get([
                'route_stops.id',
                'route_stops.route_id',
                'routes.code as route_code',
                'routes.route_date',
                'route_stops.sequence',
                'route_stops.stop_type',
                'route_stops.status',
                'route_stops.planned_at',
                'route_stops.completed_at',
            ]);

        return response()->json([
            'data' => [
                'shipment' => $shipment,
                'tracking_events' => $trackingEvents,
                'pods' => $pods,
                'incidents' => $incidents,
                'route_stops' => $routeStops,
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.write')) {
            return $this->forbidden();
        }

        $minScheduled = Carbon::now()->subDays(30)->format('Y-m-d H:i:s');
        $maxScheduled = Carbon::now()->addDays(180)->format('Y-m-d H:i:s');
        $payload = $request->validate([
            'hub_id' => ['required', 'uuid'],
            'reference' => ['required', 'string', 'max:60'],
            'consignee_name' => ['nullable', 'string', 'max:120'],
            'address_line' => ['nullable', 'string', 'max:220'],
            'scheduled_at' => ['nullable', 'date', 'after_or_equal:' . $minScheduled, 'before_or_equal:' . $maxScheduled],
        ]);

        $id = (string) Str::uuid();
        DB::table('shipments')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'],
            'reference' => $payload['reference'],
            'consignee_name' => $payload['consignee_name'] ?? null,
            'address_line' => $payload['address_line'] ?? null,
            'scheduled_at' => $payload['scheduled_at'] ?? null,
            'status' => 'created',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'data' => DB::table('shipments')->where('id', $id)->first(),
        ], 201);
    }

    public function exportCsv(Request $request)
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.read')) {
            return $this->forbidden();
        }

        $query = $this->baseQueryForActor($actor);
        if ($query === null) {
            return response('', 200, [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="shipments_export.csv"',
            ]);
        }
        $this->applyFilters($request, $query);

        $sort = (string) $request->query('sort', 'created_at');
        $dir = strtolower((string) $request->query('dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSorts = ['created_at', 'scheduled_at', 'reference', 'status'];
        if (!in_array($sort, $allowedSorts, true)) {
            $sort = 'created_at';
        }

        $rows = $query->orderBy($sort, $dir)->get();

        $allowedColumns = [
            'id',
            'reference',
            'status',
            'consignee_name',
            'address_line',
            'scheduled_at',
            'delivered_at',
            'hub_id',
            'route_id',
            'assigned_driver_id',
            'subcontractor_id',
            'created_at',
        ];
        $requestedColumns = $request->query('columns');
        if (is_string($requestedColumns) && $requestedColumns !== '') {
            $columns = array_values(array_intersect($allowedColumns, array_map('trim', explode(',', $requestedColumns))));
            if ($columns === []) {
                $columns = $allowedColumns;
            }
        } else {
            $columns = $allowedColumns;
        }

        $csvRows = [];
        $csvRows[] = implode(',', $columns);
        foreach ($rows as $row) {
            $line = [];
            foreach ($columns as $column) {
                $value = $row->{$column} ?? '';
                $line[] = $this->csvValue((string) $value);
            }
            $csvRows[] = implode(',', $line);
        }

        return response(implode("\n", $csvRows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="shipments_export.csv"',
        ]);
    }

    public function exportPdf(Request $request)
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.read')) {
            return $this->forbidden();
        }

        $query = $this->baseQueryForActor($actor);
        if ($query === null) {
            $query = DB::table('shipments')->whereRaw('1 = 0');
        }
        $this->applyFilters($request, $query);

        $sort = (string) $request->query('sort', 'created_at');
        $dir = strtolower((string) $request->query('dir', 'desc')) === 'asc' ? 'asc' : 'desc';
        $allowedSorts = ['created_at', 'scheduled_at', 'reference', 'status'];
        if (!in_array($sort, $allowedSorts, true)) {
            $sort = 'created_at';
        }
        $rows = $query->orderBy($sort, $dir)->get();

        $allowedColumns = [
            'reference' => 'Reference',
            'status' => 'Status',
            'consignee_name' => 'Consignee',
            'address_line' => 'Address',
            'scheduled_at' => 'Scheduled',
            'delivered_at' => 'Delivered',
            'hub_id' => 'Hub',
        ];
        $requestedColumns = $request->query('columns');
        if (is_string($requestedColumns) && $requestedColumns !== '') {
            $requested = array_values(array_intersect(array_keys($allowedColumns), array_map('trim', explode(',', $requestedColumns))));
            if ($requested !== []) {
                $allowedColumns = array_intersect_key($allowedColumns, array_flip($requested));
            }
        }

        $html = '<h3>Shipments Export</h3>';
        $html .= '<table width="100%" cellspacing="0" cellpadding="4" border="1">';
        $html .= '<thead><tr>';
        foreach ($allowedColumns as $label) {
            $html .= '<th>' . e($label) . '</th>';
        }
        $html .= '</tr></thead><tbody>';
        foreach ($rows as $row) {
            $html .= '<tr>';
            foreach (array_keys($allowedColumns) as $column) {
                $html .= '<td>' . e((string) ($row->{$column} ?? '')) . '</td>';
            }
            $html .= '</tr>';
        }
        $html .= '</tbody></table>';

        $pdf = Pdf::loadHTML($html)->setPaper('A4', 'landscape');
        return $pdf->download('shipments_export.pdf');
    }

    public function importCsv(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.write')) {
            return $this->forbidden();
        }

        $file = $request->file('file');
        if (!$file || !$file->isValid()) {
            return response()->json(['error' => ['message' => 'Archivo CSV invalido']], 422);
        }

        $dryRun = $request->boolean('dry_run');
        $minScheduled = Carbon::now()->subDays(30);
        $maxScheduled = Carbon::now()->addDays(180);

        $handle = fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            return response()->json(['error' => ['message' => 'No se pudo leer el CSV']], 422);
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            return response()->json(['error' => ['message' => 'CSV sin cabecera']], 422);
        }

        $normalizedHeader = array_map(static fn ($value) => strtolower(trim((string) $value)), $header);
        $requiredHeaders = ['hub_code', 'reference'];
        foreach ($requiredHeaders as $required) {
            if (!in_array($required, $normalizedHeader, true)) {
                fclose($handle);
                return response()->json(['error' => ['message' => "Falta columna requerida: {$required}"]], 422);
            }
        }

        $rows = [];
        $errors = [];
        $seenReferences = [];
        $insertRows = [];
        $rowNumber = 1;

        while (($data = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if ($data === [null] || $data === false) {
                continue;
            }
            $row = [];
            foreach ($normalizedHeader as $index => $column) {
                $row[$column] = isset($data[$index]) ? trim((string) $data[$index]) : '';
            }

            $reference = $row['reference'] ?? '';
            $hubCode = $row['hub_code'] ?? '';
            $scheduledAt = $row['scheduled_at'] ?? '';
            $serviceType = $row['service_type'] ?? 'delivery';

            $rowErrors = [];
            if ($hubCode === '') {
                $rowErrors[] = 'hub_code requerido';
            }
            if ($reference === '') {
                $rowErrors[] = 'reference requerido';
            }

            $hubId = null;
            if ($hubCode !== '') {
                $hubId = DB::table('hubs')->where('code', $hubCode)->value('id');
                if (!$hubId) {
                    $rowErrors[] = 'hub_code no existe';
                }
            }

            if ($reference !== '') {
                if (isset($seenReferences[$reference])) {
                    $rowErrors[] = 'reference duplicada en CSV';
                } else {
                    $seenReferences[$reference] = true;
                }
                if (DB::table('shipments')->where('reference', $reference)->exists()) {
                    $rowErrors[] = 'reference ya existe';
                }
            }

            $scheduledAtValue = null;
            if ($scheduledAt !== '') {
                try {
                    $scheduledAtValue = Carbon::parse($scheduledAt);
                    if ($scheduledAtValue->lt($minScheduled) || $scheduledAtValue->gt($maxScheduled)) {
                        $rowErrors[] = 'scheduled_at fuera de ventana';
                    }
                } catch (\Throwable $e) {
                    $rowErrors[] = 'scheduled_at invalido';
                }
            }

            if ($serviceType === '') {
                $serviceType = 'delivery';
            }

            if ($rowErrors === []) {
                $insertRows[] = [
                    'id' => (string) Str::uuid(),
                    'hub_id' => $hubId,
                    'reference' => $reference,
                    'consignee_name' => $row['consignee_name'] !== '' ? $row['consignee_name'] : null,
                    'address_line' => $row['address_line'] !== '' ? $row['address_line'] : null,
                    'scheduled_at' => $scheduledAtValue?->format('Y-m-d H:i:s'),
                    'service_type' => $serviceType,
                    'status' => 'created',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                $rows[] = [
                    'row' => $rowNumber,
                    'reference' => $reference,
                    'status' => 'ok',
                ];
            } else {
                $errors[] = [
                    'row' => $rowNumber,
                    'reference' => $reference,
                    'status' => 'error',
                    'errors' => $rowErrors,
                ];
            }
        }

        fclose($handle);

        $createdCount = 0;
        if (!$dryRun && $insertRows !== []) {
            DB::table('shipments')->insert($insertRows);
            $createdCount = count($insertRows);
        }

        return response()->json([
            'data' => [
                'dry_run' => $dryRun,
                'created_count' => $dryRun ? 0 : $createdCount,
                'skipped_count' => count($errors),
                'error_count' => count($errors),
                'rows' => array_merge($rows, $errors),
            ],
        ]);
    }

    private function baseQueryForActor(User $actor)
    {
        $query = DB::table('shipments');
        if ($actor->hasRole('driver')) {
            $driverId = DB::table('drivers')->where('user_id', $actor->id)->value('id');
            if (!$driverId) {
                return null;
            }
            $query->where('assigned_driver_id', $driverId);
        }
        return $query;
    }

    private function applyFilters(Request $request, $query): void
    {
        $status = $request->query('status');
        $search = $request->query('q');
        $scheduledFrom = $request->query('scheduled_from');
        $scheduledTo = $request->query('scheduled_to');

        if (is_string($status) && $status !== '') {
            $query->where('status', $status);
        }

        if (is_string($search) && $search !== '') {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $query->where(function ($inner) use ($like): void {
                $inner->where('reference', 'like', $like)
                    ->orWhere('id', 'like', $like)
                    ->orWhere('consignee_name', 'like', $like);
            });
        }

        if (is_string($scheduledFrom) && $scheduledFrom !== '') {
            $query->whereDate('scheduled_at', '>=', $scheduledFrom);
        }
        if (is_string($scheduledTo) && $scheduledTo !== '') {
            $query->whereDate('scheduled_at', '<=', $scheduledTo);
        }
    }

    private function csvValue(string $value): string
    {
        $escaped = str_replace('"', '""', $value);
        return '"' . $escaped . '"';
    }

    public function markDelivered(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.write')) {
            return $this->forbidden();
        }

        $exists = DB::table('shipments')->where('id', $id)->exists();
        if (!$exists) {
            return $this->notFound('Shipment not found.');
        }

        DB::table('shipments')->where('id', $id)->update([
            'status' => 'delivered',
            'delivered_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('shipments')->where('id', $id)->first()]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }

    private function notFound(string $message): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => $message],
        ], 404);
    }
}

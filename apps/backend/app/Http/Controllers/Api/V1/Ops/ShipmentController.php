<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Infrastructure\Auth\AuditLogWriter;
use App\Models\User;
use App\Services\Contacts\ContactResolver;
use App\Services\Shipments\ShipmentImportService;
use App\Services\SequenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Validation\ValidationException;

class ShipmentController extends Controller
{
    public function __construct(
        private readonly AuditLogWriter $auditLogWriter,
        private readonly ShipmentImportService $importService,
        private readonly SequenceService $sequenceService,
        private readonly ContactResolver $contactResolver
    ) {}

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
            'external_reference' => ['nullable', 'string', 'max:80'],
            'consignee_name' => ['required', 'string', 'max:120'],
            'consignee_document_id' => ['required', 'string', 'max:60'],
            'address_line' => ['nullable', 'string', 'max:220'],
            'address_street' => ['required', 'string', 'max:180'],
            'address_number' => ['nullable', 'string', 'max:40'],
            'postal_code' => ['required', 'string', 'max:20', 'regex:/^[0-9A-Za-z -]{4,10}$/'],
            'city' => ['required', 'string', 'max:80'],
            'province' => ['nullable', 'string', 'max:80'],
            'country' => ['required', 'string', 'max:80'],
            'address_notes' => ['nullable', 'string', 'max:220'],
            'consignee_phone' => ['required', 'string', 'max:40', 'regex:/^[+0-9 -]{7,20}$/'],
            'consignee_phone_alt' => ['nullable', 'string', 'max:40', 'regex:/^[+0-9 -]{7,20}$/'],
            'consignee_email' => ['nullable', 'email', 'max:120'],
            'sender_name' => ['nullable', 'string', 'max:120'],
            'sender_legal_name' => ['nullable', 'string', 'max:180'],
            'sender_document_id' => ['required', 'string', 'max:60'],
            'sender_phone' => ['nullable', 'string', 'max:40', 'regex:/^[+0-9 -]{7,20}$/'],
            'sender_phone_alt' => ['nullable', 'string', 'max:40', 'regex:/^[+0-9 -]{7,20}$/'],
            'sender_email' => ['nullable', 'email', 'max:120'],
            'sender_address_line' => ['nullable', 'string', 'max:220'],
            'sender_address_street' => ['required', 'string', 'max:180'],
            'sender_address_number' => ['nullable', 'string', 'max:40'],
            'sender_postal_code' => ['required', 'string', 'max:20', 'regex:/^[0-9A-Za-z -]{4,10}$/'],
            'sender_city' => ['required', 'string', 'max:80'],
            'sender_province' => ['nullable', 'string', 'max:80'],
            'sender_country' => ['required', 'string', 'max:80'],
            'sender_address_notes' => ['nullable', 'string', 'max:220'],
            'scheduled_at' => ['nullable', 'date', 'after_or_equal:' . $minScheduled, 'before_or_equal:' . $maxScheduled],
            'service_type' => ['required', 'in:express_1030,express_1400,express_1900,economy_parcel,business_parcel,thermo_parcel,delivery'],
        ]);
        if (
            $this->normalizeText($payload['sender_name'] ?? null) === null
            && $this->normalizeText($payload['sender_legal_name'] ?? null) === null
        ) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Sender name or legal name is required.'],
            ], 422);
        }

        $id = (string) Str::uuid();
        $reference = (string) $this->sequenceService->next('shipments');
        $addressLine = $this->normalizeText($payload['address_line'] ?? '') ?: $this->composeAddressLine($payload);
        $senderAddressLine = $this->normalizeText($payload['sender_address_line'] ?? '') ?: $this->composeAddressLineWithPrefix($payload, 'sender_');

        $recipientContactId = $this->contactResolver->resolve([
            'name' => $payload['consignee_name'] ?? null,
            'document_id' => $payload['consignee_document_id'] ?? null,
            'phone' => $payload['consignee_phone'] ?? null,
            'phone_alt' => $payload['consignee_phone_alt'] ?? null,
            'email' => $payload['consignee_email'] ?? null,
            'address_line' => $addressLine,
            'address_street' => $payload['address_street'] ?? null,
            'address_number' => $payload['address_number'] ?? null,
            'postal_code' => $payload['postal_code'] ?? null,
            'city' => $payload['city'] ?? null,
            'province' => $payload['province'] ?? null,
            'country' => $payload['country'] ?? null,
            'address_notes' => $payload['address_notes'] ?? null,
        ], 'recipient');

        $senderContactId = $this->contactResolver->resolve([
            'name' => $payload['sender_name'] ?? null,
            'legal_name' => $payload['sender_legal_name'] ?? null,
            'document_id' => $payload['sender_document_id'] ?? null,
            'phone' => $payload['sender_phone'] ?? null,
            'phone_alt' => $payload['sender_phone_alt'] ?? null,
            'email' => $payload['sender_email'] ?? null,
            'address_line' => $senderAddressLine,
            'address_street' => $payload['sender_address_street'] ?? null,
            'address_number' => $payload['sender_address_number'] ?? null,
            'postal_code' => $payload['sender_postal_code'] ?? null,
            'city' => $payload['sender_city'] ?? null,
            'province' => $payload['sender_province'] ?? null,
            'country' => $payload['sender_country'] ?? null,
            'address_notes' => $payload['sender_address_notes'] ?? null,
        ], 'sender');

        DB::table('shipments')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'],
            'sender_contact_id' => $senderContactId,
            'recipient_contact_id' => $recipientContactId,
            'reference' => $reference,
            'external_reference' => $this->normalizeText($payload['external_reference'] ?? null),
            'consignee_name' => $this->normalizeTitle($payload['consignee_name'] ?? null),
            'address_line' => $addressLine,
            'address_street' => $this->normalizeTitle($payload['address_street'] ?? null),
            'address_number' => $this->normalizeText($payload['address_number'] ?? null),
            'postal_code' => $this->normalizeText($payload['postal_code'] ?? null),
            'city' => $this->normalizeTitle($payload['city'] ?? null),
            'province' => $this->normalizeTitle($payload['province'] ?? null),
            'country' => $this->normalizeText($payload['country'] ?? null),
            'address_notes' => $this->normalizeText($payload['address_notes'] ?? null),
            'consignee_phone' => $this->normalizeText($payload['consignee_phone'] ?? null),
            'consignee_email' => $this->normalizeText($payload['consignee_email'] ?? null),
            'scheduled_at' => $payload['scheduled_at'] ?? null,
            'service_type' => $payload['service_type'],
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
            'external_reference',
            'status',
            'consignee_name',
            'address_line',
            'address_street',
            'address_number',
            'postal_code',
            'city',
            'province',
            'country',
            'address_notes',
            'consignee_phone',
            'consignee_email',
            'scheduled_at',
            'delivered_at',
            'hub_id',
            'hub_code',
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

        $this->auditLogWriter->write($actor->id, 'shipments.exported.csv', [
            'filters' => $request->query(),
            'columns' => $columns,
            'rows' => count($rows),
        ]);

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
            'external_reference' => 'External Reference',
            'status' => 'Status',
            'consignee_name' => 'Consignee',
            'address_line' => 'Address',
            'address_street' => 'Street',
            'address_number' => 'Number',
            'postal_code' => 'Postal Code',
            'city' => 'City',
            'province' => 'Province',
            'country' => 'Country',
            'address_notes' => 'Address Notes',
            'consignee_phone' => 'Phone',
            'consignee_email' => 'Email',
            'scheduled_at' => 'Scheduled',
            'delivered_at' => 'Delivered',
            'hub_id' => 'Hub ID',
            'hub_code' => 'Hub Code',
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

        $this->auditLogWriter->write($actor->id, 'shipments.exported.pdf', [
            'filters' => $request->query(),
            'columns' => array_keys($allowedColumns),
            'rows' => count($rows),
        ]);

        $pdf = Pdf::loadHTML($html)->setPaper('A4', 'landscape');
        return $pdf->download('shipments_export.pdf');
    }

    public function templateCsv(Request $request)
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.import')) {
            return $this->forbidden();
        }

        $hubCode = (string) (DB::table('hubs')->value('code') ?? 'HUB-000');
        $rows = [
            'hub_code,external_reference,consignee_name,address_street,address_number,postal_code,city,province,country,address_notes,consignee_phone,consignee_email,scheduled_at,service_type',
            $hubCode . ',REF-CLIENTE-0009,Cliente Demo,Calle Larios,12,29001,Malaga,Malaga,ES,Portal azul,+34950111222,cliente@eco.local,2026-03-05,express_1030',
        ];

        $this->auditLogWriter->write($actor->id, 'shipments.template.downloaded', [
            'hub_code' => $hubCode,
        ]);

        return response(implode("\n", $rows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="shipments_import_template.csv"',
        ]);
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
        $async = $request->boolean('async');
        if ($async && $dryRun) {
            return response()->json(['error' => ['message' => 'dry_run no soportado en modo async']], 422);
        }

        if ($async) {
            $targetDir = 'imports/shipments';
            $filename = (string) Str::uuid() . '.csv';
            $path = $file->storeAs($targetDir, $filename);
            $importId = (string) Str::uuid();

            DB::table('shipments_import_jobs')->insert([
                'id' => $importId,
                'actor_user_id' => $actor->id,
                'status' => 'queued',
                'file_path' => $path,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $this->auditLogWriter->write($actor->id, 'shipments.import.queued', [
                'import_id' => $importId,
                'path' => $path,
            ]);

            \App\Jobs\ImportShipmentsCsvJob::dispatch($importId, $path, $actor->id);

            return response()->json([
                'data' => [
                    'job_dispatched' => true,
                    'import_id' => $importId,
                    'queued_at' => now()->toDateTimeString(),
                ],
            ], 202);
        }

        try {
            $result = $this->importService->importFromCsvPath($file->getRealPath(), $dryRun);
        } catch (\RuntimeException $exception) {
            return response()->json(['error' => ['message' => $exception->getMessage()]], 422);
        }

        $importId = (string) Str::uuid();
        DB::table('shipments_import_jobs')->insert([
            'id' => $importId,
            'actor_user_id' => $actor->id,
            'status' => $dryRun ? 'completed' : 'completed',
            'created_count' => $result['created_count'] ?? 0,
            'error_count' => $result['error_count'] ?? 0,
            'skipped_count' => $result['skipped_count'] ?? 0,
            'warnings' => json_encode($result['warnings'] ?? [], JSON_THROW_ON_ERROR),
            'unknown_columns' => json_encode($result['unknown_columns'] ?? [], JSON_THROW_ON_ERROR),
            'file_path' => 'direct_upload',
            'started_at' => now(),
            'completed_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->auditLogWriter->write($actor->id, 'shipments.imported', [
            'import_id' => $importId,
            'dry_run' => $dryRun,
            'created_count' => $result['created_count'] ?? 0,
            'error_count' => $result['error_count'] ?? 0,
            'warnings' => $result['warnings'] ?? [],
        ]);

        return response()->json(['data' => array_merge($result, ['import_id' => $importId])]);
    }

    public function importStatus(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.import')) {
            return $this->forbidden();
        }

        $row = DB::table('shipments_import_jobs')->where('id', $id)->first();
        if (!$row) {
            return $this->notFound('Import job not found.');
        }

        return response()->json(['data' => $row]);
    }

    public function importIndex(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.import')) {
            return $this->forbidden();
        }

        $perPage = max(1, min((int) $request->query('per_page', 20), 100));
        $page = max(1, (int) $request->query('page', 1));
        $query = DB::table('shipments_import_jobs')->orderByDesc('created_at');
        $total = (clone $query)->count();
        $rows = $query->offset(($page - 1) * $perPage)->limit($perPage)->get();

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

    private function baseQueryForActor(User $actor)
    {
        $query = DB::table('shipments')
            ->leftJoin('hubs', 'hubs.id', '=', 'shipments.hub_id')
            ->select('shipments.*', 'hubs.code as hub_code');
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
        $hubId = $request->query('hub_id');
        $scheduledFrom = $request->query('scheduled_from');
        $scheduledTo = $request->query('scheduled_to');

        if (is_string($status) && $status !== '') {
            $query->where('shipments.status', $status);
        }

        if (is_string($hubId) && $hubId !== '') {
            $query->where('shipments.hub_id', $hubId);
        }

        if (is_string($search) && $search !== '') {
            $like = '%' . str_replace('%', '\\%', $search) . '%';
            $query->where(function ($inner) use ($like): void {
                $inner->where('shipments.reference', 'like', $like)
                    ->orWhere('shipments.external_reference', 'like', $like)
                    ->orWhere('shipments.id', 'like', $like)
                    ->orWhere('shipments.consignee_name', 'like', $like);
            });
        }

        if (is_string($scheduledFrom) && $scheduledFrom !== '') {
            $query->whereDate('shipments.scheduled_at', '>=', $scheduledFrom);
        }
        if (is_string($scheduledTo) && $scheduledTo !== '') {
            $query->whereDate('shipments.scheduled_at', '<=', $scheduledTo);
        }
    }

    private function csvValue(string $value): string
    {
        $escaped = str_replace('"', '""', $value);
        return '"' . $escaped . '"';
    }

    private function composeAddressLine(array $payload): ?string
    {
        $street = $this->normalizeTitle($payload['address_street'] ?? null) ?? '';
        $number = $this->normalizeText($payload['address_number'] ?? null) ?? '';
        $postal = $this->normalizeText($payload['postal_code'] ?? null) ?? '';
        $city = $this->normalizeTitle($payload['city'] ?? null) ?? '';
        $province = $this->normalizeTitle($payload['province'] ?? null) ?? '';
        $country = $this->normalizeText($payload['country'] ?? null) ?? '';

        $parts = [];
        if ($street !== '') {
            $parts[] = $number !== '' ? $street . ' ' . $number : $street;
        }
        $locality = trim($postal . ' ' . $city);
        if ($locality !== '') {
            $parts[] = $locality;
        }
        if ($province !== '') {
            $parts[] = $province;
        }
        if ($country !== '') {
            $parts[] = $country;
        }

        if (empty($parts)) {
            return null;
        }

        return implode(', ', $parts);
    }

    private function composeAddressLineWithPrefix(array $payload, string $prefix): ?string
    {
        $street = $this->normalizeTitle($payload[$prefix . 'address_street'] ?? null) ?? '';
        $number = $this->normalizeText($payload[$prefix . 'address_number'] ?? null) ?? '';
        $postal = $this->normalizeText($payload[$prefix . 'postal_code'] ?? null) ?? '';
        $city = $this->normalizeTitle($payload[$prefix . 'city'] ?? null) ?? '';
        $province = $this->normalizeTitle($payload[$prefix . 'province'] ?? null) ?? '';
        $country = $this->normalizeText($payload[$prefix . 'country'] ?? null) ?? '';

        $parts = [];
        if ($street !== '') {
            $parts[] = $number !== '' ? $street . ' ' . $number : $street;
        }
        $locality = trim($postal . ' ' . $city);
        if ($locality !== '') {
            $parts[] = $locality;
        }
        if ($province !== '') {
            $parts[] = $province;
        }
        if ($country !== '') {
            $parts[] = $country;
        }

        if (empty($parts)) {
            return null;
        }

        return implode(', ', $parts);
    }

    private function normalizeText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $trimmed = trim(preg_replace('/\\s+/', ' ', $value));
        return $trimmed === '' ? null : $trimmed;
    }

    private function normalizeTitle(?string $value): ?string
    {
        $normalized = $this->normalizeText($value);
        if ($normalized === null) {
            return null;
        }
        $lower = mb_strtolower($normalized, 'UTF-8');
        return mb_convert_case($lower, MB_CASE_TITLE, 'UTF-8');
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

    public function bulkUpdate(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.write')) {
            return $this->forbidden();
        }

        $payload = $this->validateBulkShipmentPayload($request);

        $updates = [];
        if (array_key_exists('status', $payload)) {
            $updates['status'] = $payload['status'];
            if (($payload['status'] ?? null) === 'delivered') {
                $updates['delivered_at'] = now();
            }
        }
        if (array_key_exists('hub_id', $payload)) {
            $updates['hub_id'] = $payload['hub_id'];
        }
        if (array_key_exists('scheduled_at', $payload)) {
            $updates['scheduled_at'] = $payload['scheduled_at'];
        }
        if ($updates === []) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'At least one update field is required.'],
            ], 422);
        }

        $shipmentIds = $this->collectShipmentIdsForBulk($actor, $payload);
        $beforeRows = DB::table('shipments')
            ->whereIn('id', $shipmentIds)
            ->get(['id', 'status', 'hub_id', 'scheduled_at'])
            ->keyBy('id');

        if ($shipmentIds !== []) {
            DB::table('shipments')
                ->whereIn('id', $shipmentIds)
                ->update([
                    ...$updates,
                    'updated_at' => now(),
                ]);
        }
        $afterRows = DB::table('shipments')
            ->whereIn('id', $shipmentIds)
            ->get(['id', 'status', 'hub_id', 'scheduled_at'])
            ->keyBy('id');
        $changeRows = [];
        foreach ($shipmentIds as $shipmentId) {
            $before = $beforeRows[$shipmentId] ?? null;
            $after = $afterRows[$shipmentId] ?? null;
            if (!$before || !$after) {
                continue;
            }
            $diff = [];
            foreach (['status', 'hub_id', 'scheduled_at'] as $field) {
                if (($before->{$field} ?? null) !== ($after->{$field} ?? null)) {
                    $diff[$field] = [
                        'before' => $before->{$field} ?? null,
                        'after' => $after->{$field} ?? null,
                    ];
                }
            }
            if ($diff !== []) {
                $changeRows[] = [
                    'shipment_id' => $shipmentId,
                    'changes' => $diff,
                ];
            }
        }

        $this->auditLogWriter->write($actor->id, 'shipments.bulk_updated', [
            'shipment_ids' => $shipmentIds,
            'updates' => $updates,
            'reason' => $payload['reason'],
            'reason_code' => $payload['reason_code'] ?? null,
            'reason_detail' => $payload['reason_detail'] ?? null,
            'apply_to_filtered' => !empty($payload['apply_to_filtered']),
            'count' => count($shipmentIds),
            'changed_rows_count' => count($changeRows),
            'changes' => array_slice($changeRows, 0, 50),
        ]);

        return response()->json([
            'data' => DB::table('shipments')->whereIn('id', $shipmentIds)->get()->all(),
            'meta' => [
                'updated_count' => count($shipmentIds),
            ],
        ]);
    }

    public function bulkUpdatePreview(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.write')) {
            return $this->forbidden();
        }

        $payload = $this->validateBulkShipmentPayload($request, true);
        $shipmentIds = $this->collectShipmentIdsForBulk($actor, $payload);
        $samples = DB::table('shipments')
            ->whereIn('id', $shipmentIds)
            ->orderBy('reference')
            ->limit(20)
            ->get(['id', 'reference', 'status', 'hub_id', 'scheduled_at'])
            ->all();

        return response()->json([
            'data' => [
                'target_count' => count($shipmentIds),
                'sample' => $samples,
                'updates' => [
                    'status' => $payload['status'] ?? null,
                    'hub_id' => $payload['hub_id'] ?? null,
                    'scheduled_at' => $payload['scheduled_at'] ?? null,
                ],
                'apply_to_filtered' => (bool) ($payload['apply_to_filtered'] ?? false),
            ],
        ]);
    }

    public function bulkUpdatePreviewCsv(Request $request)
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.write')) {
            return $this->forbidden();
        }

        $payload = $this->validateBulkShipmentPayload($request, true);
        $shipmentIds = $this->collectShipmentIdsForBulk($actor, $payload);
        $rows = DB::table('shipments')
            ->whereIn('id', $shipmentIds)
            ->orderBy('reference')
            ->get(['id', 'reference', 'status', 'hub_id', 'scheduled_at']);

        $csvRows = ['id,reference,status,hub_id,scheduled_at'];
        foreach ($rows as $row) {
            $csvRows[] = implode(',', [
                $this->csvValue((string) $row->id),
                $this->csvValue((string) $row->reference),
                $this->csvValue((string) $row->status),
                $this->csvValue((string) ($row->hub_id ?? '')),
                $this->csvValue((string) ($row->scheduled_at ?? '')),
            ]);
        }

        $this->auditLogWriter->write($actor->id, 'shipments.bulk_update.preview.exported.csv', [
            'count' => count($shipmentIds),
            'apply_to_filtered' => (bool) ($payload['apply_to_filtered'] ?? false),
            'updates' => [
                'status' => $payload['status'] ?? null,
                'hub_id' => $payload['hub_id'] ?? null,
                'scheduled_at' => $payload['scheduled_at'] ?? null,
            ],
        ]);

        return response(implode("\n", $csvRows), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="shipments_bulk_update_preview.csv"',
        ]);
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

    private function validateBulkShipmentPayload(Request $request, bool $preview = false): array
    {
        return $request->validate([
            'shipment_ids' => ['nullable', 'array', 'min:1'],
            'shipment_ids.*' => ['required', 'uuid'],
            'apply_to_filtered' => ['nullable', 'boolean'],
            'filter_status' => ['nullable', 'in:created,out_for_delivery,delivered,incident'],
            'filter_hub_id' => ['nullable', 'uuid'],
            'filter_q' => ['nullable', 'string', 'max:120'],
            'filter_scheduled_from' => ['nullable', 'date'],
            'filter_scheduled_to' => ['nullable', 'date'],
            'status' => ['nullable', 'in:created,out_for_delivery,delivered,incident'],
            'hub_id' => ['nullable', 'uuid', 'exists:hubs,id'],
            'scheduled_at' => ['nullable', 'date'],
            'reason_code' => ['nullable', 'string', 'max:80'],
            'reason_detail' => ['nullable', 'string', 'max:220'],
            'reason' => $preview ? ['nullable', 'string', 'max:220'] : ['required', 'string', 'max:220'],
        ]);
    }

    /**
     * @throws ValidationException
     * @return array<int, string>
     */
    private function collectShipmentIdsForBulk(User $actor, array $payload): array
    {
        $shipmentIds = array_values(array_unique($payload['shipment_ids'] ?? []));
        if (!empty($payload['apply_to_filtered'])) {
            $query = $this->baseQueryForActor($actor);
            if ($query === null) {
                return [];
            }
            if (!empty($payload['filter_status'])) {
                $query->where('shipments.status', $payload['filter_status']);
            }
            if (!empty($payload['filter_hub_id'])) {
                $query->where('shipments.hub_id', $payload['filter_hub_id']);
            }
            if (!empty($payload['filter_q'])) {
                $like = '%' . str_replace('%', '\\%', (string) $payload['filter_q']) . '%';
                $query->where(function ($inner) use ($like): void {
                    $inner->where('shipments.reference', 'like', $like)
                        ->orWhere('shipments.external_reference', 'like', $like)
                        ->orWhere('shipments.id', 'like', $like)
                        ->orWhere('shipments.consignee_name', 'like', $like);
                });
            }
            if (!empty($payload['filter_scheduled_from'])) {
                $query->whereDate('shipments.scheduled_at', '>=', $payload['filter_scheduled_from']);
            }
            if (!empty($payload['filter_scheduled_to'])) {
                $query->whereDate('shipments.scheduled_at', '<=', $payload['filter_scheduled_to']);
            }
            return $query->pluck('shipments.id')->all();
        }
        if ($shipmentIds === []) {
            throw ValidationException::withMessages([
                'shipment_ids' => ['Provide shipment_ids or enable apply_to_filtered.'],
            ]);
        }
        $existing = DB::table('shipments')->whereIn('id', $shipmentIds)->pluck('id')->all();
        if (count($existing) !== count($shipmentIds)) {
            throw ValidationException::withMessages([
                'shipment_ids' => ['One or more shipment_ids do not exist.'],
            ]);
        }
        return $shipmentIds;
    }
}

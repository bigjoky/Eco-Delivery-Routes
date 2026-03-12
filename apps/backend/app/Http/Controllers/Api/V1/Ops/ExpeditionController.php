<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Infrastructure\Auth\AuditLogWriter;
use App\Models\User;
use App\Services\Contacts\ContactResolver;
use App\Services\SequenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ExpeditionController extends Controller
{
    public function __construct(
        private readonly AuditLogWriter $auditLogWriter,
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

        $query = DB::table('expeditions')
            ->leftJoin('shipments', 'shipments.id', '=', 'expeditions.shipment_id')
            ->leftJoin('pickups', 'pickups.id', '=', 'expeditions.pickup_id')
            ->leftJoin('contacts as sender_contacts', 'sender_contacts.id', '=', 'expeditions.sender_contact_id')
            ->leftJoin('contacts as recipient_contacts', 'recipient_contacts.id', '=', 'expeditions.recipient_contact_id')
            ->select(
                'expeditions.*',
                'shipments.reference as shipment_reference',
                'shipments.status as shipment_status',
                'pickups.reference as pickup_reference',
                'pickups.status as pickup_status',
                DB::raw('COALESCE(sender_contacts.display_name, sender_contacts.legal_name) as sender_name'),
                DB::raw('COALESCE(recipient_contacts.display_name, recipient_contacts.legal_name, shipments.consignee_name) as recipient_name')
            );

        if ($request->filled('status')) {
            $query->where('expeditions.status', (string) $request->query('status'));
        }
        if ($request->filled('id')) {
            $query->where('expeditions.id', (string) $request->query('id'));
        }
        if ($request->filled('shipment_id')) {
            $query->where('expeditions.shipment_id', (string) $request->query('shipment_id'));
        }
        if ($request->filled('pickup_id')) {
            $query->where('expeditions.pickup_id', (string) $request->query('pickup_id'));
        }
        if ($request->filled('operation_kind')) {
            $query->where('expeditions.operation_kind', (string) $request->query('operation_kind'));
        }
        if ($request->filled('leg_status')) {
            $legStatus = (string) $request->query('leg_status');
            $query->where(function ($inner) use ($legStatus): void {
                $inner->where('shipments.status', $legStatus)
                    ->orWhere('pickups.status', $legStatus);
            });
        }
        if ($request->filled('q')) {
            $like = '%' . str_replace('%', '\\%', (string) $request->query('q')) . '%';
            $query->where(function ($inner) use ($like): void {
                $inner->where('expeditions.reference', 'like', $like)
                    ->orWhere('expeditions.external_reference', 'like', $like)
                    ->orWhere('expeditions.id', 'like', $like)
                    ->orWhere('expeditions.shipment_id', 'like', $like)
                    ->orWhere('expeditions.pickup_id', 'like', $like)
                    ->orWhere('shipments.reference', 'like', $like)
                    ->orWhere('pickups.reference', 'like', $like)
                    ->orWhere('shipments.consignee_name', 'like', $like)
                    ->orWhere('pickups.requester_name', 'like', $like);
            });
        }

        return response()->json([
            'data' => $query->orderByDesc('expeditions.created_at')->limit((int) $request->query('limit', 150))->get(),
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('shipments.read')) {
            return $this->forbidden();
        }

        $expedition = DB::table('expeditions')->where('id', $id)->first();
        if (!$expedition) {
            return response()->json(['error' => ['message' => 'Expedition not found']], 404);
        }

        $shipment = !empty($expedition->shipment_id) ? DB::table('shipments')->where('id', $expedition->shipment_id)->first() : null;
        $pickup = !empty($expedition->pickup_id) ? DB::table('pickups')->where('id', $expedition->pickup_id)->first() : null;
        $senderContact = !empty($expedition->sender_contact_id) ? DB::table('contacts')->where('id', $expedition->sender_contact_id)->first() : null;
        $recipientContact = !empty($expedition->recipient_contact_id) ? DB::table('contacts')->where('id', $expedition->recipient_contact_id)->first() : null;

        $shipmentEvents = $shipment
            ? DB::table('tracking_events')
                ->where('trackable_type', 'shipment')
                ->where('trackable_id', $shipment->id)
                ->orderBy('occurred_at')
                ->get()
            : collect();
        $pickupEvents = $pickup
            ? DB::table('tracking_events')
                ->where('trackable_type', 'pickup')
                ->where('trackable_id', $pickup->id)
                ->orderBy('occurred_at')
                ->get()
            : collect();
        $trackingEvents = $pickupEvents
            ->concat($shipmentEvents)
            ->sortBy('occurred_at')
            ->values();

        $timeline = collect();
        if ($pickup && $pickup->scheduled_at) {
            $timeline->push([
                'id' => 'pickup-scheduled-' . $pickup->id,
                'leg' => 'pickup',
                'label' => 'Recogida programada',
                'detail' => $pickup->reference,
                'at' => $pickup->scheduled_at,
            ]);
        }
        if ($pickup && $pickup->completed_at) {
            $timeline->push([
                'id' => 'pickup-completed-' . $pickup->id,
                'leg' => 'pickup',
                'label' => 'Recogida completada',
                'detail' => $pickup->reference,
                'at' => $pickup->completed_at,
            ]);
        }
        foreach ($pickupEvents as $event) {
            $timeline->push([
                'id' => 'pickup-event-' . $event->id,
                'leg' => 'pickup',
                'label' => $event->event_code,
                'detail' => $event->status_to,
                'at' => $event->occurred_at,
            ]);
        }
        if ($shipment && $shipment->scheduled_at) {
            $timeline->push([
                'id' => 'delivery-scheduled-' . $shipment->id,
                'leg' => 'delivery',
                'label' => 'Entrega programada',
                'detail' => $shipment->reference,
                'at' => $shipment->scheduled_at,
            ]);
        }
        foreach ($shipmentEvents as $event) {
            $timeline->push([
                'id' => 'delivery-event-' . $event->id,
                'leg' => 'delivery',
                'label' => $event->event_code,
                'detail' => $event->status_to,
                'at' => $event->occurred_at,
            ]);
        }
        if ($shipment && $shipment->delivered_at) {
            $timeline->push([
                'id' => 'delivery-completed-' . $shipment->id,
                'leg' => 'delivery',
                'label' => 'Entrega completada',
                'detail' => $shipment->reference,
                'at' => $shipment->delivered_at,
            ]);
        }

        $routeStops = DB::table('route_stops')
            ->leftJoin('routes', 'routes.id', '=', 'route_stops.route_id')
            ->leftJoin('shipments', 'shipments.id', '=', 'route_stops.shipment_id')
            ->leftJoin('pickups', 'pickups.id', '=', 'route_stops.pickup_id')
            ->leftJoin('expeditions', function ($join): void {
                $join->on('expeditions.id', '=', 'shipments.expedition_id')
                    ->orOn('expeditions.id', '=', 'pickups.expedition_id');
            })
            ->where(function ($query) use ($expedition): void {
                $query->where('route_stops.shipment_id', $expedition->shipment_id)
                    ->orWhere('route_stops.pickup_id', $expedition->pickup_id);
            })
            ->orderBy('routes.route_date')
            ->orderBy('route_stops.sequence')
            ->get([
                'route_stops.id',
                'route_stops.route_id',
                'route_stops.sequence',
                'route_stops.stop_type',
                'route_stops.shipment_id',
                'route_stops.pickup_id',
                'route_stops.status',
                'route_stops.planned_at',
                'route_stops.completed_at',
                DB::raw("CASE WHEN route_stops.shipment_id IS NOT NULL THEN 'shipment' ELSE 'pickup' END as entity_type"),
                DB::raw('COALESCE(route_stops.shipment_id, route_stops.pickup_id) as entity_id'),
                DB::raw('COALESCE(shipments.reference, pickups.reference) as reference'),
                'expeditions.id as expedition_id',
                'expeditions.reference as expedition_reference',
                'expeditions.operation_kind',
                'expeditions.product_category',
                DB::raw('COALESCE(shipments.service_type, pickups.service_type) as service_type'),
                DB::raw('COALESCE(shipments.consignee_name, pickups.requester_name) as counterparty_name'),
                DB::raw('COALESCE(shipments.address_line, pickups.address_line) as address_line'),
                DB::raw("CASE WHEN route_stops.shipment_id IS NOT NULL THEN (select reference from pickups where pickups.id = expeditions.pickup_id) ELSE (select reference from shipments where shipments.id = expeditions.shipment_id) END as linked_reference"),
            ]);

        $incidents = DB::table('incidents')
            ->where(function ($query) use ($expedition): void {
                $query->where('incidentable_type', 'shipment')->where('incidentable_id', $expedition->shipment_id);
            })
            ->orWhere(function ($query) use ($expedition): void {
                $query->where('incidentable_type', 'pickup')->where('incidentable_id', $expedition->pickup_id);
            })
            ->orderBy('created_at', 'desc')
            ->get();

        $pods = DB::table('pods')
            ->where(function ($query) use ($expedition): void {
                $query->where('evidenceable_type', 'shipment')->where('evidenceable_id', $expedition->shipment_id);
            })
            ->orWhere(function ($query) use ($expedition): void {
                $query->where('evidenceable_type', 'pickup')->where('evidenceable_id', $expedition->pickup_id);
            })
            ->orderBy('captured_at', 'desc')
            ->get();

        return response()->json([
            'data' => [
                'expedition' => $expedition,
                'shipment' => $shipment,
                'pickup' => $pickup,
                'sender_contact' => $senderContact,
                'recipient_contact' => $recipientContact,
                'timeline' => $timeline->sortBy('at')->values()->all(),
                'tracking_events' => $trackingEvents,
                'route_stops' => $routeStops,
                'incidents' => $incidents,
                'pods' => $pods,
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
        $payload = $request->validate(array_merge(
            $this->shipmentAddressRules(''),
            $this->shipmentAddressRules('sender_'),
            [
                'hub_id' => ['required', 'uuid'],
                'external_reference' => ['nullable', 'string', 'max:80'],
                'operation_kind' => ['required', 'in:shipment,return'],
                'product_category' => ['required', 'in:parcel,thermo'],
                'temperature_min_c' => ['nullable', 'numeric', 'between:-50,50'],
                'temperature_max_c' => ['nullable', 'numeric', 'between:-50,50', 'gte:temperature_min_c'],
                'requires_temperature_log' => ['nullable', 'boolean'],
                'thermo_notes' => ['nullable', 'string', 'max:500'],
                'consignee_name' => ['required', 'string', 'max:120'],
                'consignee_document_id' => ['required', 'string', 'max:60'],
                'consignee_phone' => ['required', 'string', 'max:40', 'regex:/^[+0-9 -]{7,20}$/'],
                'consignee_email' => ['nullable', 'email', 'max:120'],
                'sender_name' => ['nullable', 'string', 'max:120'],
                'sender_legal_name' => ['nullable', 'string', 'max:180'],
                'sender_document_id' => ['required', 'string', 'max:60'],
                'sender_phone' => ['required', 'string', 'max:40', 'regex:/^[+0-9 -]{7,20}$/'],
                'sender_email' => ['nullable', 'email', 'max:120'],
                'scheduled_at' => ['nullable', 'date', 'after_or_equal:' . $minScheduled, 'before_or_equal:' . $maxScheduled],
                'service_type' => ['required', 'in:express_1030,express_1400,express_1900,economy_parcel,business_parcel,thermo_parcel,delivery'],
            ]
        ));

        if (
            $this->normalizeText($payload['sender_name'] ?? null) === null
            && $this->normalizeText($payload['sender_legal_name'] ?? null) === null
        ) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Sender name or legal name is required.'],
            ], 422);
        }

        if (($payload['product_category'] ?? 'parcel') === 'thermo' && empty($payload['temperature_min_c']) && empty($payload['temperature_max_c'])) {
            return response()->json([
                'error' => ['code' => 'VALIDATION_ERROR', 'message' => 'Thermo expeditions require a temperature range.'],
            ], 422);
        }

        $scheduledAt = $payload['scheduled_at'] ?? null;
        $shipmentId = (string) Str::uuid();
        $pickupId = (string) Str::uuid();
        $expeditionId = (string) Str::uuid();
        $shipmentReference = (string) $this->sequenceService->next('shipments');
        $pickupReference = (string) $this->sequenceService->next('pickups');
        $expeditionReference = $this->sequenceService->nextPadded('expeditions', 14);

        $addressLine = $this->normalizeText($payload['address_line'] ?? '') ?: $this->composeAddressLine($payload);
        $senderAddressLine = $this->normalizeText($payload['sender_address_line'] ?? '') ?: $this->composeAddressLineWithPrefix($payload, 'sender_');

        $recipientContactId = $this->contactResolver->resolve([
            'name' => $payload['consignee_name'] ?? null,
            'document_id' => $payload['consignee_document_id'] ?? null,
            'phone' => $payload['consignee_phone'] ?? null,
            'email' => $payload['consignee_email'] ?? null,
            'address_line' => $addressLine,
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
        ], 'recipient');

        $senderContactId = $this->contactResolver->resolve([
            'name' => $payload['sender_name'] ?? null,
            'legal_name' => $payload['sender_legal_name'] ?? null,
            'document_id' => $payload['sender_document_id'] ?? null,
            'phone' => $payload['sender_phone'] ?? null,
            'email' => $payload['sender_email'] ?? null,
            'address_line' => $senderAddressLine,
            'address_street_type' => $payload['sender_address_street_type'] ?? null,
            'address_street' => $payload['sender_address_street'] ?? null,
            'address_number' => $payload['sender_address_number'] ?? null,
            'address_block' => $payload['sender_address_block'] ?? null,
            'address_stair' => $payload['sender_address_stair'] ?? null,
            'address_floor' => $payload['sender_address_floor'] ?? null,
            'address_door' => $payload['sender_address_door'] ?? null,
            'postal_code' => $payload['sender_postal_code'] ?? null,
            'city' => $payload['sender_city'] ?? null,
            'address_municipality' => $payload['sender_address_municipality'] ?? null,
            'province' => $payload['sender_province'] ?? null,
            'country' => $payload['sender_country'] ?? null,
            'address_reference' => $payload['sender_address_reference'] ?? null,
            'address_notes' => $payload['sender_address_notes'] ?? null,
        ], 'sender');

        DB::transaction(function () use (
            $payload,
            $expeditionId,
            $expeditionReference,
            $shipmentId,
            $shipmentReference,
            $pickupId,
            $pickupReference,
            $senderContactId,
            $recipientContactId,
            $senderAddressLine,
            $addressLine,
            $scheduledAt
        ): void {
            DB::table('shipments')->insert([
                'id' => $shipmentId,
                'expedition_id' => $expeditionId,
                'hub_id' => $payload['hub_id'],
                'sender_contact_id' => $senderContactId,
                'recipient_contact_id' => $recipientContactId,
                'reference' => $shipmentReference,
                'external_reference' => $this->normalizeText($payload['external_reference'] ?? null),
                'operation_kind' => $payload['operation_kind'],
                'product_category' => $payload['product_category'],
                'temperature_min_c' => $payload['temperature_min_c'] ?? null,
                'temperature_max_c' => $payload['temperature_max_c'] ?? null,
                'requires_temperature_log' => (bool) ($payload['requires_temperature_log'] ?? false),
                'thermo_notes' => $this->normalizeText($payload['thermo_notes'] ?? null),
                'service_type' => $payload['service_type'],
                'status' => 'created',
                'consignee_name' => $this->normalizeTitle($payload['consignee_name'] ?? null),
                'address_line' => $addressLine,
                'address_street_type' => $this->normalizeTitle($payload['address_street_type'] ?? null),
                'address_street' => $this->normalizeTitle($payload['address_street'] ?? null),
                'address_number' => $this->normalizeText($payload['address_number'] ?? null),
                'address_block' => $this->normalizeText($payload['address_block'] ?? null),
                'address_stair' => $this->normalizeText($payload['address_stair'] ?? null),
                'address_floor' => $this->normalizeText($payload['address_floor'] ?? null),
                'address_door' => $this->normalizeText($payload['address_door'] ?? null),
                'postal_code' => $this->normalizeText($payload['postal_code'] ?? null),
                'city' => $this->normalizeTitle($payload['city'] ?? null),
                'address_municipality' => $this->normalizeTitle($payload['address_municipality'] ?? null),
                'province' => $this->normalizeTitle($payload['province'] ?? null),
                'country' => $this->normalizeText($payload['country'] ?? null),
                'address_reference' => $this->normalizeText($payload['address_reference'] ?? null),
                'address_notes' => $this->normalizeText($payload['address_notes'] ?? null),
                'consignee_phone' => $this->normalizeText($payload['consignee_phone'] ?? null),
                'consignee_email' => $this->normalizeText($payload['consignee_email'] ?? null),
                'scheduled_at' => $scheduledAt,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('pickups')->insert([
                'id' => $pickupId,
                'expedition_id' => $expeditionId,
                'hub_id' => $payload['hub_id'],
                'reference' => $pickupReference,
                'external_reference' => $this->normalizeText($payload['external_reference'] ?? null),
                'pickup_type' => $payload['operation_kind'] === 'return' ? 'RETURN' : 'NORMAL',
                'service_type' => $payload['service_type'],
                'product_category' => $payload['product_category'],
                'temperature_min_c' => $payload['temperature_min_c'] ?? null,
                'temperature_max_c' => $payload['temperature_max_c'] ?? null,
                'requires_temperature_log' => (bool) ($payload['requires_temperature_log'] ?? false),
                'thermo_notes' => $this->normalizeText($payload['thermo_notes'] ?? null),
                'status' => 'planned',
                'requester_name' => $this->normalizeTitle($payload['sender_name'] ?? $payload['sender_legal_name'] ?? null),
                'address_line' => $senderAddressLine,
                'scheduled_at' => $scheduledAt,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('expeditions')->insert([
                'id' => $expeditionId,
                'hub_id' => $payload['hub_id'],
                'sender_contact_id' => $senderContactId,
                'recipient_contact_id' => $recipientContactId,
                'shipment_id' => $shipmentId,
                'pickup_id' => $pickupId,
                'reference' => $expeditionReference,
                'external_reference' => $this->normalizeText($payload['external_reference'] ?? null),
                'operation_kind' => $payload['operation_kind'],
                'product_category' => $payload['product_category'],
                'service_type' => $payload['service_type'],
                'status' => 'planned',
                'temperature_min_c' => $payload['temperature_min_c'] ?? null,
                'temperature_max_c' => $payload['temperature_max_c'] ?? null,
                'requires_temperature_log' => (bool) ($payload['requires_temperature_log'] ?? false),
                'thermo_notes' => $this->normalizeText($payload['thermo_notes'] ?? null),
                'scheduled_at' => $scheduledAt,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $shipment = DB::table('shipments')->where('id', $shipmentId)->first();
        $pickup = DB::table('pickups')->where('id', $pickupId)->first();
        $expedition = DB::table('expeditions')->where('id', $expeditionId)->first();

        $this->auditLogWriter->write($actor->id, 'expeditions.created', [
            'expedition_id' => $expeditionId,
            'hub_id' => $payload['hub_id'],
            'external_reference' => $payload['external_reference'] ?? null,
            'scheduled_at' => $scheduledAt,
            'sender_contact_id' => $senderContactId,
            'recipient_contact_id' => $recipientContactId,
            'created' => [
                'reference' => $expeditionReference,
                'shipment_reference' => $shipmentReference,
                'pickup_reference' => $pickupReference,
                'operation_kind' => $payload['operation_kind'],
                'product_category' => $payload['product_category'],
                'service_type' => $payload['service_type'],
            ],
        ]);

        return response()->json([
            'data' => [
                'expedition' => $expedition,
                'shipment' => $shipment,
                'pickup' => $pickup,
            ],
        ], 201);
    }

    private function shipmentAddressRules(string $prefix): array
    {
        return [
            $prefix . 'address_line' => ['nullable', 'string', 'max:220'],
            $prefix . 'address_street_type' => ['nullable', 'string', 'max:40'],
            $prefix . 'address_street' => ['required_without:' . $prefix . 'address_line', 'nullable', 'string', 'max:120'],
            $prefix . 'address_number' => ['nullable', 'string', 'max:20'],
            $prefix . 'address_block' => ['nullable', 'string', 'max:20'],
            $prefix . 'address_stair' => ['nullable', 'string', 'max:20'],
            $prefix . 'address_floor' => ['nullable', 'string', 'max:20'],
            $prefix . 'address_door' => ['nullable', 'string', 'max:20'],
            $prefix . 'postal_code' => ['required_without:' . $prefix . 'address_line', 'nullable', 'string', 'max:20'],
            $prefix . 'city' => ['required_without:' . $prefix . 'address_line', 'nullable', 'string', 'max:80'],
            $prefix . 'address_municipality' => ['nullable', 'string', 'max:80'],
            $prefix . 'province' => ['nullable', 'string', 'max:80'],
            $prefix . 'country' => ['nullable', 'string', 'max:40'],
            $prefix . 'address_reference' => ['nullable', 'string', 'max:160'],
            $prefix . 'address_notes' => ['nullable', 'string', 'max:255'],
        ];
    }

    private function composeAddressLine(array $payload): ?string
    {
        return $this->composeAddressLineWithPrefix($payload, '');
    }

    private function composeAddressLineWithPrefix(array $payload, string $prefix): ?string
    {
        $firstLine = trim(implode(' ', array_filter([
            $this->normalizeTitle($payload[$prefix . 'address_street_type'] ?? null),
            $this->normalizeTitle($payload[$prefix . 'address_street'] ?? null),
            $this->normalizeText($payload[$prefix . 'address_number'] ?? null),
        ])));

        $accessLine = implode(', ', array_filter([
            $this->normalizeText($payload[$prefix . 'address_block'] ?? null) ? 'Bloque ' . $this->normalizeText($payload[$prefix . 'address_block']) : null,
            $this->normalizeText($payload[$prefix . 'address_stair'] ?? null) ? 'Esc. ' . $this->normalizeText($payload[$prefix . 'address_stair']) : null,
            $this->normalizeText($payload[$prefix . 'address_floor'] ?? null) ? 'Planta ' . $this->normalizeText($payload[$prefix . 'address_floor']) : null,
            $this->normalizeText($payload[$prefix . 'address_door'] ?? null) ? 'Puerta ' . $this->normalizeText($payload[$prefix . 'address_door']) : null,
        ]));

        $locationLine = trim(implode(' ', array_filter([
            $this->normalizeText($payload[$prefix . 'postal_code'] ?? null),
            $this->normalizeTitle($payload[$prefix . 'city'] ?? null),
        ])));

        $parts = array_filter([
            $firstLine !== '' ? $firstLine : null,
            $accessLine !== '' ? $accessLine : null,
            $locationLine !== '' ? $locationLine : null,
            $this->normalizeTitle($payload[$prefix . 'address_municipality'] ?? null),
            $this->normalizeTitle($payload[$prefix . 'province'] ?? null),
            $this->normalizeText($payload[$prefix . 'country'] ?? null),
        ]);

        return $parts === [] ? null : implode(', ', $parts);
    }

    private function normalizeText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim($value);
        return $trimmed === '' ? null : $trimmed;
    }

    private function normalizeTitle(?string $value): ?string
    {
        $normalized = $this->normalizeText($value);
        if ($normalized === null) {
            return null;
        }

        return mb_convert_case($normalized, MB_CASE_TITLE, 'UTF-8');
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }
}

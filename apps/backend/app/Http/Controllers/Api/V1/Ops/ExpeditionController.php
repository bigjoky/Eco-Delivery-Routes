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
        $expeditionReference = (string) $this->sequenceService->next('expeditions');

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

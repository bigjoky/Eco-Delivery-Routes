<?php

namespace App\Http\Controllers\Api\V1\Ops;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\SequenceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Support\Carbon;

class PickupController extends Controller
{
    public function __construct(private readonly SequenceService $sequenceService) {}

    public function index(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('pickups.read')) {
            return $this->forbidden();
        }

        $query = DB::table('pickups')
            ->leftJoin('expeditions', 'expeditions.id', '=', 'pickups.expedition_id')
            ->leftJoin('shipments', 'shipments.id', '=', 'expeditions.shipment_id')
            ->select(
                'pickups.*',
                'expeditions.reference as expedition_reference',
                'shipments.reference as shipment_reference'
            );

        if ($request->filled('status')) {
            $query->where('pickups.status', (string) $request->query('status'));
        }
        if ($request->filled('q')) {
            $like = '%' . str_replace('%', '\\%', (string) $request->query('q')) . '%';
            $query->where(function ($inner) use ($like): void {
                $inner->where('pickups.reference', 'like', $like)
                    ->orWhere('pickups.external_reference', 'like', $like)
                    ->orWhere('pickups.requester_name', 'like', $like)
                    ->orWhere('expeditions.reference', 'like', $like)
                    ->orWhere('shipments.reference', 'like', $like);
            });
        }

        return response()->json([
            'data' => $query->orderByDesc('pickups.created_at')->limit(150)->get(),
        ]);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('pickups.read')) {
            return $this->forbidden();
        }

        $pickup = DB::table('pickups')->where('id', $id)->first();
        if (!$pickup) {
            return response()->json(['error' => ['message' => 'Pickup not found']], 404);
        }

        $expedition = null;
        $linkedShipment = null;
        $senderContact = null;
        $recipientContact = null;
        if (!empty($pickup->expedition_id)) {
            $expedition = DB::table('expeditions')->where('id', $pickup->expedition_id)->first();
            if ($expedition) {
                if (!empty($expedition->shipment_id)) {
                    $linkedShipment = DB::table('shipments')->where('id', $expedition->shipment_id)->first();
                }
                if (!empty($expedition->sender_contact_id)) {
                    $senderContact = DB::table('contacts')->where('id', $expedition->sender_contact_id)->first();
                }
                if (!empty($expedition->recipient_contact_id)) {
                    $recipientContact = DB::table('contacts')->where('id', $expedition->recipient_contact_id)->first();
                }
            }
        }

        $trackingEvents = DB::table('tracking_events')
            ->where('trackable_type', 'pickup')
            ->where('trackable_id', $id)
            ->orderBy('occurred_at', 'desc')
            ->get();

        $pods = DB::table('pods')
            ->where('evidenceable_type', 'pickup')
            ->where('evidenceable_id', $id)
            ->orderBy('captured_at', 'desc')
            ->get();

        $incidents = DB::table('incidents')
            ->where('incidentable_type', 'pickup')
            ->where('incidentable_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        $routeStops = DB::table('route_stops')
            ->leftJoin('routes', 'routes.id', '=', 'route_stops.route_id')
            ->where('route_stops.pickup_id', $id)
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
                'pickup' => $pickup,
                'expedition' => $expedition,
                'linked_shipment' => $linkedShipment,
                'sender_contact' => $senderContact,
                'recipient_contact' => $recipientContact,
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
        if (!$actor->hasPermission('pickups.write')) {
            return $this->forbidden();
        }

        $payload = $request->validate([
            'hub_id' => ['required', 'uuid'],
            'external_reference' => ['nullable', 'string', 'max:80'],
            'pickup_type' => ['required', 'in:NORMAL,RETURN'],
            'requester_name' => ['required', 'string', 'max:120'],
            'address_line' => ['required', 'string', 'max:220'],
            'scheduled_at' => [
                'required',
                'date',
                'after_or_equal:' . Carbon::now()->subDays(30)->format('Y-m-d H:i:s'),
                'before_or_equal:' . Carbon::now()->addDays(180)->format('Y-m-d H:i:s'),
            ],
        ]);

        $id = (string) Str::uuid();
        $reference = (string) $this->sequenceService->next('pickups');
        DB::table('pickups')->insert([
            'id' => $id,
            'hub_id' => $payload['hub_id'],
            'reference' => $reference,
            'external_reference' => $payload['external_reference'] ?? null,
            'pickup_type' => $payload['pickup_type'],
            'requester_name' => $payload['requester_name'] ?? null,
            'address_line' => $payload['address_line'] ?? null,
            'scheduled_at' => $payload['scheduled_at'] ?? null,
            'status' => 'planned',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['data' => DB::table('pickups')->where('id', $id)->first()], 201);
    }

    public function complete(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        if (!$actor->hasPermission('pickups.write')) {
            return $this->forbidden();
        }

        $updated = DB::table('pickups')->where('id', $id)->update([
            'status' => 'completed',
            'completed_at' => now(),
            'updated_at' => now(),
        ]);

        if (!$updated) {
            return response()->json([
                'error' => ['code' => 'RESOURCE_NOT_FOUND', 'message' => 'Pickup not found.'],
            ], 404);
        }

        return response()->json(['data' => DB::table('pickups')->where('id', $id)->first()]);
    }

    private function forbidden(): JsonResponse
    {
        return response()->json([
            'error' => ['code' => 'AUTH_UNAUTHORIZED', 'message' => 'Unauthorized.'],
        ], 403);
    }
}

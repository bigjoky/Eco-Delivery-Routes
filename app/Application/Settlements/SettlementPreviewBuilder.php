<?php

namespace App\Application\Settlements;

use App\Domain\Settlements\PayableRules;

final class SettlementPreviewBuilder
{
    /**
     * @param array<int,array<string,mixed>> $shipments
     * @param array<int,array<string,mixed>> $pickups
     * @param array<int,array<string,mixed>> $advances
     * @param array<string,int> $tariffMap
     *
     * @return array<string,mixed>
     */
    public function build(array $shipments, array $pickups, array $advances, array $tariffMap): array
    {
        $lines = [];
        $gross = 0;

        foreach ($shipments as $shipment) {
            $payable = PayableRules::isShipmentPayable($shipment);
            $unitAmount = $tariffMap['delivery'] ?? 0;
            $lineTotal = $payable ? $unitAmount : 0;
            $gross += $lineTotal;

            $lines[] = [
                'line_type' => 'shipment_delivery',
                'source_id' => $shipment['id'] ?? null,
                'source_ref' => $shipment['reference'] ?? null,
                'units' => 1,
                'unit_amount_cents' => $unitAmount,
                'line_total_cents' => $lineTotal,
                'status' => $payable ? 'payable' : 'excluded',
                'exclusion_reason' => $payable ? null : 'NOT_PAYABLE_RULE',
                'metadata' => [
                    'status' => $shipment['status'] ?? null,
                    'has_pod' => $shipment['has_pod'] ?? false,
                    'incident_category' => $shipment['incident_category'] ?? null,
                ],
            ];
        }

        foreach ($pickups as $pickup) {
            $pickupType = strtoupper((string) ($pickup['pickup_type'] ?? ''));
            $tariffKey = $pickupType === 'RETURN' ? 'pickup_return' : 'pickup_normal';

            $payable = PayableRules::isPickupPayable($pickup);
            $unitAmount = $tariffMap[$tariffKey] ?? 0;
            $lineTotal = $payable ? $unitAmount : 0;
            $gross += $lineTotal;

            $lines[] = [
                'line_type' => $tariffKey,
                'source_id' => $pickup['id'] ?? null,
                'source_ref' => $pickup['reference'] ?? null,
                'units' => 1,
                'unit_amount_cents' => $unitAmount,
                'line_total_cents' => $lineTotal,
                'status' => $payable ? 'payable' : 'excluded',
                'exclusion_reason' => $payable ? null : 'NOT_PAYABLE_RULE',
                'metadata' => [
                    'status' => $pickup['status'] ?? null,
                    'pickup_type' => $pickup['pickup_type'] ?? null,
                    'has_evidence' => $pickup['has_evidence'] ?? false,
                    'incident_category' => $pickup['incident_category'] ?? null,
                ],
            ];
        }

        $advancesTotal = 0;
        foreach ($advances as $advance) {
            $amount = (int) ($advance['amount_cents'] ?? 0);
            $advancesTotal += $amount;
            $lines[] = [
                'line_type' => 'advance_deduction',
                'source_id' => $advance['id'] ?? null,
                'source_ref' => $advance['id'] ?? null,
                'units' => 1,
                'unit_amount_cents' => -$amount,
                'line_total_cents' => -$amount,
                'status' => 'payable',
                'exclusion_reason' => null,
                'metadata' => [
                    'reason' => $advance['reason'] ?? null,
                    'request_date' => $advance['request_date'] ?? null,
                ],
            ];
        }

        return [
            'lines' => $lines,
            'totals' => [
                'gross_amount_cents' => $gross,
                'advances_amount_cents' => $advancesTotal,
                'net_amount_cents' => $gross - $advancesTotal,
            ],
        ];
    }
}

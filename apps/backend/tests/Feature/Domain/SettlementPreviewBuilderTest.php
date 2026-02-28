<?php

namespace Tests\Feature\Domain;

use App\Application\Settlements\SettlementPreviewBuilder;
use Tests\TestCase;

class SettlementPreviewBuilderTest extends TestCase
{
    public function test_preview_applies_tariffs_and_advance_deductions(): void
    {
        $builder = new SettlementPreviewBuilder();

        $shipments = [
            [
                'id' => 's1',
                'reference' => 'SHP-1',
                'status' => 'delivered',
                'has_pod' => true,
                'incident_category' => null,
            ],
            [
                'id' => 's2',
                'reference' => 'SHP-2',
                'status' => 'delivered',
                'has_pod' => true,
                'incident_category' => 'retry',
            ],
        ];

        $pickups = [
            [
                'id' => 'p1',
                'reference' => 'PCK-1',
                'pickup_type' => 'NORMAL',
                'status' => 'completed',
                'has_evidence' => true,
                'incident_category' => null,
            ],
            [
                'id' => 'p2',
                'reference' => 'PCK-2',
                'pickup_type' => 'RETURN',
                'status' => 'completed',
                'has_evidence' => true,
                'incident_category' => null,
            ],
        ];

        $advances = [
            ['id' => 'a1', 'amount_cents' => 5000, 'reason' => 'Anticipo'],
        ];

        $tariffs = [
            'delivery' => 250,
            'pickup_normal' => 190,
            'pickup_return' => 220,
        ];

        $result = $builder->build($shipments, $pickups, $advances, $tariffs);

        // payable: s1 (250) + p1 (190) + p2 (220) = 660
        $this->assertSame(660, $result['totals']['gross_amount_cents']);
        $this->assertSame(5000, $result['totals']['advances_amount_cents']);
        $this->assertSame(-4340, $result['totals']['net_amount_cents']);
        $this->assertCount(5, $result['lines']);
    }
}

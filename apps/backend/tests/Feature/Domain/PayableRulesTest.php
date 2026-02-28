<?php

namespace Tests\Feature\Domain;

use App\Domain\Settlements\PayableRules;
use Tests\TestCase;

class PayableRulesTest extends TestCase
{
    public function test_delivery_delivered_with_pod_is_payable(): void
    {
        $fixture = [
            'status' => 'delivered',
            'has_pod' => true,
            'incident_category' => null,
        ];

        $this->assertTrue(PayableRules::isShipmentPayable($fixture));
    }

    public function test_delivery_retry_or_absent_is_not_payable(): void
    {
        $retryFixture = [
            'status' => 'delivered',
            'has_pod' => true,
            'incident_category' => 'retry',
        ];

        $absentFixture = [
            'status' => 'delivered',
            'has_pod' => true,
            'incident_category' => 'absent',
        ];

        $this->assertFalse(PayableRules::isShipmentPayable($retryFixture));
        $this->assertFalse(PayableRules::isShipmentPayable($absentFixture));
    }

    public function test_delivery_without_pod_is_not_payable(): void
    {
        $fixture = [
            'status' => 'delivered',
            'has_pod' => false,
            'incident_category' => null,
        ];

        $this->assertFalse(PayableRules::isShipmentPayable($fixture));
    }

    public function test_pickup_normal_and_return_completed_with_evidence_are_payable(): void
    {
        $normal = [
            'pickup_type' => 'NORMAL',
            'status' => 'completed',
            'has_evidence' => true,
            'incident_category' => null,
        ];

        $return = [
            'pickup_type' => 'RETURN',
            'status' => 'completed',
            'has_evidence' => true,
            'incident_category' => null,
        ];

        $this->assertTrue(PayableRules::isPickupPayable($normal));
        $this->assertTrue(PayableRules::isPickupPayable($return));
    }

    public function test_pickup_not_completed_or_without_evidence_or_absent_is_not_payable(): void
    {
        $planned = [
            'pickup_type' => 'NORMAL',
            'status' => 'planned',
            'has_evidence' => true,
            'incident_category' => null,
        ];

        $withoutEvidence = [
            'pickup_type' => 'RETURN',
            'status' => 'completed',
            'has_evidence' => false,
            'incident_category' => null,
        ];

        $absent = [
            'pickup_type' => 'NORMAL',
            'status' => 'completed',
            'has_evidence' => true,
            'incident_category' => 'absent',
        ];

        $this->assertFalse(PayableRules::isPickupPayable($planned));
        $this->assertFalse(PayableRules::isPickupPayable($withoutEvidence));
        $this->assertFalse(PayableRules::isPickupPayable($absent));
    }
}

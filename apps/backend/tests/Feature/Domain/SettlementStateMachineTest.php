<?php

namespace Tests\Feature\Domain;

use App\Domain\Settlements\SettlementStateMachine;
use Tests\TestCase;

class SettlementStateMachineTest extends TestCase
{
    public function test_approve_only_allowed_for_draft(): void
    {
        $this->assertTrue(SettlementStateMachine::canApprove('draft'));
        $this->assertFalse(SettlementStateMachine::canApprove('approved'));
        $this->assertFalse(SettlementStateMachine::canApprove('exported'));
        $this->assertFalse(SettlementStateMachine::canApprove('paid'));
    }

    public function test_export_allowed_for_approved_or_exported_only(): void
    {
        $this->assertTrue(SettlementStateMachine::canExport('approved'));
        $this->assertTrue(SettlementStateMachine::canExport('exported'));
        $this->assertFalse(SettlementStateMachine::canExport('draft'));
        $this->assertFalse(SettlementStateMachine::canExport('paid'));
    }

    public function test_mark_paid_allowed_for_approved_or_exported_only(): void
    {
        $this->assertTrue(SettlementStateMachine::canMarkPaid('approved'));
        $this->assertTrue(SettlementStateMachine::canMarkPaid('exported'));
        $this->assertFalse(SettlementStateMachine::canMarkPaid('draft'));
        $this->assertFalse(SettlementStateMachine::canMarkPaid('paid'));
    }
}

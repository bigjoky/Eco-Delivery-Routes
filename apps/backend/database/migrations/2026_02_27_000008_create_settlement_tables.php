<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('settlements', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('subcontractor_id');
            $table->date('period_start');
            $table->date('period_end');
            $table->string('status', 30)->default('draft'); // draft | approved | exported | paid
            $table->unsignedInteger('gross_amount_cents')->default(0);
            $table->unsignedInteger('advances_amount_cents')->default(0);
            $table->integer('adjustments_amount_cents')->default(0);
            $table->integer('net_amount_cents')->default(0);
            $table->char('currency', 3)->default('EUR');
            $table->timestamp('approved_at')->nullable();
            $table->uuid('approved_by_user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('settlement_lines', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('settlement_id');
            $table->string('line_type', 40); // shipment_delivery | pickup_normal | pickup_return | advance_deduction | manual_adjustment
            $table->uuid('source_id')->nullable();
            $table->string('source_ref', 80)->nullable();
            $table->unsignedInteger('units')->default(1);
            $table->integer('unit_amount_cents')->default(0);
            $table->integer('line_total_cents')->default(0);
            $table->string('currency', 3)->default('EUR');
            $table->string('status', 30)->default('payable'); // payable | excluded
            $table->string('exclusion_reason', 80)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('advances', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('subcontractor_id');
            $table->unsignedInteger('amount_cents');
            $table->char('currency', 3)->default('EUR');
            $table->string('status', 30)->default('requested'); // requested | approved | rejected | deducted
            $table->string('reason', 160)->nullable();
            $table->date('request_date');
            $table->timestamp('approved_at')->nullable();
            $table->uuid('approved_by_user_id')->nullable();
            $table->date('deducted_for_period')->nullable();
            $table->timestamps();

            $table->index(['subcontractor_id', 'status', 'request_date'], 'advances_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('advances');
        Schema::dropIfExists('settlement_lines');
        Schema::dropIfExists('settlements');
    }
};

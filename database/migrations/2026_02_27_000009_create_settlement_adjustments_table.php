<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('settlement_adjustments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('settlement_id');
            $table->integer('amount_cents');
            $table->char('currency', 3)->default('EUR');
            $table->string('reason', 200);
            $table->string('status', 30)->default('pending'); // pending | approved | rejected
            $table->uuid('created_by_user_id')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->uuid('approved_by_user_id')->nullable();
            $table->timestamps();

            $table->index(['settlement_id', 'status'], 'settlement_adjustments_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settlement_adjustments');
    }
};

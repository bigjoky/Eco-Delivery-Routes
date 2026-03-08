<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('vehicle_controls', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('vehicle_id');
            $table->enum('control_type', ['fuel', 'insurance', 'itv', 'maintenance', 'other']);
            $table->date('event_date');
            $table->date('due_date')->nullable();
            $table->decimal('amount', 10, 2)->nullable();
            $table->unsignedInteger('odometer_km')->nullable();
            $table->string('provider', 160)->nullable();
            $table->string('reference', 80)->nullable();
            $table->text('notes')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->timestamps();

            $table->foreign('vehicle_id')->references('id')->on('vehicles')->cascadeOnDelete();
            $table->foreign('created_by_user_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['vehicle_id', 'control_type']);
            $table->index(['event_date', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_controls');
    }
};


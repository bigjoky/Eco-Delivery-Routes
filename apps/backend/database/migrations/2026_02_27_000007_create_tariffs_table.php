<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('tariffs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('hub_id')->nullable();
            $table->uuid('subcontractor_id')->nullable();
            $table->string('service_type', 30); // delivery | pickup_normal | pickup_return
            $table->unsignedInteger('amount_cents');
            $table->char('currency', 3)->default('EUR');
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['service_type', 'subcontractor_id', 'hub_id', 'valid_from'], 'tariffs_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tariffs');
    }
};

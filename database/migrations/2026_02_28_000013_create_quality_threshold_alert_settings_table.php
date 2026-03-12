<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quality_threshold_alert_settings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->decimal('large_delta_threshold', 5, 2);
            $table->unsignedSmallInteger('window_hours');
            $table->uuid('updated_by_user_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quality_threshold_alert_settings');
    }
};

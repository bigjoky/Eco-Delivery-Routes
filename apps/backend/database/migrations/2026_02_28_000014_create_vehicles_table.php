<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('subcontractor_id')->nullable();
            $table->uuid('home_hub_id')->nullable();
            $table->uuid('assigned_driver_id')->nullable();
            $table->string('code', 60)->unique();
            $table->string('plate_number', 20)->nullable()->unique();
            $table->string('vehicle_type', 40)->default('van');
            $table->unsignedInteger('capacity_kg')->nullable();
            $table->string('status', 40)->default('active');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};


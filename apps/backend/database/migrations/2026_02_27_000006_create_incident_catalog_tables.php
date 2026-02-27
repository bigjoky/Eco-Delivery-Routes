<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('incident_catalog_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('version', 30)->unique();
            $table->string('name', 120);
            $table->boolean('is_active')->default(false);
            $table->timestamp('active_from')->nullable();
            $table->timestamps();
        });

        Schema::create('incident_catalog_items', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('version_id');
            $table->string('code', 80);
            $table->string('name', 140);
            $table->string('category', 40); // failed | absent | retry | general
            $table->string('applies_to', 20); // shipment | pickup | both
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['version_id', 'code']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_catalog_items');
        Schema::dropIfExists('incident_catalog_versions');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('incident_catalog_items', function (Blueprint $table) {
            $table->string('priority', 10)->nullable()->after('category'); // high | medium | low
            $table->unsignedInteger('sla_minutes')->nullable()->after('priority');
        });
    }

    public function down(): void
    {
        Schema::table('incident_catalog_items', function (Blueprint $table) {
            $table->dropColumn(['priority', 'sla_minutes']);
        });
    }
};


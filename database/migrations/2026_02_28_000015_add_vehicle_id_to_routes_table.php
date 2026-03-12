<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->uuid('vehicle_id')->nullable()->after('subcontractor_id');
            $table->index('vehicle_id');
        });
    }

    public function down(): void
    {
        Schema::table('routes', function (Blueprint $table) {
            $table->dropIndex(['vehicle_id']);
            $table->dropColumn('vehicle_id');
        });
    }
};

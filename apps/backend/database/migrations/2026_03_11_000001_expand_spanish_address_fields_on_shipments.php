<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->string('address_street_type', 40)->nullable()->after('address_line');
            $table->string('address_block', 40)->nullable()->after('address_number');
            $table->string('address_stair', 40)->nullable()->after('address_block');
            $table->string('address_floor', 40)->nullable()->after('address_stair');
            $table->string('address_door', 40)->nullable()->after('address_floor');
            $table->string('address_municipality', 120)->nullable()->after('city');
            $table->string('address_reference', 220)->nullable()->after('country');
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn([
                'address_street_type',
                'address_block',
                'address_stair',
                'address_floor',
                'address_door',
                'address_municipality',
                'address_reference',
            ]);
        });
    }
};

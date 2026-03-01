<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->string('address_street', 180)->nullable()->after('address_line');
            $table->string('address_number', 40)->nullable()->after('address_street');
            $table->string('postal_code', 20)->nullable()->after('address_number');
            $table->string('city', 80)->nullable()->after('postal_code');
            $table->string('province', 80)->nullable()->after('city');
            $table->string('country', 80)->nullable()->after('province');
            $table->string('address_notes', 220)->nullable()->after('country');
            $table->string('consignee_phone', 40)->nullable()->after('address_notes');
            $table->string('consignee_email', 120)->nullable()->after('consignee_phone');
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn([
                'address_street',
                'address_number',
                'postal_code',
                'city',
                'province',
                'country',
                'address_notes',
                'consignee_phone',
                'consignee_email',
            ]);
        });
    }
};

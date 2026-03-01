<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->uuid('sender_contact_id')->nullable()->after('subcontractor_id');
            $table->uuid('recipient_contact_id')->nullable()->after('sender_contact_id');
            $table->string('external_reference', 80)->nullable()->after('reference');
        });

        Schema::table('pickups', function (Blueprint $table) {
            $table->string('external_reference', 80)->nullable()->after('reference');
        });
    }

    public function down(): void
    {
        Schema::table('pickups', function (Blueprint $table) {
            $table->dropColumn('external_reference');
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->dropColumn(['sender_contact_id', 'recipient_contact_id', 'external_reference']);
        });
    }
};

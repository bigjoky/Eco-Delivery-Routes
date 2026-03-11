<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('expeditions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('hub_id');
            $table->uuid('sender_contact_id')->nullable();
            $table->uuid('recipient_contact_id')->nullable();
            $table->uuid('shipment_id')->nullable();
            $table->uuid('pickup_id')->nullable();
            $table->string('reference', 60)->unique();
            $table->string('external_reference', 80)->nullable();
            $table->string('operation_kind', 20)->default('shipment'); // shipment | return
            $table->string('product_category', 20)->default('parcel'); // parcel | thermo
            $table->string('service_type', 40)->nullable();
            $table->string('status', 40)->default('planned');
            $table->decimal('temperature_min_c', 5, 2)->nullable();
            $table->decimal('temperature_max_c', 5, 2)->nullable();
            $table->boolean('requires_temperature_log')->default(false);
            $table->text('thermo_notes')->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamps();
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->uuid('expedition_id')->nullable()->after('id');
            $table->string('operation_kind', 20)->default('shipment')->after('reference');
            $table->string('product_category', 20)->default('parcel')->after('operation_kind');
            $table->decimal('temperature_min_c', 5, 2)->nullable()->after('product_category');
            $table->decimal('temperature_max_c', 5, 2)->nullable()->after('temperature_min_c');
            $table->boolean('requires_temperature_log')->default(false)->after('temperature_max_c');
            $table->text('thermo_notes')->nullable()->after('requires_temperature_log');
            $table->index('expedition_id');
        });

        Schema::table('pickups', function (Blueprint $table) {
            $table->uuid('expedition_id')->nullable()->after('id');
            $table->string('service_type', 40)->nullable()->after('pickup_type');
            $table->string('product_category', 20)->default('parcel')->after('service_type');
            $table->decimal('temperature_min_c', 5, 2)->nullable()->after('product_category');
            $table->decimal('temperature_max_c', 5, 2)->nullable()->after('temperature_min_c');
            $table->boolean('requires_temperature_log')->default(false)->after('temperature_max_c');
            $table->text('thermo_notes')->nullable()->after('requires_temperature_log');
            $table->index('expedition_id');
        });
    }

    public function down(): void
    {
        Schema::table('pickups', function (Blueprint $table) {
            $table->dropIndex(['expedition_id']);
            $table->dropColumn([
                'expedition_id',
                'service_type',
                'product_category',
                'temperature_min_c',
                'temperature_max_c',
                'requires_temperature_log',
                'thermo_notes',
            ]);
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->dropIndex(['expedition_id']);
            $table->dropColumn([
                'expedition_id',
                'operation_kind',
                'product_category',
                'temperature_min_c',
                'temperature_max_c',
                'requires_temperature_log',
                'thermo_notes',
            ]);
        });

        Schema::dropIfExists('expeditions');
    }
};

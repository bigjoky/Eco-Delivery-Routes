<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('hubs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 40)->unique();
            $table->string('name', 120);
            $table->string('city', 80);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('subcontractors', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('legal_name', 180);
            $table->string('tax_id', 60)->nullable();
            $table->string('status', 40)->default('active');
            $table->string('payment_terms', 80)->default('monthly');
            $table->timestamps();
        });

        Schema::create('drivers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->uuid('subcontractor_id')->nullable();
            $table->uuid('home_hub_id')->nullable();
            $table->string('employment_type', 40); // employee | subcontractor
            $table->string('code', 60)->unique();
            $table->string('name', 120);
            $table->string('status', 40)->default('active');
            $table->timestamps();
        });

        Schema::create('routes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('hub_id');
            $table->uuid('driver_id')->nullable();
            $table->uuid('subcontractor_id')->nullable();
            $table->string('code', 60)->unique();
            $table->date('route_date');
            $table->string('status', 40)->default('planned');
            $table->timestamps();
        });

        Schema::create('shipments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('hub_id');
            $table->uuid('route_id')->nullable();
            $table->uuid('assigned_driver_id')->nullable();
            $table->uuid('subcontractor_id')->nullable();
            $table->string('reference', 60)->unique();
            $table->string('service_type', 40)->default('delivery');
            $table->string('status', 40)->default('created');
            $table->string('consignee_name', 120)->nullable();
            $table->string('address_line', 220)->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
        });

        Schema::create('parcels', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('shipment_id');
            $table->string('barcode', 80)->unique();
            $table->unsignedInteger('weight_grams')->nullable();
            $table->string('status', 40)->default('created');
            $table->timestamps();
        });

        Schema::create('pickups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('hub_id');
            $table->uuid('route_id')->nullable();
            $table->uuid('driver_id')->nullable();
            $table->uuid('subcontractor_id')->nullable();
            $table->string('reference', 60)->unique();
            $table->string('pickup_type', 20); // NORMAL | RETURN
            $table->string('status', 40)->default('planned');
            $table->string('requester_name', 120)->nullable();
            $table->string('address_line', 220)->nullable();
            $table->timestamp('scheduled_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('route_stops', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('route_id');
            $table->unsignedSmallInteger('sequence');
            $table->string('stop_type', 20); // DELIVERY | PICKUP
            $table->uuid('shipment_id')->nullable();
            $table->uuid('pickup_id')->nullable();
            $table->string('status', 40)->default('planned');
            $table->timestamp('planned_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('pods', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('evidenceable_type', 40); // shipment | pickup
            $table->uuid('evidenceable_id');
            $table->string('signature_name', 120)->nullable();
            $table->string('photo_url', 255)->nullable();
            $table->decimal('geo_lat', 10, 7)->nullable();
            $table->decimal('geo_lng', 10, 7)->nullable();
            $table->timestamp('captured_at');
            $table->timestamps();
        });

        Schema::create('incidents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('incidentable_type', 40); // shipment | pickup
            $table->uuid('incidentable_id');
            $table->string('catalog_code', 80);
            $table->string('category', 40); // failed | absent | retry | general
            $table->text('notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('tracking_events', function (Blueprint $table) {
            $table->id();
            $table->string('trackable_type', 40); // shipment | parcel | pickup
            $table->uuid('trackable_id');
            $table->string('event_code', 80);
            $table->string('status_to', 40)->nullable();
            $table->string('scan_code', 120)->nullable();
            $table->string('source', 40)->default('driver_app');
            $table->json('metadata')->nullable();
            $table->timestamp('occurred_at');
            $table->timestamps();
        });

        Schema::create('quality_snapshots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('scope_type', 40); // driver | subcontractor | route
            $table->uuid('scope_id');
            $table->date('period_start');
            $table->date('period_end');
            $table->string('period_granularity', 20)->default('monthly');
            $table->unsignedInteger('assigned_with_attempt')->default(0);
            $table->unsignedInteger('delivered_completed')->default(0);
            $table->unsignedInteger('failed_count')->default(0);
            $table->unsignedInteger('absent_count')->default(0);
            $table->unsignedInteger('retry_count')->default(0);
            $table->unsignedInteger('pickups_completed')->default(0);
            $table->decimal('service_quality_score', 5, 2)->default(0);
            $table->string('calculation_version', 20)->default('v1');
            $table->json('payload')->nullable();
            $table->timestamp('calculated_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quality_snapshots');
        Schema::dropIfExists('tracking_events');
        Schema::dropIfExists('incidents');
        Schema::dropIfExists('pods');
        Schema::dropIfExists('route_stops');
        Schema::dropIfExists('pickups');
        Schema::dropIfExists('parcels');
        Schema::dropIfExists('shipments');
        Schema::dropIfExists('routes');
        Schema::dropIfExists('drivers');
        Schema::dropIfExists('subcontractors');
        Schema::dropIfExists('hubs');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('agencies', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('hub_id')->nullable();
            $table->string('code', 40)->unique();
            $table->string('name', 160);
            $table->string('legal_name', 180)->nullable();
            $table->string('tax_id', 60)->nullable();
            $table->string('address_line', 220)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('city', 80)->nullable();
            $table->string('province', 80)->nullable();
            $table->string('country', 2)->default('ES');
            $table->string('contact_name', 120)->nullable();
            $table->string('contact_phone', 40)->nullable();
            $table->string('contact_email', 160)->nullable();
            $table->string('manager_name', 120)->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->timestamp('deleted_at')->nullable()->index();
        });

        Schema::table('hubs', function (Blueprint $table) {
            $table->string('address_line', 220)->nullable()->after('city');
            $table->string('postal_code', 20)->nullable()->after('address_line');
            $table->string('province', 80)->nullable()->after('postal_code');
            $table->string('country', 2)->default('ES')->after('province');
            $table->string('contact_name', 120)->nullable()->after('country');
            $table->string('contact_phone', 40)->nullable()->after('contact_name');
            $table->string('contact_email', 160)->nullable()->after('contact_phone');
            $table->string('manager_name', 120)->nullable()->after('contact_email');
            $table->string('opening_hours', 120)->nullable()->after('manager_name');
            $table->decimal('latitude', 10, 7)->nullable()->after('opening_hours');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->text('notes')->nullable()->after('longitude');
        });

        Schema::table('depots', function (Blueprint $table) {
            $table->string('postal_code', 20)->nullable()->after('city');
            $table->string('province', 80)->nullable()->after('postal_code');
            $table->string('country', 2)->default('ES')->after('province');
            $table->string('contact_name', 120)->nullable()->after('country');
            $table->string('contact_phone', 40)->nullable()->after('contact_name');
            $table->string('contact_email', 160)->nullable()->after('contact_phone');
            $table->string('manager_name', 120)->nullable()->after('contact_email');
            $table->string('opening_hours', 120)->nullable()->after('manager_name');
            $table->decimal('latitude', 10, 7)->nullable()->after('opening_hours');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->text('notes')->nullable()->after('longitude');
        });

        Schema::table('points', function (Blueprint $table) {
            $table->string('postal_code', 20)->nullable()->after('city');
            $table->string('province', 80)->nullable()->after('postal_code');
            $table->string('country', 2)->default('ES')->after('province');
            $table->string('contact_name', 120)->nullable()->after('country');
            $table->string('contact_phone', 40)->nullable()->after('contact_name');
            $table->string('contact_email', 160)->nullable()->after('contact_phone');
            $table->string('manager_name', 120)->nullable()->after('contact_email');
            $table->string('opening_hours', 120)->nullable()->after('manager_name');
            $table->decimal('latitude', 10, 7)->nullable()->after('opening_hours');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->text('notes')->nullable()->after('longitude');
        });

        Schema::table('subcontractors', function (Blueprint $table) {
            $table->string('trade_name', 180)->nullable()->after('legal_name');
            $table->string('contact_name', 120)->nullable()->after('payment_terms');
            $table->string('phone', 40)->nullable()->after('contact_name');
            $table->string('email', 160)->nullable()->after('phone');
            $table->string('billing_email', 160)->nullable()->after('email');
            $table->string('address_line', 220)->nullable()->after('billing_email');
            $table->string('postal_code', 20)->nullable()->after('address_line');
            $table->string('city', 80)->nullable()->after('postal_code');
            $table->string('province', 80)->nullable()->after('city');
            $table->string('country', 2)->default('ES')->after('province');
            $table->string('iban', 40)->nullable()->after('country');
            $table->date('contract_start')->nullable()->after('iban');
            $table->date('contract_end')->nullable()->after('contract_start');
            $table->text('notes')->nullable()->after('contract_end');
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->string('phone', 40)->nullable()->after('name');
            $table->string('email', 160)->nullable()->after('phone');
            $table->string('license_number', 60)->nullable()->after('email');
            $table->date('license_expires_at')->nullable()->after('license_number');
        });

        Schema::table('vehicles', function (Blueprint $table) {
            $table->string('brand', 80)->nullable()->after('vehicle_type');
            $table->string('model', 80)->nullable()->after('brand');
            $table->string('fuel_type', 40)->nullable()->after('model');
            $table->string('ownership_type', 40)->nullable()->after('fuel_type');
            $table->decimal('volume_m3', 8, 2)->nullable()->after('capacity_kg');
            $table->boolean('is_refrigerated')->default(false)->after('volume_m3');
            $table->date('thermo_cert_expires_at')->nullable()->after('is_refrigerated');
            $table->date('insurance_expires_at')->nullable()->after('thermo_cert_expires_at');
            $table->date('itv_expires_at')->nullable()->after('insurance_expires_at');
            $table->text('notes')->nullable()->after('itv_expires_at');
        });

        DB::transaction(function (): void {
            $expeditions = DB::table('expeditions')->orderBy('created_at')->orderBy('id')->get(['id']);
            $counter = 1;
            foreach ($expeditions as $expedition) {
                DB::table('expeditions')
                    ->where('id', $expedition->id)
                    ->update(['reference' => str_pad((string) $counter, 14, '0', STR_PAD_LEFT)]);
                $counter++;
            }

            DB::table('sequence_counters')->updateOrInsert(
                ['entity' => 'expeditions'],
                ['next_number' => $counter, 'created_at' => now(), 'updated_at' => now()]
            );

            $hubs = DB::table('hubs')->pluck('code', 'id');
            $routes = DB::table('routes')
                ->orderBy('route_date')
                ->orderBy('hub_id')
                ->orderBy('created_at')
                ->orderBy('id')
                ->get(['id', 'hub_id', 'route_date']);

            $groupCounters = [];
            foreach ($routes as $route) {
                $dateKey = str_replace('-', '', (string) $route->route_date);
                $hubCode = strtoupper(preg_replace('/[^A-Z0-9]/', '', (string) ($hubs[$route->hub_id] ?? 'GEN')));
                $hubCode = substr($hubCode !== '' ? $hubCode : 'GEN', 0, 8);
                $groupKey = $dateKey . ':' . $hubCode;
                $groupCounters[$groupKey] = ($groupCounters[$groupKey] ?? 0) + 1;
                $sequence = str_pad((string) $groupCounters[$groupKey], 3, '0', STR_PAD_LEFT);
                $code = sprintf('R-%s-%s-%s', $dateKey, $hubCode, $sequence);

                DB::table('routes')->where('id', $route->id)->update(['code' => $code]);
            }

            foreach ($groupCounters as $groupKey => $next) {
                DB::table('sequence_counters')->updateOrInsert(
                    ['entity' => 'routes:' . $groupKey],
                    ['next_number' => $next + 1, 'created_at' => now(), 'updated_at' => now()]
                );
            }
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn([
                'brand',
                'model',
                'fuel_type',
                'ownership_type',
                'volume_m3',
                'is_refrigerated',
                'thermo_cert_expires_at',
                'insurance_expires_at',
                'itv_expires_at',
                'notes',
            ]);
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->dropColumn([
                'phone',
                'email',
                'license_number',
                'license_expires_at',
            ]);
        });

        Schema::table('subcontractors', function (Blueprint $table) {
            $table->dropColumn([
                'trade_name',
                'contact_name',
                'phone',
                'email',
                'billing_email',
                'address_line',
                'postal_code',
                'city',
                'province',
                'country',
                'iban',
                'contract_start',
                'contract_end',
                'notes',
            ]);
        });

        Schema::table('points', function (Blueprint $table) {
            $table->dropColumn([
                'postal_code',
                'province',
                'country',
                'contact_name',
                'contact_phone',
                'contact_email',
                'manager_name',
                'opening_hours',
                'latitude',
                'longitude',
                'notes',
            ]);
        });

        Schema::table('depots', function (Blueprint $table) {
            $table->dropColumn([
                'postal_code',
                'province',
                'country',
                'contact_name',
                'contact_phone',
                'contact_email',
                'manager_name',
                'opening_hours',
                'latitude',
                'longitude',
                'notes',
            ]);
        });

        Schema::table('hubs', function (Blueprint $table) {
            $table->dropColumn([
                'address_line',
                'postal_code',
                'province',
                'country',
                'contact_name',
                'contact_phone',
                'contact_email',
                'manager_name',
                'opening_hours',
                'latitude',
                'longitude',
                'notes',
            ]);
        });

        Schema::dropIfExists('agencies');
    }
};

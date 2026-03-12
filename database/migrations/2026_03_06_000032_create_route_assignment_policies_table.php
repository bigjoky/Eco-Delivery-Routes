<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('route_assignment_policies', function (Blueprint $table): void {
            $table->id();
            $table->boolean('enforce_on_publish')->default(true);
            $table->json('critical_warning_codes');
            $table->json('bypass_role_codes');
            $table->timestamps();
        });

        DB::table('route_assignment_policies')->insert([
            'id' => 1,
            'enforce_on_publish' => true,
            'critical_warning_codes' => json_encode(['LOW_DRIVER_QUALITY', 'LOW_SUBCONTRACTOR_QUALITY']),
            'bypass_role_codes' => json_encode(['super_admin']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('route_assignment_policies');
    }
};


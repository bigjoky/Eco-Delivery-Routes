<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table): void {
            $table->string('resolution_reason_code', 80)->nullable()->after('resolved_at');
            $table->text('resolution_reason_detail')->nullable()->after('resolution_reason_code');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table): void {
            $table->dropColumn(['resolution_reason_code', 'resolution_reason_detail']);
        });
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table): void {
            $table->string('priority_override', 16)->nullable()->after('category');
            $table->timestamp('sla_due_at_override')->nullable()->after('priority_override');
        });
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table): void {
            $table->dropColumn(['priority_override', 'sla_due_at_override']);
        });
    }
};

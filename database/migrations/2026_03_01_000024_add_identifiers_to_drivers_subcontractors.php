<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->string('dni', 40)->nullable()->after('employment_type');
            $table->unique('dni');
        });

        Schema::table('subcontractors', function (Blueprint $table) {
            $table->unique('tax_id');
        });
    }

    public function down(): void
    {
        Schema::table('subcontractors', function (Blueprint $table) {
            $table->dropUnique(['tax_id']);
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->dropUnique(['dni']);
            $table->dropColumn('dni');
        });
    }
};

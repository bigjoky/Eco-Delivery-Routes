<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('settlement_adjustments', function (Blueprint $table) {
            $table->string('rejection_reason', 200)->nullable()->after('reason');
            $table->timestamp('rejected_at')->nullable()->after('approved_at');
            $table->uuid('rejected_by_user_id')->nullable()->after('approved_by_user_id');
        });
    }

    public function down(): void
    {
        Schema::table('settlement_adjustments', function (Blueprint $table) {
            $table->dropColumn(['rejection_reason', 'rejected_at', 'rejected_by_user_id']);
        });
    }
};

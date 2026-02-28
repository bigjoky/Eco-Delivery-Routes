<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quality_threshold_settings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('scope_type', 16); // global | role | user
            $table->string('scope_id')->nullable(); // role code or user id
            $table->decimal('threshold', 5, 2);
            $table->uuid('updated_by_user_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quality_threshold_settings');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('depots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('hub_id');
            $table->string('code', 40)->unique();
            $table->string('name', 120);
            $table->string('address_line', 220)->nullable();
            $table->string('city', 80)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('points', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('hub_id');
            $table->uuid('depot_id')->nullable();
            $table->string('code', 40)->unique();
            $table->string('name', 120);
            $table->string('address_line', 220)->nullable();
            $table->string('city', 80)->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('points');
        Schema::dropIfExists('depots');
    }
};

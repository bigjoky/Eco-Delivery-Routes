<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('route_bulk_action_templates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->uuid('route_id')->nullable();
            $table->string('name', 120);
            $table->string('status', 20)->nullable();
            $table->dateTime('planned_at')->nullable();
            $table->dateTime('completed_at')->nullable();
            $table->integer('shift_minutes')->default(0);
            $table->timestamps();

            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('route_id')->references('id')->on('routes')->nullOnDelete();
            $table->index(['user_id', 'route_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('route_bulk_action_templates');
    }
};


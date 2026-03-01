<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipments_import_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('actor_user_id')->nullable();
            $table->string('status', 30)->default('queued'); // queued|processing|completed|failed
            $table->unsignedInteger('created_count')->default(0);
            $table->unsignedInteger('error_count')->default(0);
            $table->unsignedInteger('skipped_count')->default(0);
            $table->json('warnings')->nullable();
            $table->json('unknown_columns')->nullable();
            $table->text('error_message')->nullable();
            $table->string('file_path', 255);
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments_import_jobs');
    }
};

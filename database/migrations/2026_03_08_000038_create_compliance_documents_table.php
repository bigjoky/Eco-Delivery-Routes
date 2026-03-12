<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('compliance_documents', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->enum('scope_type', ['company', 'subcontractor', 'employee', 'driver', 'vehicle', 'operation']);
            $table->string('scope_id', 64)->nullable();
            $table->enum('document_type', ['cae', 'insurance', 'itv', 'contract', 'training', 'license', 'prevention', 'other']);
            $table->string('title', 180);
            $table->string('reference', 80)->nullable();
            $table->string('issuer', 160)->nullable();
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->enum('status', ['valid', 'expiring', 'expired', 'pending'])->default('pending');
            $table->string('file_url', 255)->nullable();
            $table->json('metadata')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->timestamps();

            $table->foreign('created_by_user_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['scope_type', 'scope_id']);
            $table->index(['document_type', 'status']);
            $table->index(['expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('compliance_documents');
    }
};


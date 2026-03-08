<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('company_employees', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('code', 40)->nullable()->unique();
            $table->string('document_id', 60)->unique();
            $table->string('name', 160);
            $table->enum('employment_type', ['own', 'external', 'contractor'])->default('own');
            $table->uuid('subcontractor_id')->nullable();
            $table->string('role_title', 120)->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('email', 180)->nullable();
            $table->enum('status', ['active', 'inactive', 'suspended'])->default('active');
            $table->date('contract_start')->nullable();
            $table->date('contract_end')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->foreign('subcontractor_id')->references('id')->on('subcontractors')->nullOnDelete();
            $table->index(['employment_type', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_employees');
    }
};


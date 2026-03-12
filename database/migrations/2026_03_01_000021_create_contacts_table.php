<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('contacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('user_id')->nullable();
            $table->string('display_name', 120)->nullable();
            $table->string('legal_name', 180)->nullable();
            $table->string('document_id', 60)->nullable();
            $table->string('phone', 40)->nullable();
            $table->string('phone_alt', 40)->nullable();
            $table->string('email', 120)->nullable();
            $table->string('address_line', 220)->nullable();
            $table->string('address_street', 180)->nullable();
            $table->string('address_number', 40)->nullable();
            $table->string('postal_code', 20)->nullable();
            $table->string('city', 80)->nullable();
            $table->string('province', 80)->nullable();
            $table->string('country', 80)->nullable();
            $table->string('address_notes', 220)->nullable();
            $table->string('kind', 20)->nullable(); // sender | recipient | both
            $table->timestamps();

            $table->index('phone');
            $table->index('email');
            $table->index('document_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};

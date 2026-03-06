<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->string('priority', 10)->nullable()->after('category');
            $table->timestamp('sla_due_at')->nullable()->after('priority');
        });

        $rows = DB::table('incidents')->get(['id', 'category', 'created_at']);
        foreach ($rows as $row) {
            $priority = match ((string) $row->category) {
                'failed' => 'high',
                'absent', 'retry' => 'medium',
                default => 'low',
            };
            $minutes = match ($priority) {
                'high' => 4 * 60,
                'medium' => 8 * 60,
                default => 24 * 60,
            };
            $created = strtotime((string) $row->created_at) ?: time();
            DB::table('incidents')->where('id', $row->id)->update([
                'priority' => $priority,
                'sla_due_at' => date('Y-m-d H:i:s', $created + ($minutes * 60)),
            ]);
        }
    }

    public function down(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn(['priority', 'sla_due_at']);
        });
    }
};


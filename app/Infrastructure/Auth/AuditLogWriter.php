<?php

namespace App\Infrastructure\Auth;

use Illuminate\Support\Facades\DB;

final class AuditLogWriter
{
    public function write(?string $actorUserId, string $event, array $metadata = []): void
    {
        DB::table('audit_logs')->insert([
            'actor_user_id' => $actorUserId,
            'event' => $event,
            'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}

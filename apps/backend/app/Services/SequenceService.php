<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

final class SequenceService
{
    public function next(string $entity): int
    {
        return (int) DB::transaction(function () use ($entity) {
            $row = DB::table('sequence_counters')
                ->where('entity', $entity)
                ->lockForUpdate()
                ->first();

            if (!$row) {
                DB::table('sequence_counters')->insert([
                    'entity' => $entity,
                    'next_number' => 2,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                return 1;
            }

            $next = (int) $row->next_number;
            DB::table('sequence_counters')
                ->where('entity', $entity)
                ->update([
                    'next_number' => $next + 1,
                    'updated_at' => now(),
                ]);

            return $next;
        });
    }

    public function nextPadded(string $entity, int $length): string
    {
        return str_pad((string) $this->next($entity), $length, '0', STR_PAD_LEFT);
    }
}

<?php

namespace App\Jobs;

use App\Infrastructure\Auth\AuditLogWriter;
use App\Services\Shipments\ShipmentImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

final class ImportShipmentsCsvJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        private readonly string $importId,
        private readonly string $path,
        private readonly ?string $actorUserId
    ) {}

    public function handle(ShipmentImportService $importService, AuditLogWriter $auditLogWriter): void
    {
        DB::table('shipments_import_jobs')
            ->where('id', $this->importId)
            ->update([
                'status' => 'processing',
                'started_at' => now(),
                'updated_at' => now(),
            ]);

        try {
            $fullPath = Storage::path($this->path);
            $result = $importService->importFromCsvPath($fullPath, false);

            DB::table('shipments_import_jobs')
                ->where('id', $this->importId)
                ->update([
                    'status' => 'completed',
                    'created_count' => $result['created_count'] ?? 0,
                    'error_count' => $result['error_count'] ?? 0,
                    'skipped_count' => $result['skipped_count'] ?? 0,
                    'warnings' => json_encode($result['warnings'] ?? [], JSON_THROW_ON_ERROR),
                    'unknown_columns' => json_encode($result['unknown_columns'] ?? [], JSON_THROW_ON_ERROR),
                    'completed_at' => now(),
                    'updated_at' => now(),
                ]);

            $auditLogWriter->write($this->actorUserId, 'shipments.import.completed', [
                'import_id' => $this->importId,
                'path' => $this->path,
                'created_count' => $result['created_count'] ?? 0,
                'error_count' => $result['error_count'] ?? 0,
                'warnings' => $result['warnings'] ?? [],
            ]);
        } catch (\Throwable $exception) {
            DB::table('shipments_import_jobs')
                ->where('id', $this->importId)
                ->update([
                    'status' => 'failed',
                    'error_message' => $exception->getMessage(),
                    'completed_at' => now(),
                    'updated_at' => now(),
                ]);
            $auditLogWriter->write($this->actorUserId, 'shipments.import.failed', [
                'import_id' => $this->importId,
                'path' => $this->path,
                'error' => $exception->getMessage(),
            ]);
        }
    }
}

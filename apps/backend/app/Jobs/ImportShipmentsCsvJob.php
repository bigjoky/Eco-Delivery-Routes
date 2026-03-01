<?php

namespace App\Jobs;

use App\Infrastructure\Auth\AuditLogWriter;
use App\Services\Shipments\ShipmentImportService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

final class ImportShipmentsCsvJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(
        private readonly string $path,
        private readonly ?string $actorUserId
    ) {}

    public function handle(ShipmentImportService $importService, AuditLogWriter $auditLogWriter): void
    {
        $fullPath = Storage::path($this->path);
        $result = $importService->importFromCsvPath($fullPath, false);

        $auditLogWriter->write($this->actorUserId, 'shipments.import.completed', [
            'path' => $this->path,
            'created_count' => $result['created_count'] ?? 0,
            'error_count' => $result['error_count'] ?? 0,
            'warnings' => $result['warnings'] ?? [],
        ]);
    }
}

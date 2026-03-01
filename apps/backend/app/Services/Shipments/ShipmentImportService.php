<?php

namespace App\Services\Shipments;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ShipmentImportService
{
    /**
     * @return array<string, mixed>
     */
    public function importFromCsvPath(string $path, bool $dryRun): array
    {
        $minScheduled = Carbon::now()->subDays(30);
        $maxScheduled = Carbon::now()->addDays(180);
        $allowedHeaders = [
            'hub_code',
            'reference',
            'consignee_name',
            'address_line',
            'address_street',
            'address_number',
            'postal_code',
            'city',
            'province',
            'country',
            'address_notes',
            'consignee_phone',
            'consignee_email',
            'scheduled_at',
            'service_type',
        ];

        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new \RuntimeException('No se pudo leer el CSV');
        }

        $header = fgetcsv($handle);
        if ($header === false) {
            fclose($handle);
            throw new \RuntimeException('CSV sin cabecera');
        }

        $normalizedHeader = array_map(static fn ($value) => strtolower(trim((string) $value)), $header);
        foreach (['hub_code', 'reference'] as $required) {
            if (!in_array($required, $normalizedHeader, true)) {
                fclose($handle);
                throw new \RuntimeException("Falta columna requerida: {$required}");
            }
        }

        $unknownColumns = array_values(array_diff($normalizedHeader, $allowedHeaders));
        $warnings = [];
        foreach ($unknownColumns as $column) {
            $warnings[] = "Columna desconocida: {$column}";
        }

        $rows = [];
        $errors = [];
        $seenReferences = [];
        $insertRows = [];
        $rowNumber = 1;

        while (($data = fgetcsv($handle)) !== false) {
            $rowNumber++;
            if ($data === [null] || $data === false) {
                continue;
            }
            $row = [];
            foreach ($normalizedHeader as $index => $column) {
                $row[$column] = isset($data[$index]) ? trim((string) $data[$index]) : '';
            }

            $reference = $row['reference'] ?? '';
            $hubCode = $row['hub_code'] ?? '';
            $scheduledAt = $row['scheduled_at'] ?? '';
            $serviceType = $row['service_type'] ?? 'delivery';

            $rowErrors = [];
            if ($hubCode === '') {
                $rowErrors[] = 'hub_code requerido';
            }
            if ($reference === '') {
                $rowErrors[] = 'reference requerido';
            }

            $hubId = null;
            if ($hubCode !== '') {
                $hubId = DB::table('hubs')->where('code', $hubCode)->value('id');
                if (!$hubId) {
                    $rowErrors[] = 'hub_code no existe';
                }
            }

            if ($reference !== '') {
                if (isset($seenReferences[$reference])) {
                    $rowErrors[] = 'reference duplicada en CSV';
                } else {
                    $seenReferences[$reference] = true;
                }
                if (DB::table('shipments')->where('reference', $reference)->exists()) {
                    $rowErrors[] = 'reference ya existe';
                }
            }

            $scheduledAtValue = null;
            if ($scheduledAt !== '') {
                try {
                    $scheduledAtValue = Carbon::parse($scheduledAt);
                    if ($scheduledAtValue->lt($minScheduled) || $scheduledAtValue->gt($maxScheduled)) {
                        $rowErrors[] = 'scheduled_at fuera de ventana';
                    }
                } catch (\Throwable $e) {
                    $rowErrors[] = 'scheduled_at invalido';
                }
            }

            if ($serviceType === '') {
                $serviceType = 'delivery';
            }

            if ($rowErrors === []) {
                $insertRows[] = [
                    'id' => (string) Str::uuid(),
                    'hub_id' => $hubId,
                    'reference' => $reference,
                    'consignee_name' => $this->normalizeTitle($row['consignee_name'] ?? null),
                    'address_line' => $this->composeAddressLine($row),
                    'address_street' => $this->normalizeTitle($row['address_street'] ?? null),
                    'address_number' => $this->normalizeText($row['address_number'] ?? null),
                    'postal_code' => $this->normalizeText($row['postal_code'] ?? null),
                    'city' => $this->normalizeTitle($row['city'] ?? null),
                    'province' => $this->normalizeTitle($row['province'] ?? null),
                    'country' => $this->normalizeText($row['country'] ?? null),
                    'address_notes' => $this->normalizeText($row['address_notes'] ?? null),
                    'consignee_phone' => $this->normalizeText($row['consignee_phone'] ?? null),
                    'consignee_email' => $this->normalizeText($row['consignee_email'] ?? null),
                    'scheduled_at' => $scheduledAtValue?->format('Y-m-d H:i:s'),
                    'service_type' => $serviceType,
                    'status' => 'created',
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
                $rows[] = [
                    'row' => $rowNumber,
                    'reference' => $reference,
                    'status' => 'ok',
                ];
            } else {
                $errors[] = [
                    'row' => $rowNumber,
                    'reference' => $reference,
                    'status' => 'error',
                    'errors' => $rowErrors,
                ];
            }
        }

        fclose($handle);

        $createdCount = 0;
        if (!$dryRun && $insertRows !== []) {
            DB::table('shipments')->insert($insertRows);
            $createdCount = count($insertRows);
        }

        return [
            'dry_run' => $dryRun,
            'created_count' => $dryRun ? 0 : $createdCount,
            'skipped_count' => count($errors),
            'error_count' => count($errors),
            'rows' => array_merge($rows, $errors),
            'warnings' => $warnings,
            'unknown_columns' => $unknownColumns,
        ];
    }

    private function composeAddressLine(array $row): ?string
    {
        $street = $this->normalizeTitle($row['address_street'] ?? null) ?? '';
        $number = $this->normalizeText($row['address_number'] ?? null) ?? '';
        $postal = $this->normalizeText($row['postal_code'] ?? null) ?? '';
        $city = $this->normalizeTitle($row['city'] ?? null) ?? '';
        $province = $this->normalizeTitle($row['province'] ?? null) ?? '';
        $country = $this->normalizeText($row['country'] ?? null) ?? '';
        $fallback = $this->normalizeText($row['address_line'] ?? null) ?? '';

        $parts = [];
        if ($street !== '') {
            $parts[] = $number !== '' ? $street . ' ' . $number : $street;
        }
        $locality = trim($postal . ' ' . $city);
        if ($locality !== '') {
            $parts[] = $locality;
        }
        if ($province !== '') {
            $parts[] = $province;
        }
        if ($country !== '') {
            $parts[] = $country;
        }

        if ($parts === []) {
            return $fallback !== '' ? $fallback : null;
        }

        return implode(', ', $parts);
    }

    private function normalizeText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $trimmed = trim(preg_replace('/\\s+/', ' ', (string) $value));
        return $trimmed === '' ? null : $trimmed;
    }

    private function normalizeTitle(?string $value): ?string
    {
        $normalized = $this->normalizeText($value);
        if ($normalized === null) {
            return null;
        }
        $lower = mb_strtolower($normalized, 'UTF-8');
        return mb_convert_case($lower, MB_CASE_TITLE, 'UTF-8');
    }
}

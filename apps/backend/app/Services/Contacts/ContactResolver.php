<?php

namespace App\Services\Contacts;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ContactResolver
{
    /**
     * @param array<string, mixed> $payload
     */
    public function resolve(array $payload, string $kind): ?string
    {
        $name = $this->normalizeTitle($payload['name'] ?? null);
        $legalName = $this->normalizeTitle($payload['legal_name'] ?? null);
        $documentId = $this->normalizeText($payload['document_id'] ?? null);
        $phone = $this->normalizePhone($payload['phone'] ?? null);
        $email = $this->normalizeText($payload['email'] ?? null);

        $addressLine = $this->normalizeText($payload['address_line'] ?? null);
        $addressStreet = $this->normalizeText($payload['address_street'] ?? null);
        $city = $this->normalizeText($payload['city'] ?? null);
        $hasAddress = $addressLine || $addressStreet || $city;

        if (!$name && !$legalName && !$documentId && !$phone && !$email && !$hasAddress) {
            return null;
        }

        $query = DB::table('contacts');
        if ($phone) {
            $query->where('phone', $phone);
        } elseif ($email) {
            $query->where('email', $email);
        } elseif ($documentId) {
            $query->where('document_id', $documentId);
        } else {
            $query->where('display_name', $name ?? $legalName ?? '');
        }

        $existing = $query->first();
        if ($existing) {
            $updates = $this->buildUpdatePayload($payload, $kind, $existing);
            if ($updates !== []) {
                DB::table('contacts')->where('id', $existing->id)->update($updates + ['updated_at' => now()]);
            }
            return (string) $existing->id;
        }

        $id = (string) Str::uuid();
        DB::table('contacts')->insert($this->buildInsertPayload($id, $payload, $kind));
        return $id;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function buildInsertPayload(string $id, array $payload, string $kind): array
    {
        return [
            'id' => $id,
            'user_id' => $payload['user_id'] ?? null,
            'display_name' => $this->normalizeTitle($payload['name'] ?? null),
            'legal_name' => $this->normalizeTitle($payload['legal_name'] ?? null),
            'document_id' => $this->normalizeText($payload['document_id'] ?? null),
            'phone' => $this->normalizePhone($payload['phone'] ?? null),
            'phone_alt' => $this->normalizePhone($payload['phone_alt'] ?? null),
            'email' => $this->normalizeText($payload['email'] ?? null),
            'address_line' => $this->normalizeText($payload['address_line'] ?? null),
            'address_street' => $this->normalizeTitle($payload['address_street'] ?? null),
            'address_number' => $this->normalizeText($payload['address_number'] ?? null),
            'postal_code' => $this->normalizeText($payload['postal_code'] ?? null),
            'city' => $this->normalizeTitle($payload['city'] ?? null),
            'province' => $this->normalizeTitle($payload['province'] ?? null),
            'country' => $this->normalizeText($payload['country'] ?? null),
            'address_notes' => $this->normalizeText($payload['address_notes'] ?? null),
            'kind' => $kind,
            'created_at' => now(),
            'updated_at' => now(),
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @param object $existing
     * @return array<string, mixed>
     */
    private function buildUpdatePayload(array $payload, string $kind, object $existing): array
    {
        $updates = [];
        $updates = $this->fillIfEmpty($updates, 'display_name', $existing, $this->normalizeTitle($payload['name'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'legal_name', $existing, $this->normalizeTitle($payload['legal_name'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'document_id', $existing, $this->normalizeText($payload['document_id'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'phone_alt', $existing, $this->normalizePhone($payload['phone_alt'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'email', $existing, $this->normalizeText($payload['email'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'address_line', $existing, $this->normalizeText($payload['address_line'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'address_street', $existing, $this->normalizeTitle($payload['address_street'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'address_number', $existing, $this->normalizeText($payload['address_number'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'postal_code', $existing, $this->normalizeText($payload['postal_code'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'city', $existing, $this->normalizeTitle($payload['city'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'province', $existing, $this->normalizeTitle($payload['province'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'country', $existing, $this->normalizeText($payload['country'] ?? null));
        $updates = $this->fillIfEmpty($updates, 'address_notes', $existing, $this->normalizeText($payload['address_notes'] ?? null));

        if (($existing->kind ?? null) === null) {
            $updates['kind'] = $kind;
        } elseif ($existing->kind !== $kind && $existing->kind !== 'both') {
            $updates['kind'] = 'both';
        }

        return $updates;
    }

    /**
     * @param array<string, mixed> $updates
     * @param object $existing
     * @param mixed $value
     * @return array<string, mixed>
     */
    private function fillIfEmpty(array $updates, string $field, object $existing, mixed $value): array
    {
        if ($value !== null && ($existing->{$field} ?? null) === null) {
            $updates[$field] = $value;
        }
        return $updates;
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
        $value = $this->normalizeText($value);
        if ($value === null) {
            return null;
        }
        return mb_convert_case($value, MB_CASE_TITLE, 'UTF-8');
    }

    private function normalizePhone(?string $value): ?string
    {
        $value = $this->normalizeText($value);
        if ($value === null) {
            return null;
        }
        return preg_replace('/\\s+/', ' ', $value) ?: $value;
    }
}

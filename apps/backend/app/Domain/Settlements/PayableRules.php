<?php

namespace App\Domain\Settlements;

final class PayableRules
{
    /**
     * Reglas negocio subcontrata:
     * - Solo entrega delivered con POD válido es pagable.
     * - Reintento y ausencia no son pagables.
     */
    public static function isShipmentPayable(array $shipment): bool
    {
        $status = (string) ($shipment['status'] ?? '');
        $hasPod = (bool) ($shipment['has_pod'] ?? false);
        $incidentCategory = strtolower((string) ($shipment['incident_category'] ?? ''));

        if ($status !== 'delivered') {
            return false;
        }

        if (!$hasPod) {
            return false;
        }

        if (in_array($incidentCategory, ['retry', 'absent'], true)) {
            return false;
        }

        return true;
    }

    /**
     * Reglas negocio recogida:
     * - NORMAL y RETURN se pagan (tarifa independiente) solo si completed con evidencia.
     */
    public static function isPickupPayable(array $pickup): bool
    {
        $type = strtoupper((string) ($pickup['pickup_type'] ?? ''));
        $status = (string) ($pickup['status'] ?? '');
        $hasEvidence = (bool) ($pickup['has_evidence'] ?? false);
        $incidentCategory = strtolower((string) ($pickup['incident_category'] ?? ''));

        if (!in_array($type, ['NORMAL', 'RETURN'], true)) {
            return false;
        }

        if ($status !== 'completed') {
            return false;
        }

        if (!$hasEvidence) {
            return false;
        }

        if (in_array($incidentCategory, ['retry', 'absent'], true)) {
            return false;
        }

        return true;
    }
}

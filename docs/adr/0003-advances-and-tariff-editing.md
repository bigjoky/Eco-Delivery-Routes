# ADR 0003: Gestion de Anticipos y Edicion de Tarifas

- Date: 2026-02-27
- Status: Accepted

## Context
Contabilidad necesita operar anticipos y mantener tarifas sin salir del backoffice web.

## Decision
1. Se añade API de anticipos (`advances`) para listar, crear, editar (solo requested) y aprobar.
2. Se habilita edicion de tarifas existentes mediante `PATCH /tariffs/{id}`.
3. Se integra en web una pantalla nueva de `Anticipos` y mejoras en `Tarifas` para alta/edicion.

## Consequences
- Operativa mensual de liquidacion más completa en MVP.
- Menor friccion para contabilidad al gestionar anticipos y correcciones de precio.

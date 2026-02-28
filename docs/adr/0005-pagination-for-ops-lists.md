# ADR 0005: Paginacion y Ordenacion en Listados Operativos

- Date: 2026-02-27
- Status: Accepted

## Context
Los listados de operaciones estaban limitados con `limit(100)` sin control de pagina, lo que no escala para backoffice real.

## Decision
1. Se añade paginacion y ordenacion backend en:
   - `GET /shipments`
   - `GET /settlements`
   - `GET /advances`
2. Parametros estandar:
   - `page`, `per_page`, `sort`, `dir`
3. Respuesta estandarizada:
   - `data`
   - `meta { page, per_page, total, last_page }`
4. Web adapta consumo con navegacion `Anterior/Siguiente` en las tres vistas.

## Consequences
- Mejor rendimiento y UX en backoffice con volumen.
- Contrato de listado consistente para siguientes modulos.

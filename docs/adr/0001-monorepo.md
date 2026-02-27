# ADR-0001: Monorepo para Eco Delivery Routes

- Fecha: 2026-02-27
- Estado: Accepted

## Contexto

El producto requiere backend + web + apps nativas Apple + Android con dominio y contratos compartidos.

## Decisión

Se adopta monorepo con separación por `apps/*` y documentación transversal en `docs/*`.

## Consecuencias

Positivas:
- Cambios cross-platform coordinados en una sola PR.
- Menor deriva entre contratos API y clientes.
- Pipeline de calidad y seguridad unificado.

Negativas:
- Pipeline inicial más complejo.
- Requiere disciplina para no acoplar módulos sin necesidad.

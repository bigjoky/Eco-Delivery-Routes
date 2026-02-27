# MVP Status Board (Eco Delivery Routes)

Fecha de corte: 2026-02-27

| Área | Estado | Cobertura actual | Riesgo |
|---|---|---|---|
| Backend Auth/RBAC | En progreso | Roles/permisos base + permisos calidad dashboard/export | Medio |
| Backend Operativa (shipments/routes/pickups/incidents/pod) | En progreso | Endpoints v1 + tests HTTP | Medio |
| Backend Calidad KPI | En progreso | snapshots + top rutas bajo umbral + riesgo agregado + export CSV/PDF | Bajo |
| Backend Liquidaciones | En progreso | preview/finalize/approve/export/paid + ajustes + auditoría | Medio |
| Web Backoffice | En progreso | filtros, exports, auditoría expandible, riesgo operativo | Medio |
| Android Driver | En progreso | login/ruta/scan/pod/pickup/incidencias + KPI ruta lectura | Medio |
| iOS Driver | En progreso | login/ruta/scan/pod/pickup/incidencias + KPI ruta lectura | Medio |
| macOS Ops | En progreso | operativa + módulos base + KPI ruta lectura | Medio |
| tvOS Dashboard | En progreso | dashboard lectura + polling + API real con fallback | Bajo |
| CI/CD | Pendiente parcial | pruebas manuales ejecutadas localmente | Alto |

## Bloqueadores actuales

1. Remoto Git no configurado en workspace (sin push/PR efectivos).
2. Falta cerrar pipeline CI real (lint/test/build por app).
3. Falta consolidar estrategia de despliegue por entorno (dev/staging/prod).

## Próximo hito recomendado

- Objetivo: MVP operativo en staging con flujo completo `driver -> operación -> calidad -> liquidación`.

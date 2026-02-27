# QA Checklist Base

## Backend/API

- [ ] Endpoints documentados en OpenAPI.
- [ ] Validaciones cubiertas por tests de feature.
- [ ] RBAC verificado para roles críticos.
- [ ] Errores estandarizados (código + mensaje).

## Clientes

- [ ] Manejo de sesión y estados de carga/error.
- [ ] Acceso por rol respetado en UI.
- [ ] Navegación mínima funcional.
- [ ] Modo mock disponible para desarrollo local.

## Seguridad/Operación

- [ ] Rate limiting configurado.
- [ ] Logging estructurado de eventos clave.
- [ ] Auditoría de login/logout y acciones administrativas.

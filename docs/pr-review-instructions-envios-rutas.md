# Review Instructions - PR Consolidacion Envios/Rutas

Usar este comentario como guia de revision en la PR.

## Orden de revision recomendado

1. **Backend**
   - Revisar controladores y contratos de `driver/me/route`, `routes`, `routes/{id}/stops`.
   - Validar endpoints de breakdown de calidad (route/driver), export CSV/PDF y OpenAPI.
   - Confirmar pruebas feature/domain en verde.

2. **Web**
   - Revisar tipos API y cliente para contrato de entidad (`entity_type`, `entity_id`, `reference`).
   - Validar tests de flujo operativo (`scan -> pod -> incidencia`).
   - Revisar pantallas de rutas y detalle.

3. **Android**
   - Confirmar parser de stops normalizado y tests unitarios.
   - Validar fecha por defecto de ruta y llamadas operativas.

4. **Apple**
   - Confirmar paridad en SharedCore y apps (filtros de ruta + operaciones por entidad).
   - Revisar tests de SharedCore para contratos y filtros.

5. **Docs / Hygiene**
   - Revisar ADRs, arquitectura, checklist y script de release.
   - Verificar `.gitignore` para evitar artefactos runtime en commits.

## Comando de validacion integral

```bash
./scripts/verify_release_envios_rutas.sh
```

## Criterio de aprobacion

- Contrato operativo consistente en backend/web/android/apple.
- OpenAPI alineado con implementación.
- Tests y build verdes en las 4 apps.
- Sin artefactos runtime ni cambios no relacionados.

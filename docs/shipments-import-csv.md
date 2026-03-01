# Importacion CSV de envios

## Archivo esperado
- Codificacion: UTF-8
- Separador: coma (`,`) con valores entre comillas cuando sea necesario.
- Primera fila: cabeceras.

## Columnas (orden recomendado)
1. `hub_code` (obligatorio)
2. `reference` (obligatorio, unico)
3. `consignee_name` (opcional)
4. `address_street` (opcional)
5. `address_number` (opcional)
6. `postal_code` (opcional)
7. `city` (opcional)
8. `province` (opcional)
9. `country` (opcional)
10. `address_notes` (opcional)
11. `consignee_phone` (opcional)
12. `consignee_email` (opcional)
13. `scheduled_at` (opcional, ISO-8601 `YYYY-MM-DDTHH:MM:SSZ`)
14. `service_type` (opcional, por defecto `delivery`)

## Reglas
- `hub_code` debe existir en la tabla `hubs`.
- `reference` es unica por envio.
- `scheduled_at` fuera de ventana se rechaza (ventana actual: desde hoy - 30 dias hasta hoy + 180 dias).
- Si `address_line` viene vacio y hay campos estructurados, se compone automaticamente.
- Valores vacios se interpretan como `null`.
- Si se envia `dry_run=1`, no se insertan filas y se devuelve el preview con errores.
- Endpoint plantilla: `GET /api/v1/shipments/template.csv`.
- Importacion async: `POST /api/v1/shipments/import?async=1` (encola el proceso).
- Requiere cola activa: configurar `QUEUE_CONNECTION=database` y ejecutar `php artisan queue:work`.

## Ejemplo
```
hub_code,reference,consignee_name,address_street,address_number,postal_code,city,province,country,address_notes,consignee_phone,consignee_email,scheduled_at,service_type
AGP-HUB-01,SHP-AGP-0009,Cliente Demo,Calle Larios,12,29001,Malaga,Malaga,ES,Portal azul,+34950111222,cliente@eco.local,2026-03-05T08:30:00Z,delivery
AGP-HUB-01,SHP-AGP-0010,Cliente Centro,Calle Granada,7,29001,Malaga,Malaga,ES,Recepcion,,"",2026-03-05T11:00:00Z,delivery
```

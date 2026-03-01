# Importacion CSV de envios

## Archivo esperado
- Codificacion: UTF-8
- Separador: coma (`,`) con valores entre comillas cuando sea necesario.
- Primera fila: cabeceras.

## Columnas (orden recomendado)
1. `hub_code` (obligatorio)
2. `reference` (obligatorio, unico)
3. `consignee_name` (opcional)
4. `address_line` (opcional)
5. `scheduled_at` (opcional, ISO-8601 `YYYY-MM-DDTHH:MM:SSZ`)
6. `service_type` (opcional, por defecto `delivery`)

## Reglas
- `hub_code` debe existir en la tabla `hubs`.
- `reference` es unica por envio.
- `scheduled_at` fuera de ventana se rechaza (ventana actual: desde hoy - 30 dias hasta hoy + 180 dias).
- Valores vacios se interpretan como `null`.

## Ejemplo
```
hub_code,reference,consignee_name,address_line,scheduled_at,service_type
AGP-HUB-01,SHP-AGP-0009,Cliente Demo,Calle Larios 12,2026-03-05T08:30:00Z,delivery
AGP-HUB-01,SHP-AGP-0010,Cliente Centro,Calle Granada 7,2026-03-05T11:00:00Z,delivery
```

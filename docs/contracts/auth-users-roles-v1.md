# Contracts v1 (Auth + Users + Roles)

## UserSummary

```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "status": "pending|active|suspended"
}
```

## RoleSummary

```json
{
  "id": "uuid",
  "code": "super_admin|ops_manager|warehouse_operator|courier|viewer",
  "name": "string"
}
```

## AuthToken

```json
{
  "token": "string",
  "token_type": "Bearer"
}
```

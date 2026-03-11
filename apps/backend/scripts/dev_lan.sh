#!/usr/bin/env bash

set -euo pipefail

APP_PORT="${APP_PORT:-8000}"
VITE_PORT="${VITE_PORT:-5173}"
VITE_LISTEN_HOST="${VITE_LISTEN_HOST:-0.0.0.0}"

is_port_in_use() {
  local port="$1"
  lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
}

find_free_port() {
  local port="$1"
  while is_port_in_use "${port}"; do
    port="$((port + 1))"
  done
  printf '%s\n' "${port}"
}

detect_lan_ip() {
  if [[ -n "${LAN_IP_OVERRIDE:-}" ]]; then
    printf '%s\n' "${LAN_IP_OVERRIDE}"
    return 0
  fi

  if command -v route >/dev/null 2>&1 && command -v ipconfig >/dev/null 2>&1; then
    local interface
    interface="$(route get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
    if [[ -n "${interface}" ]]; then
      ipconfig getifaddr "${interface}" 2>/dev/null && return 0
    fi
  fi

  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1; exit}' && return 0
  fi

  if command -v ifconfig >/dev/null 2>&1; then
    ifconfig | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}' && return 0
  fi

  return 1
}

LAN_IP="$(detect_lan_ip || true)"

if [[ -z "${LAN_IP}" ]]; then
  printf 'No se pudo detectar una IP LAN activa.\n' >&2
  exit 1
fi

APP_PORT="$(find_free_port "${APP_PORT}")"
VITE_PORT="$(find_free_port "${VITE_PORT}")"

export APP_URL="http://${LAN_IP}:${APP_PORT}"
export SANCTUM_STATEFUL_DOMAINS="localhost,127.0.0.1,127.0.0.1:8000,127.0.0.1:${APP_PORT},${LAN_IP},${LAN_IP}:${APP_PORT}"
export VITE_DEV_HOST="${LAN_IP}"
export VITE_DEV_PORT="${VITE_PORT}"
export VITE_LISTEN_HOST

printf 'Eco Delivery Routes LAN\n'
printf '  APP_URL: %s\n' "${APP_URL}"
printf '  Vite HMR: http://%s:%s\n' "${VITE_DEV_HOST}" "${VITE_DEV_PORT}"

npx concurrently -c "#93c5fd,#c4b5fd,#fca5a5,#fdba74" \
  "php artisan serve --host=0.0.0.0 --port=${APP_PORT}" \
  "php artisan queue:listen --tries=1" \
  "php artisan pail --timeout=0" \
  "npm run dev:host"

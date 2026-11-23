#!/bin/sh
set -e

# El contenedor de MySQL tarda en aceptar conexiones aunque el healthcheck ya
# diga healthy. Sin esta espera, las migraciones fallan y la app arranca con
# la base vacia.
esperar_bd() {
  intento=1
  while [ "$intento" -le 45 ]; do
    if node -e "
      const net = require('net');
      const socket = net.connect({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306) }, () => {
        socket.end();
        process.exit(0);
      });
      socket.on('error', () => process.exit(1));
      setTimeout(() => process.exit(1), 2000);
    " 2>/dev/null; then
      return 0
    fi
    echo "=== [API] Esperando la base de datos (intento $intento) ==="
    intento=$((intento + 1))
    sleep 2
  done
  return 1
}

esperar_bd || echo "=== [API] La base no respondio; se intenta igual ==="

if [ "$AUTO_MIGRATE" != "false" ]; then
  echo "=== [API] Ejecutando migraciones ==="
  npm run migration:run || echo "Aviso: no se pudieron aplicar las migraciones."
fi

if [ "$AUTO_SEED" = "true" ]; then
  echo "=== [API] Ejecutando seeders ==="
  npm run seed || echo "Aviso: los seeders no se aplicaron."
fi

echo "=== [API] Iniciando servicio en puerto ${PORT:-3000} ==="
exec "$@"

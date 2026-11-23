# Flujos de negocio (pruebas de recorrido)

Pruebas que recorren una historia completa a través de endpoints, en orden, con un `it()` por paso. Complementan a la suite de recursos (`src/test/e2e/api.test.ts`): esa verifica que cada endpoint responda bien por separado; estas verifican que la costura entre módulos funcione (invitación → activación → sesión → alta de catálogo → publicación → cotización).

> Referencia completa de las 58 operaciones y de todos los flujos (también los que no tienen prueba): [docs/api/operaciones-y-flujos.md](../api/operaciones-y-flujos.md).

## Cómo correrlas

```bash
npm run test:flow     # compila, recrea turista_test, siembra y corre todos los flujos
npm test              # suite rápida de recursos
```

Cada comando recrea la base de test por su cuenta.

## Convenciones

- **Solo endpoints**: los pasos no tocan repositorios ni tablas. La única excepción es leer el buzón falso de correo, porque el token de activación solo existe en el mensaje.
- **Un archivo por flujo** en `src/test/flow/`, con el nombre `<flujo>.flow.test.ts`.
- **Un documento por flujo** en `docs/flujos/NN-<flujo>.md`, con la tabla de pasos y las reglas que valida.
- **Datos únicos por corrida** (sufijo `RUN`), para que no haga falta limpiar entre flujos.
- El administrador **viene del seeder**; no se crea por API.
- Cada flujo es autocontenido (helpers incluidos) para poder leerse aislado.

## Índice

| # | Flujo | Documento | Prueba | Estado |
|---|---|---|---|---|
| 01 | De cero a paquete publicado (admin → agencia → activación → paquete) | [01-agencia-paquetes.md](01-agencia-paquetes.md) | `agencia-paquetes.flow.test.ts` | ✅ hecho (18 pasos) |
| 02 | Hotel: alta → habitación → inventario → disponibilidad por noches | [02-hotel-inventario.md](02-hotel-inventario.md) | `hotel-inventario.flow.test.ts` | ✅ hecho (17 pasos) |
| 03 | Agente: cotización multi-servicio con credencial de servicio y vencimiento | [03-agente-cotizacion.md](03-agente-cotizacion.md) | `agente-cotizacion.flow.test.ts` | ✅ hecho (16 pasos) |
| 04 | Cierre rápido y cupo: una fecha cerrada deja de ofrecerse | — | — | ✅ cubierto por el flujo 02 (pasos 15–16) |
| 05 | Equipo del socio: invitar staff, activarlo y comprobar permisos owner/staff | — | — | propuesto |
| 06 | Rechazo de solicitud: motivo obligatorio, correo y estado final | — | — | propuesto |
| 07 | Alta de administradores | — | — | bloqueado: falta el endpoint |

## Qué NO cubren

- Interfaz web ni contrato visual.
- Pagos, bloqueo de inventario y reservas: no existen todavía en el API.
- Concurrencia y carga.
- Desglose fiscal por estado (IVA/ISH).

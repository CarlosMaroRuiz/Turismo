# Guía de Pruebas E2E

Este proyecto utiliza el runner nativo de Node (`node:test`) junto con `tsx` y un cliente HTTP tipado (`apiRequest`) para validar los endpoints de la API de extremo a extremo.

---

## Cómo crear y ejecutar una nueva suite E2E

1. Crea un archivo dentro de `src/test/e2e/` con la terminación `.e2e.ts` (por ejemplo: `partner.e2e.ts`).
2. Implementa las pruebas usando `describe`, `it` de `node:test`, `assert` de `node:assert/strict` y el helper `apiRequest<T>`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { apiRequest } from "./helpers/api-client.js";

describe("E2E: /api/partners", () => {
  it("POST /partners/register -> 201 registra solicitud", async () => {
    const { status, body } = await apiRequest("/partners/register", {
      method: "POST",
      body: { /* payload */ },
    });

    assert.equal(status, 201);
    assert.equal(body.ok, true);
  });
});
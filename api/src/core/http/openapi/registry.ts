import type { ZodType } from "zod";

export type HttpMethod = "get" | "post" | "patch" | "put" | "delete";

export interface RouteDoc {
  method: HttpMethod;
  /** Ruta completa, incluido el prefijo de versión: /api/v1/auth/login */
  path: string;
  summary: string;
  tags: string[];
  auth: "none" | "user" | "service";
  /** Roles globales que pueden invocar la ruta (informativo para el contrato). */
  roles?: string[];
  /** Cuerpo esperado; se convierte a JSON Schema desde el mismo Zod que valida. */
  body?: ZodType;
  query?: ZodType;
  successStatus?: number;
  successDescription?: string;
}

const routes: RouteDoc[] = [];

/**
 * Registra la documentación de un grupo de rutas. Se llama al construir el
 * router, junto a las definiciones reales, para que el contrato no se separe
 * del código que valida.
 */
export function registerRoutes(
  tag: string,
  docs: Omit<RouteDoc, "tags">[]
): void {
  for (const doc of docs) {
    const existingIndex = routes.findIndex(
      (route) => route.method === doc.method && route.path === doc.path
    );
    const entry: RouteDoc = { ...doc, tags: [tag] };

    if (existingIndex >= 0) {
      routes[existingIndex] = entry;
    } else {
      routes.push(entry);
    }
  }
}

export function getRegisteredRoutes(): readonly RouteDoc[] {
  return routes;
}

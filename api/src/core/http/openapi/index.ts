import { z } from "zod";
import type { ZodType } from "zod";
import { getRegisteredRoutes, type RouteDoc } from "./registry.js";

export type { RouteDoc } from "./registry.js";
export { registerRoutes } from "./registry.js";

const API_PREFIX = "/api/v1";

const errorResponseSchema = {
  type: "object",
  required: ["ok", "code", "message"],
  properties: {
    ok: { type: "boolean", enum: [false] },
    code: {
      type: "string",
      description:
        "Código estable legible por máquina, por ejemplo VALIDATION_ERROR o PARTNER_INACTIVE.",
    },
    message: { type: "string" },
    errors: {
      type: "object",
      additionalProperties: {
        type: "array",
        items: { type: "string" },
      },
      description: "Errores por campo cuando el código es VALIDATION_ERROR.",
    },
  },
} as const;

const successEnvelope = {
  type: "object",
  required: ["ok", "message", "data"],
  properties: {
    ok: { type: "boolean", enum: [true] },
    message: { type: "string" },
    data: {},
    meta: {
      type: "object",
      properties: {
        page: { type: "integer" },
        limit: { type: "integer" },
        total: { type: "integer" },
        totalPages: { type: "integer" },
      },
    },
  },
} as const;

function toJsonSchema(schema: ZodType | undefined): unknown {
  if (schema === undefined) {
    return undefined;
  }

  try {
    return z.toJSONSchema(schema, { io: "input" });
  } catch {
    // Un esquema con transformaciones no representables no debe tumbar el contrato.
    return undefined;
  }
}

/** Convierte un esquema Zod de query en parámetros individuales del spec. */
function toQueryParameters(schema: ZodType | undefined): unknown[] | undefined {
  if (schema === undefined) {
    return undefined;
  }

  const json = toJsonSchema(schema) as
    | { properties?: Record<string, unknown>; required?: string[] }
    | undefined;

  if (json?.properties === undefined) {
    return undefined;
  }

  const required = json.required ?? [];

  return Object.entries(json.properties).map(([name, propertySchema]) => ({
    name,
    in: "query",
    required: required.includes(name),
    schema: propertySchema,
  }));
}

function buildOperation(route: RouteDoc) {
  const responses: Record<string, unknown> = {};

  const successStatus = String(route.successStatus ?? 200);
  responses[successStatus] = {
    description: route.successDescription ?? "Operación exitosa",
    content: {
      "application/json": { schema: successEnvelope },
    },
  };

  if (route.auth !== "none") {
    responses["401"] = {
      description: "Token ausente, inválido, expirado o sesión revocada",
      content: { "application/json": { schema: errorResponseSchema } },
    };
    responses["403"] = {
      description:
        "Sin permisos, cuenta inactiva, socio suspendido o cambio de contraseña pendiente",
      content: { "application/json": { schema: errorResponseSchema } },
    };
  }

  responses["422"] = {
    description: "Datos inválidos (validación Zod)",
    content: { "application/json": { schema: errorResponseSchema } },
  };
  responses["429"] = {
    description: "Límite de peticiones excedido",
    content: { "application/json": { schema: errorResponseSchema } },
  };
  responses["500"] = {
    description: "Error interno",
    content: { "application/json": { schema: errorResponseSchema } },
  };

  const jsonSchema = toJsonSchema(route.body);
  const queryParameters = toQueryParameters(route.query);

  const operation: Record<string, unknown> = {
    tags: route.tags,
    summary: route.summary,
    responses,
  };

  if (route.auth !== "none") {
    operation.security = [{ bearerAuth: [] }];
  }

  if (jsonSchema !== undefined) {
    operation.requestBody = {
      required: true,
      content: { "application/json": { schema: jsonSchema } },
    };
  }

  if (queryParameters !== undefined) {
    operation.parameters = queryParameters;
  }

  if (route.roles !== undefined && route.roles.length > 0) {
    operation["x-allowed-roles"] = route.roles;
  }

  if (route.path.includes("{")) {
    responses["404"] = {
      description: "El recurso solicitado no existe",
      content: { "application/json": { schema: errorResponseSchema } },
    };
  }

  return operation;
}

/**
 * Documento OpenAPI 3.1 construido a partir de los esquemas Zod que validan
 * las peticiones, de modo que el contrato y la validación no puedan divergir.
 */
export function buildOpenApiDocument(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  const tags = new Map<string, { name: string }>();

  for (const route of getRegisteredRoutes()) {
    const relativePath = route.path.startsWith(API_PREFIX)
      ? route.path.slice(API_PREFIX.length)
      : route.path;

    const normalizedPath = relativePath.replace(/:([A-Za-z0-9_]+)/g, "{$1}");

    for (const tag of route.tags) {
      if (!tags.has(tag)) {
        tags.set(tag, { name: tag });
      }
    }

    paths[normalizedPath] ??= {};
    paths[normalizedPath]![route.method] = buildOperation(route);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Turismo API",
      version: "1.0.0",
      description:
        "API de la plataforma turística. Todos los listados devuelven `data` como arreglo y `meta` con la paginación.",
    },
    servers: [{ url: API_PREFIX, description: "Versión actual" }],
    tags: [...tags.values()],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Access token de vida corta. Se renueva con POST /auth/refresh.",
        },
      },
      schemas: {
        ApiError: errorResponseSchema,
        ApiSuccess: successEnvelope,
      },
    },
    paths,
  };
}

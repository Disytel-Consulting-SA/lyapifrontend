import type { DynamicField } from "../types/dynamicField";


function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  return normalized === "y" || normalized === "true" || normalized === "1";
}


function normalizeInteger(field: DynamicField, value: unknown): number {
  const normalized = Number(value);

  if (!Number.isFinite(normalized) || !Number.isInteger(normalized)) {
    throw new Error(`${field.name}: "${String(value)}" no es un entero válido`);
  }

  return normalized;
}


function normalizeNumber(field: DynamicField, value: unknown): number {
  const normalized = Number(value);

  if (!Number.isFinite(normalized)) {
    throw new Error(`${field.name}: "${String(value)}" no es un número válido`);
  }

  return normalized;
}


/**
 * Normaliza el valor de un campo dinámico según su tipo semántico.
 *
 * Es compartido por formularios de ventana y puede reutilizarse
 * para parámetros de procesos.
 */
export function normalizeDynamicFieldValue(field: DynamicField, value: unknown): unknown {
  const type = field.reference?.type;

  if (type === "boolean") return normalizeBoolean(value);
  if (type === "integer") return normalizeInteger(field, value);

  if (type === "number" || type === "amount" || type === "quantity" || type === "costprice") {
    return normalizeNumber(field, value);
  }

  if ((type === "lookup" || type === "search") && field.columnname.toUpperCase().endsWith("_ID")) {
    return normalizeInteger(field, value);
  }

  return String(value);
}

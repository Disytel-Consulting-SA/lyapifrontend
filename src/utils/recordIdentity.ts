import type { WindowSchemaTab } from "../types/metadata";

export type IdentityValue = string | number;
export type RecordIdentity = Record<string, IdentityValue>;
export type AncestorIdentities = Record<string, RecordIdentity>;

/** Extrae la identidad completa en el orden y con los nombres del diccionario. */
export function getRecordIdentity(
  tab: Pick<WindowSchemaTab, "pk_columns">,
  record: Record<string, unknown> | null | undefined
): RecordIdentity | null {
  const columns = tab.pk_columns ?? [];
  if (!record || columns.length === 0)
    return null;

  const entries: Array<[string, IdentityValue]> = [];
  const seen = new Set<string>();
  for (const column of columns) {
    const key = column.toLowerCase();
    if (seen.has(key))
      return null;
    seen.add(key);

    const matches = Object.keys(record).filter(name => name.toLowerCase() === key);
    if (matches.length !== 1)
      return null;
    const value = record[matches[0]];
    if (typeof value === "number" && Number.isSafeInteger(value))
      entries.push([column, value]);
    else if (typeof value === "string" && value.trim().length > 0)
      entries.push([column, value]);
    else
      return null;
  }
  return Object.fromEntries(entries);
}

/** Clave de selección sin colisiones por separadores ni dependencia del orden. */
export function identityKey(identity: RecordIdentity): string {
  return JSON.stringify(Object.entries(identity)
    .map(([column, value]) => [column.toLowerCase(), String(value)])
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}

export function sameIdentity(a: RecordIdentity | null, b: RecordIdentity | null): boolean {
  return a !== null && b !== null && identityKey(a) === identityKey(b);
}

/** Adaptación al contrato histórico de lectura con claves posicionales. */
export function identityPathValues(
  tab: Pick<WindowSchemaTab, "pk_columns">,
  identity: RecordIdentity
): IdentityValue[] | null {
  const normalized = getRecordIdentity(tab, identity);
  if (!normalized || Object.keys(identity).length !== Object.keys(normalized).length)
    return null;
  return (tab.pk_columns ?? []).map(column => normalized[column]);
}

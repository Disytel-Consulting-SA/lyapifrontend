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


/** Resuelve la rama completa; null distingue un contexto incompleto de una raíz. */
export function getAncestorIdentities(
  tab: WindowSchemaTab,
  tabs: WindowSchemaTab[],
  records: Record<number, Record<string, unknown> | null>
): AncestorIdentities | null {
  const entries: Array<[string, RecordIdentity]> = [];
  const visited = new Set<number>([tab.ad_tab_id]);
  let child = tab;
  while (child.tablevel > 0) {
    const parent = tabs.find(candidate => candidate.ad_tab_id === child.parent_ad_tab_id);
    if (!parent || visited.has(parent.ad_tab_id) || parent.tablevel !== child.tablevel - 1)
      return null;
    const identity = getRecordIdentity(parent, records[parent.ad_tab_id]);
    if (!identity)
      return null;
    visited.add(parent.ad_tab_id);
    entries.unshift([String(parent.ad_tab_id), identity]);
    child = parent;
  }
  return child.tablevel === 0 ? Object.fromEntries(entries) : null;
}

/** Identifica descendientes estructurales sin afectar ramas hermanas. */
export function isDescendantTab(tab: WindowSchemaTab, ancestorId: number, tabs: WindowSchemaTab[]): boolean {
  const visited = new Set<number>([tab.ad_tab_id]);
  let parentId = tab.parent_ad_tab_id;
  while (parentId !== undefined && !visited.has(parentId)) {
    if (parentId === ancestorId)
      return true;
    visited.add(parentId);
    parentId = tabs.find(candidate => candidate.ad_tab_id === parentId)?.parent_ad_tab_id;
  }
  return false;
}

/** Identificador compatible con los procesos y acciones documentales de CORE. */
export function getLegacyRecordId(tab: WindowSchemaTab, record: Record<string, unknown> | null | undefined): number | undefined {
  const columns = tab.pk_columns ?? [];
  if (columns.length !== 1 || columns[0].toLowerCase() !== tab.tablename.toLowerCase() + "_id")
    return undefined;
  const identity = getRecordIdentity(tab, record);
  if (!identity) return undefined;
  const raw = String(identity[columns[0]]);
  if (!/^[0-9]{1,10}$/.test(raw)) return undefined;
  const id = Number(raw);
  return id > 0 && id <= 2147483647 ? id : undefined;
}

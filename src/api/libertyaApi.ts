import type {
  WindowOption,
  WindowSchema,
} from "../types/metadata";

const BASE_URL = "/api";

const TOKEN = import.meta.env.VITE_LIBERTYA_TOKEN;

if (!TOKEN) {
  throw new Error(
    "No se definió VITE_LIBERTYA_TOKEN en .env.local"
  );
}


export interface LookupValue {
  value: string;
  name: string;
  isactive: boolean;
}


/**
 * Recupera la lista de ventanas para el selector.
 */
export async function getWindows(): Promise<WindowOption[]> {

  const response = await fetch(
    `${BASE_URL}/v1.0/windows/options`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error recuperando ventanas: ${response.status}`
    );
  }

  return response.json();
}


/**
 * Recupera toda la definición de metadata de una ventana
 * en una única llamada.
 */
export async function getWindowSchema(
  windowId: number
): Promise<WindowSchema> {

  const response = await fetch(
    `${BASE_URL}/v1.0/windows/${windowId}/schema`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error recuperando schema de ventana ${windowId}: ${response.status}`
    );
  }

  return response.json();
}


/**
 * Recupera un registro utilizando directamente el endpoint
 * informado por WindowSchemaTab.data_endpoint.
 */
export async function getRecord(
  dataEndpoint: string,
  page: number,
  filter?: string
): Promise<Record<string, unknown> | null> {

  const params = new URLSearchParams();

  params.set("limit", "1");
  params.set("page", String(page));

  if (filter) {
    params.set("filter", filter);
  }

  const response = await fetch(
    `${BASE_URL}${dataEndpoint}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error recuperando datos desde ${dataEndpoint}: ${response.status}`
    );
  }

  const records = await response.json();

  return records.length > 0
    ? records[0]
    : null;
}


/**
 * Recupera opciones de un lookup.
 *
 * Puede utilizarse de tres formas:
 *
 * 1. listado paginado:
 *    ?limit=50&page=1
 *
 * 2. búsqueda textual:
 *    ?search=cliente&limit=50&page=1
 *
 * 3. resolución puntual por valor:
 *    ?value=1000123
 */
export async function getLookupValues(
  endpoint: string,
  limit = 50,
  page = 1,
  search?: string,
  value?: string
): Promise<LookupValue[]> {

  const params = new URLSearchParams();

  params.set("limit", String(limit));
  params.set("page", String(page));

  if (
    search !== undefined &&
    search.trim() !== ""
  ) {
    params.set(
      "search",
      search.trim()
    );
  }

  if (
    value !== undefined &&
    value.trim() !== ""
  ) {
    params.set(
      "value",
      value.trim()
    );
  }

  const response = await fetch(
    `${BASE_URL}${endpoint}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error recuperando lookup desde ${endpoint}: ${response.status}`
    );
  }

  return response.json();
}
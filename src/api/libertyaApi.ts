import type {
  WindowOption,
  WindowSchema,
} from "../types/metadata";

import {
  getToken,
} from "../auth";


const BASE_URL = "/api";


export interface LookupValue {
  value: string;
  name: string;
  isactive: boolean;
}


export interface LoginParams {
  username: string;
  password: string;
  clientId: number;
  orgId: number;
}


/**
 * Obtiene un JWT de Libertya REST API.
 *
 * POST /token
 *
 * El backend espera las credenciales mediante headers:
 *
 * username
 * password
 * clientid
 * orgid
 */
export async function login(
  params: LoginParams
): Promise<string> {

  const TOKEN_EXP_MINUTES =
    import.meta.env
      .VITE_LIBERTYA_TOKEN_EXP_MINUTES
    ?? "30";
  
  const response = await fetch(
    `${BASE_URL}/token`,
    {
      method: "POST",

      headers: {
        username:
          params.username,

        password:
          params.password,

        clientid:
          String(params.clientId),

        orgid:
          String(params.orgId),

        expirationminutes: 
          TOKEN_EXP_MINUTES,
      },
    }
  );


  if (response.status === 403) {

    throw new Error(
      "Usuario, contraseña, compañía u organización inválidos"
    );
  }


  if (!response.ok) {

    throw new Error(
      `Error de autenticación: ${response.status}`
    );
  }


  return response.text();
}


/**
 * Headers comunes para requests autenticados.
 */
function getAuthHeaders(): HeadersInit {

  const token =
    getToken();


  if (!token) {

    throw new Error(
      "No existe una sesión autenticada"
    );
  }


  /*
   * IMPORTANTE:
   *
   * /token devuelve:
   *
   * Bearer eyJ...
   *
   * por lo tanto NO debemos volver a agregar
   * el prefijo Bearer.
   */
  return {
    Authorization: token,
  };
}


/**
 * Recupera la lista de ventanas para el selector.
 */
export async function getWindows():
  Promise<WindowOption[]> {

  const response = await fetch(
    `${BASE_URL}/v1.0/windows/options`,
    {
      headers:
        getAuthHeaders(),
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
      headers:
        getAuthHeaders(),
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
 * Recupera un registro utilizando directamente
 * WindowSchemaTab.data_endpoint.
 */
export async function getRecord(
  dataEndpoint: string,
  page: number,
  filter?: string
): Promise<Record<string, unknown> | null> {

  const params =
    new URLSearchParams();


  params.set(
    "limit",
    "1"
  );

  params.set(
    "page",
    String(page)
  );


  if (filter) {

    params.set(
      "filter",
      filter
    );
  }


  const response = await fetch(
    `${BASE_URL}${dataEndpoint}?${params.toString()}`,
    {
      headers:
        getAuthHeaders(),
    }
  );


  if (!response.ok) {

    throw new Error(
      `Error recuperando datos desde ${dataEndpoint}: ${response.status}`
    );
  }


  const records =
    await response.json();


  return records.length > 0
    ? records[0]
    : null;
}


/**
 * Recupera opciones de un lookup.
 */
export async function getLookupValues(
  endpoint: string,
  limit = 50,
  page = 1,
  search?: string,
  value?: string
): Promise<LookupValue[]> {

  const params =
    new URLSearchParams();


  params.set(
    "limit",
    String(limit)
  );

  params.set(
    "page",
    String(page)
  );


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
      headers:
        getAuthHeaders(),
    }
  );


  if (!response.ok) {

    throw new Error(
      `Error recuperando lookup desde ${endpoint}: ${response.status}`
    );
  }


  return response.json();
}
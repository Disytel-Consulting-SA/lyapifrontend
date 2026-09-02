import type {
  WindowOption,
  WindowSchema,
} from "../types/metadata";

import {
  expireSession,
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
 * expirationminutes
 */
export async function login(
  params: LoginParams
): Promise<string> {

  const TOKEN_EXP_MINUTES =
    import.meta.env
      .VITE_LIBERTYA_TOKEN_EXP_MINUTES
    ?? "30";


  /*
   * IMPORTANTE:
   *
   * El login NO utiliza authenticatedFetch().
   *
   * Un HTTP 403 en /token significa que las
   * credenciales suministradas no son válidas.
   *
   * En cambio, un HTTP 403 en un request ya
   * autenticado indica que el JWT dejó de ser válido.
   */
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
 * Ejecuta un request autenticado contra
 * Libertya REST API.
 *
 * Centraliza:
 *
 * - obtención del JWT
 * - header Authorization
 * - detección de sesión inválida
 *
 * JWTAuthorizationFilter devuelve HTTP 403
 * cuando el JWT está vencido, malformado
 * o dejó de ser válido.
 */
async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {

  const token =
    getToken();


  /*
   * Si desapareció el token del almacenamiento,
   * la aplicación ya no tiene una sesión válida.
   */
  if (!token) {

    expireSession();

    throw new Error(
      "No existe una sesión autenticada"
    );
  }


  /*
   * Crear una instancia de Headers permite
   * conservar cualquier header adicional que
   * el caller pueda necesitar en el futuro.
   */
  const headers =
    new Headers(
      options.headers
    );


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
  headers.set(
    "Authorization",
    token
  );


  const response =
    await fetch(
      url,
      {
        ...options,
        headers,
      }
    );


  /*
   * JWTAuthorizationFilter del backend responde
   * HTTP 403 ante un JWT vencido o inválido.
   *
   * Invalidamos la sesión local y notificamos
   * a App mediante SESSION_EXPIRED_EVENT.
   */
  if (response.status === 403) {

    expireSession();
  }


  return response;
}


/**
 * Recupera la lista de ventanas para el selector.
 */
export async function getWindows():
  Promise<WindowOption[]> {

  const response =
    await authenticatedFetch(
      `${BASE_URL}/v1.0/windows/options`
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

  const response =
    await authenticatedFetch(
      `${BASE_URL}/v1.0/windows/${windowId}/schema`
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


  const response =
    await authenticatedFetch(
      `${BASE_URL}${dataEndpoint}?${params.toString()}`
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
 * Recupera un registro por su clave primaria.
 *
 * Soporta claves simples y compuestas, respetando
 * el orden definido por WindowSchemaTab.pk_columns.
 */
export async function getRecordByKey(
  dataEndpoint: string,
  recordIds: Array<string | number>
): Promise<Record<string, unknown> | null> {
  const recordPath = recordIds.map((id) => encodeURIComponent(String(id))).join("/");

  const response = await authenticatedFetch(
    `${BASE_URL}${dataEndpoint}/${recordPath}`
  );

  if (response.status === 404)
    return null;

  if (!response.ok) {
    throw new Error(
      `Error recuperando registro desde ${dataEndpoint}: ${response.status}`
    );
  }

  return response.json();
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


  const response =
    await authenticatedFetch(
      `${BASE_URL}${endpoint}?${params.toString()}`
    );


  if (!response.ok) {

    throw new Error(
      `Error recuperando lookup desde ${endpoint}: ${response.status}`
    );
  }


  return response.json();
}

/**
 * Crea un nuevo registro utilizando directamente
 * WindowSchemaTab.data_endpoint.
 *
 * El backend devuelve como body el identificador
 * del registro creado.
 */
export async function createRecord(
  dataEndpoint: string,
  record: Record<string, unknown>
): Promise<string> {

  const response =
    await authenticatedFetch(
      `${BASE_URL}${dataEndpoint}`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          record
        ),
      }
    );


  if (!response.ok) {

    /*
     * Intentamos conservar el mensaje devuelto
     * por el backend, dado que normalmente será
     * mucho más útil que únicamente el status HTTP.
     */
    const detail =
      await response.text();


    throw new Error(
      detail
        ? `Error creando registro: ${detail}`
        : `Error creando registro: ${response.status}`
    );
  }


  return response.text();
}


/**
 * Actualiza un registro existente utilizando directamente
 * WindowSchemaTab.data_endpoint.
 */
export async function updateRecord(
  dataEndpoint: string,
  recordIds: Array<string | number>,
  record: Record<string, unknown>
): Promise<string> {
  const recordPath = recordIds.map((id) => encodeURIComponent(String(id))).join("/");

  const response = await authenticatedFetch(
    `${BASE_URL}${dataEndpoint}/${recordPath}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      detail
        ? `Error actualizando registro: ${detail}`
        : `Error actualizando registro: ${response.status}`
    );
  }

  return response.text();
}
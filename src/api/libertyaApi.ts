import { getRecordIdentity } from "../utils/recordIdentity";
import type { RecordIdentity, AncestorIdentities } from "../utils/recordIdentity";
import type {
  MenuOption,
  WindowOption,
  WindowSchema,
  WindowSchemaTab,
} from "../types/metadata";
import type { ProcessExecuteRequest, ProcessExecuteResponse, ProcessSchema, ProcessState, ProcessStateRequest } from "../types/process";

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


export interface RoleOption {
  ad_role_id: number;
  name: string;
}

export interface RecordResult {
  record: Record<string, unknown> | null;
  totalCount: number;
}

export interface RecordSearchResult {
  records: Record<string, unknown>[];
  totalCount: number;
}


export interface TabRecordQuery {
  parent_values?: Record<string, string>;
  filter?: string;
  fields?: string;
  sort?: string;
  limit?: number;
  page?: number;
  include_total?: boolean;
}

export interface TabRecordResult {
  records: Record<string, unknown>[];
  totalCount: number;
}

export interface WindowRecordFieldState {
  ad_field_id: number;
  columnname: string;
  displayed: boolean;
  readonly: boolean;
}

export interface WindowRecordState {
  values: Record<string, string>;
  fields: WindowRecordFieldState[];
}

export interface WindowRecordStateRequest {
  values?: Record<string, string>;
  parent_values?: Record<string, string>;
  changed_columns?: string[];
  inserting?: boolean;
}

export interface WindowCalloutRequest {
  ad_field_id: number;
  value: unknown;
  values: Record<string, unknown>;
  inserting: boolean;
  record_ids?: string[];
}

export interface WindowCalloutResponse {
  changes: Record<string, unknown>;
  message: string | null;
}

export class CalloutValidationError extends Error {}

export interface Location {
  c_location_id: number;

  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;

  plaza?: string;
  city?: string;
  postal?: string;
  postal_add?: string;

  c_city_id?: number;
  c_region_id?: number;
  c_country_id: number;

  referencedvalues?: Array<{
    key: string;
    value: string;
  }>;
}


export interface DocumentAction {
  value: string;
  name: string;
  description?: string;
}

export interface DocumentActions {
  docStatus: string;
  defaultAction?: string | null;
  actions: DocumentAction[];
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
 * Recupera los perfiles disponibles para el usuario autenticado.
 */
export async function getRoleOptions(): Promise<RoleOption[]> {
  const response = await authenticatedFetch(
    `${BASE_URL}/v1.0/roleoptions`
  );

  if (!response.ok) {
    throw new Error(
      `Error recuperando perfiles: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Selecciona un perfil y obtiene un nuevo JWT contextual.
 *
 * El backend conserva username, clientID y orgID desde el JWT actual
 * y agrega el roleID solicitado luego de validarlo.
 */
export async function selectRole(roleId: number): Promise<string> {
  const response = await authenticatedFetch(
    `${BASE_URL}/token/context`,
    {
      method: "POST",
      headers: {
        roleid: String(roleId),
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error seleccionando perfil: ${response.status}`
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
  options: RequestInit = {},
  expireOnForbidden = true
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
  if (response.status === 401 || (response.status === 403 &&
    (expireOnForbidden || response.headers.get("X-Libertya-Session-Invalid") === "true"))) {

    expireSession();
  }


  return response;
}


/** Recupera las entradas de menu disponibles para el perfil actual. */
export async function getMenuOptions(): Promise<MenuOption[]> {
  const response = await authenticatedFetch(`${BASE_URL}/v1.0/menu/options`);
  if (!response.ok) throw new Error(`Error recuperando menu: ${response.status}`);
  return response.json();
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
 * Construye el estado inicial efectivo de un nuevo registro
 * para una pestaña dinámica.
 *
 * El backend resuelve DefaultValue, DisplayLogic,
 * ReadOnlyLogic y permisos efectivos.
 */
export async function getNewRecordState(
  tabId: number,
  request: WindowRecordStateRequest = {}
): Promise<WindowRecordState> {

  const response = await authenticatedFetch(
    `${BASE_URL}/v1.0/tabs/${tabId}/new-record`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error construyendo estado inicial para pestaña ${tabId}: ${response.status}`
    );
  }

  return response.json();
}


/**
 * Reevalúa el estado efectivo de un registro dinámico.
 *
 * El backend resuelve DisplayLogic, ReadOnlyLogic
 * y permisos efectivos utilizando los valores actuales.
 */
export async function evaluateRecordState(
  tabId: number,
  request: WindowRecordStateRequest
): Promise<WindowRecordState> {

  const response = await authenticatedFetch(
    `${BASE_URL}/v1.0/tabs/${tabId}/evaluate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Error reevaluando estado para pestaña ${tabId}: ${response.status}`
    );
  }

  return response.json();
}

export async function executeTabFieldCallout(
  tabId: number,
  request: WindowCalloutRequest
): Promise<WindowCalloutResponse> {
  const response = await authenticatedFetch(
    `${BASE_URL}/v1.0/tabs/${tabId}/callout`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    },
    false
  );

  if (!response.ok) {
    if (response.status === 400) {
      const error = await response.json().catch(() => null) as Partial<WindowCalloutResponse> | null;
      throw new CalloutValidationError(error?.message ?? "Los datos del callout no son válidos");
    }
    throw new Error(
      `Error ejecutando callout para pestaña ${tabId}: ${response.status}`
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
): Promise<RecordResult> {

  const params = new URLSearchParams();

  params.set("limit", "1");
  params.set("page", String(page));
  params.set("includeTotal", "true");

  if (filter) {
    params.set("filter", filter);
  }

  const response = await authenticatedFetch(
    `${BASE_URL}${dataEndpoint}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      `Error recuperando datos desde ${dataEndpoint}: ${response.status}`
    );
  }

  const records = await response.json();

  const totalCountHeader = response.headers.get("X-Total-Count");
  const totalCount = totalCountHeader !== null
    ? Number(totalCountHeader)
    : 0;

  return {
    record: records.length > 0 ? records[0] : null,
    totalCount,
  };
}



/**
 * Recupera múltiples registros aplicando un filtro.
 *
 * Se utiliza para búsquedas dentro de ventanas dinámicas.
 */
export async function searchRecords(
  dataEndpoint: string,
  filter: string,
  limit = 50,
  page = 1,
  sort?: string
): Promise<RecordSearchResult> {

  const params = new URLSearchParams();

  params.set("limit", String(limit));
  params.set("page", String(page));
  params.set("includeTotal", "true");

  if (filter.trim() !== "") {
    params.set("filter", filter);
  }

  if (
    sort !== undefined &&
    sort.trim() !== ""
  ) {
    params.set(
      "sort",
      sort.trim()
    );
  }

  const response = await authenticatedFetch(
    `${BASE_URL}${dataEndpoint}?${params.toString()}`
  );

  if (!response.ok) {
    throw new Error(
      `Error buscando registros en ${dataEndpoint}: ${response.status}`
    );
  }

  const records = await response.json();

  const totalCountHeader =
    response.headers.get("X-Total-Count");

  const totalCount =
    totalCountHeader !== null
      ? Number(totalCountHeader)
      : records.length;

  return {
    records,
    totalCount,
  };
}



/**
 * Recupera registros respetando la semántica efectiva de una AD_Tab:
 * WhereClause, contexto, relación padre/detalle, permisos y OrderByClause.
 */
export async function getTabRecords(
  tabId: number,
  query: TabRecordQuery = {}
): Promise<TabRecordResult> {

  const response = await authenticatedFetch(
    `${BASE_URL}/v1.0/tabs/${tabId}/records`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(query),
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      detail
        ? `Error recuperando registros de pestaña ${tabId}: ${detail}`
        : `Error recuperando registros de pestaña ${tabId}: ${response.status}`
    );
  }

  const records = await response.json();

  const totalCountHeader = response.headers.get("X-Total-Count");
  const totalCount = totalCountHeader !== null
    ? Number(totalCountHeader)
    : records.length;

  return {
    records,
    totalCount,
  };
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

  const body = await response.json();

  /*
   * Algunos endpoints de documentos devuelven el registro
   * envuelto en { header: {...} }. DynamicTab necesita siempre
   * el objeto que contiene directamente las columnas.
   */
  if (
    body &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    "header" in body &&
    body.header &&
    typeof body.header === "object" &&
    !Array.isArray(body.header)
  ) {
    return body.header as Record<string, unknown>;
  }

  return body as Record<string, unknown>;
}



export async function getLocation(
  endpoint: string,
  locationId: string | number
): Promise<Location | null> {

  const response =
    await authenticatedFetch(
      `${BASE_URL}${endpoint}/${encodeURIComponent(
        String(locationId)
      )}`
    );

  if (response.status === 404)
    return null;

  if (!response.ok) {
    throw new Error(
      `Error recuperando localización desde ${endpoint}: ${response.status}`
    );
  }

  return response.json();
}


export interface LocationUpdate {
  address1?: string;
  address2?: string;
  address3?: string;
  address4?: string;
  plaza?: string;
  city?: string;
  postal?: string;
  c_region_id?: number;
  c_country_id?: number;
}


export async function updateLocation(
  endpoint: string,
  locationId: string | number,
  location: LocationUpdate
): Promise<void> {

  const response =
    await authenticatedFetch(
      `${BASE_URL}${endpoint}/${encodeURIComponent(
        String(locationId)
      )}`,
      {
        method: "PUT",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          location
        ),
      }
    );


  if (!response.ok) {

    const detail =
      await response.text();

    throw new Error(
      detail
        ? `Error actualizando localización: ${detail}`
        : `Error actualizando localización: ${response.status}`
    );
  }
}



export async function createLocation(
  endpoint: string,
  location: LocationUpdate
): Promise<string> {

  const response =
    await authenticatedFetch(
      `${BASE_URL}${endpoint}`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          location
        ),
      }
    );


  if (!response.ok) {

    const detail =
      await response.text();

    throw new Error(
      detail
        ? `Error creando localización: ${detail}`
        : `Error creando localización: ${response.status}`
    );
  }


  /*
   * El endpoint de creación de Libertya
   * retorna como String el ID generado.
   */
  const createdId =
    await response.text();

  return createdId.replace(
    /^"|"$/g,
    ""
  );
}



/**
 * Recupera opciones de un lookup.
 */
export async function getLookupValues(
  endpoint: string,
  limit = 50,
  page = 1,
  search?: string,
  value?: string,
  contextValues?: Record<string, string>
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

  if (
    contextValues !== undefined &&
    Object.keys(contextValues).length > 0
  ) {
    params.set(
      "context",
      JSON.stringify(contextValues)
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
 * Crea un nuevo registro utilizando el endpoint de creación resuelto por la pestaña dinámica.
 *
 * El backend devuelve como body el identificador del registro creado.
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


  /*
   * Los endpoints de alta retornan el ID como String.
   * Dependiendo de la serialización puede llegar como 123
   * o como "123"; normalizamos ambas variantes antes de
   * utilizarlo para recuperar el registro creado.
   */
  const createdId =
    await response.text();

  return createdId.replace(
    /^"|"$/g,
    ""
  );
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


/**
 * Elimina un registro existente utilizando directamente
 * WindowSchemaTab.data_endpoint.
 *
 * Soporta claves simples y compuestas, respetando
 * el orden definido por WindowSchemaTab.pk_columns.
 */
export async function deleteRecord(
  dataEndpoint: string,
  recordIds: Array<string | number>
): Promise<string> {
  const recordPath = recordIds.map((id) => encodeURIComponent(String(id))).join("/");

  const response = await authenticatedFetch(
    `${BASE_URL}${dataEndpoint}/${recordPath}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      detail
        ? `Error eliminando registro: ${detail}`
        : `Error eliminando registro: ${response.status}`
    );
  }

  return response.text();
}



/**
 * Recupera las acciones actualmente disponibles para un documento.
 *
 * El backend resuelve las acciones válidas según el estado actual
 * del documento, personalizaciones, plugins, workflow y permisos.
 */
export async function getDocumentActions(
  tableName: string,
  recordId: string | number
): Promise<DocumentActions> {
  const response = await authenticatedFetch(
    `${BASE_URL}/v1.0/generic/${encodeURIComponent(tableName)}/${encodeURIComponent(String(recordId))}/process/actions`
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      detail
        ? `Error recuperando acciones del documento: ${detail}`
        : `Error recuperando acciones del documento: ${response.status}`
    );
  }

  return response.json();
}


/**
 * Ejecuta una acción sobre un documento.
 */
export async function processDocument(
  tableName: string,
  recordId: string | number,
  action: string
): Promise<string> {
  const params = new URLSearchParams();
  params.set("action", action);

  const response = await authenticatedFetch(
    `${BASE_URL}/v1.0/generic/${encodeURIComponent(tableName)}/${encodeURIComponent(String(recordId))}/process?${params.toString()}`,
    {
      method: "PUT",
    }
  );

  if (!response.ok) {
    const detail = await response.text();

    throw new Error(
      detail
        ? `Error procesando documento: ${detail}`
        : `Error procesando documento: ${response.status}`
    );
  }

  return response.text();
}

/**
 * Recupera la metadata declarativa de los parametros de un proceso.
 */
export async function getProcessSchema(processId: number): Promise<ProcessSchema> {
  const response = await authenticatedFetch(`${BASE_URL}/v1.0/processes/${processId}/schema`);
  if (!response.ok) throw new Error(`Error recuperando schema del proceso ${processId}: ${response.status}`);
  return response.json();
}

/**
 * Construye o reevalua el estado efectivo de los parametros de un proceso.
 */
export async function evaluateProcessState(processId: number, request: ProcessStateRequest): Promise<ProcessState> {
  const response = await authenticatedFetch(`${BASE_URL}/v1.0/processes/${processId}/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail ? `Error evaluando proceso: ${detail}` : `Error evaluando proceso ${processId}: ${response.status}`);
  }
  return response.json();
}


/**
 * Ejecuta un proceso mediante el pipeline canonico de Libertya CORE.
 */
export async function executeProcess(processId: number, request: ProcessExecuteRequest): Promise<ProcessExecuteResponse> {
  const response = await authenticatedFetch(`${BASE_URL}/v1.0/processes/${processId}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    /*
     * La API devuelve ProcessExecuteResponse también para errores de
     * ejecución controlados. El detalle técnico queda exclusivamente
     * en el log del backend.
     */
    try {
      const detail = await response.json() as ProcessExecuteResponse;
      if (detail.summary) throw new Error(detail.summary);
    } catch (error) {
      if (error instanceof Error && error.message) throw error;
    }

    throw new Error("No fue posible ejecutar el proceso.");
  }
  return response.json();
}


/** Ejecuta un informe nativo o Jasper y devuelve el PDF para visualizarlo. */
export async function generateProcessReport(processId: number, request: ProcessExecuteRequest): Promise<Blob> {
  // Un 403 de permisos del informe no debe invalidar el JWT contextual.
  const response = await authenticatedFetch(`${BASE_URL}/v1.0/processes/${processId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/pdf" },
    body: JSON.stringify(request),
  }, false);
  if (!response.ok) {
    const detail = (await response.text()).trim();
    const message = response.status === 403 ? "No tiene permisos para ejecutar este informe."
      : response.status === 400 ? "Los parámetros del informe no son válidos."
      : response.status === 404 ? "El informe no existe o no está disponible."
      : "No se pudo generar el informe.";
    throw new Error(`${message} (HTTP ${response.status})${detail ? `: ${detail.slice(0, 400)}` : ""}`);
  }
  const pdf = await response.blob();
  if (!pdf.size || !pdf.type.toLowerCase().includes("pdf")) {
    throw new Error("El servidor no devolvió un documento PDF válido.");
  }
  return pdf;
}


/** Solicitudes JSON de identidad, sin intentar interpretar respuestas 204. */
async function identityRequest(endpoint: string, method: "POST" | "PUT" | "DELETE",
  body: unknown, operation: string, allowNotFound = false): Promise<Response> {
  const response = await authenticatedFetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, false);
  if (!response.ok && !(allowNotFound && response.status === 404)) {
    const detail = await response.text();
    throw new Error(`Error ${operation}: ${detail || response.status}`);
  }
  return response;
}

export async function getRecordByIdentity(endpoint: string, identity: RecordIdentity):
  Promise<Record<string, unknown> | null> {
  const response = await identityRequest(endpoint + "/lookup", "POST", identity, "recuperando registro", true);
  return response.status === 404 ? null : response.json();
}

function contextualEndpoint(tab: WindowSchemaTab, method: "POST" | "PUT" | "DELETE"): string {
  const endpoint = tab.crud_endpoints?.[method];
  if (!endpoint)
    throw new Error("La pestaña no admite esta operación");
  return endpoint;
}

/** Contrato histórico: contexto plano, exclusivamente identificadores numéricos positivos. */
function legacyParentValues(ancestors: AncestorIdentities): Record<string, string> {
  const entries: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const identity of Object.values(ancestors)) {
    const columns = Object.entries(identity);
    if (columns.length !== 1)
      throw new Error("El endpoint histórico requiere ancestros de clave simple");
    const [column, value] = columns[0];
    const raw = String(value);
    if (!/^[0-9]{1,10}$/.test(raw) || Number(raw) <= 0 || Number(raw) > 2147483647 || seen.has(column.toLowerCase()))
      throw new Error("Contexto ancestral incompatible con el endpoint histórico");
    seen.add(column.toLowerCase());
    entries.push([column, raw]);
  }
  return Object.fromEntries(entries);
}

function legacyRecordPath(endpoint: string, tab: WindowSchemaTab, identity: RecordIdentity): string {
  const normalized = getRecordIdentity(tab, identity);
  const keys = tab.pk_columns ?? [];
  if (!normalized || keys.length !== 1 || Object.keys(identity).length !== 1)
    throw new Error("El endpoint histórico requiere una identidad simple");
  const id = String(normalized[keys[0]]);
  if (!/^[0-9]{1,10}$/.test(id) || Number(id) <= 0 || Number(id) > 2147483647)
    throw new Error("Identificador numérico inválido");
  return endpoint.replace("{recordId}", encodeURIComponent(id));
}

export async function createContextualRecord(tab: WindowSchemaTab, ancestors: AncestorIdentities,
  values: Record<string, unknown>): Promise<RecordIdentity> {
  const endpoint = contextualEndpoint(tab, "POST");
  let identity: RecordIdentity | null;
  if (endpoint === `/v1.0/windowidentity/${tab.ad_tab_id}/records`) {
    const response = await identityRequest(endpoint, "POST", { ancestors, values }, "creando registro");
    identity = getRecordIdentity(tab, await response.json());
  } else if (endpoint === `/v1.0/windowrecords/${tab.ad_tab_id}/records`) {
    const response = await identityRequest(endpoint, "POST", { parentValues: legacyParentValues(ancestors), values }, "creando registro");
    const id = (await response.text()).replace(/^"|"$/g, "");
    const keys = tab.pk_columns ?? [];
    identity = keys.length === 1 && /^[0-9]{1,10}$/.test(id) && Number(id) > 0 && Number(id) <= 2147483647
      ? getRecordIdentity(tab, { [keys[0]]: Number(id) }) : null;
  } else {
    throw new Error("Contrato contextual de alta no reconocido");
  }
  if (!identity)
    throw new Error("El backend no devolvió una identidad completa para el registro creado");
  return identity;
}

export async function updateContextualRecord(tab: WindowSchemaTab, ancestors: AncestorIdentities,
  identity: RecordIdentity, values: Record<string, unknown>): Promise<void> {
  const endpoint = contextualEndpoint(tab, "PUT");
  if (endpoint === `/v1.0/windowidentity/${tab.ad_tab_id}/record`)
    await identityRequest(endpoint, "PUT", { ancestors, identity, values }, "actualizando registro");
  else if (endpoint === `/v1.0/windowrecords/${tab.ad_tab_id}/records/{recordId}`)
    await identityRequest(legacyRecordPath(endpoint, tab, identity), "PUT",
      { parentValues: legacyParentValues(ancestors), values }, "actualizando registro");
  else
    throw new Error("Contrato contextual de modificación no reconocido");
}

export async function deleteContextualRecord(tab: WindowSchemaTab, ancestors: AncestorIdentities,
  identity: RecordIdentity): Promise<void> {
  const endpoint = contextualEndpoint(tab, "DELETE");
  if (endpoint === `/v1.0/windowidentity/${tab.ad_tab_id}/record`)
    await identityRequest(endpoint, "DELETE", { ancestors, identity }, "eliminando registro");
  else if (endpoint === `/v1.0/windowrecords/${tab.ad_tab_id}/records/{recordId}`)
    await identityRequest(legacyRecordPath(endpoint, tab, identity), "DELETE",
      legacyParentValues(ancestors), "eliminando registro");
  else
    throw new Error("Contrato contextual de eliminación no reconocido");
}

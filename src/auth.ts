export const TOKEN_KEY = "libertya_token";
const USERNAME_KEY = "libertya_username";

const CONTEXT_TOKEN_KEY = "libertya_context_token";
const ROLE_ID_KEY = "libertya_role_id";
const ROLE_NAME_KEY = "libertya_role_name";

export const SESSION_EXPIRED_EVENT =
  "libertya-session-expired";


export function setSession(
  token: string,
  username: string
) {
  /*
   * /token devuelve el valor con "Bearer " incluido.
   *
   * La autenticación base se comparte entre todas
   * las pestañas del navegador.
   */
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}


export function setToken(token: string) {
  /*
   * /token/context devuelve el JWT correspondiente
   * al perfil seleccionado.
   *
   * El contexto pertenece exclusivamente a esta
   * pestaña.
   */
  sessionStorage.setItem(
    CONTEXT_TOKEN_KEY,
    token
  );
}


export function getToken(): string | null {
  const baseToken =
    localStorage.getItem(TOKEN_KEY);

  /*
   * Si no existe sesión global, un eventual token
   * contextual residual no debe autenticar la pestaña.
   */
  if (baseToken === null) {
    return null;
  }

  return (
    sessionStorage.getItem(CONTEXT_TOKEN_KEY)
    ?? baseToken
  );
}


export function getUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}


export function setRole(
  roleId: number,
  roleName: string
) {
  sessionStorage.setItem(
    ROLE_ID_KEY,
    String(roleId)
  );

  sessionStorage.setItem(
    ROLE_NAME_KEY,
    roleName
  );
}


export function getRoleId(): number | null {
  const value =
    sessionStorage.getItem(ROLE_ID_KEY);

  return value !== null
    ? Number(value)
    : null;
}


export function getRoleName(): string | null {
  return sessionStorage.getItem(
    ROLE_NAME_KEY
  );
}


export function clearRole() {
  sessionStorage.removeItem(
    CONTEXT_TOKEN_KEY
  );

  sessionStorage.removeItem(
    ROLE_ID_KEY
  );

  sessionStorage.removeItem(
    ROLE_NAME_KEY
  );
}


export function isAuthenticated(): boolean {
  return localStorage.getItem(TOKEN_KEY) !== null;
}


export function clearSession() {
  /*
   * Logout de la sesión global.
   */
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);

  /*
   * Y contexto propio de esta pestaña.
   */
  clearRole();
}


/*
 * Invalidar la sesión desde cualquier capa
 * de la aplicación.
 */
export function expireSession() {
  clearSession();

  window.dispatchEvent(
    new Event(SESSION_EXPIRED_EVENT)
  );
}
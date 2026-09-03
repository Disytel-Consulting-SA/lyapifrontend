const TOKEN_KEY = "libertya_token";
const USERNAME_KEY = "libertya_username";
const ROLE_ID_KEY = "libertya_role_id";
const ROLE_NAME_KEY = "libertya_role_name";

export const SESSION_EXPIRED_EVENT = "libertya-session-expired";

export function setSession(token: string, username: string) {
  /*
   * /token devuelve el valor con "Bearer " incluido.
   */
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(USERNAME_KEY, username);
}

export function setToken(token: string) {
  /*
   * /token/context también devuelve el valor con "Bearer " incluido.
   */
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getUsername(): string | null {
  return sessionStorage.getItem(USERNAME_KEY);
}

export function setRole(roleId: number, roleName: string) {
  sessionStorage.setItem(ROLE_ID_KEY, String(roleId));
  sessionStorage.setItem(ROLE_NAME_KEY, roleName);
}

export function getRoleId(): number | null {
  const value = sessionStorage.getItem(ROLE_ID_KEY);
  return value !== null ? Number(value) : null;
}

export function getRoleName(): string | null {
  return sessionStorage.getItem(ROLE_NAME_KEY);
}

export function clearRole() {
  sessionStorage.removeItem(ROLE_ID_KEY);
  sessionStorage.removeItem(ROLE_NAME_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USERNAME_KEY);
  clearRole();
}

/*
 * Invalidar la sesión desde cualquier capa de la aplicación.
 *
 * Además de limpiar sessionStorage, se notifica a App para que vuelva
 * a mostrar el login sin recargar la página.
 */
export function expireSession() {
  clearSession();
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
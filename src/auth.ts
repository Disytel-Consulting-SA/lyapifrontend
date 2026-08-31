const TOKEN_KEY = "libertya_token";
const USERNAME_KEY = "libertya_username";


export const SESSION_EXPIRED_EVENT =
  "libertya-session-expired";


export function setSession(
  token: string,
  username: string
) {

  /*
   * /token devuelve el valor con "Bearer " incluido.
   */
  sessionStorage.setItem(
    TOKEN_KEY,
    token
  );

  sessionStorage.setItem(
    USERNAME_KEY,
    username
  );
}


export function getToken():
  string | null {

  return sessionStorage.getItem(
    TOKEN_KEY
  );
}


export function getUsername():
  string | null {

  return sessionStorage.getItem(
    USERNAME_KEY
  );
}


export function isAuthenticated():
  boolean {

  return getToken() !== null;
}


export function clearSession() {

  sessionStorage.removeItem(
    TOKEN_KEY
  );

  sessionStorage.removeItem(
    USERNAME_KEY
  );
}


/*
 * Invalidar la sesión desde cualquier capa
 * de la aplicación.
 *
 * Además de limpiar sessionStorage,
 * se notifica a App para que vuelva
 * a mostrar el login sin recargar la página.
 */
export function expireSession() {

  clearSession();


  window.dispatchEvent(
    new Event(
      SESSION_EXPIRED_EVENT
    )
  );
}
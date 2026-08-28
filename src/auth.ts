const TOKEN_KEY = "libertya_token";
const USERNAME_KEY = "libertya_username";


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
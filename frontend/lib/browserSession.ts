const TOKEN_KEY = "fairplan_token";

export function readToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function saveLogin(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearLogin() {
  window.localStorage.removeItem(TOKEN_KEY);
}

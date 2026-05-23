import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";

export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

let onAuthStateChange: ((authenticated: boolean) => void) | null = null;

export function setOnAuthStateChange(cb: (authenticated: boolean) => void) {
  onAuthStateChange = cb;
}

export function notifyAuthChange(authenticated: boolean) {
  onAuthStateChange?.(authenticated);
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

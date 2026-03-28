const STORAGE_KEY = "frontiers:session";

export interface AuthState {
  sessionToken: string | null;
  email: string | null;
}

export function getSession(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function setSession(token: string): void {
  localStorage.setItem(STORAGE_KEY, token);
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function fetchWithAuth(url: string, init?: RequestInit): Promise<Response> {
  const token = getSession();
  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers });
}

export async function requestLogin(
  apiBase: string,
  email: string,
): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${apiBase}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  return { ok: res.ok, message: data.message ?? data.error };
}

export async function verifyToken(
  apiBase: string,
  token: string,
): Promise<{ sessionToken: string; email: string } | null> {
  const res = await fetch(`${apiBase}/api/auth/verify?token=${token}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getMe(apiBase: string): Promise<{ userId: string; email: string } | null> {
  const session = getSession();
  if (!session) return null;
  const res = await fetch(`${apiBase}/api/auth/me`, {
    headers: { Authorization: `Bearer ${session}` },
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  return res.json();
}

export async function logout(apiBase: string): Promise<void> {
  const session = getSession();
  if (session) {
    await fetch(`${apiBase}/api/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session}` },
    }).catch(() => {});
  }
  clearSession();
}

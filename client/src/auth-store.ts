/**
 * Auth persistence: sessionStorage for WS-visible token; HttpOnly cookie for HTTP APIs.
 */

export type AuthInfo = {
  token: string;
  username: string;
  display_name: string;
  user_id?: string;
};

export function loadAuth(storageKey: string): AuthInfo | null {
  try {
    const raw = sessionStorage.getItem(storageKey) ?? localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthInfo;
    if (!parsed?.token) return null;
    // Migrate off localStorage
    if (!sessionStorage.getItem(storageKey) && localStorage.getItem(storageKey)) {
      sessionStorage.setItem(storageKey, raw);
      localStorage.removeItem(storageKey);
    }
    return parsed;
  } catch {
    return null;
  }
}

export function storeAuth(storageKey: string, info: AuthInfo | null): void {
  localStorage.removeItem(storageKey);
  if (!info) sessionStorage.removeItem(storageKey);
  else sessionStorage.setItem(storageKey, JSON.stringify(info));
}

/** After WS login: set HttpOnly cookie so /api/* works without Bearer (credentials: include). */
export async function syncSessionCookie(token: string | null): Promise<void> {
  try {
    if (token) {
      await fetch("/api/session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
    } else {
      await fetch("/api/session", {
        method: "DELETE",
        credentials: "include",
      });
    }
  } catch {
    // Cookie sync is best-effort; Bearer still works
  }
}

export function apiAuthHeaders(token: string, json = false): HeadersInit {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

const API_BASE = "http://localhost:8000";

export interface EmotionResponse {
  id: number;
  parameters: Record<string, number>;
  created_at: string;
  username?: string;
}

export interface AuthResponse {
  token: string;
  user: { id: number; username: string };
}

function getToken(): string | null {
  return localStorage.getItem("token");
}

export function getUsername(): string | null {
  return localStorage.getItem("username");
}

export function saveAuth(token: string, username: string): void {
  localStorage.setItem("token", token);
  localStorage.setItem("username", username);
}

export function clearAuth(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

export async function register(
  username: string,
  password: string
): Promise<{ id: number; username: string }> {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Register failed: ${res.status}`);
  }
  return res.json();
}

export async function login(
  username: string,
  password: string
): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Login failed: ${res.status}`);
  }
  const data: AuthResponse = await res.json();
  saveAuth(data.token, data.user.username);
  return data;
}

export async function saveEmotion(
  parameters: Record<string, number>
): Promise<{ id: number }> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/emotions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ parameters }),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  return res.json();
}

export async function getRandomEmotion(): Promise<EmotionResponse> {
  const res = await fetch(`${API_BASE}/emotions/random`);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

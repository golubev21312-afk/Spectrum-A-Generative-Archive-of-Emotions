// Centralized auth state — single source of truth for token + username
// Components subscribe via onChange; call set/clear to mutate.

type Listener = () => void;

interface AuthState {
  token: string | null;
  username: string | null;
}

const listeners = new Set<Listener>();

function read(): AuthState {
  return {
    token: localStorage.getItem("token"),
    username: localStorage.getItem("username"),
  };
}

function notify() {
  listeners.forEach(fn => fn());
}

export function getAuth(): AuthState {
  return read();
}

export function isLoggedIn(): boolean {
  return read().token !== null;
}

export function getUsername(): string | null {
  return read().username;
}

export function setAuth(token: string, username: string): void {
  localStorage.setItem("token", token);
  localStorage.setItem("username", username);
  notify();
}

export function clearAuth(): void {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
  notify();
}

export function onAuthChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

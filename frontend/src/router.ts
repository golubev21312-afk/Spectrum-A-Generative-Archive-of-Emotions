export type Route =
  | { name: "create" }
  | { name: "view" }
  | { name: "feed" }
  | { name: "auth" }
  | { name: "notifications" }
  | { name: "emotion"; id: number }
  | { name: "profile"; username: string };

export function parseRoute(hash: string): Route {
  const h = hash || "#/create";

  if (h === "#/view") return { name: "view" };
  if (h === "#/feed") return { name: "feed" };
  if (h === "#/auth") return { name: "auth" };
  if (h === "#/notifications") return { name: "notifications" };

  if (h.startsWith("#/emotion/")) {
    const raw = h.slice("#/emotion/".length);
    const id = parseInt(raw, 10);
    if (!isNaN(id) && id > 0) return { name: "emotion", id };
    return { name: "feed" };
  }

  if (h.startsWith("#/profile/")) {
    const username = h.slice("#/profile/".length).trim();
    if (username) return { name: "profile", username };
    return { name: "feed" };
  }

  return { name: "create" };
}

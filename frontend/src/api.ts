import { getAuth, setAuth, clearAuth as _clearAuth, isLoggedIn, getUsername } from "./state";

export { isLoggedIn, getUsername, clearAuth } from "./state";

const API_BASE = "http://localhost:8000";

export interface EmotionResponse {
  id: number;
  parameters: Record<string, unknown>;
  created_at: string;
  username?: string;
  emotion_type?: string;
  likes_count: number;
  liked_by_me: boolean;
  thumbnail?: string;
  views?: number;
  reactions: Record<string, number>;
  my_reaction?: string;
}

export interface EmotionFeed {
  items: EmotionResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface UserProfile {
  username: string;
  created_at: string;
  emotion_count: number;
  likes_count: number;
  followers_count: number;
  following_count: number;
  is_following: boolean;
  emotions: EmotionResponse[];
  bio?: string;
  avatar?: string;
}

export interface NotificationResponse {
  id: number;
  type: string;
  from_username?: string;
  emotion_id?: number;
  read: boolean;
  created_at: string;
}

export interface CommentResponse {
  id: number;
  username: string;
  text: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  refresh_token?: string;
  user: { id: number; username: string };
}

const REFRESH_KEY = "spectrum_refresh";

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

function saveRefreshToken(rt: string | null) {
  if (rt) localStorage.setItem(REFRESH_KEY, rt);
  else localStorage.removeItem(REFRESH_KEY);
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const { token } = getAuth();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

let _refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) { saveRefreshToken(null); _clearAuth(); return false; }
    const data: AuthResponse = await res.json();
    // Update tokens silently (no notify) to avoid re-rendering the current page
    localStorage.setItem("token", data.token);
    localStorage.setItem("username", data.user.username);
    saveRefreshToken(data.refresh_token ?? null);
    return true;
  } catch {
    return false;
  }
}

async function fetchWithRefresh(input: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(input, init);
  if (res.status === 401 && getRefreshToken()) {
    if (!_refreshing) _refreshing = tryRefresh().finally(() => { _refreshing = null; });
    const ok = await _refreshing;
    if (ok) {
      // Retry with new token
      const retryInit = { ...init, headers: { ...(init?.headers as Record<string, string> || {}), "Authorization": `Bearer ${getAuth().token}` } };
      res = await fetch(input, retryInit);
    }
  }
  return res;
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
  setAuth(data.token, data.user.username);
  saveRefreshToken(data.refresh_token ?? null);
  return data;
}

export async function saveEmotion(
  parameters: Record<string, unknown>,
  emotion_type?: string,
  thumbnail?: string
): Promise<{ id: number }> {
  const res = await fetchWithRefresh(`${API_BASE}/emotions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ parameters, emotion_type, thumbnail }),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
  return res.json();
}

export async function getRandomEmotion(): Promise<EmotionResponse> {
  const res = await fetchWithRefresh(`${API_BASE}/emotions/random`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

export async function getEmotion(id: number): Promise<EmotionResponse> {
  const res = await fetchWithRefresh(`${API_BASE}/emotions/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

export async function deleteEmotion(id: number): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/emotions/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
}

export async function updateAvatar(username: string, dataUrl: string): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/users/${username}/avatar`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ avatar: dataUrl }),
  });
  if (!res.ok) throw new Error(`Avatar update failed: ${res.status}`);
}

export async function updateBio(username: string, bio: string): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/users/${username}/bio`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ bio }),
  });
  if (!res.ok) throw new Error(`Bio update failed: ${res.status}`);
}

export async function updateEmotionType(id: number, emotion_type: string): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/emotions/${id}/type`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ emotion_type }),
  });
  if (!res.ok) throw new Error(`Update type failed: ${res.status}`);
}

export async function getFeed(params: {
  page?: number;
  limit?: number;
  emotion_type?: string;
  sort?: "new" | "popular" | "trending";
  author?: string;
  q?: string;
  following?: boolean;
  period?: "today";
}): Promise<EmotionFeed> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.emotion_type) q.set("emotion_type", params.emotion_type);
  if (params.sort) q.set("sort", params.sort);
  if (params.author) q.set("author", params.author);
  if (params.q) q.set("q", params.q);
  if (params.following) q.set("following", "true");
  if (params.period) q.set("period", params.period);
  const res = await fetchWithRefresh(`${API_BASE}/emotions?${q}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Feed failed: ${res.status}`);
  return res.json();
}

export async function reactEmotion(id: number, symbol: string): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/emotions/${id}/react`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ symbol }),
  });
  if (!res.ok) throw new Error(`React failed: ${res.status}`);
}

export async function likeEmotion(id: number): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/emotions/${id}/like`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Like failed: ${res.status}`);
}

export async function unlikeEmotion(id: number): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/emotions/${id}/like`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Unlike failed: ${res.status}`);
}

export async function getUserProfile(username: string): Promise<UserProfile> {
  const res = await fetchWithRefresh(`${API_BASE}/users/${username}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Profile failed: ${res.status}`);
  return res.json();
}

export async function getLikedEmotions(username: string, page = 1): Promise<EmotionFeed> {
  const res = await fetchWithRefresh(`${API_BASE}/users/${username}/liked?page=${page}&limit=20`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Liked failed: ${res.status}`);
  return res.json();
}

export async function followUser(username: string): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/users/${username}/follow`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Follow failed: ${res.status}`);
}

export async function unfollowUser(username: string): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/users/${username}/follow`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Unfollow failed: ${res.status}`);
}

export async function getNotifications(): Promise<NotificationResponse[]> {
  const res = await fetchWithRefresh(`${API_BASE}/notifications`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Notifications failed: ${res.status}`);
  return res.json();
}

export async function markNotificationsRead(): Promise<void> {
  await fetchWithRefresh(`${API_BASE}/notifications/read`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function getComments(emotionId: number): Promise<CommentResponse[]> {
  const res = await fetchWithRefresh(`${API_BASE}/emotions/${emotionId}/comments`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Comments failed: ${res.status}`);
  return res.json();
}

export async function addComment(emotionId: number, text: string): Promise<CommentResponse> {
  const res = await fetchWithRefresh(`${API_BASE}/emotions/${emotionId}/comments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Comment failed: ${res.status}`);
  return res.json();
}

export async function getUnreadCount(): Promise<number> {
  try {
    const items = await getNotifications();
    return items.filter(n => !n.read).length;
  } catch {
    return 0;
  }
}

export interface MessageResponse {
  id: number;
  from_username: string;
  to_username: string;
  emotion_id?: number;
  emotion_type?: string;
  emotion_hue?: number;
  read: boolean;
  created_at: string;
}

export interface CollectionResponse {
  id: number;
  username: string;
  title: string;
  emotion_count: number;
  preview_hues: number[];
  created_at: string;
}

export interface CollectionFull {
  id: number;
  username: string;
  title: string;
  emotions: EmotionResponse[];
  created_at: string;
}

export async function createCollection(title: string): Promise<CollectionResponse> {
  const res = await fetchWithRefresh(`${API_BASE}/collections`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`Create collection failed: ${res.status}`);
  return res.json();
}

export async function getCollections(username: string): Promise<CollectionResponse[]> {
  const res = await fetch(`${API_BASE}/collections?username=${encodeURIComponent(username)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getCollection(id: number): Promise<CollectionFull> {
  const res = await fetchWithRefresh(`${API_BASE}/collections/${id}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Get collection failed: ${res.status}`);
  return res.json();
}

export async function addToCollection(collectionId: number, emotionId: number): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/collections/${collectionId}/add`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ emotion_id: emotionId }),
  });
  if (!res.ok) throw new Error(`Add to collection failed: ${res.status}`);
}

export async function removeFromCollection(collectionId: number, emotionId: number): Promise<void> {
  const res = await fetchWithRefresh(`${API_BASE}/collections/${collectionId}/emotions/${emotionId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Remove from collection failed: ${res.status}`);
}

export async function sendMessage(to_username: string, emotion_id: number): Promise<MessageResponse> {
  const res = await fetchWithRefresh(`${API_BASE}/messages`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ to_username, emotion_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Send failed: ${res.status}`);
  }
  return res.json();
}

export async function getInbox(): Promise<MessageResponse[]> {
  const res = await fetchWithRefresh(`${API_BASE}/messages/inbox`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Inbox failed: ${res.status}`);
  return res.json();
}

export async function markMessageRead(id: number): Promise<void> {
  await fetchWithRefresh(`${API_BASE}/messages/${id}/read`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function getFollowers(username: string): Promise<{ username: string }[]> {
  const r = await fetch(`${API_BASE}/users/${username}/followers`);
  if (!r.ok) return [];
  return r.json();
}

export async function getFollowing(username: string): Promise<{ username: string }[]> {
  const r = await fetch(`${API_BASE}/users/${username}/following`);
  if (!r.ok) return [];
  return r.json();
}

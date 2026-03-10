import { mountCreator } from "./creator";
import { mountViewer } from "./viewer";
import { mountFeed } from "./feed";
import { mountEmotionPage } from "./emotionPage";
import { mountProfile } from "./profile";
import { mountNotifications } from "./notifications";
import { t, getLang, setLang, Lang } from "./i18n";
import { login, register, getUnreadCount } from "./api";
import { isLoggedIn, getUsername, clearAuth, onAuthChange } from "./state";
import { initTheme, toggleTheme, getTheme } from "./theme";
import { parseRoute } from "./router";

initTheme();

const app = document.getElementById("app")!;

let cleanup: (() => void) | null = null;

function createNav(): HTMLElement {
  const nav = document.createElement("nav");
  nav.className = "nav";

  const createLink = document.createElement("a");
  createLink.href = "#/create";
  createLink.textContent = t("create");

  const viewLink = document.createElement("a");
  viewLink.href = "#/view";
  viewLink.textContent = t("view");

  const feedLink = document.createElement("a");
  feedLink.href = "#/feed";
  feedLink.textContent = t("feed");

  const langBtn = document.createElement("button");
  langBtn.className = "lang-btn";
  langBtn.textContent = getLang() === "ru" ? "EN" : "RU";
  langBtn.addEventListener("click", () => {
    const next: Lang = getLang() === "ru" ? "en" : "ru";
    setLang(next);
    route();
  });

  nav.appendChild(createLink);
  nav.appendChild(viewLink);
  nav.appendChild(feedLink);

  if (isLoggedIn()) {
    const username = getUsername() || "";

    // Notification bell
    const bell = document.createElement("a");
    bell.href = "#/notifications";
    bell.className = "nav-bell";
    bell.textContent = "🔔";
    nav.appendChild(bell);

    // Fetch unread count async
    getUnreadCount().then(count => {
      if (count > 0) {
        const badge = document.createElement("span");
        badge.className = "nav-bell-badge";
        badge.textContent = count > 9 ? "9+" : String(count);
        bell.appendChild(badge);
      }
    });

    const userLink = document.createElement("a");
    userLink.href = `#/profile/${username}`;
    userLink.className = "nav-user";
    userLink.textContent = username;
    nav.appendChild(userLink);

    const logoutBtn = document.createElement("button");
    logoutBtn.className = "lang-btn";
    logoutBtn.textContent = t("logout");
    logoutBtn.addEventListener("click", () => {
      clearAuth();
      route();
    });
    nav.appendChild(logoutBtn);
  } else {
    const authLink = document.createElement("a");
    authLink.href = "#/auth";
    authLink.textContent = t("auth");
    nav.appendChild(authLink);
  }

  const themeBtn = document.createElement("button");
  themeBtn.className = "theme-btn";
  themeBtn.title = "Toggle theme";
  themeBtn.textContent = getTheme() === "dark" ? "☀" : "🌙";
  themeBtn.addEventListener("click", () => {
    const next = toggleTheme();
    themeBtn.textContent = next === "dark" ? "☀" : "🌙";
  });

  nav.appendChild(langBtn);
  nav.appendChild(themeBtn);

  function updateActive() {
    const r = parseRoute(location.hash);
    createLink.classList.toggle("active", r.name === "create");
    viewLink.classList.toggle("active", r.name === "view");
    feedLink.classList.toggle("active", r.name === "feed" || r.name === "emotion" || r.name === "profile");
  }

  const ac = new AbortController();
  window.addEventListener("hashchange", updateActive, { signal: ac.signal });
  updateActive();

  nav.dataset.cleanup = "";
  (nav as any)._cleanup = () => ac.abort();

  return nav;
}

function mountAuth(app: HTMLElement) {
  const container = document.createElement("div");
  container.className = "auth-container";

  const title = document.createElement("h2");
  title.className = "auth-title";
  title.textContent = t("auth");

  const form = document.createElement("form");
  form.className = "auth-form";

  const usernameInput = document.createElement("input");
  usernameInput.type = "text";
  usernameInput.placeholder = t("username");
  usernameInput.className = "auth-input";
  usernameInput.minLength = 2;
  usernameInput.maxLength = 32;
  usernameInput.required = true;

  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.placeholder = t("password");
  passwordInput.className = "auth-input";
  passwordInput.minLength = 4;
  passwordInput.required = true;

  const msg = document.createElement("div");
  msg.className = "auth-msg";

  const loginBtn = document.createElement("button");
  loginBtn.type = "submit";
  loginBtn.className = "action-btn";
  loginBtn.textContent = t("login");

  const registerBtn = document.createElement("button");
  registerBtn.type = "button";
  registerBtn.className = "action-btn auth-register-btn";
  registerBtn.textContent = t("register");

  form.appendChild(usernameInput);
  form.appendChild(passwordInput);
  form.appendChild(msg);
  form.appendChild(loginBtn);
  form.appendChild(registerBtn);
  container.appendChild(title);
  container.appendChild(form);
  app.appendChild(container);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    msg.className = "auth-msg";
    try {
      await login(usernameInput.value, passwordInput.value);
      location.hash = "#/create";
      route();
    } catch (err: any) {
      msg.textContent = err.message || t("invalidCredentials");
      msg.className = "auth-msg auth-msg-error";
    }
  });

  registerBtn.addEventListener("click", async () => {
    if (!form.reportValidity()) return;
    msg.textContent = "";
    msg.className = "auth-msg";
    try {
      await register(usernameInput.value, passwordInput.value);
      msg.textContent = t("registerSuccess");
      msg.className = "auth-msg auth-msg-success";
    } catch (err: any) {
      msg.textContent = err.message || t("usernameTaken");
      msg.className = "auth-msg auth-msg-error";
    }
  });
}

function route() {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }

  // Clean up previous nav's hashchange listener before wiping DOM
  const prevNav = app.querySelector(".nav") as any;
  prevNav?._cleanup?.();

  app.innerHTML = "";
  app.classList.remove("page-enter");
  void app.offsetWidth; // force reflow
  app.classList.add("page-enter");
  app.appendChild(createNav());
  app.appendChild(createMobileNav());

  const route = parseRoute(location.hash);

  switch (route.name) {
    case "view":          cleanup = mountViewer(app) || null; break;
    case "feed":          cleanup = mountFeed(app) || null; break;
    case "emotion":       cleanup = mountEmotionPage(app, route.id) || null; break;
    case "profile":       cleanup = mountProfile(app, route.username) || null; break;
    case "notifications": cleanup = mountNotifications(app) || null; break;
    case "auth":          mountAuth(app); break;
    default:              cleanup = mountCreator(app) || null;
  }
}

function createMobileNav(): HTMLElement {
  const bar = document.createElement("nav");
  bar.className = "mobile-nav";

  const tabs = [
    { href: "#/create",        icon: "✦", labelKey: "create" as const },
    { href: "#/feed",          icon: "◈", labelKey: "feed" as const },
    { href: "#/notifications", icon: "🔔", labelKey: "notifications" as const },
  ] as const;

  const hash = location.hash || "#/create";

  tabs.forEach(({ href, icon, labelKey }) => {
    const a = document.createElement("a");
    a.href = href;
    a.className = `mobile-nav-tab${hash.startsWith(href) ? " active" : ""}`;
    a.innerHTML = `<span class="mobile-nav-icon">${icon}</span><span class="mobile-nav-label">${t(labelKey)}</span>`;
    bar.appendChild(a);
  });

  // Profile or Auth tab
  const profileA = document.createElement("a");
  if (isLoggedIn()) {
    const u = getUsername() || "";
    profileA.href = `#/profile/${u}`;
    profileA.className = `mobile-nav-tab${hash.startsWith("#/profile/") ? " active" : ""}`;
    profileA.innerHTML = `<span class="mobile-nav-icon">◉</span><span class="mobile-nav-label">${t("profile")}</span>`;
  } else {
    profileA.href = "#/auth";
    profileA.className = `mobile-nav-tab${hash === "#/auth" ? " active" : ""}`;
    profileA.innerHTML = `<span class="mobile-nav-icon">◎</span><span class="mobile-nav-label">${t("auth")}</span>`;
  }
  bar.appendChild(profileA);

  return bar;
}

window.addEventListener("hashchange", route);
onAuthChange(route);
route();

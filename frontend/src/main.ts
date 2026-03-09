import { mountCreator } from "./creator";
import { mountViewer } from "./viewer";
import { mountFeed } from "./feed";
import { mountEmotionPage } from "./emotionPage";
import { mountProfile } from "./profile";
import { t, getLang, setLang, Lang } from "./i18n";
import { login, register } from "./api";
import { isLoggedIn, getUsername, clearAuth, onAuthChange } from "./state";

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

  nav.appendChild(langBtn);

  function updateActive() {
    const hash = location.hash || "#/create";
    createLink.classList.toggle("active", hash === "#/create");
    viewLink.classList.toggle("active", hash === "#/view");
    feedLink.classList.toggle("active", hash.startsWith("#/feed") || hash.startsWith("#/emotion/") || hash.startsWith("#/profile/"));
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
  app.appendChild(createNav());

  const hash = location.hash || "#/create";

  if (hash === "#/view") {
    cleanup = mountViewer(app) || null;
  } else if (hash === "#/feed") {
    cleanup = mountFeed(app) || null;
  } else if (hash.startsWith("#/emotion/")) {
    const id = parseInt(hash.slice("#/emotion/".length), 10);
    if (!isNaN(id)) cleanup = mountEmotionPage(app, id) || null;
    else cleanup = mountFeed(app) || null;
  } else if (hash.startsWith("#/profile/")) {
    const username = hash.slice("#/profile/".length);
    if (username) cleanup = mountProfile(app, username) || null;
    else location.hash = "#/feed";
  } else if (hash === "#/auth") {
    mountAuth(app);
  } else {
    cleanup = mountCreator(app) || null;
  }
}

window.addEventListener("hashchange", route);
onAuthChange(route);
route();

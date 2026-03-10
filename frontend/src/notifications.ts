import { getNotifications, markNotificationsRead } from "./api";
import { t } from "./i18n";

export function mountNotifications(app: HTMLElement) {
  const wrap = document.createElement("div");
  wrap.className = "notif-wrap";

  const header = document.createElement("div");
  header.className = "notif-header";

  const title = document.createElement("h2");
  title.className = "notif-title";
  title.textContent = t("notifications");

  const readAllBtn = document.createElement("button");
  readAllBtn.className = "notif-read-all";
  readAllBtn.textContent = t("markRead");

  header.appendChild(title);
  header.appendChild(readAllBtn);

  const list = document.createElement("div");
  list.className = "notif-list";
  list.textContent = t("loading");

  wrap.appendChild(header);
  wrap.appendChild(list);
  app.appendChild(wrap);

  getNotifications().then(items => {
    list.textContent = "";

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "notif-empty";
      empty.textContent = t("noNotifications");
      list.appendChild(empty);
      return;
    }

    items.forEach(n => {
      const item = document.createElement("div");
      item.className = `notif-item${n.read ? "" : " notif-unread"}`;

      const dot = document.createElement("span");
      dot.className = "notif-dot";

      const text = document.createElement("span");
      text.className = "notif-text";

      if (n.type === "like") {
        text.innerHTML = `<a href="#/profile/${n.from_username}" class="notif-link">${n.from_username}</a> ${t("notifLiked")} <a href="#/emotion/${n.emotion_id}" class="notif-link">#${n.emotion_id}</a>`;
      } else if (n.type === "comment") {
        text.innerHTML = `<a href="#/profile/${n.from_username}" class="notif-link">${n.from_username}</a> ${t("notifCommented")} <a href="#/emotion/${n.emotion_id}" class="notif-link">#${n.emotion_id}</a>`;
      } else {
        text.textContent = `${n.from_username} — ${n.type}`;
      }

      const time = document.createElement("span");
      time.className = "notif-time";
      time.textContent = new Date(n.created_at).toLocaleString();

      item.appendChild(dot);
      item.appendChild(text);
      item.appendChild(time);
      list.appendChild(item);
    });

    // Mark all as read after viewing
    markNotificationsRead().catch(() => {});
  }).catch(() => {
    list.textContent = t("notFound");
  });

  readAllBtn.addEventListener("click", () => {
    markNotificationsRead().then(() => {
      list.querySelectorAll(".notif-unread").forEach(el => {
        el.classList.remove("notif-unread");
      });
      readAllBtn.style.opacity = "0.3";
    });
  });

  return () => {};
}

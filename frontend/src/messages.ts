import { getInbox, markMessageRead, MessageResponse } from "./api";
import { t } from "./i18n";
import { createAvatarCanvas } from "./avatar";
import { emotionPreviewStyle } from "./card";

export function mountMessages(app: HTMLElement) {
  const wrap = document.createElement("div");
  wrap.className = "messages-wrap";

  const heading = document.createElement("h2");
  heading.className = "messages-heading";
  heading.textContent = t("inbox");
  wrap.appendChild(heading);

  const list = document.createElement("div");
  list.className = "messages-list";
  list.textContent = t("loading");
  wrap.appendChild(list);
  app.appendChild(wrap);

  getInbox().then(items => {
    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML = `<div class="messages-empty">${t("noMessages")}</div>`;
      return;
    }
    items.forEach(msg => {
      list.appendChild(createMessageRow(msg));
    });
  }).catch(() => {
    list.innerHTML = `<div class="messages-empty">${t("noMessages")}</div>`;
  });
}

function createMessageRow(msg: MessageResponse): HTMLElement {
  const row = document.createElement("div");
  row.className = `message-row${msg.read ? "" : " unread"}`;

  const av = createAvatarCanvas(msg.from_username, 36);
  av.className = "message-avatar";

  const body = document.createElement("div");
  body.className = "message-body";

  const sender = document.createElement("span");
  sender.className = "message-sender";
  sender.textContent = msg.from_username;

  const dot = document.createElement("span");
  dot.className = "message-dot";
  dot.textContent = ` · `;

  const date = document.createElement("span");
  date.className = "message-date";
  date.textContent = new Date(msg.created_at).toLocaleDateString();

  const preview = document.createElement("div");
  preview.className = "message-preview";
  if (msg.emotion_hue !== undefined) {
    preview.setAttribute("style", emotionPreviewStyle({ hue: msg.emotion_hue, transparency: 0.2 }));
  }

  const emotionLabel = document.createElement("span");
  emotionLabel.className = "message-emotion-label";
  emotionLabel.textContent = msg.emotion_type || "—";

  body.appendChild(sender);
  body.appendChild(dot);
  body.appendChild(date);
  body.appendChild(emotionLabel);

  row.appendChild(av);
  row.appendChild(body);
  row.appendChild(preview);

  row.addEventListener("click", async () => {
    if (!msg.read) {
      msg.read = true;
      row.classList.remove("unread");
      markMessageRead(msg.id).catch(() => {});
    }
    if (msg.emotion_id) {
      location.hash = `#/emotion/${msg.emotion_id}`;
    }
  });

  return row;
}

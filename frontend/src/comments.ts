import { getComments, addComment, isLoggedIn } from "./api";
import { t } from "./i18n";

export function mountComments(container: HTMLElement, emotionId: number) {
  const section = document.createElement("div");
  section.className = "comments-section";

  const title = document.createElement("div");
  title.className = "comments-title";
  title.textContent = t("comments");

  const list = document.createElement("div");
  list.className = "comments-list";

  // Input row
  const form = document.createElement("div");
  form.className = "comments-form";

  const input = document.createElement("textarea");
  input.className = "comments-input";
  input.placeholder = t("commentPlaceholder");
  input.maxLength = 280;
  input.rows = 2;

  const sendBtn = document.createElement("button");
  sendBtn.className = "action-btn comments-send-btn";
  sendBtn.textContent = t("send");

  if (!isLoggedIn()) {
    input.placeholder = t("loginToComment");
    input.disabled = true;
    sendBtn.disabled = true;
  }

  const counter = document.createElement("div");
  counter.className = "comments-counter";
  counter.textContent = "0 / 280";

  input.addEventListener("input", () => {
    counter.textContent = `${input.value.length} / 280`;
  });

  form.appendChild(input);
  form.appendChild(counter);
  form.appendChild(sendBtn);

  section.appendChild(title);
  section.appendChild(list);
  section.appendChild(form);
  container.appendChild(section);

  function renderComment(c: { username: string; text: string; created_at: string }) {
    const item = document.createElement("div");
    item.className = "comment-item";

    const meta = document.createElement("div");
    meta.className = "comment-meta";
    meta.innerHTML = `<a href="#/profile/${c.username}" class="comment-author">${c.username}</a><span class="comment-time">${new Date(c.created_at).toLocaleString()}</span>`;

    const text = document.createElement("div");
    text.className = "comment-text";
    text.textContent = c.text;

    item.appendChild(meta);
    item.appendChild(text);
    return item;
  }

  // Load existing comments
  getComments(emotionId).then(items => {
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "comments-empty";
      empty.textContent = t("noComments");
      list.appendChild(empty);
    } else {
      items.forEach(c => list.appendChild(renderComment(c)));
    }
  }).catch(() => {});

  sendBtn.addEventListener("click", async () => {
    const text = input.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      const comment = await addComment(emotionId, text);
      // Remove empty state if present
      list.querySelector(".comments-empty")?.remove();
      list.appendChild(renderComment(comment));
      input.value = "";
      counter.textContent = "0 / 280";
    } catch {
      // silent fail
    } finally {
      sendBtn.disabled = false;
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      sendBtn.click();
    }
  });

  return section;
}

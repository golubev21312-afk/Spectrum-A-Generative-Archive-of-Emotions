import { likeEmotion, unlikeEmotion, isLoggedIn, EmotionResponse } from "./api";
import { t } from "./i18n";
import { createAvatarCanvas } from "./avatar";

export function emotionPreviewStyle(params: Record<string, number>): string {
  const h = params.hue ?? 160;
  const tr = params.transparency ?? 0.3;
  const l1 = Math.round(15 + (1 - tr) * 20);
  const l2 = Math.round(30 + (1 - tr) * 25);
  return `background: linear-gradient(135deg,
    hsl(${h},70%,${l1}%) 0%,
    hsl(${(h + 40) % 360},80%,${l2}%) 50%,
    hsl(${(h + 80) % 360},60%,${l1}%) 100%);`;
}

export function createCard(
  emotion: EmotionResponse,
  onLikeToggle: (id: number, liked: boolean) => void = () => {},
  index = 0
): HTMLElement {
  const card = document.createElement("div");
  card.className = "feed-card";
  card.setAttribute("data-id", String(emotion.id));
  card.style.setProperty("--card-index", String(index));

  // Preview — WebGL thumbnail if available, else CSS gradient
  let preview: HTMLElement;
  if (emotion.thumbnail) {
    const img = document.createElement("img");
    img.className = "feed-card-preview feed-card-preview-img";
    img.src = emotion.thumbnail;
    img.loading = "lazy";
    img.alt = emotion.emotion_type || "";
    preview = img;
  } else {
    preview = document.createElement("div");
    preview.className = "feed-card-preview";
    preview.setAttribute("style", emotionPreviewStyle(emotion.parameters));
  }
  preview.addEventListener("click", () => { location.hash = `#/emotion/${emotion.id}`; });

  const info = document.createElement("div");
  info.className = "feed-card-info";

  const emotionLabel = document.createElement("div");
  emotionLabel.className = "feed-card-emotion";
  emotionLabel.textContent = emotion.emotion_type || "—";

  const meta = document.createElement("div");
  meta.className = "feed-card-meta";
  if (emotion.username) {
    const av = createAvatarCanvas(emotion.username, 18);
    av.className = "feed-card-avatar";
    meta.appendChild(av);
    const authorLink = document.createElement("a");
    authorLink.href = `#/profile/${emotion.username}`;
    authorLink.className = "feed-card-author";
    authorLink.textContent = emotion.username;
    meta.appendChild(authorLink);
  } else {
    const anon = document.createElement("span");
    anon.className = "feed-card-author";
    anon.textContent = t("anonymous");
    meta.appendChild(anon);
  }
  const dateSep = document.createElement("span");
  dateSep.textContent = ` · ${new Date(emotion.created_at).toLocaleDateString()}`;
  meta.appendChild(dateSep);

  const likeRow = document.createElement("div");
  likeRow.className = "feed-card-like-row";

  const likeBtn = document.createElement("button");
  likeBtn.className = `feed-like-btn${emotion.liked_by_me ? " liked" : ""}`;
  likeBtn.innerHTML = `<span class="like-icon">${emotion.liked_by_me ? "♥" : "♡"}</span>`;

  const likeCount = document.createElement("span");
  likeCount.className = "like-count";
  likeCount.textContent = String(emotion.likes_count);

  let liked = emotion.liked_by_me;
  let count = emotion.likes_count;

  likeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!isLoggedIn()) {
      likeBtn.title = t("loginToLike");
      likeBtn.classList.add("shake");
      setTimeout(() => likeBtn.classList.remove("shake"), 400);
      return;
    }
    liked = !liked;
    count += liked ? 1 : -1;
    likeBtn.innerHTML = `<span class="like-icon">${liked ? "♥" : "♡"}</span>`;
    likeCount.textContent = String(count);
    likeBtn.classList.toggle("liked", liked);
    try {
      if (liked) { await likeEmotion(emotion.id); } else { await unlikeEmotion(emotion.id); }
      onLikeToggle(emotion.id, liked);
    } catch {
      liked = !liked;
      count += liked ? 1 : -1;
      likeBtn.innerHTML = `<span class="like-icon">${liked ? "♥" : "♡"}</span>`;
      likeCount.textContent = String(count);
      likeBtn.classList.toggle("liked", liked);
    }
  });

  likeRow.appendChild(likeBtn);
  likeRow.appendChild(likeCount);
  info.appendChild(emotionLabel);
  info.appendChild(meta);
  info.appendChild(likeRow);
  card.appendChild(preview);
  card.appendChild(info);
  return card;
}

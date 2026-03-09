import { getUserProfile, likeEmotion, unlikeEmotion, isLoggedIn, EmotionResponse } from "./api";
import { t } from "./i18n";

// Generative avatar — deterministic pattern from username hash
function drawAvatar(canvas: HTMLCanvasElement, username: string) {
  const ctx = canvas.getContext("2d")!;
  const size = canvas.width;

  // Simple hash
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = ((hash << 5) - hash + username.charCodeAt(i)) | 0;
  }
  const rng = (n: number) => {
    hash = ((hash * 1664525 + 1013904223) | 0) + n;
    return (hash >>> 0) / 0xffffffff;
  };

  const hue = Math.floor(rng(0) * 360);
  ctx.fillStyle = `hsl(${hue}, 30%, 12%)`;
  ctx.fillRect(0, 0, size, size);

  // Draw 5×5 symmetric pattern
  const cell = size / 5;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (rng(row * 3 + col) > 0.45) {
        const h2 = (hue + Math.floor(rng(col) * 60) - 30 + 360) % 360;
        const l = 45 + Math.floor(rng(row) * 30);
        ctx.fillStyle = `hsl(${h2}, 80%, ${l}%)`;
        ctx.fillRect(col * cell, row * cell, cell, cell);
        ctx.fillRect((4 - col) * cell, row * cell, cell, cell); // mirror
      }
    }
  }
}

function emotionPreviewStyle(params: Record<string, number>): string {
  const h = params.hue ?? 160;
  const tr = params.transparency ?? 0.3;
  const l1 = Math.round(15 + (1 - tr) * 20);
  const l2 = Math.round(30 + (1 - tr) * 25);
  return `background: linear-gradient(135deg,
    hsl(${h},70%,${l1}%) 0%,
    hsl(${(h + 40) % 360},80%,${l2}%) 50%,
    hsl(${(h + 80) % 360},60%,${l1}%) 100%);`;
}

function createMiniCard(emotion: EmotionResponse): HTMLElement {
  const card = document.createElement("div");
  card.className = "feed-card";
  card.style.cursor = "pointer";
  card.addEventListener("click", () => { location.hash = `#/emotion/${emotion.id}`; });

  const preview = document.createElement("div");
  preview.className = "feed-card-preview";
  preview.setAttribute("style", emotionPreviewStyle(emotion.parameters));

  const info = document.createElement("div");
  info.className = "feed-card-info";

  const label = document.createElement("div");
  label.className = "feed-card-emotion";
  label.textContent = emotion.emotion_type || "—";

  const date = document.createElement("div");
  date.className = "feed-card-meta";
  date.textContent = new Date(emotion.created_at).toLocaleDateString();

  const likeRow = document.createElement("div");
  likeRow.className = "feed-card-like-row";

  const likeBtn = document.createElement("button");
  likeBtn.className = `feed-like-btn${emotion.liked_by_me ? " liked" : ""}`;

  let liked = emotion.liked_by_me;
  let count = emotion.likes_count;

  const likeIcon = document.createElement("span");
  likeIcon.className = "like-icon";
  likeIcon.textContent = liked ? "♥" : "♡";

  const likeCount = document.createElement("span");
  likeCount.className = "like-count";
  likeCount.textContent = String(count);

  likeBtn.appendChild(likeIcon);
  likeBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!isLoggedIn()) return;
    liked = !liked;
    count += liked ? 1 : -1;
    likeIcon.textContent = liked ? "♥" : "♡";
    likeCount.textContent = String(count);
    likeBtn.classList.toggle("liked", liked);
    try {
      liked ? await likeEmotion(emotion.id) : await unlikeEmotion(emotion.id);
    } catch {
      liked = !liked;
      count += liked ? 1 : -1;
      likeIcon.textContent = liked ? "♥" : "♡";
      likeCount.textContent = String(count);
      likeBtn.classList.toggle("liked", liked);
    }
  });

  likeRow.appendChild(likeBtn);
  likeRow.appendChild(likeCount);
  info.appendChild(label);
  info.appendChild(date);
  info.appendChild(likeRow);
  card.appendChild(preview);
  card.appendChild(info);
  return card;
}

export function mountProfile(app: HTMLElement, username: string) {
  const wrap = document.createElement("div");
  wrap.className = "profile-wrap";

  const loading = document.createElement("div");
  loading.className = "feed-empty";
  loading.textContent = t("loading");
  wrap.appendChild(loading);
  app.appendChild(wrap);

  getUserProfile(username).then(profile => {
    wrap.innerHTML = "";

    // Header
    const header = document.createElement("div");
    header.className = "profile-header";

    const avatarCanvas = document.createElement("canvas");
    avatarCanvas.width = 80;
    avatarCanvas.height = 80;
    avatarCanvas.className = "profile-avatar";
    drawAvatar(avatarCanvas, profile.username);

    const headerInfo = document.createElement("div");
    headerInfo.className = "profile-header-info";

    const nameEl = document.createElement("div");
    nameEl.className = "profile-name";
    nameEl.textContent = profile.username;

    const stats = document.createElement("div");
    stats.className = "profile-stats";
    const joinDate = new Date(profile.created_at).toLocaleDateString();
    stats.innerHTML = `
      <span>${profile.emotion_count} ${t("emotions")}</span>
      <span>${profile.likes_count} ${t("likes")}</span>
      <span>${t("joined")}: ${joinDate}</span>
    `;

    headerInfo.appendChild(nameEl);
    headerInfo.appendChild(stats);
    header.appendChild(avatarCanvas);
    header.appendChild(headerInfo);

    // Grid
    const grid = document.createElement("div");
    grid.className = "feed-grid";

    if (profile.emotions.length === 0) {
      grid.innerHTML = `<div class="feed-empty">${t("noEmotions")}</div>`;
    } else {
      profile.emotions.forEach(e => grid.appendChild(createMiniCard(e)));
    }

    wrap.appendChild(header);
    wrap.appendChild(grid);
  }).catch(() => {
    wrap.innerHTML = `<div class="feed-empty">${t("notFound")}</div>`;
  });

  return () => {};
}

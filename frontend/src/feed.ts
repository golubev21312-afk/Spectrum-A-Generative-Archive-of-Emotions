import { getFeed, likeEmotion, unlikeEmotion, isLoggedIn, EmotionResponse } from "./api";
import { t, getLang } from "./i18n";

const EMOTION_TYPES_EN = [
  "Rage","Passion","Anxiety","Energy","Joy","Hope","Calm",
  "Melancholy","Sadness","Mystery","Tenderness","Emptiness",
  "Chaos","Harmony","Contemplation","Serenity",
];
const EMOTION_TYPES_RU = [
  "Ярость","Страсть","Тревога","Энергия","Радость","Надежда","Спокойствие",
  "Меланхолия","Грусть","Мистика","Нежность","Пустота",
  "Хаос","Гармония","Созерцание","Безмятежность",
];

function emotionTypes() {
  return getLang() === "ru" ? EMOTION_TYPES_RU : EMOTION_TYPES_EN;
}

// Generates a CSS gradient based on hue parameter
function emotionPreviewStyle(params: Record<string, number>): string {
  const h = params.hue ?? 160;
  const t2 = params.transparency ?? 0.3;
  const l1 = Math.round(15 + (1 - t2) * 20);
  const l2 = Math.round(30 + (1 - t2) * 25);
  return `background: linear-gradient(135deg,
    hsl(${h},70%,${l1}%) 0%,
    hsl(${(h + 40) % 360},80%,${l2}%) 50%,
    hsl(${(h + 80) % 360},60%,${l1}%) 100%);`;
}

function createCard(emotion: EmotionResponse, onLikeToggle: (id: number, liked: boolean) => void): HTMLElement {
  const card = document.createElement("div");
  card.className = "feed-card";
  card.setAttribute("data-id", String(emotion.id));

  // Preview
  const preview = document.createElement("div");
  preview.className = "feed-card-preview";
  preview.setAttribute("style", emotionPreviewStyle(emotion.parameters));
  preview.addEventListener("click", () => {
    location.hash = `#/emotion/${emotion.id}`;
  });

  // Info
  const info = document.createElement("div");
  info.className = "feed-card-info";

  const emotionLabel = document.createElement("div");
  emotionLabel.className = "feed-card-emotion";
  emotionLabel.textContent = emotion.emotion_type || "—";

  const meta = document.createElement("div");
  meta.className = "feed-card-meta";
  const author = emotion.username
    ? `<a href="#/profile/${emotion.username}" class="feed-card-author">${emotion.username}</a>`
    : `<span class="feed-card-author">${t("anonymous")}</span>`;
  const date = new Date(emotion.created_at).toLocaleDateString();
  meta.innerHTML = `${author} · ${date}`;

  // Likes
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
      liked ? await likeEmotion(emotion.id) : await unlikeEmotion(emotion.id);
      onLikeToggle(emotion.id, liked);
    } catch {
      // revert on error
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

export function mountFeed(app: HTMLElement) {
  const hint = document.createElement("div");
  hint.className = "page-hint";
  hint.textContent = t("feedHint");
  app.appendChild(hint);

  const wrap = document.createElement("div");
  wrap.className = "feed-wrap";

  // Filters
  const filters = document.createElement("div");
  filters.className = "feed-filters";

  // Sort buttons
  const sortWrap = document.createElement("div");
  sortWrap.className = "feed-sort";

  const sortNew = document.createElement("button");
  sortNew.className = "feed-sort-btn active";
  sortNew.textContent = t("sortNew");

  const sortPop = document.createElement("button");
  sortPop.className = "feed-sort-btn";
  sortPop.textContent = t("sortPopular");

  sortWrap.appendChild(sortNew);
  sortWrap.appendChild(sortPop);

  // Emotion type filter
  const typeSelect = document.createElement("select");
  typeSelect.className = "feed-type-select";
  const allOpt = document.createElement("option");
  allOpt.value = "";
  allOpt.textContent = t("allEmotions");
  typeSelect.appendChild(allOpt);
  emotionTypes().forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    typeSelect.appendChild(opt);
  });

  // Author search
  const authorInput = document.createElement("input");
  authorInput.type = "text";
  authorInput.className = "feed-author-input auth-input";
  authorInput.placeholder = t("searchAuthor");

  filters.appendChild(sortWrap);
  filters.appendChild(typeSelect);
  filters.appendChild(authorInput);

  // Grid
  const grid = document.createElement("div");
  grid.className = "feed-grid";

  // Load more
  const loadMoreBtn = document.createElement("button");
  loadMoreBtn.className = "action-btn feed-load-more";
  loadMoreBtn.textContent = t("loadMore");
  loadMoreBtn.style.display = "none";

  wrap.appendChild(filters);
  wrap.appendChild(grid);
  wrap.appendChild(loadMoreBtn);
  app.appendChild(wrap);

  let currentPage = 1;
  let currentSort: "new" | "popular" = "new";
  let currentType = "";
  let currentAuthor = "";
  let totalItems = 0;
  let loading = false;

  function showSkeletons(count = 8) {
    for (let i = 0; i < count; i++) {
      const card = document.createElement("div");
      card.className = "feed-card-skeleton";
      card.innerHTML = `
        <div class="skeleton-preview"></div>
        <div class="skeleton-info">
          <div class="skeleton-line skeleton-line-title"></div>
          <div class="skeleton-line skeleton-line-meta"></div>
        </div>`;
      grid.appendChild(card);
    }
  }

  async function load(reset = false) {
    if (loading) return;
    loading = true;
    if (reset) {
      currentPage = 1;
      grid.innerHTML = "";
      showSkeletons();
    }

    try {
      const data = await getFeed({
        page: currentPage,
        limit: 20,
        sort: currentSort,
        emotion_type: currentType || undefined,
        author: currentAuthor || undefined,
      });
      totalItems = data.total;

      // Remove skeleton placeholders before inserting real cards
      grid.querySelectorAll(".feed-card-skeleton").forEach(el => el.remove());

      if (data.items.length === 0 && currentPage === 1) {
        grid.innerHTML = `<div class="feed-empty">${t("noEmotions")}</div>`;
      } else {
        data.items.forEach(emotion => {
          grid.appendChild(createCard(emotion, () => {}));
        });
      }

      const shown = (currentPage - 1) * 20 + data.items.length;
      loadMoreBtn.style.display = shown < totalItems ? "block" : "none";
    } catch {
      grid.querySelectorAll(".feed-card-skeleton").forEach(el => el.remove());
      if (currentPage === 1) {
        grid.innerHTML = `<div class="feed-empty">${t("noEmotions")}</div>`;
      }
      loadMoreBtn.style.display = "none";
    } finally {
      loading = false;
    }
  }

  sortNew.addEventListener("click", () => {
    currentSort = "new";
    sortNew.classList.add("active");
    sortPop.classList.remove("active");
    load(true);
  });

  sortPop.addEventListener("click", () => {
    currentSort = "popular";
    sortPop.classList.add("active");
    sortNew.classList.remove("active");
    load(true);
  });

  typeSelect.addEventListener("change", () => {
    currentType = typeSelect.value;
    load(true);
  });

  let authorTimer: ReturnType<typeof setTimeout>;
  authorInput.addEventListener("input", () => {
    clearTimeout(authorTimer);
    authorTimer = setTimeout(() => {
      currentAuthor = authorInput.value.trim();
      load(true);
    }, 400);
  });

  loadMoreBtn.addEventListener("click", () => {
    currentPage++;
    load();
  });

  load(true);

  return () => {
    clearTimeout(authorTimer);
  };
}

import { getFeed, isLoggedIn } from "./api";
import { createCard } from "./card";
import { t, getLang } from "./i18n";

function emptyState(): HTMLElement {
  const el = document.createElement("div");
  el.className = "feed-empty-state";
  el.innerHTML = `
    <div class="feed-empty-glyph">◈</div>
    <div class="feed-empty-title">${t("feedEmptyTitle")}</div>
    <div class="feed-empty-sub">${t("feedEmptyText")}</div>
    <a href="#/create" class="feed-empty-action">${t("feedEmptyAction")}</a>
  `;
  return el;
}

const EMOTION_TYPES_EN = [
  "Rage","Passion","Anxiety","Energy","Joy","Hope","Calm",
  "Melancholy","Sadness","Mystery","Tenderness","Emptiness",
  "Chaos","Harmony","Contemplation","Serenity",
  "Fury","Euphoria","Dread","Bliss","Wonder","Nostalgia","Yearning","Catharsis",
];
const EMOTION_TYPES_RU = [
  "Ярость","Страсть","Тревога","Энергия","Радость","Надежда","Спокойствие",
  "Меланхолия","Грусть","Мистика","Нежность","Пустота",
  "Хаос","Гармония","Созерцание","Безмятежность",
  "Бешенство","Эйфория","Ужас","Блаженство","Изумление","Ностальгия","Тоска","Катарсис",
];

function emotionTypes() {
  return getLang() === "ru" ? EMOTION_TYPES_RU : EMOTION_TYPES_EN;
}

// Persist scroll position across navigations
let savedScrollTop = 0;

export function mountFeed(app: HTMLElement) {
  const hint = document.createElement("div");
  hint.className = "page-hint";
  hint.textContent = t("feedHint");
  app.appendChild(hint);

  const wrap = document.createElement("div");
  wrap.className = "feed-wrap";

  // ── Today's top strip ──────────────────────────────────────
  const todaySection = document.createElement("div");
  todaySection.className = "feed-today";

  const todayTitle = document.createElement("div");
  todayTitle.className = "feed-today-title";
  todayTitle.textContent = t("todayTop");

  const todayRow = document.createElement("div");
  todayRow.className = "feed-today-row";

  todaySection.appendChild(todayTitle);
  todaySection.appendChild(todayRow);

  getFeed({ sort: "trending", limit: 5, period: "today" }).then(data => {
    if (data.items.length === 0) {
      todaySection.style.display = "none";
      return;
    }
    data.items.forEach(emotion => {
      const chip = document.createElement("a");
      chip.className = "feed-today-chip";
      chip.href = `#/emotion/${emotion.id}`;
      const h = Number(emotion.parameters.hue ?? 160);
      chip.style.cssText = `background: linear-gradient(135deg, hsl(${h},60%,18%) 0%, hsl(${(h+50)%360},70%,24%) 100%); border-color: hsl(${h},60%,30%)`;
      chip.innerHTML = `
        <span class="feed-today-type">${emotion.emotion_type || "—"}</span>
        <span class="feed-today-meta">${emotion.likes_count} ♥</span>
      `;
      todayRow.appendChild(chip);
    });
  }).catch(() => { todaySection.style.display = "none"; });

  // ── Filters ────────────────────────────────────────────────
  const filters = document.createElement("div");
  filters.className = "feed-filters";

  const sortWrap = document.createElement("div");
  sortWrap.className = "feed-sort";

  const sortNew = document.createElement("button");
  sortNew.className = "feed-sort-btn active";
  sortNew.textContent = t("sortNew");

  const sortPop = document.createElement("button");
  sortPop.className = "feed-sort-btn";
  sortPop.textContent = t("sortPopular");

  const sortTrending = document.createElement("button");
  sortTrending.className = "feed-sort-btn";
  sortTrending.textContent = t("sortTrending");

  const sortFollowing = document.createElement("button");
  sortFollowing.className = "feed-sort-btn";
  sortFollowing.textContent = t("followingFeed");
  if (!isLoggedIn()) sortFollowing.style.display = "none";

  sortWrap.appendChild(sortNew);
  sortWrap.appendChild(sortPop);
  sortWrap.appendChild(sortTrending);
  sortWrap.appendChild(sortFollowing);

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

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.className = "feed-author-input auth-input";
  searchInput.placeholder = t("search");

  filters.appendChild(sortWrap);
  filters.appendChild(typeSelect);
  filters.appendChild(searchInput);

  // ── Grid ───────────────────────────────────────────────────
  const grid = document.createElement("div");
  grid.className = "feed-grid";

  const sentinel = document.createElement("div");
  sentinel.className = "feed-sentinel";

  wrap.appendChild(todaySection);
  wrap.appendChild(filters);
  wrap.appendChild(grid);
  wrap.appendChild(sentinel);
  app.appendChild(wrap);

  let currentPage = 1;
  let currentSort: "new" | "popular" | "trending" = "new";
  let currentType = "";
  let currentQ = "";
  let currentFollowing = false;
  let totalItems = 0;
  let loading = false;
  let cardIndex = 0;

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
      cardIndex = 0;
      grid.innerHTML = "";
      showSkeletons();
    }

    try {
      const data = await getFeed({
        page: currentPage,
        limit: 20,
        sort: currentSort,
        emotion_type: currentType || undefined,
        q: currentQ || undefined,
        following: currentFollowing || undefined,
      });
      totalItems = data.total;

      grid.querySelectorAll(".feed-card-skeleton").forEach(el => el.remove());

      if (data.items.length === 0 && currentPage === 1) {
        grid.appendChild(emptyState());
      } else {
        data.items.forEach(emotion => {
          grid.appendChild(createCard(emotion, () => {}, cardIndex++));
        });
      }

      const shown = (currentPage - 1) * 20 + data.items.length;
      sentinel.style.display = shown < totalItems ? "block" : "none";
    } catch {
      grid.querySelectorAll(".feed-card-skeleton").forEach(el => el.remove());
      if (currentPage === 1) grid.appendChild(emptyState());
      sentinel.style.display = "none";
    } finally {
      loading = false;
    }
  }

  function setSort(s: "new" | "popular" | "trending", following = false) {
    currentSort = s;
    currentFollowing = following;
    [sortNew, sortPop, sortTrending, sortFollowing].forEach(b => b.classList.remove("active"));
    if (following) sortFollowing.classList.add("active");
    else if (s === "new") sortNew.classList.add("active");
    else if (s === "popular") sortPop.classList.add("active");
    else sortTrending.classList.add("active");
    load(true);
  }

  sortNew.addEventListener("click", () => setSort("new"));
  sortPop.addEventListener("click", () => setSort("popular"));
  sortTrending.addEventListener("click", () => setSort("trending"));
  sortFollowing.addEventListener("click", () => setSort("new", true));

  typeSelect.addEventListener("change", () => {
    currentType = typeSelect.value;
    load(true);
  });

  let searchTimer: ReturnType<typeof setTimeout>;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentQ = searchInput.value.trim();
      load(true);
    }, 400);
  });

  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      currentPage++;
      load();
    }
  }, { rootMargin: "200px" });
  observer.observe(sentinel);

  wrap.scrollTop = savedScrollTop;
  wrap.addEventListener("scroll", () => { savedScrollTop = wrap.scrollTop; }, { passive: true });

  load(true);

  return () => {
    clearTimeout(searchTimer);
    observer.disconnect();
  };
}

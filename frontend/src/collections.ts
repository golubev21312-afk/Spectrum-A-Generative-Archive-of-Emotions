import { getCollection, removeFromCollection, isLoggedIn, CollectionFull } from "./api";
import { createCard } from "./card";
import { t } from "./i18n";
import { getUsername } from "./state";

export function mountCollection(app: HTMLElement, id: number) {
  const wrap = document.createElement("div");
  wrap.className = "collection-page-wrap";

  const heading = document.createElement("h2");
  heading.className = "collection-page-heading";
  heading.textContent = t("loading");
  wrap.appendChild(heading);

  const grid = document.createElement("div");
  grid.className = "feed-grid";
  wrap.appendChild(grid);
  app.appendChild(wrap);

  getCollection(id).then(coll => {
    heading.textContent = coll.title;

    const meta = document.createElement("div");
    meta.className = "collection-page-meta";
    meta.innerHTML = `<a href="#/profile/${coll.username}" class="feed-card-author">${coll.username}</a>
      <span class="message-dot"> · </span>
      <span class="message-date">${coll.emotions.length} ${t("emotions")}</span>`;
    wrap.insertBefore(meta, grid);

    if (!coll.emotions.length) {
      grid.innerHTML = `<div class="feed-empty">${t("noEmotions")}</div>`;
      return;
    }

    const isOwner = isLoggedIn() && getUsername() === coll.username;

    coll.emotions.forEach((emotion, i) => {
      const cardWrap = document.createElement("div");
      cardWrap.style.position = "relative";
      cardWrap.appendChild(createCard(emotion, () => {}, i));

      if (isOwner) {
        const removeBtn = document.createElement("button");
        removeBtn.className = "collection-remove-btn";
        removeBtn.textContent = "×";
        removeBtn.title = t("removeFromCollection");
        removeBtn.addEventListener("click", async (e) => {
          e.stopPropagation();
          removeBtn.disabled = true;
          try {
            await removeFromCollection(id, emotion.id);
            cardWrap.remove();
          } catch {
            removeBtn.disabled = false;
          }
        });
        cardWrap.appendChild(removeBtn);
      }

      grid.appendChild(cardWrap);
    });
  }).catch(() => {
    grid.innerHTML = `<div class="feed-empty">${t("notFound")}</div>`;
  });
}

export function createCollectionCard(coll: { id: number; title: string; emotion_count: number; preview_hues: number[] }): HTMLElement {
  const card = document.createElement("div");
  card.className = "collection-card";
  card.addEventListener("click", () => { location.hash = `#/collection/${coll.id}`; });

  // Mini preview strip with up to 4 color swatches
  const strip = document.createElement("div");
  strip.className = "collection-card-strip";
  const hues = coll.preview_hues.length ? coll.preview_hues : [160];
  hues.slice(0, 4).forEach(h => {
    const swatch = document.createElement("div");
    swatch.className = "collection-swatch";
    swatch.style.background = `hsl(${h}, 70%, 30%)`;
    strip.appendChild(swatch);
  });

  const title = document.createElement("div");
  title.className = "collection-card-title";
  title.textContent = coll.title;

  const count = document.createElement("div");
  count.className = "collection-card-count";
  count.textContent = `${coll.emotion_count} ${t("emotions")}`;

  card.appendChild(strip);
  card.appendChild(title);
  card.appendChild(count);
  return card;
}

import { CubeScene, CubeParams } from "./cube";
import { getEmotion, likeEmotion, unlikeEmotion, isLoggedIn, deleteEmotion, updateEmotionType } from "./api";
import { AmbientAudio } from "./audio";
import { t, detectEmotion } from "./i18n";
import { mountComments } from "./comments";
import { getUsername } from "./state";

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

export function mountEmotionPage(app: HTMLElement, id: number) {
  const cubeScene = new CubeScene(app);
  const audio = new AmbientAudio();

  const startAudio = () => { audio.start(); document.removeEventListener("click", startAudio); };
  document.addEventListener("click", startAudio);

  const overlay = document.createElement("div");
  overlay.className = "viewer-overlay";

  const backBtn = document.createElement("a");
  backBtn.href = "#/feed";
  backBtn.className = "feed-back-btn";
  backBtn.textContent = t("backToFeed");

  const authorTag = document.createElement("div");
  authorTag.className = "viewer-author";

  const emotionTagWrap = document.createElement("div");
  emotionTagWrap.className = "viewer-emotion-wrap";

  const emotionTag = document.createElement("div");
  emotionTag.className = "viewer-emotion";

  const editTypeBtn = document.createElement("button");
  editTypeBtn.className = "edit-type-btn";
  editTypeBtn.textContent = t("editType");
  editTypeBtn.style.display = "none";

  const typeSelect = document.createElement("select");
  typeSelect.className = "edit-type-select";
  typeSelect.style.display = "none";
  [...EMOTION_TYPES_EN, ...EMOTION_TYPES_RU].forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    typeSelect.appendChild(opt);
  });

  emotionTagWrap.appendChild(emotionTag);
  emotionTagWrap.appendChild(editTypeBtn);
  emotionTagWrap.appendChild(typeSelect);

  const info = document.createElement("div");
  info.className = "viewer-info";
  info.textContent = t("loading");

  const viewsTag = document.createElement("div");
  viewsTag.className = "viewer-views";

  // Like button + actions row
  const likeRow = document.createElement("div");
  likeRow.className = "emotion-page-like-row";

  const likeBtn = document.createElement("button");
  likeBtn.className = "action-btn like-action-btn";

  const cloneBtn = document.createElement("button");
  cloneBtn.className = "action-btn";
  cloneBtn.textContent = t("clone");

  const shareBtn = document.createElement("button");
  shareBtn.className = "action-btn screenshot-btn";
  shareBtn.textContent = t("share");

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "action-btn delete-btn";
  deleteBtn.textContent = t("deleteEmotion");
  deleteBtn.style.display = "none";

  likeRow.appendChild(likeBtn);
  likeRow.appendChild(cloneBtn);
  likeRow.appendChild(shareBtn);
  likeRow.appendChild(deleteBtn);

  overlay.appendChild(backBtn);
  overlay.appendChild(authorTag);
  overlay.appendChild(emotionTagWrap);
  overlay.appendChild(info);
  overlay.appendChild(viewsTag);
  overlay.appendChild(likeRow);
  app.appendChild(overlay);

  shareBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(location.href).then(() => {
      shareBtn.textContent = t("copied");
      setTimeout(() => { shareBtn.textContent = t("share"); }, 2000);
    });
  });

  cloneBtn.addEventListener("click", () => {
    // Will be filled after emotion loads
  });

  deleteBtn.addEventListener("click", async () => {
    if (!confirm(t("confirmDelete"))) return;
    deleteBtn.disabled = true;
    try {
      await deleteEmotion(id);
      location.hash = "#/feed";
    } catch {
      deleteBtn.disabled = false;
    }
  });

  let liked = false;
  let likesCount = 0;

  function updateLikeBtn() {
    likeBtn.innerHTML = `${liked ? "♥" : "♡"} ${likesCount}`;
    likeBtn.classList.toggle("liked", liked);
  }

  likeBtn.addEventListener("click", async () => {
    if (!isLoggedIn()) {
      likeBtn.title = t("loginToLike");
      return;
    }
    liked = !liked;
    likesCount += liked ? 1 : -1;
    updateLikeBtn();
    try {
      liked ? await likeEmotion(id) : await unlikeEmotion(id);
    } catch {
      liked = !liked;
      likesCount += liked ? 1 : -1;
      updateLikeBtn();
    }
  });

  // Comments panel (outside overlay, below cube)
  const commentsPanel = document.createElement("div");
  commentsPanel.className = "emotion-page-comments";
  app.appendChild(commentsPanel);
  mountComments(commentsPanel, id);

  getEmotion(id).then(emotion => {
    liked = emotion.liked_by_me;
    likesCount = emotion.likes_count;
    updateLikeBtn();

    if ((emotion.views ?? 0) > 0) {
      viewsTag.textContent = `${emotion.views} ${t("views")}`;
      viewsTag.className = "viewer-views";
    }

    // Accent color based on hue
    const h = emotion.parameters.hue ?? 160;
    document.documentElement.style.setProperty("--accent", `hsl(${h}, 90%, 55%)`);

    // Show owner-only controls
    if (isLoggedIn() && getUsername() === emotion.username) {
      deleteBtn.style.display = "";
      editTypeBtn.style.display = "";
      typeSelect.value = emotion.emotion_type || "";
    }

    editTypeBtn.addEventListener("click", () => {
      const editing = typeSelect.style.display === "none";
      typeSelect.style.display = editing ? "" : "none";
      editTypeBtn.textContent = editing ? "✓" : t("editType");
      if (!editing && typeSelect.value) {
        updateEmotionType(id, typeSelect.value).then(() => {
          emotionTag.textContent = typeSelect.value;
        }).catch(() => {});
      }
    });

    // Wire up clone button with actual params
    cloneBtn.onclick = () => {
      sessionStorage.setItem("spectrum_clone", JSON.stringify(emotion.parameters));
      location.hash = "#/create";
    };

    cubeScene.beginTransition(() => {
      const params = emotion.parameters as unknown as CubeParams;
      cubeScene.updateParams(params);
      const name = emotion.emotion_type || detectEmotion(emotion.parameters);
      emotionTag.textContent = name;
      audio.setEmotion(name);
      authorTag.textContent = emotion.username
        ? `${t("author")}: ${emotion.username}`
        : t("anonymous");
      const date = new Date(emotion.created_at).toLocaleString();
      info.textContent = `#${emotion.id} — ${date}`;
    });
  }).catch(() => {
    info.textContent = t("notFound");
  });

  return () => {
    cubeScene.dispose();
    audio.dispose();
    document.removeEventListener("click", startAudio);
    commentsPanel.remove();
    document.documentElement.style.removeProperty("--accent");
  };
}

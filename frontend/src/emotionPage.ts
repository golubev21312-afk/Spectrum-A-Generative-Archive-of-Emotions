import { CubeScene, CubeParams } from "./cube";
import { getEmotion, likeEmotion, unlikeEmotion, isLoggedIn } from "./api";
import { AmbientAudio } from "./audio";
import { t, detectEmotion } from "./i18n";

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

  const emotionTag = document.createElement("div");
  emotionTag.className = "viewer-emotion";

  const info = document.createElement("div");
  info.className = "viewer-info";
  info.textContent = t("loading");

  // Like button
  const likeRow = document.createElement("div");
  likeRow.className = "emotion-page-like-row";

  const likeBtn = document.createElement("button");
  likeBtn.className = "action-btn like-action-btn";

  const shareBtn = document.createElement("button");
  shareBtn.className = "action-btn screenshot-btn";
  shareBtn.textContent = t("share");

  likeRow.appendChild(likeBtn);
  likeRow.appendChild(shareBtn);

  overlay.appendChild(backBtn);
  overlay.appendChild(authorTag);
  overlay.appendChild(emotionTag);
  overlay.appendChild(info);
  overlay.appendChild(likeRow);
  app.appendChild(overlay);

  shareBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(location.href).then(() => {
      shareBtn.textContent = t("copied");
      setTimeout(() => { shareBtn.textContent = t("share"); }, 2000);
    });
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

  getEmotion(id).then(emotion => {
    liked = emotion.liked_by_me;
    likesCount = emotion.likes_count;
    updateLikeBtn();

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
  };
}

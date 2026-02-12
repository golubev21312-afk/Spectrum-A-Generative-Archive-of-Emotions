import { CubeScene, CubeParams } from "./cube";
import { getRandomEmotion } from "./api";
import { AmbientAudio } from "./audio";
import { t, detectEmotion } from "./i18n";

export function mountViewer(app: HTMLElement) {
  const hint = document.createElement("div");
  hint.className = "page-hint";
  hint.textContent = t("hintView");
  app.appendChild(hint);

  const cubeScene = new CubeScene(app);
  const audio = new AmbientAudio();

  const startAudio = () => {
    audio.start();
    document.removeEventListener("click", startAudio);
  };
  document.addEventListener("click", startAudio);

  const overlay = document.createElement("div");
  overlay.className = "viewer-overlay";

  const authorTag = document.createElement("div");
  authorTag.className = "viewer-author";

  const emotionTag = document.createElement("div");
  emotionTag.className = "viewer-emotion";

  const info = document.createElement("div");
  info.className = "viewer-info";
  info.textContent = t("loading");

  const btn = document.createElement("button");
  btn.className = "action-btn";
  btn.textContent = t("next");

  async function loadRandom() {
    btn.disabled = true;
    info.textContent = t("loading");
    emotionTag.textContent = "";
    authorTag.textContent = "";
    try {
      const emotion = await getRandomEmotion();
      const params = emotion.parameters as unknown as CubeParams;
      cubeScene.updateParams(params);
      const emotionName = detectEmotion(emotion.parameters);
      emotionTag.textContent = emotionName;
      audio.setEmotion(emotionName);
      const author = emotion.username || t("anonymous");
      authorTag.textContent = `${t("author")}: ${author}`;
      const date = new Date(emotion.created_at).toLocaleString();
      info.textContent = `#${emotion.id} — ${date}`;
    } catch {
      info.textContent = t("noEmotions");
    }
    btn.disabled = false;
  }

  btn.addEventListener("click", loadRandom);

  overlay.appendChild(authorTag);
  overlay.appendChild(emotionTag);
  overlay.appendChild(info);
  overlay.appendChild(btn);
  app.appendChild(overlay);

  loadRandom();

  return () => {
    cubeScene.dispose();
    audio.dispose();
    document.removeEventListener("click", startAudio);
  };
}

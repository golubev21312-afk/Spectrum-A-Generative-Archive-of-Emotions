import { CubeScene, CubeParams } from "./cube";
import { getRandomEmotion } from "./api";
import { AmbientAudio } from "./audio";
import { t, detectEmotion } from "./i18n";

const AUTO_INTERVAL = 5; // seconds

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

  const btnRow = document.createElement("div");
  btnRow.className = "viewer-btn-row";

  const btn = document.createElement("button");
  btn.className = "action-btn";
  btn.textContent = t("next");

  const autoBtn = document.createElement("button");
  autoBtn.className = "action-btn viewer-auto-btn";
  autoBtn.textContent = t("autoPlay");

  const countdown = document.createElement("div");
  countdown.className = "viewer-countdown";
  countdown.style.display = "none";

  btnRow.appendChild(btn);
  btnRow.appendChild(autoBtn);

  let autoTimer: ReturnType<typeof setInterval> | null = null;
  let countdownTimer: ReturnType<typeof setInterval> | null = null;
  let secondsLeft = AUTO_INTERVAL;

  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    autoBtn.textContent = t("autoPlay");
    autoBtn.classList.remove("active");
    countdown.style.display = "none";
  }

  function startAuto() {
    autoBtn.textContent = t("autoStop");
    autoBtn.classList.add("active");
    countdown.style.display = "";
    secondsLeft = AUTO_INTERVAL;
    countdown.textContent = `${t("nextIn")} ${secondsLeft}s`;

    countdownTimer = setInterval(() => {
      secondsLeft--;
      countdown.textContent = `${t("nextIn")} ${secondsLeft}s`;
      if (secondsLeft <= 0) secondsLeft = AUTO_INTERVAL;
    }, 1000);

    autoTimer = setInterval(() => {
      secondsLeft = AUTO_INTERVAL;
      loadRandom();
    }, AUTO_INTERVAL * 1000);
  }

  autoBtn.addEventListener("click", () => {
    if (autoTimer) stopAuto();
    else startAuto();
  });

  async function loadRandom() {
    btn.disabled = true;
    info.textContent = t("loading");
    emotionTag.textContent = "";
    authorTag.textContent = "";
    try {
      const emotion = await getRandomEmotion();
      cubeScene.beginTransition(() => {
        const params = emotion.parameters as unknown as CubeParams;
        cubeScene.updateParams(params);
        const emotionName = detectEmotion(emotion.parameters);
        emotionTag.textContent = emotionName;
        audio.setEmotion(emotionName);
        const author = emotion.username || t("anonymous");
        authorTag.textContent = `${t("author")}: ${author}`;
        const date = new Date(emotion.created_at).toLocaleString();
        info.textContent = `#${emotion.id} — ${date}`;
        btn.disabled = false;
      });
    } catch {
      info.textContent = t("noEmotions");
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", () => {
    stopAuto();
    loadRandom();
  });

  overlay.appendChild(authorTag);
  overlay.appendChild(emotionTag);
  overlay.appendChild(info);
  overlay.appendChild(btnRow);
  overlay.appendChild(countdown);
  app.appendChild(overlay);

  loadRandom();

  return () => {
    stopAuto();
    cubeScene.dispose();
    audio.dispose();
    document.removeEventListener("click", startAudio);
  };
}

import { CubeScene } from "./cube";
import { createControls } from "./controls";
import { saveEmotion } from "./api";
import { AmbientAudio } from "./audio";
import { t } from "./i18n";

// Particle force by emotion name (RU + EN)
const EMOTION_FORCE: Record<string, number> = {
  Ярость: -1,    Rage: -1,
  Хаос: -0.8,    Chaos: -0.8,
  Тревога: -0.5, Anxiety: -0.5,
  Страсть: -0.3, Passion: -0.3,
  Грусть: -0.2,  Sadness: -0.2,
  Пустота: -0.1, Emptiness: -0.1,
  Меланхолия: 0, Melancholy: 0,
  Мистика: 0.1,  Mystery: 0.1,
  Созерцание: 0.2, Contemplation: 0.2,
  Спокойствие: 0.2, Calm: 0.2,
  Безмятежность: 0.2, Serenity: 0.2,
  Энергия: 0.3,  Energy: 0.3,
  Гармония: 0.4, Harmony: 0.4,
  Надежда: 0.5,  Hope: 0.5,
  Нежность: 0.6, Tenderness: 0.6,
  Радость: 0.8,  Joy: 0.8,
};

export function mountCreator(app: HTMLElement) {
  const hint = document.createElement("div");
  hint.className = "page-hint";
  hint.textContent = t("hintCreate");
  app.appendChild(hint);

  const cubeScene = new CubeScene(app);
  const audio = new AmbientAudio();

  const startAudio = () => {
    audio.start();
    document.removeEventListener("click", startAudio);
  };
  document.addEventListener("click", startAudio);

  const controls = createControls(
    app,
    (params) => cubeScene.updateParams(params),
    (emotionName) => {
      audio.setEmotion(emotionName);
      cubeScene.setParticleForce(EMOTION_FORCE[emotionName] ?? 0);
    }
  );

  const btnWrap = document.createElement("div");
  btnWrap.className = "viewer-overlay";

  const screenshotBtn = document.createElement("button");
  screenshotBtn.className = "action-btn screenshot-btn";
  screenshotBtn.textContent = t("screenshot");
  screenshotBtn.addEventListener("click", () => {
    cubeScene.getCanvas().toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spectrum-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  const btn = document.createElement("button");
  btn.className = "action-btn";
  btn.textContent = t("save");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.textContent = t("saving");
    try {
      const params = controls.getValues();
      const result = await saveEmotion(params as unknown as Record<string, number>);
      btn.textContent = `${t("saved")} #${result.id}`;
      setTimeout(() => {
        btn.disabled = false;
        btn.textContent = t("save");
      }, 2000);
    } catch (err) {
      btn.textContent = t("errorRetry");
      btn.disabled = false;
      console.error(err);
    }
  });

  btnWrap.appendChild(screenshotBtn);
  btnWrap.appendChild(btn);
  app.appendChild(btnWrap);

  return () => {
    cubeScene.dispose();
    audio.dispose();
    document.removeEventListener("click", startAudio);
  };
}

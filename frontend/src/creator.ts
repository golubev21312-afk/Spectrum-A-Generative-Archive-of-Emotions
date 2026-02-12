import { CubeScene } from "./cube";
import { createControls } from "./controls";
import { saveEmotion } from "./api";
import { AmbientAudio } from "./audio";
import { t } from "./i18n";

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
    (emotionName) => audio.setEmotion(emotionName)
  );

  const btnWrap = document.createElement("div");
  btnWrap.className = "viewer-overlay";

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

  btnWrap.appendChild(btn);
  app.appendChild(btnWrap);

  return () => {
    cubeScene.dispose();
    audio.dispose();
    document.removeEventListener("click", startAudio);
  };
}

import { CubeParams, DEFAULT_PARAMS } from "./cube";
import { t, detectEmotion } from "./i18n";

interface SliderConfig {
  key: keyof CubeParams;
  labelKey: "hue" | "transparency" | "rotation" | "noise" | "particles";
  hintKey: "hintHue" | "hintTransparency" | "hintRotation" | "hintNoise" | "hintParticles";
  min: number;
  max: number;
  step: number;
  default: number;
}

const SLIDERS: SliderConfig[] = [
  { key: "hue", labelKey: "hue", hintKey: "hintHue", min: 0, max: 360, step: 1, default: DEFAULT_PARAMS.hue },
  { key: "transparency", labelKey: "transparency", hintKey: "hintTransparency", min: 0, max: 1, step: 0.01, default: DEFAULT_PARAMS.transparency },
  { key: "rotationSpeed", labelKey: "rotation", hintKey: "hintRotation", min: 0, max: 5, step: 0.1, default: DEFAULT_PARAMS.rotationSpeed },
  { key: "noiseAmplitude", labelKey: "noise", hintKey: "hintNoise", min: 0, max: 2, step: 0.01, default: DEFAULT_PARAMS.noiseAmplitude },
  { key: "particleDensity", labelKey: "particles", hintKey: "hintParticles", min: 0, max: 500, step: 1, default: DEFAULT_PARAMS.particleDensity },
];

export function createControls(
  container: HTMLElement,
  onChange: (params: Partial<CubeParams>) => void,
  onEmotionChange?: (emotionName: string) => void
): { getValues: () => CubeParams; setValues: (params: Partial<CubeParams>) => void } {
  const panel = document.createElement("div");
  panel.className = "controls";

  const title = document.createElement("h2");
  title.textContent = t("params");
  panel.appendChild(title);

  const emotionBox = document.createElement("div");
  emotionBox.className = "emotion-label";
  const emotionTitle = document.createElement("span");
  emotionTitle.className = "emotion-title";
  emotionTitle.textContent = t("emotionLabel") + ": ";
  const emotionName = document.createElement("span");
  emotionName.className = "emotion-name";
  emotionBox.appendChild(emotionTitle);
  emotionBox.appendChild(emotionName);
  panel.appendChild(emotionBox);

  const values: Record<string, number> = {};
  const sliderInputs: Record<string, HTMLInputElement> = {};
  const sliderSpans: Record<string, HTMLElement> = {};
  const sliderSteps: Record<string, number> = {};

  function updateEmotion() {
    const name = detectEmotion(values);
    emotionName.textContent = name;
    onEmotionChange?.(name);
  }

  for (const cfg of SLIDERS) {
    values[cfg.key] = cfg.default;
    sliderSteps[cfg.key] = cfg.step;

    const group = document.createElement("div");
    group.className = "slider-group";

    const label = document.createElement("label");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = t(cfg.labelKey);
    const valueSpan = document.createElement("span");
    valueSpan.className = "value";
    valueSpan.textContent = String(cfg.default);
    label.appendChild(nameSpan);
    label.appendChild(valueSpan);

    const hint = document.createElement("div");
    hint.className = "slider-hint";
    hint.textContent = t(cfg.hintKey);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(cfg.min);
    input.max = String(cfg.max);
    input.step = String(cfg.step);
    input.value = String(cfg.default);

    sliderInputs[cfg.key] = input;
    sliderSpans[cfg.key] = valueSpan;

    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      values[cfg.key] = v;
      valueSpan.textContent = cfg.step < 1 ? v.toFixed(2) : String(v);
      onChange({ [cfg.key]: v });
      updateEmotion();
    });

    group.appendChild(label);
    group.appendChild(hint);
    group.appendChild(input);
    panel.appendChild(group);
  }

  updateEmotion();
  container.appendChild(panel);

  return {
    getValues: () => ({ ...values }) as unknown as CubeParams,
    setValues: (params: Partial<CubeParams>) => {
      for (const [key, val] of Object.entries(params)) {
        if (key in values && typeof val === "number") {
          values[key] = val;
          if (sliderInputs[key]) sliderInputs[key].value = String(val);
          if (sliderSpans[key]) sliderSpans[key].textContent = sliderSteps[key] < 1 ? val.toFixed(2) : String(val);
        }
      }
      onChange({ ...params });
      updateEmotion();
    },
  };
}

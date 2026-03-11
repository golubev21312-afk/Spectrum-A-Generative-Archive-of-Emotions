import { CubeParams, DEFAULT_PARAMS } from "./cube";
import { t, detectEmotion } from "./i18n";
import { ZODIAC_SIGNS } from "./zodiac";

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

const ZODIAC_SYMBOLS: Record<string, string> = {
  cube: "⬛", aries: "♈", taurus: "♉", gemini: "♊", cancer: "♋",
  leo: "♌", virgo: "♍", libra: "♎", scorpio: "♏", sagittarius: "♐",
  capricorn: "♑", aquarius: "♒", pisces: "♓",
};

const ZODIAC_I18N_KEY: Record<string, string> = {
  cube: "zodiacCube", aries: "zodiacAries", taurus: "zodiacTaurus",
  gemini: "zodiacGemini", cancer: "zodiacCancer", leo: "zodiacLeo",
  virgo: "zodiacVirgo", libra: "zodiacLibra", scorpio: "zodiacScorpio",
  sagittarius: "zodiacSagittarius", capricorn: "zodiacCapricorn",
  aquarius: "zodiacAquarius", pisces: "zodiacPisces",
};

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

  // ── Zodiac shape picker ──────────────────────────────────────────────────
  let currentShape = "cube";

  const pickerWrap = document.createElement("div");
  pickerWrap.className = "zodiac-picker";
  const pickerLabel = document.createElement("div");
  pickerLabel.className = "zodiac-picker-label";
  pickerLabel.textContent = t("zodiacPicker");
  pickerWrap.appendChild(pickerLabel);

  const pickerGrid = document.createElement("div");
  pickerGrid.className = "zodiac-picker-grid";

  const shapeButtons: Record<string, HTMLButtonElement> = {};

  const allShapes = ["cube", ...ZODIAC_SIGNS];
  for (const id of allShapes) {
    const btn = document.createElement("button");
    btn.className = "zodiac-btn" + (id === "cube" ? " zodiac-btn--active" : "");
    btn.title = t(ZODIAC_I18N_KEY[id] as Parameters<typeof t>[0]);
    btn.innerHTML = `<span class="zodiac-symbol">${ZODIAC_SYMBOLS[id]}</span><span class="zodiac-name">${t(ZODIAC_I18N_KEY[id] as Parameters<typeof t>[0])}</span>`;
    btn.addEventListener("click", () => {
      shapeButtons[currentShape]?.classList.remove("zodiac-btn--active");
      currentShape = id;
      btn.classList.add("zodiac-btn--active");
      onChange({ shape: id });
    });
    shapeButtons[id] = btn;
    pickerGrid.appendChild(btn);
  }

  pickerWrap.appendChild(pickerGrid);
  panel.appendChild(pickerWrap);
  // ────────────────────────────────────────────────────────────────────────

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
    getValues: () => ({ ...values, shape: currentShape }) as unknown as CubeParams,
    setValues: (params: Partial<CubeParams>) => {
      for (const [key, val] of Object.entries(params)) {
        if (key === "shape" && typeof val === "string") {
          shapeButtons[currentShape]?.classList.remove("zodiac-btn--active");
          currentShape = val;
          shapeButtons[val]?.classList.add("zodiac-btn--active");
        } else if (key in values && typeof val === "number") {
          values[key] = val as number;
          if (sliderInputs[key]) sliderInputs[key].value = String(val);
          if (sliderSpans[key]) sliderSpans[key].textContent = sliderSteps[key] < 1 ? (val as number).toFixed(2) : String(val);
        }
      }
      onChange({ ...params });
      updateEmotion();
    },
  };
}

import { describe, it, expect, beforeEach } from "vitest";
import { detectEmotion, t, getLang, setLang } from "../i18n";

beforeEach(() => {
  localStorage.clear();
  setLang("en");
});

describe("detectEmotion", () => {
  it("detects Rage", () => {
    expect(detectEmotion({ hue: 10, noiseAmplitude: 1.5, rotationSpeed: 4, transparency: 0.2, particleDensity: 100 }))
      .toBe("Rage");
  });

  it("detects Passion (hue<30, rotation>1.5, not rage)", () => {
    expect(detectEmotion({ hue: 20, noiseAmplitude: 0.3, rotationSpeed: 2, transparency: 0.2, particleDensity: 100 }))
      .toBe("Passion");
  });

  it("detects Anxiety (high noise + high rotation)", () => {
    expect(detectEmotion({ hue: 100, noiseAmplitude: 1.5, rotationSpeed: 3, transparency: 0.2, particleDensity: 100 }))
      .toBe("Anxiety");
  });

  it("detects Joy (yellow hue + many particles)", () => {
    expect(detectEmotion({ hue: 60, noiseAmplitude: 0.3, rotationSpeed: 1, transparency: 0.2, particleDensity: 300 }))
      .toBe("Joy");
  });

  it("detects Calm (teal + slow)", () => {
    expect(detectEmotion({ hue: 180, noiseAmplitude: 0.2, rotationSpeed: 0.5, transparency: 0.1, particleDensity: 100 }))
      .toBe("Calm");
  });

  it("detects Chaos (very noisy + dense, hue outside earlier rules)", () => {
    // hue=180 avoids Hope(80-160), rotation=1 avoids Anxiety/Energy, transparency avoids Emptiness
    expect(detectEmotion({ hue: 180, noiseAmplitude: 1.8, rotationSpeed: 1, transparency: 0.2, particleDensity: 400 }))
      .toBe("Chaos");
  });

  it("detects Emptiness (transparent + no particles, hue outside Melancholy range)", () => {
    // hue=50 avoids Melancholy(200-270), low rotation avoids Energy, few particles avoids Joy
    expect(detectEmotion({ hue: 50, noiseAmplitude: 0.3, rotationSpeed: 1, transparency: 0.9, particleDensity: 20 }))
      .toBe("Emptiness");
  });

  it("falls back to Serenity when no rule matches", () => {
    // rotation=2.5 (too high for Harmony<2 and Contemplation<0.5, avoids Anxiety noise<1.2)
    // noise=0.8 (avoids Calm<0.5), transparency=0.5 (avoids Emptiness>0.7)
    // hue=180 (outside Hope 80-160, outside Melancholy 200-270)
    expect(detectEmotion({ hue: 180, noiseAmplitude: 0.8, rotationSpeed: 2.5, transparency: 0.5, particleDensity: 100 }))
      .toBe("Serenity");
  });
});

describe("t translation", () => {
  it("returns English text for 'create' when lang=en", () => {
    setLang("en");
    expect(t("create")).toBe("Create");
  });

  it("returns Russian text for 'create' when lang=ru", () => {
    setLang("ru");
    expect(t("create")).toBe("Создать");
  });

  it("returns correct value for 'feed' key", () => {
    setLang("en");
    expect(t("feed")).toBe("Feed");
  });
});

describe("getLang / setLang", () => {
  it("returns current lang", () => {
    setLang("ru");
    expect(getLang()).toBe("ru");
    setLang("en");
    expect(getLang()).toBe("en");
  });
});

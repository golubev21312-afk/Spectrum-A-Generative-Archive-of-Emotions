type EmotionKey =
  | "rage" | "passion" | "anxiety" | "energy" | "joy"
  | "hope" | "calm" | "melancholy" | "sadness" | "mystery"
  | "tenderness" | "emptiness" | "chaos" | "harmony"
  | "contemplation" | "serenity";

interface EmotionSound {
  notes: number[];
  wave: OscillatorType;
  filterFreq: number;
  lfoSpeed: number;
  volume: number;
  detune: number;
}

const SOUNDS: Record<EmotionKey, EmotionSound> = {
  rage:          { notes: [65, 78, 98],    wave: "sawtooth",  filterFreq: 1800, lfoSpeed: 0.6,  volume: 0.30, detune: 30 },
  passion:       { notes: [110, 139, 165], wave: "sawtooth",  filterFreq: 1200, lfoSpeed: 0.35, volume: 0.27, detune: 15 },
  anxiety:       { notes: [185, 220, 277], wave: "triangle",  filterFreq: 1400, lfoSpeed: 0.8,  volume: 0.21, detune: 40 },
  energy:        { notes: [131, 165, 196], wave: "square",    filterFreq: 1000, lfoSpeed: 0.4,  volume: 0.18, detune: 5 },
  joy:           { notes: [262, 330, 392], wave: "sine",      filterFreq: 2000, lfoSpeed: 0.25, volume: 0.24, detune: 0 },
  hope:          { notes: [196, 247, 294], wave: "sine",      filterFreq: 1200, lfoSpeed: 0.15, volume: 0.24, detune: 0 },
  calm:          { notes: [131, 165, 196], wave: "sine",      filterFreq: 600,  lfoSpeed: 0.08, volume: 0.21, detune: 0 },
  melancholy:    { notes: [110, 131, 165], wave: "triangle",  filterFreq: 700,  lfoSpeed: 0.1,  volume: 0.21, detune: 10 },
  sadness:       { notes: [98, 117, 147],  wave: "sine",      filterFreq: 500,  lfoSpeed: 0.06, volume: 0.18, detune: 8 },
  mystery:       { notes: [104, 139, 156], wave: "triangle",  filterFreq: 900,  lfoSpeed: 0.2,  volume: 0.21, detune: 20 },
  tenderness:    { notes: [220, 277, 330], wave: "sine",      filterFreq: 800,  lfoSpeed: 0.1,  volume: 0.18, detune: 0 },
  emptiness:     { notes: [65, 98, 131],   wave: "sine",      filterFreq: 350,  lfoSpeed: 0.04, volume: 0.15, detune: 5 },
  chaos:         { notes: [147, 185, 208], wave: "sawtooth",  filterFreq: 2200, lfoSpeed: 0.7,  volume: 0.24, detune: 50 },
  harmony:       { notes: [174, 220, 262], wave: "sine",      filterFreq: 900,  lfoSpeed: 0.12, volume: 0.21, detune: 0 },
  contemplation: { notes: [87, 110, 131],  wave: "sine",      filterFreq: 450,  lfoSpeed: 0.05, volume: 0.18, detune: 0 },
  serenity:      { notes: [147, 185, 220], wave: "sine",      filterFreq: 700,  lfoSpeed: 0.08, volume: 0.21, detune: 0 },
};

// Map Russian/English emotion names to keys
const NAME_TO_KEY: Record<string, EmotionKey> = {
  "Ярость": "rage", "Rage": "rage",
  "Страсть": "passion", "Passion": "passion",
  "Тревога": "anxiety", "Anxiety": "anxiety",
  "Энергия": "energy", "Energy": "energy",
  "Радость": "joy", "Joy": "joy",
  "Надежда": "hope", "Hope": "hope",
  "Спокойствие": "calm", "Calm": "calm",
  "Меланхолия": "melancholy", "Melancholy": "melancholy",
  "Грусть": "sadness", "Sadness": "sadness",
  "Мистика": "mystery", "Mystery": "mystery",
  "Нежность": "tenderness", "Tenderness": "tenderness",
  "Пустота": "emptiness", "Emptiness": "emptiness",
  "Хаос": "chaos", "Chaos": "chaos",
  "Гармония": "harmony", "Harmony": "harmony",
  "Созерцание": "contemplation", "Contemplation": "contemplation",
  "Безмятежность": "serenity", "Serenity": "serenity",
};

export class AmbientAudio {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private oscs: OscillatorNode[] = [];
  private filter: BiquadFilterNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private started = false;
  private currentEmotion: EmotionKey = "serenity";

  start() {
    if (this.started) return;
    this.ctx = new AudioContext();
    this.buildGraph(SOUNDS[this.currentEmotion]);
    this.started = true;
  }

  private buildGraph(s: EmotionSound) {
    const ctx = this.ctx!;

    this.gain = ctx.createGain();
    this.gain.gain.value = s.volume;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = s.filterFreq;
    this.filter.Q.value = 1.5;

    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = s.lfoSpeed;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = s.filterFreq * 0.15;
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);

    const levels = [0.4, 0.3, 0.2];
    this.oscs = s.notes.map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = s.wave;
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * s.detune;
      const g = ctx.createGain();
      g.gain.value = levels[i];
      osc.connect(g).connect(this.filter!);
      osc.start();
      return osc;
    });

    this.filter.connect(this.gain).connect(ctx.destination);
    this.lfo.start();
  }

  private stopOscs() {
    this.oscs.forEach(o => o.stop());
    this.oscs = [];
    this.lfo?.stop();
    this.lfo = null;
  }

  setEmotion(name: string) {
    const key = NAME_TO_KEY[name] || "serenity";
    if (key === this.currentEmotion || !this.ctx || !this.started) return;
    this.currentEmotion = key;

    const s = SOUNDS[key];
    const t = this.ctx.currentTime;

    // Smooth transition: crossfade
    const oldGain = this.gain;
    oldGain?.gain.setTargetAtTime(0, t, 0.3);

    const oldOscs = [...this.oscs];
    const oldLfo = this.lfo;

    // Build new graph
    this.buildGraph(s);
    this.gain!.gain.setValueAtTime(0, t);
    this.gain!.gain.setTargetAtTime(s.volume, t + 0.1, 0.4);

    // Clean up old after fade
    setTimeout(() => {
      oldOscs.forEach(o => { try { o.stop(); } catch {} });
      try { oldLfo?.stop(); } catch {}
      oldGain?.disconnect();
    }, 1500);
  }

  dispose() {
    if (!this.started) return;
    this.stopOscs();
    this.gain?.disconnect();
    this.ctx?.close();
    this.started = false;
    this.ctx = null;
  }
}

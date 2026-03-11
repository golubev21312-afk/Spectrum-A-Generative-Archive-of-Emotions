import * as THREE from "three";

export const ZODIAC_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
] as const;

export type ZodiacSign = (typeof ZODIAC_SIGNS)[number];

/** Build extruded 3D geometry for a zodiac sign, normalized to ~1.6 units */
export function buildZodiacGeometry(sign: string): THREE.BufferGeometry {
  const builder = BUILDERS[sign as ZodiacSign];
  if (!builder) return new THREE.BoxGeometry(1.6, 1.6, 1.6, 32, 32, 32);

  const shapes = builder();
  const arr = Array.isArray(shapes) ? shapes : [shapes];

  const geo = new THREE.ExtrudeGeometry(arr, {
    depth: 1.0,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.08,
    bevelSegments: 4,
  });

  geo.center();
  geo.computeBoundingBox();
  const box = geo.boundingBox!;
  const sizeVec = new THREE.Vector3();
  box.getSize(sizeVec);
  const maxXY = Math.max(sizeVec.x, sizeVec.y);
  if (maxXY > 0) {
    const s = 1.6 / maxXY;
    geo.scale(s, s, s);
  }
  return geo;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function rect(x: number, y: number, w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(x, y);
  s.lineTo(x + w, y);
  s.lineTo(x + w, y + h);
  s.lineTo(x, y + h);
  s.closePath();
  return s;
}

function ring(cx: number, cy: number, outer: number, inner: number): THREE.Shape {
  const s = new THREE.Shape();
  s.absarc(cx, cy, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(cx, cy, inner, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

/** Thick arc: outer CCW from startA→endA, inner CW back */
function thickArc(
  cx: number, cy: number,
  outer: number, inner: number,
  startA: number, endA: number,
): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(cx + Math.cos(startA) * outer, cy + Math.sin(startA) * outer);
  s.absarc(cx, cy, outer, startA, endA, false);
  s.absarc(cx, cy, inner, endA, startA, true);
  s.closePath();
  return s;
}

function starShape(n: number, outer: number, inner: number, rot = 0): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 + rot;
    const r = i % 2 === 0 ? outer : inner;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}

// ── builders ─────────────────────────────────────────────────────────────────

const BUILDERS: Record<ZodiacSign, () => THREE.Shape | THREE.Shape[]> = {
  aries:       buildAries,
  taurus:      buildTaurus,
  gemini:      buildGemini,
  cancer:      buildCancer,
  leo:         buildLeo,
  virgo:       buildVirgo,
  libra:       buildLibra,
  scorpio:     buildScorpio,
  sagittarius: buildSagittarius,
  capricorn:   buildCapricorn,
  aquarius:    buildAquarius,
  pisces:      buildPisces,
};

// Aries ♈ — два рога вверх + соединение
function buildAries(): THREE.Shape[] {
  return [
    thickArc(-0.48, 0, 0.65, 0.40, 0, Math.PI),
    thickArc(0.48, 0, 0.65, 0.40, 0, Math.PI),
    rect(-0.11, -0.48, 0.22, 0.55),
  ];
}

// Taurus ♉ — кольцо + два рога
function buildTaurus(): THREE.Shape[] {
  return [
    ring(0, -0.18, 0.70, 0.45),
    thickArc(-0.42, 0.52, 0.46, 0.28, -Math.PI * 0.05, Math.PI * 1.05),
    thickArc(0.42, 0.52, 0.46, 0.28, -Math.PI * 0.05, Math.PI * 1.05),
  ];
}

// Gemini ♊ — две колонны с перекладинами
function buildGemini(): THREE.Shape[] {
  const ph = 1.4, pw = 0.22, bw = 1.52, bh = 0.20, gap = 0.38;
  return [
    rect(-gap / 2 - pw, -ph / 2, pw, ph),
    rect(gap / 2, -ph / 2, pw, ph),
    rect(-bw / 2, ph / 2, bw, bh),
    rect(-bw / 2, -ph / 2 - bh, bw, bh),
  ];
}

// Cancer ♋ — два серпа (паттерн 69)
function buildCancer(): THREE.Shape[] {
  return [
    thickArc(0.12, 0.42, 0.60, 0.38, -Math.PI * 0.25, Math.PI * 1.25),
    thickArc(-0.12, -0.42, 0.60, 0.38, Math.PI * 0.75, Math.PI * 2.25),
  ];
}

// Leo ♌ — кольцо + изогнутый хвост
function buildLeo(): THREE.Shape[] {
  const tail = new THREE.Shape();
  tail.moveTo(0.70, 0.20);
  tail.bezierCurveTo(1.10, 0.20, 1.30, -0.10, 1.10, -0.52);
  tail.bezierCurveTo(0.90, -0.92, 0.35, -0.98, 0.18, -0.70);
  tail.bezierCurveTo(0.46, -0.66, 0.62, -0.40, 0.52, -0.10);
  tail.bezierCurveTo(0.50, 0.00, 0.46, 0.06, 0.46, 0.06);
  tail.lineTo(0.46, 0.20);
  tail.closePath();
  return [ring(0, 0.20, 0.70, 0.46), tail];
}

// Virgo ♍ — шестиконечная звезда
function buildVirgo(): THREE.Shape {
  return starShape(6, 1.0, 0.42, Math.PI / 2);
}

// Libra ♎ — арка + две горизонтальные полосы
function buildLibra(): THREE.Shape[] {
  return [
    thickArc(0, -0.12, 0.62, 0.42, 0, Math.PI),
    rect(-0.82, -0.46, 1.64, 0.18),
    rect(-0.82, -0.80, 1.64, 0.18),
  ];
}

// Scorpio ♏ — две арки (M) + стрела вниз
function buildScorpio(): THREE.Shape[] {
  const archR = 0.40, archT = 0.18, legW = 0.18, legH = 0.70;
  const lx = 0.53; // центр правой ноги

  const arrow = new THREE.Shape();
  arrow.moveTo(lx - legW / 2, 0.08);
  arrow.lineTo(lx + legW / 2, 0.08);
  arrow.lineTo(lx + legW / 2, -0.40);
  arrow.lineTo(lx + 0.24, -0.40);
  arrow.lineTo(lx, -0.72);
  arrow.lineTo(lx - 0.24, -0.40);
  arrow.lineTo(lx - legW / 2, -0.40);
  arrow.closePath();

  return [
    thickArc(-0.42, 0.08, archR, archR - archT, 0, Math.PI),
    thickArc(0.18, 0.08, archR, archR - archT, 0, Math.PI),
    rect(-0.42 - legW / 2, 0.08 - legH, legW, legH),
    rect(0.18 - legW / 2, 0.08 - legH * 0.6, legW, legH * 0.6),
    arrow,
  ];
}

// Sagittarius ♐ — стрела вверх
function buildSagittarius(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 1.0);
  s.lineTo(-0.38, 0.32);
  s.lineTo(-0.14, 0.32);
  s.lineTo(-0.14, -1.0);
  s.lineTo(0.14, -1.0);
  s.lineTo(0.14, 0.32);
  s.lineTo(0.38, 0.32);
  s.closePath();
  return s;
}

// Capricorn ♑ — левый рог + правая ветка с петлёй
function buildCapricorn(): THREE.Shape[] {
  const horn = thickArc(-0.52, 0.28, 0.62, 0.40, Math.PI * 0.52, Math.PI * 1.40);

  const body = new THREE.Shape();
  body.moveTo(-0.14, 0.10);
  body.lineTo(0.10, 0.10);
  body.lineTo(0.55, -0.52);
  body.bezierCurveTo(0.78, -0.82, 1.05, -0.78, 1.02, -0.52);
  body.bezierCurveTo(0.98, -0.26, 0.70, -0.28, 0.58, -0.48);
  body.lineTo(0.30, -0.20);
  body.lineTo(-0.10, 0.10);
  body.closePath();

  return [horn, body];
}

// Aquarius ♒ — две волновые полосы
function buildAquarius(): THREE.Shape[] {
  const h = 0.16, A = 0.28;
  return [0.28, -0.28].map(yBase => {
    const s = new THREE.Shape();
    s.moveTo(-1.0, yBase);
    s.bezierCurveTo(-0.75, yBase + A, -0.25, yBase + A, 0, yBase);
    s.bezierCurveTo(0.25, yBase - A, 0.75, yBase - A, 1.0, yBase);
    s.lineTo(1.0, yBase + h);
    s.bezierCurveTo(0.75, yBase + h - A, 0.25, yBase + h - A, 0, yBase + h);
    s.bezierCurveTo(-0.25, yBase + h + A, -0.75, yBase + h + A, -1.0, yBase + h);
    s.closePath();
    return s;
  });
}

// Pisces ♓ — два серпа + соединительная полоса
function buildPisces(): THREE.Shape[] {
  return [
    thickArc(0.10, 0.48, 0.60, 0.38, Math.PI * 0.15, Math.PI * 0.85),
    thickArc(-0.10, -0.48, 0.60, 0.38, Math.PI * 1.15, Math.PI * 1.85),
    rect(-0.10, -0.10, 0.20, 0.20),
  ];
}

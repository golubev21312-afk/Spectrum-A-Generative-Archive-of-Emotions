import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";
import { buildZodiacGeometry } from "./zodiac";

// ─── Postprocessing shaders ───────────────────────────────────────────────────

const ChromaticAberrationShader = {
  uniforms: { tDiffuse: { value: null }, uOffset: { value: 0.003 } },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uOffset; varying vec2 vUv;
    void main() {
      vec2 dir = vUv - 0.5;
      vec4 r = texture2D(tDiffuse, vUv + dir * uOffset);
      vec4 g = texture2D(tDiffuse, vUv);
      vec4 b = texture2D(tDiffuse, vUv - dir * uOffset);
      gl_FragColor = vec4(r.r, g.g, b.b, g.a);
    }
  `,
};

const VignetteShader = {
  uniforms: { tDiffuse: { value: null }, uDarkness: { value: 0.5 }, uOffset: { value: 1.0 } },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uDarkness; uniform float uOffset; varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - 0.5) * 2.0;
      float vignette = clamp(uOffset - dot(uv, uv) * uDarkness, 0.0, 1.0);
      gl_FragColor = vec4(texel.rgb * vignette, texel.a);
    }
  `,
};

// ─── Particle shaders ─────────────────────────────────────────────────────────

const particleVertShader = `
  attribute float aSize;
  uniform float uPixelRatio;
  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio * (40.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragShader = `
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    float dist = length(gl_PointCoord - 0.5);
    if (dist > 0.5) discard;
    gl_FragColor = vec4(uColor, uOpacity * smoothstep(0.5, 0.05, dist));
  }
`;

// ─── Background & grid GLSL utilities ────────────────────────────────────────

const GLSL_HSL2RGB = `
vec3 hsl2rgb(float h, float s, float l) {
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float hp = h / 60.0;
  float x = c * (1.0 - abs(mod(hp, 2.0) - 1.0));
  vec3 rgb;
  if (hp < 1.0)      rgb = vec3(c, x, 0.0);
  else if (hp < 2.0) rgb = vec3(x, c, 0.0);
  else if (hp < 3.0) rgb = vec3(0.0, c, x);
  else if (hp < 4.0) rgb = vec3(0.0, x, c);
  else if (hp < 5.0) rgb = vec3(x, 0.0, c);
  else               rgb = vec3(c, 0.0, x);
  return rgb + (l - c * 0.5);
}
`;

const GLSL_VNOISE = `
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1); p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i+vec3(1,0,0)), f.x), mix(hash3(i+vec3(0,1,0)), hash3(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i+vec3(0,0,1)), hash3(i+vec3(1,0,1)), f.x), mix(hash3(i+vec3(0,1,1)), hash3(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbmV(vec3 v) {
  float val = 0.0; float amp = 0.5; float freq = 1.0;
  for (int i = 0; i < 4; i++) { val += amp * vnoise(v * freq); amp *= 0.5; freq *= 2.0; }
  return val;
}
`;

// ─── Background shaders ───────────────────────────────────────────────────────

const bgVertShader = `
  varying vec3 vDir;
  void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const bgFragShader = GLSL_HSL2RGB + GLSL_VNOISE + `
  uniform float uTime;
  uniform float uHue;
  varying vec3 vDir;
  void main() {
    vec3 dir = normalize(vDir);
    float cloud = fbmV(dir * 3.0 + uTime * 0.025);
    float star = hash3(floor(dir * 130.0 + 0.5));
    float starGlow = smoothstep(0.978, 1.0, star);
    float nebulaHue = mod(uHue + cloud * 55.0 - 27.0, 360.0);
    vec3 nebulaColor = hsl2rgb(nebulaHue, 0.65, 0.04 + cloud * 0.06);
    vec3 starColor = vec3(0.78, 0.9, 1.0) * starGlow * 0.85;
    gl_FragColor = vec4(nebulaColor + starColor, 1.0);
  }
`;

// ─── Grid shaders ─────────────────────────────────────────────────────────────

const gridVertShader = `
  varying vec3 vWorldPos;
  void main() {
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const gridFragShader = GLSL_HSL2RGB + `
  uniform float uHue;
  varying vec3 vWorldPos;
  void main() {
    vec2 coord = vWorldPos.xz;
    vec2 g = abs(fract(coord * 1.2) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.04, min(g.x, g.y));
    float dist = length(vWorldPos.xz) / 9.0;
    float fade = 1.0 - smoothstep(0.1, 1.0, dist);
    vec3 gridColor = hsl2rgb(uHue, 0.9, 0.45);
    gl_FragColor = vec4(gridColor, line * fade * 0.22);
  }
`;

// ─── Morph shaders ────────────────────────────────────────────────────────────

const morphVertShader = `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  uniform float uMorphT;
  void main() {
    vec3 scatter = normalize(aFrom + aTo + vec3(0.001)) * sin(uMorphT * 3.14159) * 0.5;
    vec3 pos = mix(aFrom, aTo, uMorphT) + scatter;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = 2.5 * (200.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const morphFragShader = GLSL_HSL2RGB + `
  uniform float uHue;
  uniform float uMorphT;
  uniform float uFade;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    if (length(uv) > 0.5) discard;
    float a = smoothstep(0.5, 0.1, length(uv)) * uFade;
    vec3 col = hsl2rgb(mod(uHue + uMorphT * 50.0, 360.0), 1.0, 0.72);
    gl_FragColor = vec4(col, a * 0.9);
  }
`;

function sampleGeoPositions(geo: THREE.BufferGeometry, n: number): Float32Array {
  const pos = geo.attributes.position;
  const count = pos.count;
  const result = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * count);
    result[i * 3]     = pos.getX(idx);
    result[i * 3 + 1] = pos.getY(idx);
    result[i * 3 + 2] = pos.getZ(idx);
  }
  return result;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CubeParams {
  hue: number;
  transparency: number;
  rotationSpeed: number;
  noiseAmplitude: number;
  particleDensity: number;
  particleHue?: number;
  shape?: string; // "cube" | zodiac sign id
}

export const DEFAULT_PARAMS: CubeParams = {
  hue: 160,
  transparency: 0.3,
  rotationSpeed: 1,
  noiseAmplitude: 0.3,
  particleDensity: 200,
  particleHue: 160,
};

// ─── CubeScene ────────────────────────────────────────────────────────────────

export class CubeScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cube: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private composer!: EffectComposer;

  // Particles
  private particles: THREE.Points | null = null;
  private particleMat: THREE.ShaderMaterial | null = null;
  private trailParticles: THREE.Points | null = null;
  private trailMat: THREE.ShaderMaterial | null = null;
  private orbitalR: Float32Array | null = null;
  private orbitalBaseR: Float32Array | null = null;
  private orbitalTheta: Float32Array | null = null;
  private orbitalPhi: Float32Array | null = null;
  private orbitalDTheta: Float32Array | null = null;
  private orbitalDPhi: Float32Array | null = null;
  private trailPos: Float32Array | null = null;
  private particleForce = 0;

  // Background & grid
  private bgMaterial: THREE.ShaderMaterial | null = null;
  private gridMaterial: THREE.ShaderMaterial | null = null;

  // Mobile
  private isMobile: boolean;
  private touchStartX = 0;
  private touchStartY = 0;

  // Particle hue (independent of cube hue)
  private currentParticleHue = DEFAULT_PARAMS.particleHue!;

  // Animation state
  private clock = new THREE.Clock();
  private rotationSpeed = DEFAULT_PARAMS.rotationSpeed;
  private animationId = 0;
  private cubeScaleTarget = 1;
  private transitionCallback: (() => void) | null = null;
  private currentShape = "cube";

  // Morph state
  private morphState: "idle" | "morphing" | "fading" = "idle";
  private morphProgress = 0;
  private morphFade = 1;
  private morphParticles: THREE.Points | null = null;
  private morphMat: THREE.ShaderMaterial | null = null;
  private morphTargetGeo: THREE.BufferGeometry | null = null;

  constructor(private container: HTMLElement) {
    this.isMobile = window.innerWidth < 768;

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      200
    );
    this.camera.position.set(0, this.isMobile ? -0.3 : 0, this.isMobile ? 6.2 : 4);

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.isMobile, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.isMobile ? 1 : 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener("touchstart", this.onTouchStart, { passive: true });
    this.renderer.domElement.addEventListener("touchmove", this.onTouchMove, { passive: false });

    this.createBackground();
    this.createGrid();

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uHue: { value: DEFAULT_PARAMS.hue },
        uTransparency: { value: DEFAULT_PARAMS.transparency },
        uNoiseAmp: { value: DEFAULT_PARAMS.noiseAmplitude },
        uTime: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });

    const seg = this.isMobile ? 16 : 32;
    const size = this.isMobile ? 1.1 : 1.6;
    const geometry = new THREE.BoxGeometry(size, size, size, seg, seg, seg);
    this.cube = new THREE.Mesh(geometry, this.material);
    this.cube.scale.setScalar(0); // appear animation: start invisible
    this.scene.add(this.cube);

    this.createParticles(DEFAULT_PARAMS.particleDensity);
    this.setupComposer();

    window.addEventListener("resize", this.onResize);
    this.animate();
  }

  private createBackground() {
    const geo = new THREE.SphereGeometry(80, 32, 32);
    this.bgMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { uTime: { value: 0 }, uHue: { value: DEFAULT_PARAMS.hue } },
      vertexShader: bgVertShader,
      fragmentShader: bgFragShader,
      depthWrite: false,
    });
    this.scene.add(new THREE.Mesh(geo, this.bgMaterial));
  }

  private createGrid() {
    const geo = new THREE.PlaneGeometry(20, 20);
    this.gridMaterial = new THREE.ShaderMaterial({
      uniforms: { uHue: { value: DEFAULT_PARAMS.hue } },
      vertexShader: gridVertShader,
      fragmentShader: gridFragShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const grid = new THREE.Mesh(geo, this.gridMaterial);
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -2.2;
    this.scene.add(grid);
  }

  private createParticles(count: number) {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particleMat?.dispose();
    }
    if (this.trailParticles) {
      this.scene.remove(this.trailParticles);
      this.trailParticles.geometry.dispose();
      this.trailMat?.dispose();
    }
    this.particles = null;
    this.trailParticles = null;
    this.orbitalR = null;

    const n = Math.min(Math.floor(count), this.isMobile ? 120 : Infinity);
    if (n <= 0) return;

    this.orbitalR = new Float32Array(n);
    this.orbitalBaseR = new Float32Array(n);
    this.orbitalTheta = new Float32Array(n);
    this.orbitalPhi = new Float32Array(n);
    this.orbitalDTheta = new Float32Array(n);
    this.orbitalDPhi = new Float32Array(n);

    const positions = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const trailSizes = new Float32Array(n);

    for (let i = 0; i < n; i++) {
      const r = 1.5 + Math.random() * 1.5;
      this.orbitalR[i] = r;
      this.orbitalBaseR![i] = r;
      this.orbitalTheta[i] = Math.random() * Math.PI * 2;
      this.orbitalPhi[i] = Math.acos(2 * Math.random() - 1);
      this.orbitalDTheta[i] = (0.003 + Math.random() * 0.005) * (Math.random() > 0.5 ? 1 : -1);
      this.orbitalDPhi[i] = (0.001 + Math.random() * 0.003) * (Math.random() > 0.5 ? 1 : -1);
      sizes[i] = 0.6 + Math.random() * 1.4;
      trailSizes[i] = sizes[i] * 0.55;

      const t = this.orbitalTheta[i], p = this.orbitalPhi[i];
      positions[i * 3]     = r * Math.sin(p) * Math.cos(t);
      positions[i * 3 + 1] = r * Math.sin(p) * Math.sin(t);
      positions[i * 3 + 2] = r * Math.cos(p);
    }

    // Trail shares the same Float32Array as its geometry attribute for efficient in-place updates
    this.trailPos = new Float32Array(positions);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

    const pixelRatio = Math.min(window.devicePixelRatio, this.isMobile ? 1 : 2);
    const particleColor = new THREE.Color().setHSL(this.currentParticleHue / 360, 1.0, 0.55);

    this.particleMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: particleColor.clone() },
        uOpacity: { value: 0.75 },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: particleVertShader,
      fragmentShader: particleFragShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.particles = new THREE.Points(geo, this.particleMat);
    this.scene.add(this.particles);

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(this.trailPos, 3));
    trailGeo.setAttribute("aSize", new THREE.BufferAttribute(trailSizes, 1));
    this.trailMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: particleColor.clone() },
        uOpacity: { value: 0.28 },
        uPixelRatio: { value: pixelRatio },
      },
      vertexShader: particleVertShader,
      fragmentShader: particleFragShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.trailParticles = new THREE.Points(trailGeo, this.trailMat);
    this.scene.add(this.trailParticles);
  }

  private setupComposer() {
    const { clientWidth: w, clientHeight: h } = this.container;
    const rt = new THREE.WebGLRenderTarget(w, h, { samples: this.isMobile ? 0 : 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    if (!this.isMobile) {
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.35, 0.6, 0.45));
      this.composer.addPass(new ShaderPass(ChromaticAberrationShader));
    }
    this.composer.addPass(new ShaderPass(VignetteShader));
    this.composer.addPass(new OutputPass());
  }

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - this.touchStartX;
    const dy = e.touches[0].clientY - this.touchStartY;
    this.cube.rotation.y += dx * 0.008;
    this.cube.rotation.x += dy * 0.008;
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
    e.preventDefault();
  };

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
  };

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    const elapsed = this.clock.getElapsedTime();

    this.material.uniforms.uTime.value = elapsed;
    if (this.bgMaterial) this.bgMaterial.uniforms.uTime.value = elapsed;

    // Cube appear / transition animation
    const s = this.cube.scale.x;
    const diff = this.cubeScaleTarget - s;
    if (Math.abs(diff) > 0.001) {
      this.cube.scale.setScalar(s + diff * 0.08);
    } else {
      this.cube.scale.setScalar(this.cubeScaleTarget);
    }

    // Fire transition callback when cube fades out
    if (this.transitionCallback && this.cube.scale.x < 0.04) {
      const cb = this.transitionCallback;
      this.transitionCallback = null;
      this.cubeScaleTarget = 1;
      cb();
    }

    // Morph animation
    if (this.morphState !== "idle" && this.morphMat) {
      if (this.morphState === "morphing") {
        this.morphProgress = Math.min(this.morphProgress + 1 / 50, 1.0);
        this.morphMat.uniforms.uMorphT.value = this.morphProgress;
        if (this.morphProgress >= 1.0) {
          const oldGeo = this.cube.geometry;
          this.cube.geometry = this.morphTargetGeo!;
          this.morphTargetGeo = null;
          oldGeo.dispose();
          this.cube.scale.setScalar(0);
          this.cubeScaleTarget = 1;
          this.cube.visible = true;
          this.morphState = "fading";
          this.morphFade = 1.0;
        }
      } else if (this.morphState === "fading") {
        this.morphFade = Math.max(this.morphFade - 1 / 20, 0);
        this.morphMat.uniforms.uFade.value = this.morphFade;
        if (this.morphFade <= 0) {
          this.scene.remove(this.morphParticles!);
          this.morphParticles!.geometry.dispose();
          this.morphMat.dispose();
          this.morphParticles = null;
          this.morphMat = null;
          this.morphState = "idle";
        }
      }
    }

    this.cube.rotation.x += 0.003 * this.rotationSpeed;
    this.cube.rotation.y += 0.005 * this.rotationSpeed;

    // Update orbital particle positions
    if (this.particles && this.orbitalR) {
      const n = this.orbitalR.length;
      const posArr = this.particles.geometry.attributes.position.array as Float32Array;
      const trailAttr = this.trailParticles!.geometry.attributes.position;
      const trailArr = this.trailPos!;
      const trailLerp = 0.22;

      for (let i = 0; i < n; i++) {
        // Attract (force > 0 → smaller r) / Repel (force < 0 → larger r)
        const targetR = Math.max(1.0, this.orbitalBaseR![i] - this.particleForce * 0.8);
        this.orbitalR[i] += (targetR - this.orbitalR[i]) * 0.015;

        this.orbitalTheta![i] += this.orbitalDTheta![i] * this.rotationSpeed;
        this.orbitalPhi![i] += this.orbitalDPhi![i] * this.rotationSpeed;

        const r = this.orbitalR[i];
        const t = this.orbitalTheta![i];
        const p = this.orbitalPhi![i];
        const x = r * Math.sin(p) * Math.cos(t);
        const y = r * Math.sin(p) * Math.sin(t);
        const z = r * Math.cos(p);

        // Trail lags behind main position
        trailArr[i * 3]     += (x - trailArr[i * 3])     * trailLerp;
        trailArr[i * 3 + 1] += (y - trailArr[i * 3 + 1]) * trailLerp;
        trailArr[i * 3 + 2] += (z - trailArr[i * 3 + 2]) * trailLerp;

        posArr[i * 3]     = x;
        posArr[i * 3 + 1] = y;
        posArr[i * 3 + 2] = z;
      }

      this.particles.geometry.attributes.position.needsUpdate = true;
      trailAttr.needsUpdate = true;
    }

    this.composer.render();
  };

  updateParams(params: Partial<CubeParams>) {
    if (params.hue !== undefined) {
      this.material.uniforms.uHue.value = params.hue;
      if (this.bgMaterial) this.bgMaterial.uniforms.uHue.value = params.hue;
      if (this.gridMaterial) this.gridMaterial.uniforms.uHue.value = params.hue;
      if (this.morphMat) this.morphMat.uniforms.uHue.value = params.hue;
    }
    if (params.particleHue !== undefined) {
      this.currentParticleHue = params.particleHue;
      const c = new THREE.Color().setHSL(params.particleHue / 360, 1.0, 0.55);
      this.particleMat?.uniforms.uColor.value.copy(c);
      this.trailMat?.uniforms.uColor.value.copy(c);
    }
    if (params.transparency !== undefined) {
      this.material.uniforms.uTransparency.value = params.transparency;
    }
    if (params.noiseAmplitude !== undefined) {
      this.material.uniforms.uNoiseAmp.value = params.noiseAmplitude;
    }
    if (params.rotationSpeed !== undefined) {
      this.rotationSpeed = params.rotationSpeed;
    }
    if (params.particleDensity !== undefined) {
      this.createParticles(params.particleDensity);
    }
    if (params.shape !== undefined) {
      this.swapGeometry(params.shape);
    }
  }

  private swapGeometry(shape: string) {
    const id = shape || "cube";
    if (id === this.currentShape || this.morphState !== "idle") return;
    this.currentShape = id;
    const newGeo = id === "cube"
      ? new THREE.BoxGeometry(
          this.isMobile ? 1.1 : 1.6, this.isMobile ? 1.1 : 1.6, this.isMobile ? 1.1 : 1.6,
          this.isMobile ? 16 : 32, this.isMobile ? 16 : 32, this.isMobile ? 16 : 32,
        )
      : buildZodiacGeometry(id);
    this.startMorph(newGeo);
  }

  private startMorph(newGeo: THREE.BufferGeometry) {
    const N = 1000;
    const posA = sampleGeoPositions(this.cube.geometry, N);
    const posB = sampleGeoPositions(newGeo, N);

    const morphGeo = new THREE.BufferGeometry();
    morphGeo.setAttribute("position", new THREE.BufferAttribute(posA.slice(), 3));
    morphGeo.setAttribute("aFrom", new THREE.BufferAttribute(posA, 3));
    morphGeo.setAttribute("aTo", new THREE.BufferAttribute(posB, 3));

    if (this.morphParticles) {
      this.scene.remove(this.morphParticles);
      this.morphParticles.geometry.dispose();
      this.morphMat?.dispose();
    }

    this.morphMat = new THREE.ShaderMaterial({
      vertexShader: morphVertShader,
      fragmentShader: morphFragShader,
      uniforms: {
        uMorphT: { value: 0 },
        uHue:    { value: this.material.uniforms.uHue.value },
        uFade:   { value: 1.0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.morphParticles = new THREE.Points(morphGeo, this.morphMat);
    this.morphParticles.frustumCulled = false;
    this.scene.add(this.morphParticles);

    this.morphTargetGeo = newGeo;
    this.morphProgress = 0;
    this.morphFade = 1.0;
    this.morphState = "morphing";
    this.cube.visible = false;
  }

  /** Set particle force: positive = attract toward cube, negative = repel */
  setParticleForce(force: number) {
    this.particleForce = Math.max(-1, Math.min(1, force));
  }

  /** Scale cube out to 0, call onComplete, then scale back to 1 */
  beginTransition(onComplete: () => void) {
    this.cubeScaleTarget = 0;
    this.transitionCallback = onComplete;
  }

  /** Returns the renderer canvas (for screenshot export) */
  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  getParams(): CubeParams {
    return {
      hue: this.material.uniforms.uHue.value,
      transparency: this.material.uniforms.uTransparency.value,
      rotationSpeed: this.rotationSpeed,
      noiseAmplitude: this.material.uniforms.uNoiseAmp.value,
      particleDensity: this.particles
        ? this.particles.geometry.attributes.position.count
        : 0,
      shape: this.currentShape,
      particleHue: this.currentParticleHue,
    };
  }

  dispose() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.onResize);
    this.renderer.domElement.removeEventListener("touchstart", this.onTouchStart);
    this.renderer.domElement.removeEventListener("touchmove", this.onTouchMove);
    this.composer.dispose();
    this.renderer.dispose();
    this.material.dispose();
    this.cube.geometry.dispose();
    if (this.particles) { this.particles.geometry.dispose(); this.particleMat?.dispose(); }
    if (this.trailParticles) { this.trailParticles.geometry.dispose(); this.trailMat?.dispose(); }
    if (this.morphParticles) { this.morphParticles.geometry.dispose(); this.morphMat?.dispose(); }
    this.morphTargetGeo?.dispose();
    this.bgMaterial?.dispose();
    this.gridMaterial?.dispose();
    this.renderer.domElement.remove();
  }
}

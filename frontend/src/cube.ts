import * as THREE from "three";
import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";

export interface CubeParams {
  hue: number;
  transparency: number;
  rotationSpeed: number;
  noiseAmplitude: number;
  particleDensity: number;
}

export const DEFAULT_PARAMS: CubeParams = {
  hue: 160,
  transparency: 0.3,
  rotationSpeed: 1,
  noiseAmplitude: 0.3,
  particleDensity: 200,
};

export class CubeScene {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private cube: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private particles: THREE.Points | null = null;
  private particleMaterial: THREE.PointsMaterial | null = null;
  private clock = new THREE.Clock();
  private rotationSpeed = DEFAULT_PARAMS.rotationSpeed;
  private animationId = 0;

  constructor(private container: HTMLElement) {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 4);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

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

    const geometry = new THREE.BoxGeometry(1.6, 1.6, 1.6, 32, 32, 32);
    this.cube = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.cube);

    this.createParticles(DEFAULT_PARAMS.particleDensity);

    window.addEventListener("resize", this.onResize);
    this.animate();
  }

  private createParticles(count: number) {
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particleMaterial?.dispose();
    }

    const intCount = Math.floor(count);
    if (intCount <= 0) return;

    const positions = new Float32Array(intCount * 3);
    for (let i = 0; i < intCount; i++) {
      const r = 1.5 + Math.random() * 1.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    this.particleMaterial = new THREE.PointsMaterial({
      color: 0x00ffaa,
      size: 0.02,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.particles = new THREE.Points(geometry, this.particleMaterial);
    this.scene.add(this.particles);
  }

  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    const elapsed = this.clock.getElapsedTime();

    this.material.uniforms.uTime.value = elapsed;

    this.cube.rotation.x += 0.003 * this.rotationSpeed;
    this.cube.rotation.y += 0.005 * this.rotationSpeed;

    if (this.particles) {
      this.particles.rotation.y += 0.001 * this.rotationSpeed;
    }

    this.renderer.render(this.scene, this.camera);
  };

  updateParams(params: Partial<CubeParams>) {
    if (params.hue !== undefined) {
      this.material.uniforms.uHue.value = params.hue;
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
    };
  }

  dispose() {
    cancelAnimationFrame(this.animationId);
    window.removeEventListener("resize", this.onResize);
    this.renderer.dispose();
    this.material.dispose();
    this.cube.geometry.dispose();
    if (this.particles) {
      this.particles.geometry.dispose();
      this.particleMaterial?.dispose();
    }
    this.renderer.domElement.remove();
  }
}

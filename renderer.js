import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { HIGH, BLOOM } from './config.js';

export function isWebGLAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

export function createRenderer(canvas) {
  // Kantenglättung (MSAA) nur, wenn direkt ins Bild gezeichnet wird. Mit Bloom zeichnet die Szene in ein
  // Zwischenbild, dort wäre MSAA auf dem Bildschirm nur verschwendeter Speicher.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: HIGH && !BLOOM, powerPreference: 'high-performance' });
  renderer.setPixelRatio(maxPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}

// Höchste Auflösung: Retina-Bildschirme brauchen kein volles 2x für eine flüssige 3D-Szene
export function maxPixelRatio() {
  return Math.min(window.devicePixelRatio || 1, HIGH ? 1.5 : 1);
}

// Mit Bloom: Szene → Leuchteffekt → Farbausgabe. Ohne Bloom wird direkt gezeichnet
// (spart mehrere Vollbild-Durchgänge, gleiche Farben dank Tone Mapping des Renderers).
export function createComposer(renderer, scene, camera) {
  if (!BLOOM) {
    return {
      bloom: false,
      passes: [],
      render: () => renderer.render(scene, camera),
      setSize: () => {},
      setPixelRatio: () => {},
    };
  }
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const size = new THREE.Vector2(window.innerWidth, window.innerHeight).multiplyScalar(0.5);
  composer.addPass(new UnrealBloomPass(size, 0.55, 0.42, 0.96));
  composer.addPass(new OutputPass());
  composer.bloom = true;
  return composer;
}

// Kleine Nacht-Umgebung für Spiegelungen auf Metall, Glas und Autos
export function nightEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x070a16);
  const lamp = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 5, 4.6) });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const b = new THREE.Mesh(new THREE.BoxGeometry(5, 1.2, 0.5), lamp);
    b.position.set(Math.cos(a) * 12, 7, Math.sin(a) * 12);
    b.lookAt(0, 0, 0);
    env.add(b);
  }
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0d1018 }));
  ground.position.y = -3;
  env.add(ground);
  const horizon = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 4, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0x1d2140, side: THREE.BackSide }));
  env.add(horizon);
  const tex = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  return tex;
}

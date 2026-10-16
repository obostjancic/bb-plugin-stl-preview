import {
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type BufferGeometry,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface StlViewer {
  reset(): void;
  setWireframe(value: boolean): void;
  dispose(): void;
}

export function createViewer(
  container: HTMLElement,
  geometry: BufferGeometry,
  onError: (message: string) => void,
): StlViewer {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  const scene = new Scene();
  const material = new MeshStandardMaterial({
    color: new Color("#c89b65"),
    roughness: 0.65,
    metalness: 0.08,
    side: DoubleSide,
    flatShading: true,
  });
  const camera = new PerspectiveCamera(35, 1, 0.01, 10000);
  camera.up.set(0, 0, 1);
  const controls = new OrbitControls(camera, renderer.domElement);
  geometry.computeBoundingSphere();
  const radius = Math.max(geometry.boundingSphere!.radius, 1e-6);
  let disposed = false;
  let observer: ResizeObserver | undefined;

  function render() {
    if (!disposed) renderer.render(scene, camera);
  }
  function reset() {
    const halfFov = (camera.fov * Math.PI) / 360;
    const angle = Math.atan(Math.tan(halfFov) * Math.min(camera.aspect, 1));
    const distance = (radius / Math.sin(angle)) * 1.15;
    camera.position.copy(
      new Vector3(1, -1.5, 1).normalize().multiplyScalar(distance),
    );
    camera.near = Math.max(radius / 1000, 1e-8);
    camera.far = Math.max(distance * 20, radius * 100);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.minDistance = radius * 0.05;
    controls.maxDistance = distance * 8;
    controls.update();
    render();
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    reset();
  }
  function contextLost(event: Event) {
    event.preventDefault();
    onError(
      "The 3D graphics context was lost. Reload the preview to restore it.",
    );
  }
  function cleanup() {
    if (disposed) return;
    disposed = true;
    observer?.disconnect();
    controls.removeEventListener("change", render);
    renderer.domElement.removeEventListener("webglcontextlost", contextLost);
    controls.dispose();
    material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive STL model. Drag to orbit, right-drag to pan, scroll to zoom.",
    );
    renderer.domElement.setAttribute("role", "img");
    container.append(renderer.domElement);
    scene.add(new Mesh(geometry, material));
    scene.add(new AmbientLight(0xffffff, 1.6));
    const key = new DirectionalLight(0xffffff, 3);
    key.position.set(1, -2, 4);
    scene.add(key);
    const fill = new DirectionalLight(0xc2d4ff, 1);
    fill.position.set(-2, 1, 0);
    scene.add(fill);
    controls.addEventListener("change", render);
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return {
      reset,
      setWireframe(value) {
        material.wireframe = value;
        render();
      },
      dispose() {
        if (disposed) return;
        cleanup();
        geometry.dispose();
      },
    };
  } catch (error) {
    cleanup();
    throw error;
  }
}

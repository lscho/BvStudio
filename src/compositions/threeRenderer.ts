import * as THREE from "three";
import type { CompositionParams } from "@/domain/effects";
import { compositionNumber, isBackgroundComposition, mediaComposition } from "@/domain/compositions";

export interface CompositionImageSource {
  id: string;
  url: string;
  kind?: "image" | "video";
}

export interface MediaCompositionRenderer {
  canvas: HTMLCanvasElement;
  render: (timeUs: number, durationUs: number) => void;
  prepareFrame?: (timeUs: number, durationUs: number) => Promise<void>;
  dispose: () => void;
}

function colorParam(params: CompositionParams, key: string, fallback: string) {
  const value = params[key];
  return typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value) ? value : fallback;
}

export async function createMediaCompositionRenderer(width: number, height: number, sources: readonly CompositionImageSource[], params: CompositionParams = {}, signal?: AbortSignal, compositionId = "poster-wall-3d"): Promise<MediaCompositionRenderer> {
  signal?.throwIfAborted();
  if (mediaComposition(compositionId)?.renderer === "canvas") {
    const { createCanvasCompositionRenderer } = await import("@/compositions/canvasRenderer");
    return createCanvasCompositionRenderer(width, height, sources, params, signal, compositionId);
  }
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const background = isBackgroundComposition(compositionId);
  if (background) scene.background = new THREE.Color(colorParam(params, "background", "#191d20"));
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
  const textures: THREE.Texture[] = [];
  const meshes: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
  const spacing = compositionNumber(params, "spacing", 1, 0.8, 1.6);
  const travel = compositionNumber(params, "travel", 0.65, 0, 1);
  const layoutCount = background ? compositionNumber(params, "layoutCount", 6, 1, 12) : sources.length;
  const columns = Math.max(1, Math.min(layoutCount, Math.round(Math.sqrt(layoutCount * width / height * 1.25))));
  const rows = Math.ceil(layoutCount / columns);
  const cellW = 2.1 * spacing;
  const cellH = 2.85 * spacing;
  const fullWidth = columns * cellW;
  const fullHeight = rows * cellH;
  const distance = Math.max(fullHeight / 2, fullWidth / 2 / camera.aspect) / Math.tan(THREE.MathUtils.degToRad(19)) * 1.24 + 1;
  const dispose = () => {
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    textures.forEach((texture) => texture.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
  };
  try {
    if (background && params.grid !== false) {
      const grid = new THREE.GridHelper(80, Math.round(80 * compositionNumber(params, "density", 1, 0.5, 2)), colorParam(params, "gridColor", "#536169"), colorParam(params, "gridColor", "#536169"));
      grid.rotation.x = Math.PI / 2 + 0.18;
      grid.position.z = -2.5;
      scene.add(grid);
    }
    // Sequential decoding bounds peak memory and keeps texture order deterministic.
    for (const source of sources) {
      signal?.throwIfAborted();
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = source.url;
      try { await image.decode(); } catch { throw new Error("图片加载失败，请重新定位或替换动效素材"); }
      signal?.throwIfAborted();
      const textureLimit = Math.min(2048, renderer.capabilities.maxTextureSize);
      const ratio = Math.min(1, textureLimit / Math.max(image.naturalWidth, image.naturalHeight));
      const bitmap = document.createElement("canvas");
      bitmap.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      bitmap.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = bitmap.getContext("2d");
      if (!context) throw new Error("无法读取图片像素");
      context.drawImage(image, 0, 0, bitmap.width, bitmap.height);
      const texture = new THREE.CanvasTexture(bitmap);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      textures.push(texture);
      const aspect = image.naturalWidth / image.naturalHeight;
      const cardW = Math.min(1.9, 2.5 * aspect);
      const cardH = cardW / aspect;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cardW, cardH), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true }));
      scene.add(mesh);
      meshes.push(mesh);
    }
    return {
      canvas: renderer.domElement,
      render(timeUs, durationUs) {
        const progress = Math.max(0, Math.min(1, timeUs / Math.max(1, durationUs)));
        const sweep = Math.sin((progress - 0.5) * Math.PI);
        camera.position.set(sweep * travel * 1.3, 0.25 + Math.sin(progress * Math.PI) * 0.3 * travel, distance * (1.06 - 0.06 * progress));
        camera.lookAt(0, 0, 0);
        meshes.forEach((mesh, index) => {
          const row = Math.floor(index / columns);
          const countInRow = Math.min(columns, meshes.length - row * columns);
          const x = (index % columns - (countInRow - 1) / 2) * cellW;
          const y = ((rows - 1) / 2 - row) * cellH;
          const entry = Math.max(0, Math.min(1, (timeUs - index * 65_000) / 650_000));
          const reveal = 1 - (1 - entry) ** 3;
          mesh.position.set(x, y - (1 - reveal) * 0.45, Math.sin(index * 1.7) * 0.22);
          mesh.rotation.y = (1 - reveal) * 0.55 + x * -0.025 + sweep * travel * 0.035;
          mesh.scale.setScalar(0.85 + 0.15 * reveal);
          mesh.material.opacity = reveal;
        });
        renderer.render(scene, camera);
      },
      dispose
    };
  } catch (error) {
    dispose();
    throw error;
  }
}

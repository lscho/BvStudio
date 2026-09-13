import { isShotcraftComposition } from "@/domain/shotcraft";
import { preloadLibraryShot } from "@/compositions/shotcraftLibrary/adapter";
import { createCompositionFrameAppender, desktopCompositionFrames } from "@/services/compositionFrames";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { clockControlledRecipe, effectAnimationState } from "@/domain/effects";
import { visualTransformAt } from "@/domain/transforms";
import { isBackgroundComposition } from "@/domain/compositions";
import { CompositionContent, effectCardChromeStyle, reactEffectMotionDurationUs, usesComponentChrome, usesFullCanvasComposition } from "@/compositions/registry";
import { prepareReferenceVideoFrames } from "@/compositions/overlayStudioReference/videoFrames";
import type { RenderPlan, RenderTextOverlay } from "@/services/media";
import { streamCompositionFrames, type CompositionExportOptions } from "@/compositions/frameExport";
import { resolveOverlayStudioMediaParams } from "@/domain/overlayStudioMedia";
import { supportsOverlayStudioAutoTiming } from "@/domain/overlayStudioMotion";
import { localMediaUrl, readImageDataUrl } from "@/services/media";

const neutralRecipe = {
  layout: "frame" as const,
  entrance: "none" as const,
  paddingX: 0,
  paddingY: 0,
  borderWidth: 0,
  borderRadius: 0,
  backgroundOpacity: 0
};

function nextPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function dataUrlPayload(value: string) {
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("React 动效帧编码失败");
  return value.slice(comma + 1);
}

type CompositionImageSource = NonNullable<RenderTextOverlay["compositionImages"]>[number];
type ImageDataUrlLoader = (path: string) => Promise<string>;

export async function resolveCompositionImageUrls(
  sources: readonly CompositionImageSource[],
  signal?: AbortSignal,
  cache = new Map<string, Promise<string>>(),
  loadImage: ImageDataUrlLoader = readImageDataUrl,
  mediaUrl: (path: string) => string = localMediaUrl
) {
  const entries = await Promise.all(sources.map(async (source) => {
    signal?.throwIfAborted();
    const url = mediaUrl(source.path);
    if (source.kind !== "image") return [source.id, url] as const;
    const request = cache.get(source.path) ?? loadImage(source.path);
    cache.set(source.path, request);
    const dataUrl = await request;
    signal?.throwIfAborted();
    return [source.id, dataUrl] as const;
  }));
  return new Map(entries);
}

export function normalizeCompositionExportError(error: unknown) {
  if (error instanceof Error) return error;
  if (typeof Event !== "undefined" && error instanceof Event) return new Error("动效中的图片或视频无法加载，请检查素材是否丢失或格式不受支持");
  if (typeof error === "string" && error.trim()) return new Error(error);
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" && error.message.trim()) return new Error(error.message);
  return new Error("动效帧生成失败，请检查动效素材后重试");
}

function generatedFrameCount(overlayDurationUs: number, motionDurationUs: number, fps: number) {
  const fullFrameCount = Math.max(1, Math.ceil(overlayDurationUs / 1_000_000 * fps));
  if (motionDurationUs >= overlayDurationUs) return fullFrameCount;
  return Math.min(fullFrameCount, Math.max(1, Math.ceil(motionDurationUs / 1_000_000 * fps) + 1));
}

export function configureReactOverlayHost(host: HTMLDivElement, width: number, height: number) {
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.zIndex = "-1";
  host.style.width = `${width}px`;
  host.style.height = `${height}px`;
  host.style.pointerEvents = "none";
  host.style.background = "transparent";
  host.style.containerType = "inline-size";
}

export function inlineReactOverlaySvgStyles(host: HTMLElement) {
  // html-to-image deep-clones SVGs without copying styles onto their descendants.
  // Resolve their CSS before cloning, while local paint servers keep fragment URLs.
  const originals = Array.from(host.querySelectorAll<SVGElement>("svg *"), (node) => ({ node, style: node.getAttribute("style") }));
  for (const { node } of originals) {
    const computed = getComputedStyle(node);
    for (const property of Array.from(computed)) {
      if ((property === "fill" || property === "stroke") && node.getAttribute(property)?.startsWith("url(#")) continue;
      node.style.setProperty(property, computed.getPropertyValue(property));
    }
  }
  return () => {
    for (const { node, style } of originals) {
      if (style === null) node.removeAttribute("style");
      else node.setAttribute("style", style);
    }
  };
}

export async function waitForRenderImages(host: HTMLElement, signal?: AbortSignal) {
  await Promise.all(Array.from(host.querySelectorAll("img"), async (image) => {
    signal?.throwIfAborted();
    if (image.complete && image.naturalWidth > 0) return;
    if (typeof image.decode === "function") await image.decode();
    else {
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          image.removeEventListener("load", resolveLoaded);
          image.removeEventListener("error", rejectFailed);
        };
        const resolveLoaded = () => { cleanup(); resolve(); };
        const rejectFailed = () => { cleanup(); reject(new Error("动效中的图片无法解码，请检查素材格式")); };
        image.addEventListener("load", resolveLoaded, { once: true });
        image.addEventListener("error", rejectFailed, { once: true });
      });
    }
    signal?.throwIfAborted();
  }));
}

export function dynamicDurationUs(overlay: RenderTextOverlay) {
  if (overlay.params?.sceneLayout === "columns" || overlay.params?.sceneLayout === "matrix" || typeof overlay.params?.revealTimesUs === "string") return overlay.durationUs;
  if (isShotcraftComposition(overlay.compositionId ?? "")) return overlay.durationUs;
  if (overlay.autoTiming && overlay.compositionId && supportsOverlayStudioAutoTiming(overlay.compositionId)) return overlay.durationUs;
  if (overlay.compositionId === "chapter-bar" || overlay.compositionId === "caption-track" || overlay.compositionId === "terminal-3d" || (overlay.compositionId && isBackgroundComposition(overlay.compositionId))) return overlay.durationUs;
  const recipe = clockControlledRecipe(overlay.recipe);
  const entranceUs = (recipe.animation?.durationSeconds ?? 0) * 1_000_000 / Math.max(0.1, overlay.speed);
  let registeredUs = overlay.compositionId ? reactEffectMotionDurationUs(overlay.compositionId) : 0;
  const parameterString = (key: string) => typeof overlay.params?.[key] === "string" ? overlay.params[key] : "";
  const parameterNumber = (key: string, fallback: number) => typeof overlay.params?.[key] === "number" ? overlay.params[key] : fallback;
  const lineCount = (key: string) => Math.max(1, (parameterString(key) || overlay.text).split(/[|｜]/u).filter((line) => line.trim()).length);
  if (overlay.compositionId === "quote-lockup") registeredUs = Math.max(registeredUs, 650_000 + lineCount("quote") * 180_000);
  if (overlay.compositionId === "step-timeline") registeredUs = Math.max(registeredUs, 720_000 + lineCount("steps") * 240_000);
  if (overlay.compositionId === "type-shift") registeredUs = Math.max(registeredUs, parameterNumber("shiftAtMs", 1_600) * 1_000 + 620_000 + (lineCount("lines") - 1) * 70_000);
  if (overlay.compositionId === "odometer") registeredUs = Math.max(registeredUs, 900_000 + String(Math.max(0, Math.round(parameterNumber("value", 500)))).length * 110_000);
  if (overlay.compositionId === "blur-text") registeredUs = Math.max(registeredUs, lineCount("blurText") * parameterNumber("staggerMs", 420) * 1_000 + 700_000);
  if (overlay.compositionId === "pin-board") registeredUs = Math.max(registeredUs, 960_000 + lineCount("items") * parameterNumber("stepMs", 4_000) * 1_000);
  if (overlay.compositionId === "checklist") registeredUs = Math.max(registeredUs, 480_000 + lineCount("items") * parameterNumber("stepMs", 160) * 1_000);
  if (overlay.compositionId === "entity-chips") registeredUs = Math.max(registeredUs, 600_000 + parameterString("chips").split(/\r?\n/u).length * parameterNumber("stepMs", 500) * 1_000);
  if (overlay.compositionId === "stat-proof") registeredUs = Math.max(registeredUs, parameterNumber("countMs", 1_600) * 1_000);
  if (overlay.compositionId === "focus-card") registeredUs = Math.max(registeredUs, lineCount("items") * parameterNumber("stepMs", 600) * 1_000 + 900_000);
  if (overlay.compositionId === "growth-curve") registeredUs = Math.max(registeredUs, parameterNumber("drawMs", 1_600) * 1_000 + 300_000);
  const contentUs = Math.max(
    (recipe.chart?.durationSeconds ?? (overlay.compositionId?.includes("bullet") || overlay.compositionId?.includes("quote") ? 0.75 : 0)) * 1_000_000,
    registeredUs
  ) / Math.max(0.1, overlay.speed);
  const remainingMotionUs = Math.max(entranceUs, contentUs) - (overlay.sourceOffsetUs ?? 0) / Math.max(0.1, overlay.speed);
  return Math.min(overlay.durationUs, Math.max(0, remainingMotionUs, overlay.dimAtUs ?? 0, ...((overlay.transformKeyframes ?? []).map((frame) => frame.offsetUs))));
}

async function renderReactOverlay(overlay: RenderTextOverlay, plan: RenderPlan, options: CompositionExportOptions, imageUrlCache: Map<string, Promise<string>>): Promise<RenderTextOverlay> {
  const { signal } = options;
  for (const id of [overlay.compositionId, overlay.shotcraftData?.previous?.compositionId, overlay.shotcraftData?.clip.shotcraft?.transition.preset]) {
    if (id) await preloadLibraryShot(id);
    signal?.throwIfAborted();
  }
  const recipe = clockControlledRecipe(overlay.recipe);
  const host = document.createElement("div");
  configureReactOverlayHost(host, plan.width, plan.height);
  document.body.prepend(host);
  const root = createRoot(host);
  const length = (pixels: number) => `${pixels}px`;
  let compositionImageUrls: Map<string, string>;
  try {
    compositionImageUrls = await resolveCompositionImageUrls(overlay.compositionImages ?? [], signal, imageUrlCache);
  } catch (error) {
    root.unmount();
    host.remove();
    throw normalizeCompositionExportError(error);
  }
  const resolvedParams = resolveOverlayStudioMediaParams(overlay.compositionId ?? "", overlay.params, overlay.compositionBindings, (assetId) => {
    const source = overlay.compositionImages?.find((candidate) => candidate.id === assetId);
    return source ? { id: source.id, kind: source.kind === "video" ? "video" : "image", url: compositionImageUrls.get(source.id) ?? localMediaUrl(source.path) } : undefined;
  });
  const shotcraftAssets = (overlay.compositionImages ?? []).map((source) => ({ id: source.id, objectUrl: compositionImageUrls.get(source.id) ?? localMediaUrl(source.path), width: source.width, height: source.height }));
  const renderAt = async (localUs: number) => {
    signal?.throwIfAborted();
    const animationLocalUs = localUs + (overlay.sourceOffsetUs ?? 0) / Math.max(0.25, overlay.speed);
    const baseTransform = { x: overlay.x, y: overlay.y, scale: overlay.scale, rotation: overlay.rotation, opacity: overlay.opacity };
    const transform = visualTransformAt(baseTransform, overlay.transformKeyframes, localUs);
    const animation = effectAnimationState(recipe, animationLocalUs, overlay.speed);
    flushSync(() => root.render(
      <div
        className={`effect-overlay react-effect ${usesFullCanvasComposition(overlay.compositionId ?? "") ? "reference-full-canvas-effect" : ""} component-${overlay.compositionId ?? "unknown"} recipe-${recipe.layout} entrance-none`}
        style={{
          left: `${transform.x}%`,
          top: `${transform.y}%`,
          fontSize: `${overlay.fontSize}px`,
          ...effectCardChromeStyle({ color: overlay.color, accentColor: overlay.accentColor, backdrop: overlay.backdrop, fontSize: overlay.fontSize }, recipe, length, overlay.motionTheme, usesComponentChrome(overlay.compositionId ?? ""), usesFullCanvasComposition(overlay.compositionId ?? "")),
          opacity: transform.opacity * (overlay.dimAtUs !== undefined && localUs >= overlay.dimAtUs ? 0.35 : 1),
          transform: `translate(-50%, -50%) translate(${animation.translateX}%, ${animation.translateY}%) scale(${transform.scale * animation.scale}) rotate(${transform.rotation + animation.rotation}deg)`
        }}
      >
        <CompositionContent shotcraftData={overlay.shotcraftData} shotcraftAssets={shotcraftAssets} shotcraftTheme={overlay.motionTheme} compositionId={overlay.compositionId ?? "quote-lockup"} text={overlay.text} color={overlay.color} accentColor={overlay.accentColor} fontSize={overlay.fontSize} recipe={recipe} params={resolvedParams} timeUs={Math.round(animationLocalUs * overlay.speed)} durationUs={overlay.animationDurationUs ?? overlay.durationUs} autoTiming={overlay.autoTiming} canvasWidth={plan.width} canvasHeight={plan.height} />
      </div>
    ));
    await nextPaint();
    for (let attempt = 0; host.querySelector("[data-shotcraft-pending]"); attempt += 1) {
      signal?.throwIfAborted();
      if (attempt >= 120) throw new Error("镜头文字布局未就绪，请缩短文案后重试");
      await nextPaint();
    }
    await waitForRenderImages(host, signal);
    await prepareReferenceVideoFrames(host, animationLocalUs * overlay.speed / 1_000_000, signal);
    const restoreSvgStyles = inlineReactOverlaySvgStyles(host);
    try {
      return dataUrlPayload(await toPng(host, {
        width: plan.width,
        height: plan.height,
        pixelRatio: 1,
        backgroundColor: "transparent",
        style: { zIndex: "0" }
      }));
    } finally {
      restoreSvgStyles();
    }
  };

  try {
    await document.fonts.ready;
    const durationUs = dynamicDurationUs(overlay);
    if (durationUs <= 0) {
      return { ...overlay, shotcraftData: undefined, speed: 1, compositionImages: undefined, compositionBindings: undefined, imageDataBase64: await renderAt(overlay.durationUs), recipe: neutralRecipe, x: 50, y: 50, scale: 1, rotation: 0, opacity: 1, transformKeyframes: undefined };
    }
    const fps = Math.max(1, Math.min(120, plan.fps));
    const frameCount = generatedFrameCount(overlay.durationUs, durationUs, fps);
    const sink = options.sink ?? desktopCompositionFrames;
    signal?.throwIfAborted();
    const sequenceId = await sink.begin();
    options.sequences.push(sequenceId);
    const appender = createCompositionFrameAppender(sink, sequenceId);
    for (let index = 0; index < frameCount; index += 1) {
      signal?.throwIfAborted();
      const localUs = durationUs < overlay.durationUs && index === frameCount - 1
        ? durationUs
        : Math.round(index / fps * 1_000_000);
      const data = await renderAt(localUs);
      signal?.throwIfAborted();
      await appender.append(index, data);
      options.onProgress?.(index + 1, frameCount);
    }
    await appender.flush();
    return {
      ...overlay,
      sequenceId,
      sequenceFrameCount: frameCount,
      shotcraftData: undefined,
      speed: 1,
      sequenceFps: fps,
      imageDataBase64: undefined,
      compositionImages: undefined,
      compositionBindings: undefined,
      recipe: neutralRecipe,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      opacity: 1,
      transformKeyframes: undefined
    };
  } catch (error) {
    throw normalizeCompositionExportError(error);
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function rasterizeCompositions(plan: RenderPlan, options: CompositionExportOptions = { sequences: [] }): Promise<RenderPlan> {
  try {
    const overlays = [];
    const imageUrlCache = new Map<string, Promise<string>>();
    for (const overlay of plan.overlays) {
      options.signal?.throwIfAborted();
      if ((overlay.kind === "text" || overlay.kind === "composition") && (overlay.renderer === "three" || overlay.renderer === "canvas")) overlays.push(await streamCompositionFrames(overlay, plan, options));
      else if ((overlay.kind === "text" || overlay.kind === "composition") && overlay.renderer === "react") overlays.push(await renderReactOverlay(overlay, plan, options, imageUrlCache));
      else overlays.push(overlay);
    }
    return { ...plan, overlays };
  } catch (error) {
    throw normalizeCompositionExportError(error);
  }
}

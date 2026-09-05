import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { clockControlledRecipe, effectAnimationState } from "@/domain/effects";
import { visualTransformAt } from "@/domain/transforms";
import { EffectCardContent, effectCardChromeStyle, reactEffectMotionDurationUs, usesComponentChrome } from "@/effects/registry";
import type { RenderPlan, RenderTextOverlay } from "@/services/media";

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
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function dataUrlPayload(value: string) {
  const comma = value.indexOf(",");
  if (comma < 0) throw new Error("React 动效帧编码失败");
  return value.slice(comma + 1);
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

export function dynamicDurationUs(overlay: RenderTextOverlay) {
  if (overlay.effectId === "chapter-bar" || overlay.effectId === "caption-track") return overlay.durationUs;
  const recipe = clockControlledRecipe(overlay.recipe);
  const entranceUs = (recipe.animation?.durationSeconds ?? 0) * 1_000_000 / Math.max(0.1, overlay.speed);
  let registeredUs = overlay.effectId ? reactEffectMotionDurationUs(overlay.effectId) : 0;
  const parameterString = (key: string) => typeof overlay.params?.[key] === "string" ? overlay.params[key] : "";
  const parameterNumber = (key: string, fallback: number) => typeof overlay.params?.[key] === "number" ? overlay.params[key] : fallback;
  if (overlay.effectId === "quote-lockup") registeredUs = Math.max(registeredUs, 650_000 + parameterString("quote").split("|").length * 180_000);
  if (overlay.effectId === "step-timeline") registeredUs = Math.max(registeredUs, 720_000 + parameterString("steps").split("|").length * 240_000);
  if (overlay.effectId === "terminal-3d") registeredUs = Math.max(registeredUs, Array.from(parameterString("lines")).length / Math.max(1, parameterNumber("cps", 26)) * 1_000_000 + 200_000);
  if (overlay.effectId === "type-shift") registeredUs = Math.max(registeredUs, parameterNumber("shiftAtMs", 1_600) * 1_000 + 500_000);
  if (overlay.effectId === "blur-text") registeredUs = Math.max(registeredUs, parameterString("blurText").split("|").length * parameterNumber("staggerMs", 420) * 1_000 + 700_000);
  if (overlay.effectId === "pin-board") registeredUs = Math.max(registeredUs, 960_000 + parameterString("items").split("|").length * parameterNumber("stepMs", 4_000) * 1_000);
  if (overlay.effectId === "checklist") registeredUs = Math.max(registeredUs, 480_000 + parameterString("items").split("|").length * parameterNumber("stepMs", 160) * 1_000);
  if (overlay.effectId === "entity-chips") registeredUs = Math.max(registeredUs, 600_000 + parameterString("chips").split(/\r?\n/u).length * parameterNumber("stepMs", 500) * 1_000);
  if (overlay.effectId === "stat-proof") registeredUs = Math.max(registeredUs, parameterNumber("countMs", 1_600) * 1_000);
  if (overlay.effectId === "focus-card") registeredUs = Math.max(registeredUs, parameterString("items").split("|").length * parameterNumber("stepMs", 600) * 1_000 + 900_000);
  if (overlay.effectId === "growth-curve") registeredUs = Math.max(registeredUs, parameterNumber("drawMs", 1_600) * 1_000 + 300_000);
  const contentUs = Math.max(
    (recipe.chart?.durationSeconds ?? (overlay.effectId?.includes("bullet") || overlay.effectId?.includes("quote") ? 0.75 : 0)) * 1_000_000,
    registeredUs
  ) / Math.max(0.1, overlay.speed);
  return Math.min(overlay.durationUs, Math.max(entranceUs, contentUs, overlay.dimAtUs ?? 0));
}

async function renderReactOverlay(overlay: RenderTextOverlay, plan: RenderPlan): Promise<RenderTextOverlay> {
  const recipe = clockControlledRecipe(overlay.recipe);
  const host = document.createElement("div");
  configureReactOverlayHost(host, plan.width, plan.height);
  document.body.prepend(host);
  const root = createRoot(host);
  const length = (pixels: number) => `${pixels}px`;
  const renderAt = async (localUs: number) => {
    const baseTransform = { x: overlay.x, y: overlay.y, scale: overlay.scale, rotation: overlay.rotation, opacity: overlay.opacity };
    const transform = visualTransformAt(baseTransform, overlay.transformKeyframes, localUs);
    const animation = effectAnimationState(recipe, localUs, overlay.speed);
    flushSync(() => root.render(
      <div
        className={`effect-overlay react-effect component-${overlay.effectId ?? "unknown"} recipe-${recipe.layout} entrance-none`}
        style={{
          left: `${transform.x}%`,
          top: `${transform.y}%`,
          fontSize: `${overlay.fontSize}px`,
          ...effectCardChromeStyle({ color: overlay.color, accentColor: overlay.accentColor, backdrop: overlay.backdrop }, recipe, length, overlay.motionTheme, usesComponentChrome(overlay.effectId ?? "")),
          opacity: transform.opacity * (overlay.dimAtUs !== undefined && localUs >= overlay.dimAtUs ? 0.35 : 1),
          transform: `translate(-50%, -50%) translate(${animation.translateX}%, ${animation.translateY}%) scale(${transform.scale * animation.scale}) rotate(${transform.rotation + animation.rotation}deg)`
        }}
      >
        <EffectCardContent effectId={overlay.effectId ?? "quote-lockup"} text={overlay.text} color={overlay.color} accentColor={overlay.accentColor} fontSize={overlay.fontSize} recipe={recipe} params={overlay.params} timeUs={localUs * overlay.speed} durationUs={overlay.durationUs} canvasWidth={plan.width} canvasHeight={plan.height} />
      </div>
    ));
    await nextPaint();
    return dataUrlPayload(await toPng(host, {
      width: plan.width,
      height: plan.height,
      pixelRatio: 1,
      backgroundColor: "transparent",
      style: { zIndex: "0" }
    }));
  };

  try {
    await document.fonts.ready;
    const durationUs = dynamicDurationUs(overlay);
    if (durationUs <= 0) {
      return { ...overlay, imageDataBase64: await renderAt(overlay.durationUs), recipe: neutralRecipe, x: 50, y: 50, scale: 1, rotation: 0, opacity: 1, transformKeyframes: undefined };
    }
    const fps = Math.max(1, Math.min(60, plan.fps));
    const frameCount = Math.max(2, Math.ceil(durationUs / 1_000_000 * fps) + 1);
    const frames: string[] = [];
    for (let index = 0; index < frameCount; index += 1) {
      frames.push(await renderAt(Math.min(durationUs, Math.round(index / fps * 1_000_000))));
    }
    return {
      ...overlay,
      sequenceFramesBase64: frames,
      sequenceFps: fps,
      imageDataBase64: undefined,
      recipe: neutralRecipe,
      x: 50,
      y: 50,
      scale: 1,
      rotation: 0,
      opacity: 1,
      transformKeyframes: undefined
    };
  } finally {
    root.unmount();
    host.remove();
  }
}

export async function rasterizeReactEffects(plan: RenderPlan): Promise<RenderPlan> {
  const overlays = [];
  for (const overlay of plan.overlays) {
    if (overlay.kind === "text" && overlay.renderer === "react") overlays.push(await renderReactOverlay(overlay, plan));
    else overlays.push(overlay);
  }
  return { ...plan, overlays };
}

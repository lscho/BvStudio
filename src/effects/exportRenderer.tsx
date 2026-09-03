import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { toPng } from "html-to-image";
import { clockControlledRecipe, effectAnimationState } from "@/domain/effects";
import { visualTransformAt } from "@/domain/transforms";
import { EffectCardContent, effectCardChromeStyle } from "@/effects/registry";
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

export function dynamicDurationUs(overlay: RenderTextOverlay) {
  const recipe = clockControlledRecipe(overlay.recipe);
  const entranceUs = (recipe.animation?.durationSeconds ?? 0) * 1_000_000 / Math.max(0.1, overlay.speed);
  const contentUs = (recipe.chart?.durationSeconds ?? (overlay.effectId?.includes("bullet") || overlay.effectId?.includes("quote") ? 0.75 : 0)) * 1_000_000 / Math.max(0.1, overlay.speed);
  return Math.min(overlay.durationUs, Math.max(entranceUs, contentUs, overlay.dimAtUs ?? 0));
}

async function renderReactOverlay(overlay: RenderTextOverlay, plan: RenderPlan): Promise<RenderTextOverlay> {
  const recipe = clockControlledRecipe(overlay.recipe);
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.width = `${plan.width}px`;
  host.style.height = `${plan.height}px`;
  host.style.pointerEvents = "none";
  host.style.background = "transparent";
  host.style.containerType = "inline-size";
  document.body.append(host);
  const root = createRoot(host);
  const length = (pixels: number) => `${pixels}px`;
  const renderAt = async (localUs: number) => {
    const baseTransform = { x: overlay.x, y: overlay.y, scale: overlay.scale, rotation: overlay.rotation, opacity: overlay.opacity };
    const transform = visualTransformAt(baseTransform, overlay.transformKeyframes, localUs);
    const animation = effectAnimationState(recipe, localUs, overlay.speed);
    flushSync(() => root.render(
      <div
        className={`effect-overlay react-effect recipe-${recipe.layout} entrance-none`}
        style={{
          left: `${transform.x}%`,
          top: `${transform.y}%`,
          fontSize: `${overlay.fontSize}px`,
          ...effectCardChromeStyle({ color: overlay.color, accentColor: overlay.accentColor, backdrop: overlay.backdrop }, recipe, length, overlay.motionTheme),
          opacity: transform.opacity * (overlay.dimAtUs !== undefined && localUs >= overlay.dimAtUs ? 0.35 : 1),
          transform: `translate(-50%, -50%) translate(${animation.translateX}%, ${animation.translateY}%) scale(${transform.scale * animation.scale}) rotate(${transform.rotation + animation.rotation}deg)`
        }}
      >
        <EffectCardContent effectId={overlay.effectId ?? "test-title-slide"} text={overlay.text} color={overlay.color} accentColor={overlay.accentColor} fontSize={overlay.fontSize} recipe={recipe} timeUs={localUs * overlay.speed} durationUs={overlay.durationUs} canvasWidth={plan.width} />
      </div>
    ));
    await nextPaint();
    return dataUrlPayload(await toPng(host, { width: plan.width, height: plan.height, pixelRatio: 1, backgroundColor: "transparent" }));
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

import { useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type RefObject } from "react";
import type { CompositionRenderProps } from "@/compositions/registry";
import { InformationScene } from "@/compositions/InformationScene";
import { informationSceneLayout } from "@/domain/informationScenes";
import { isBackgroundComposition } from "@/domain/compositions";
import { EFFECTS } from "@/compositions/overlayStudioReference/effects/registry";
import type { EffectProps } from "@/compositions/overlayStudioReference/effects/types";
import { FxTimelineMsContext } from "@/compositions/overlayStudioReference/effects/useAnimation";
import { StageRatioContext, StageSizeContext, type StageRatio } from "@/compositions/overlayStudioReference/stage";
import { isReferenceStageComposition } from "@/domain/overlayStudioReference";
import "@/compositions/overlayStudioReference/reference.css";

export const replicatedOverlayStudioEffects = EFFECTS.filter((effect) => isReferenceStageComposition(effect.id));
export const replicatedOverlayStudioEffectIds = replicatedOverlayStudioEffects.map((effect) => effect.id);

const effectsById = new Map(replicatedOverlayStudioEffects.map((effect) => [effect.id, effect]));

export function replicatedOverlayStudioEffect(compositionId: string) {
  return effectsById.get(compositionId);
}

export function isReplicatedOverlayStudioEffect(compositionId: string) {
  return effectsById.has(compositionId);
}

type RuntimeParam = string | number | boolean | undefined;
type RuntimeParams = Record<string, RuntimeParam> & { __t?: number; __start?: number; __end?: number };

function runtimeDefaults(defaults: object): RuntimeParams {
  const result: RuntimeParams = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === undefined) result[key] = value;
  }
  return result;
}

function rgb(color: string) {
  const normalized = /^#[0-9a-f]{3}$/iu.test(color)
    ? color.slice(1).split("").map((part) => `${part}${part}`).join("")
    : /^#[0-9a-f]{6}$/iu.test(color) ? color.slice(1) : null;
  if (!normalized) return null;
  return [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
}

function luminance(color: string) {
  const channels = rgb(color);
  if (!channels) return null;
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function readableOverlayInk(preferred: string, theme: "dark" | "light") {
  const surface = theme === "light" ? "#f7f8fa" : "#111316";
  const preferredLuminance = luminance(preferred);
  const surfaceLuminance = luminance(surface)!;
  const contrast = preferredLuminance === null ? 0 : (Math.max(preferredLuminance, surfaceLuminance) + 0.05) / (Math.min(preferredLuminance, surfaceLuminance) + 0.05);
  if (contrast >= 4.5) return preferred;
  return theme === "light" ? "#1b1d21" : "#ffffff";
}

function useReferenceStageScale(canvasWidth: number) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => {
      const next = frame.getBoundingClientRect().width / Math.max(1, canvasWidth);
      if (next > 0 && Number.isFinite(next)) setScale(next);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [canvasWidth]);
  return { frameRef, scale };
}

function useSynchronizedAnimations(frameRef: RefObject<HTMLDivElement | null>, timeUs: number) {
  const starts = useRef(new WeakMap<Animation, number>());
  const previousMs = useRef(0);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof frame.getAnimations !== "function") return;
    const timeMs = timeUs / 1_000;
    const jumped = Math.abs(timeMs - previousMs.current) > 100;
    previousMs.current = timeMs;
    for (const animation of frame.getAnimations({ subtree: true })) {
      let startMs = starts.current.get(animation);
      if (startMs === undefined) {
        startMs = jumped ? 0 : timeMs;
        starts.current.set(animation, startMs);
      }
      animation.pause();
      animation.currentTime = Math.max(0, timeMs - startMs);
    }
  }, [frameRef, timeUs]);
}

export function ReplicatedOverlayStudioCard(props: CompositionRenderProps) {
  const definition = replicatedOverlayStudioEffect(props.compositionId);
  const [displayTimeUs, setDisplayTimeUs] = useState(0);
  const { frameRef, scale } = useReferenceStageScale(props.canvasWidth);
  useLayoutEffect(() => setDisplayTimeUs(props.timeUs), [props.timeUs]);
  useSynchronizedAnimations(frameRef, displayTimeUs);
  if (!definition) return null;

  const canvasHeight = props.canvasHeight ?? Math.round(props.canvasWidth * 9 / 16);
  const ratio: StageRatio = canvasHeight > props.canvasWidth ? "v" : "h";
  const compositionLayer = isBackgroundComposition(props.compositionId) ? "background" : "foreground";
  const params: RuntimeParams = {
    ...runtimeDefaults(definition.defaults),
    ...props.params,
    __t: displayTimeUs / 1_000_000,
    __start: 0,
    __end: props.durationUs / 1_000_000
  };
  const theme = params.theme === "light" ? "light" : "dark";
  const readableInk = readableOverlayInk(props.color, theme);
  const cardScale = typeof params.scale === "number" && Number.isFinite(params.scale)
    ? Math.max(0.3, Math.min(3, params.scale))
    : 1;
  const Component = definition.Component as unknown as ComponentType<EffectProps<RuntimeParams>>;
  const stageStyle = {
    position: "absolute",
    left: 0,
    top: 0,
    width: `${props.canvasWidth}px`,
    height: `${canvasHeight}px`,
    transform: `scale(${scale})`,
    transformOrigin: "left top",
    background: "transparent",
    border: 0,
    boxShadow: "none",
    color: readableInk,
    "--stage-w": `${props.canvasWidth}px`,
    "--stage-h": `${canvasHeight}px`,
    "--hud-blue": props.accentColor,
    "--hud-ink-doc": readableInk
  } as CSSProperties;

  return <div ref={frameRef} className="overlay-studio-reference" data-composition-layer={compositionLayer} style={{ position: "relative", width: "100%", height: "100%", background: "transparent", border: 0, boxShadow: "none" }}>
    <StageRatioContext.Provider value={ratio}>
      <StageSizeContext.Provider value={{ w: props.canvasWidth, h: canvasHeight }}>
        <FxTimelineMsContext.Provider value={displayTimeUs / 1_000}>
          <div className="stage" data-ratio={ratio} data-theme={theme} style={stageStyle}>
            <div data-card-theme={theme} data-card-vtier={definition.vTier} data-overlay-content-root style={{ display: "contents", "--hud-scale": cardScale } as CSSProperties}>
              {informationSceneLayout(props.compositionId, props.params)
                ? <InformationScene {...props} timeUs={displayTimeUs} />
                : <Component params={params} playToken={0} />}
            </div>
          </div>
        </FxTimelineMsContext.Provider>
      </StageSizeContext.Provider>
    </StageRatioContext.Provider>
  </div>;
}

import { useLayoutEffect, useRef, useState, type ComponentType, type CSSProperties, type RefObject } from "react";
import type { CompositionRenderProps } from "@/compositions/registry";
import { EFFECTS } from "@/compositions/overlayStudioReference/effects/registry";
import type { EffectProps } from "@/compositions/overlayStudioReference/effects/types";
import { FxTimelineMsContext } from "@/compositions/overlayStudioReference/effects/useAnimation";
import { StageRatioContext, StageSizeContext, type StageRatio } from "@/compositions/overlayStudioReference/stage";
import "@/compositions/overlayStudioReference/reference.css";

const retainedNativeIds = new Set([
  "quote-lockup", "step-timeline", "rank-bars", "punch-pill", "term-card", "checklist", "terminal-3d", "ring-metric", "versus-card", "ui-callout",
  "type-shift", "blur-text", "odometer", "focus-card", "chapter-bar", "caption-track", "stat-proof", "growth-curve", "entity-chips", "pin-board"
]);

export const replicatedOverlayStudioEffects = EFFECTS.filter((effect) => !retainedNativeIds.has(effect.id));
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
  const params: RuntimeParams = {
    ...runtimeDefaults(definition.defaults),
    ...props.params,
    __t: displayTimeUs / 1_000_000,
    __start: 0,
    __end: props.durationUs / 1_000_000
  };
  const theme = params.theme === "light" ? "light" : "dark";
  const Component = definition.Component as unknown as ComponentType<EffectProps<RuntimeParams>>;
  const stageStyle = {
    position: "absolute",
    left: 0,
    top: 0,
    width: `${props.canvasWidth}px`,
    height: `${canvasHeight}px`,
    transform: `scale(${scale})`,
    transformOrigin: "left top",
    color: props.color,
    "--stage-w": `${props.canvasWidth}px`,
    "--stage-h": `${canvasHeight}px`,
    "--hud-blue": props.accentColor,
    "--hud-ink-doc": props.color
  } as CSSProperties;

  return <div ref={frameRef} className="overlay-studio-reference" style={{ position: "relative", width: "100%", height: "100%" }}>
    <StageRatioContext.Provider value={ratio}>
      <StageSizeContext.Provider value={{ w: props.canvasWidth, h: canvasHeight }}>
        <FxTimelineMsContext.Provider value={displayTimeUs / 1_000}>
          <div className="stage" data-ratio={ratio} data-theme={theme} style={stageStyle}>
            <div data-card-theme={theme} data-card-vtier={definition.vTier} style={{ display: "contents" }}>
              <Component params={params} playToken={0} />
            </div>
          </div>
        </FxTimelineMsContext.Provider>
      </StageSizeContext.Provider>
    </StageRatioContext.Provider>
  </div>;
}

import { createContext, useContext, useId, type CSSProperties, type ImgHTMLAttributes, type ReactNode } from "react";
import { shotcraftBezier } from "@/domain/shotcraft";
import type { ShotcraftRegion } from "@/domain/shotcraft";

export interface ShotcraftContent {
  texts: Readonly<Record<string, string>>;
  images: readonly string[];
  imageKeys: readonly string[];
  outgoing?: ReactNode;
  incoming?: ReactNode;
  linked?: boolean;
  regions?: readonly ShotcraftRegion[];
  imageSizes?: readonly { width: number; height: number }[];
}
export interface FrameContext extends ShotcraftContent {
  frame: number;
  durationInFrames: number;
  width: number;
  height: number;
}
export const ShotcraftFrameContext = createContext<FrameContext>({ frame: 0, durationInFrames: 150, width: 1920, height: 1080, texts: {}, images: [], imageKeys: [] });
export const useCurrentFrame = () => useContext(ShotcraftFrameContext).frame;
export function useVideoConfig() { const c = useContext(ShotcraftFrameContext); return { width: c.width, height: c.height, durationInFrames: c.durationInFrames, fps: 30 }; }
export const useShotcraftContent = () => useContext(ShotcraftFrameContext);
export function AbsoluteFill({ style, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", ...style }}>{children}</div>;
}
export function Freeze({ frame, children }: { frame: number; children: ReactNode }) {
  const context = useContext(ShotcraftFrameContext);
  return <ShotcraftFrameContext.Provider value={{ ...context, frame }}>{children}</ShotcraftFrameContext.Provider>;
}
export function Sequence({ from = 0, durationInFrames = Infinity, children, layout }: { from?: number; durationInFrames?: number; children: ReactNode; layout?: "none" }) {
  const context = useContext(ShotcraftFrameContext);
  if (context.frame < from || context.frame >= from + durationInFrames) return null;
  const content = <ShotcraftFrameContext.Provider value={{ ...context, frame: context.frame - from }}>{children}</ShotcraftFrameContext.Provider>;
  return layout === "none" ? content : <AbsoluteFill>{content}</AbsoluteFill>;
}
type Ease = (t: number) => number;
export const Easing = {
  linear: (t: number) => t, quad: (t: number) => t * t, cubic: (t: number) => t ** 3,
  poly: (n: number): Ease => (t) => t ** n,
  sin: (t: number) => 1 - Math.cos(t * Math.PI / 2),
  exp: (t: number) => t === 0 ? 0 : 2 ** (10 * (t - 1)),
  back: (s = 1.70158): Ease => (t) => t * t * ((s + 1) * t - s),
  bezier: shotcraftBezier, ease: shotcraftBezier(0.42, 0, 1, 1),
  in: (ease: Ease): Ease => ease, out: (ease: Ease): Ease => (t) => 1 - ease(1 - t),
  inOut: (ease: Ease): Ease => (t) => t < 0.5 ? ease(t * 2) / 2 : 1 - ease((1 - t) * 2) / 2
};
export function interpolate(value: number, input: readonly number[], output: readonly number[], options: { easing?: Ease; extrapolateLeft?: "clamp" | "extend" | "identity" | "wrap"; extrapolateRight?: "clamp" | "extend" | "identity" | "wrap" } = {}) {
  if (input.length < 2 || input.length !== output.length) throw new Error("镜头插值数据无效");
  const first = input[0], last = input[input.length - 1];
  const mode = value < first ? options.extrapolateLeft : value > last ? options.extrapolateRight : undefined;
  if (mode === "identity") return value;
  if (mode === "clamp") value = Math.min(last, Math.max(first, value));
  if (mode === "wrap") value = ((value - first) % (last - first) + last - first) % (last - first) + first;
  let index = 0;
  while (index < input.length - 2 && value >= input[index + 1]) index += 1;
  const span = input[index + 1] - input[index];
  const progress = span === 0 ? 1 : (value - input[index]) / span;
  return output[index] + (output[index + 1] - output[index]) * (options.easing ?? Easing.linear)(progress);
}
export function spring({ frame, fps, config = {}, from = 0, to = 1, durationInFrames, durationRestThreshold = 0.005 }: { frame: number; fps: number; durationRestThreshold?: number; from?: number; to?: number; durationInFrames?: number; config?: { damping?: number; stiffness?: number; mass?: number; overshootClamping?: boolean } }) {
  if (frame <= 0) return from;
  if (durationInFrames && frame > durationInFrames) return to;
  const { damping = 10, stiffness = 100, mass = 1, overshootClamping = false } = config;
  const omega = Math.sqrt(stiffness / mass), zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const position = (t: number) => {
    if (zeta < 1) { const wd = omega * Math.sqrt(1 - zeta * zeta); return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + zeta * omega / wd * Math.sin(wd * t)); }
    // The source engine treats all nonoscillating configurations as critical damping.
    return 1 - (1 + omega * t) * Math.exp(-omega * t);
  };
  let time = frame / fps;
  if (durationInFrames) {
    let settle = 0, stable = 0;
    for (let i = 0; i < fps * 30; i += 1) { if (Math.abs(1 - position(i / fps)) < durationRestThreshold) stable += 1; else stable = 0; if (stable >= 20) { settle = (i - 19) / fps; break; } }
    time = frame / durationInFrames * (settle || 1);
  }
  // Preserve the source engine's 64 ms final integration-step cap at fractional frames.
  const fractionalFrame = time * fps % 1;
  if (time * fps >= 1 && fractionalFrame > 0) time -= Math.max(0, (1 + fractionalFrame) / fps - 0.064);
  const value = position(time);
  return from + (to - from) * (overshootClamping ? Math.min(1, value) : value);
}
export function interpolateColors(frame: number, input: readonly number[], colors: readonly string[]) {
  const channels = colors.map((color) => { const hex = color.replace("#", ""); const full = hex.length === 3 ? [...hex].map((v) => v + v).join("") : hex; return [0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16)); });
  return `rgb(${[0, 1, 2].map((channel) => Math.round(interpolate(frame, input, channels.map((color) => color[channel]), { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))).join(",")})`;
}
export function staticFile(path: string) { return `shotcraft:${path}`; }
export function shotcraftImageUrl(content: ShotcraftContent, path: string) {
  const key = path.replace(/^shotcraft:/u, "");
  const index = content.imageKeys.indexOf(key);
  const numbered = /(?:card|block|row)(\d+)/u.exec(key);
  const resolvedIndex = index >= 0 ? index : numbered ? Math.max(0, Number(numbered[1]) - 1) % Math.max(1, content.images.length) : 0;
  return content.images[resolvedIndex] ?? content.images[0] ?? "";
}
export function Img({ src = "", style, ...rest }: ImgHTMLAttributes<HTMLImageElement>) {
  const content = useShotcraftContent();
  const url = src.startsWith("shotcraft:") ? shotcraftImageUrl(content, src) : src;
  if (!url) return <div style={{ ...style, background: "#252b35", color: "#dbe5ef", display: "grid", placeItems: "center", minWidth: 40, minHeight: 30 }}>添加图片</div>;
  return <img {...rest} src={url} alt="" style={style} />;
}
export function CameraMotionBlur({ shutterAngle = 180, samples = 10, children }: { shutterAngle?: number; samples?: number; children: ReactNode }) {
  const context = useContext(ShotcraftFrameContext);
  const count = Math.max(1, Math.min(32, Math.round(samples)));
  const id = useId().replace(/:/gu, "");
  // Alpha compositing with 1/(i+1) weights produces an equal temporal average.
  return <div style={{ position: "absolute", inset: 0, isolation: "isolate" }} data-motion-blur={id}>
    {Array.from({ length: count }, (_, i) => <div key={i} style={{ position: "absolute", inset: 0, opacity: 1 / (i + 1) }}><ShotcraftFrameContext.Provider value={{ ...context, frame: Math.max(0, context.frame - shutterAngle / 360 * (count - 1 - i) / Math.max(1, count - 1)) }}>{children}</ShotcraftFrameContext.Provider></div>)}
  </div>;
}
const renderHandles = new Set<number>();
let nextHandle = 0;
export function delayRender(_label: string) { const handle = ++nextHandle; renderHandles.add(handle); return handle; }
export function continueRender(handle: number) { renderHandles.delete(handle); }
export function getRemotionEnvironment() { return { isRendering: true }; }
export function shotcraftPendingRenders() { return renderHandles.size; }
export function contentText(content: ShotcraftContent, key: string, fallback: string) { return content.texts[key] ?? fallback; }
export function contentPageGeometry(content: ShotcraftContent) {
  const image = content.imageSizes?.[0];
  const pageH = image ? 1920 * image.height / Math.max(1, image.width) : 1080;
  const region = content.regions?.[0] ?? { x: 35, y: 35, width: 30, height: 30 };
  const rect = { x: region.x * 19.2, y: region.y * pageH / 100, w: region.width * 19.2, h: region.height * pageH / 100 };
  return { pageH, rect, cx: rect.x + rect.w / 2, cy: rect.y + rect.h / 2 };
}
export function fixtureStyle(style: CSSProperties | undefined) { return style; }

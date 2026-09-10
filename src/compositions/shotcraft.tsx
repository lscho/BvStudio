import { useState, type CSSProperties, type ReactNode } from "react";
import { LibraryScene } from "@/compositions/shotcraftLibrary/adapter";
import { libraryShot } from "@/domain/shotcraftLibrary/catalog";
import { libraryTransition } from "@/domain/shotcraftLibrary/transitions";
import type { CompositionRenderProps } from "@/compositions/registry";
import type { CompositionClip, MediaAsset, MotionTheme } from "@/domain/project";
import { resolveEffectAppearance } from "@/domain/motionTheme";
import { eased } from "@/domain/easing";
import { defaultShotcraftSettings, shotcraftBezier, shotcraftFrame, shotcraftHeroZoom, shotcraftImageRect, shotcraftProgress as seg, shotcraftShot, shotcraftTransitionState, type ShotcraftSettings } from "@/domain/shotcraft";

// Adapted from video-shotcraft, Copyright 2026 Wei Yihao (Apache-2.0).
// Modified for editable assets, microsecond clocks and native React export. See docs/03-Shotcraft镜头.md.
const fill: CSSProperties = { position: "absolute", inset: 0 };
const px = (value: number) => `${value / 4.8}cqw`;
const cubicOut = (t: number) => eased(t, "cubic-out");
const cubicInOut = (t: number) => eased(t, "cubic-in-out");
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const pushEase = shotcraftBezier(0.35, 0, 0.2, 1);
const riseEase = shotcraftBezier(0.2, 1.25, 0.3, 1);
const returnEase = shotcraftBezier(0.4, 0, 0.3, 1.05);

export type ShotcraftAsset = Pick<MediaAsset, "id" | "objectUrl" | "width" | "height">;
interface SceneProps {
  clip: CompositionClip;
  assets: readonly ShotcraftAsset[];
  timeUs: number;
  width: number;
  height: number;
  theme?: MotionTheme;
}

function Picture({ asset, style, fit = "contain" }: { asset?: ShotcraftAsset; style?: CSSProperties; fit?: "contain" | "cover" }) {
  const [failedUrl, setFailedUrl] = useState<string>();
  if (!asset?.objectUrl || failedUrl === asset.objectUrl) return <div className="shotcraft-missing" style={style} role="status">{failedUrl ? "素材读取失败，请重新定位" : "添加图片素材"}</div>;
  return <img src={asset.objectUrl} alt="" draggable={false} onError={() => setFailedUrl(asset.objectUrl)} style={{ ...fill, width: "100%", height: "100%", objectFit: fit, ...style }} />;
}

function wordsFor(text: string) {
  const explicit = text.trim().split(/\s+/u).filter(Boolean);
  if (explicit.length > 1) return explicit;
  const segments = Array.from(new Intl.Segmenter("zh", { granularity: "word" }).segment(text), (part) => part.segment);
  const groupSize = Math.max(1, Math.ceil(segments.length / 6));
  return Array.from({ length: Math.ceil(segments.length / groupSize) }, (_, i) => segments.slice(i * groupSize, (i + 1) * groupSize).join(""));
}

function BlurTitle({ text, t, color, accent }: { text: string; t: number; color: string; accent: string }) {
  const lines = text.split(/[|｜\n]/u).filter(Boolean).slice(0, 2);
  return <div style={{ ...fill, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: px(16), padding: "8%" }}>
    {lines.map((line, row) => {
      const words = wordsFor(line);
      const gap = Math.min(row ? 0.04 : 0.055, 0.55 / Math.max(1, words.length));
      const lineT = row ? seg(t, 0.34, 0.9) : seg(t, 0.06, 0.62);
      return <div key={row} style={{ display: "flex", width: "100%", flexShrink: 0, flexWrap: "wrap", justifyContent: "center", gap: /\s/u.test(line) ? "0.22em" : 0, color: row ? accent : color, fontWeight: row ? 400 : 800, lineHeight: 1.35, fontSize: px(row ? 16 : Math.max(23, Math.min(34, 550 / Math.max(1, Array.from(line).length)))) }}>
        {words.map((word, i) => { const p = seg(lineT, i * gap, i * gap + 0.32, cubicOut); return <span key={i} style={{ opacity: p, transform: `translateY(${px((1 - p) * (row ? 26 : 40))})`, filter: `blur(${px((1 - p) * 10)})` }}>{word}</span>; })}
      </div>;
    })}
  </div>;
}

function BeforeAfter({ before, after, frame, text, revealAfter }: { before?: ShotcraftAsset; after?: ShotcraftAsset; frame: number; text: string; revealAfter: boolean }) {
  const split = frame < 26 ? lerp(8, 76, seg(frame, 14, 26, cubicOut)) : frame < 38 ? lerp(76, 70, seg(frame, 26, 38, cubicInOut)) : frame < 56 ? 70 : lerp(70, 40, seg(frame, 56, 104, (t) => eased(t, "ease-in-out")));
  const x = revealAfter ? split * (1 - seg(frame, 104, 132, cubicInOut)) : split;
  const labels = text.split(/[|｜\n]/u);
  return <>
    <Picture asset={after} />
    <div style={{ ...fill, clipPath: `inset(0 ${100 - x}% 0 0)` }}><Picture asset={before} /></div>
    {x > 0 && <><div style={{ position: "absolute", left: `${x}%`, top: 0, bottom: 0, width: px(1.5), background: "#ffffff", boxShadow: `0 0 ${px(4)} #00000066` }} />
    <div style={{ position: "absolute", left: `${x}%`, top: "50%", transform: "translate(-50%, -50%)", width: px(22), height: px(22), borderRadius: "50%", background: "#ffffff", color: "#111316", display: "grid", placeItems: "center", fontSize: px(14), boxShadow: `0 ${px(2)} ${px(6)} #00000055` }}>↔</div>
    </>}
    {labels.slice(0, 2).map((label, i) => (x > 0 || i === 1) && <div key={i} style={{ position: "absolute", top: "7%", ...(i ? { right: "5%" } : { left: "5%" }), padding: `${px(5)} ${px(10)}`, background: "#111316d9", color: "#ffffff", borderRadius: px(3), fontSize: px(13) }}>{label}</div>)}
  </>;
}

function CursorTour({ page, settings, t, accent, width, height }: { page?: ShotcraftAsset; settings: ShotcraftSettings; t: number; accent: string; width: number; height: number }) {
  const rect = shotcraftImageRect(page?.width ?? width, page?.height ?? height, width, height);
  const windows = [[0.2, 0.32], [0.4, 0.52], [0.6, 0.72], [0.79, 0.91]];
  let x = 50, y = 50, scale = 0.8, lastX = 50, lastY = 50, lastScale = 0.8, click = 1;
  settings.regions.forEach((region, i) => {
    const targetX = rect.x + (region.x + region.width / 2) * rect.width / 100;
    const targetY = rect.y + (region.y + region.height / 2) * rect.height / 100;
    const nextScale = Math.min(2.5, Math.max(1.2, 52 / Math.max(region.width * rect.width / 100, region.height * rect.height / 100)));
    const p = seg(t, windows[i][0], windows[i][1], cubicInOut);
    x += p * (targetX - lastX); y += p * (targetY - lastY); scale += p * (nextScale - lastScale);
    lastX = targetX; lastY = targetY; lastScale = nextScale;
    if (t >= windows[i][1]) click = seg(t, windows[i][1], windows[i][1] + 0.055, cubicOut);
  });
  const fade = seg(t, 0, 0.14, cubicOut);
  return <div style={{ ...fill, transformOrigin: "0 0", transform: `translate(${50 - x * scale}%, ${50 - y * scale}%) scale(${scale})`, opacity: fade }}>
    <Picture asset={page} style={{ filter: `blur(${px((1 - fade) * 5)})` }} />
    <div style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: px(26), height: px(26), border: `${px(2)} solid ${accent}`, borderRadius: "50%", opacity: (1 - click) * 0.85, transform: `translate(-50%, -50%) scale(${(0.3 + click * 1.6) / scale})` }} />
    <svg viewBox="0 0 24 24" style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: px(22), height: px(22), transformOrigin: "0 0", transform: `scale(${1 / scale})`, filter: `drop-shadow(0 ${px(3)} ${px(5)} #00000088)` }}><path d="M4 2 L4 19 L9 14.4 L12.2 21.5 L15.4 20 L12.2 13 L19 12.6 Z" fill="#ffffff" stroke="#111316" strokeWidth={1.1} /></svg>
  </div>;
}

function CardFan({ cards, t, fit }: { cards: readonly (ShotcraftAsset | undefined)[]; t: number; fit: "contain" | "cover" }) {
  const fan = seg(t, 0.55, 0.8, cubicInOut);
  return <div style={{ ...fill, perspective: px(900), overflow: "hidden" }}>{cards.map((card, i) => {
    const inT = seg(t, 0.02 + i * 0.033, 0.32 + i * 0.033);
    const spring = 1 - Math.exp(-6 * inT) * Math.cos((8 + 8 * 0.7) * inT * 0.3 * 2.2);
    const k = i - (cards.length - 1) / 2;
    return <div key={i} style={{ position: "absolute", left: "50%", top: "50%", width: px(110), height: px(150), margin: `${px(-85)} 0 0 ${px(-55)}`, borderRadius: px(6), background: "#ffffff", border: `${px(0.5)} solid #ffffff33`, boxShadow: `0 ${px(12)} ${px(34)} #00000066`, transformOrigin: "50% 130%", transform: `translate3d(${px(k * 34 * fan)}, ${px(300 * (1 - spring))}, ${px(-10 * Math.abs(k) * fan)}) rotate(${k * 8 * fan}deg)`, opacity: Math.min(1, inT * 4), zIndex: 20 - Math.abs(k * 2), overflow: "hidden" }}><Picture asset={card} fit={fit} /></div>;
  })}</div>;
}

function SpatialSteps({ cards, t, text, color, accent, surface }: { cards: readonly (ShotcraftAsset | undefined)[]; t: number; text: string; color: string; accent: string; surface: string }) {
  const poses = [{ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 }, { x: 520, y: -60, z: -180, rx: 0, ry: -40, rz: 0, s: 1 }, { x: 160, y: 300, z: -520, rx: 0, ry: 0, rz: 90, s: 1 }, { x: 220, y: 90, z: -260, rx: 0, ry: 0, rz: 0, s: 3.1 }];
  const flyAt = [0.22, 0.48, 0.76];
  const cam = { ...poses[0] }; let af = 0;
  flyAt.forEach((at, i) => { const f = seg(t, at, at + 0.16, cubicInOut); af += f; for (const key of ["x", "y", "z", "rx", "ry", "rz", "s"] as const) cam[key] = lerp(cam[key], poses[i + 1][key], f); });
  const over = seg(t, 0.76, 0.92); const labels = text.split(/[|｜\n]/u);
  return <div style={{ ...fill, perspective: px(1000), overflow: "hidden" }}><div style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, transformStyle: "preserve-3d", transform: `scale(${1 / cam.s}) rotateZ(${-cam.rz}deg) rotateY(${-cam.ry}deg) rotateX(${-cam.rx}deg) translate3d(${px(-cam.x)}, ${px(-cam.y)}, ${px(-cam.z)})` }}>
    {poses.map((pose, i) => { const last = i === 3; const focus = Math.max(1 - Math.min(1, Math.abs(af - i)), over); return <div key={i} style={{ position: "absolute", left: px(last ? -160 : -110), top: px(last ? -100 : -70), width: px(last ? 320 : 220), height: px(last ? 200 : 140), borderRadius: px(6), background: surface, border: `${px(1)} solid ${accent}`, boxShadow: `0 ${px(18)} ${px(50)} #00000066`, transform: `translate3d(${px(pose.x)}, ${px(pose.y)}, ${px(pose.z)}) rotateY(${pose.ry}deg) rotateZ(${pose.rz}deg) scale(${pose.s / (last ? 2.2 : 1)})`, opacity: 0.28 + focus * 0.72, filter: `blur(${px((1 - focus) * 3.5)})`, overflow: "hidden" }}>
      {!last && <Picture asset={cards[i]} style={{ height: "75%" }} />}
      <div style={{ position: "absolute", inset: last ? "15%" : "77% 5% 3%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color, fontSize: px(last ? 26 : 14), fontWeight: 700, lineHeight: 1.3 }}>{labels[i] ?? ""}</div>
    </div>; })}
  </div></div>;
}

function HeroCard({ page, hero, settings, frame, height, accent, patch }: { page?: ShotcraftAsset; hero?: ShotcraftAsset; settings: ShotcraftSettings; frame: number; height: number; accent: string; patch: string }) {
  const region = settings.regions[0];
  const pageH = 480 * (page?.height ?? 1080) / Math.max(1, page?.width ?? 1920);
  const rect = { x: region.x * 4.8, y: region.y / 100 * pageH, w: region.width * 4.8, h: region.height / 100 * pageH };
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const p = seg(frame, 32, 48, pushEase);
  const initialZoom = Math.min(0.78, height / pageH * 0.9);
  const zoom = lerp(initialZoom, shotcraftHeroZoom(rect.w, rect.h, height), p);
  const camX = lerp(240, cx - 7.5, p), camY = lerp(height / 2, cy, p);
  const rise = seg(frame, 48, 58, riseEase), reseat = seg(frame, 112, 130, returnEase);
  const lift = rise * (1 - reseat), z = 27.5 * lift + Math.sin((frame - 58) / 40 * Math.PI * 2) * lift;
  const press = frame < 129 ? lerp(1, 0.997, seg(frame, 126, 129)) : lerp(0.997, 1, seg(frame, 129, 130));
  const beam1 = frame >= 59 && frame <= 75, beam2 = frame >= 79 && frame <= 101;
  const beam = beam1 ? seg(frame, 60, 74) : seg(frame, 80, 100, shotcraftBezier(0.4, 0, 0.4, 1));
  const spotEase = shotcraftBezier(0.4, 0, 0.3, 1);
  const stops = [4, 8, 16, 22, 28, 48];
  const spotAt = (values: number[]) => values.slice(1).reduce((value, next, index) => value + (next - values[index]) * seg(frame, stops[index], stops[index + 1], spotEase), values[0]);
  const spotX = spotAt([25, 25, 70, 42, 50 + (cx - 240) * initialZoom / 480 * 100, 50]);
  const spotY = spotAt([30, 30, 45, 60, 50 + (cy - height / 2) * initialZoom / height * 100, 50]);
  const pool = lerp(155, 105, seg(frame, 22, 32, spotEase)) - 15 * seg(frame, 32, 48, spotEase);
  const pulse = 1 + 0.06 * (seg(frame, 32, 36) - seg(frame, 36, 41));
  const vignette = 0.16 + 0.18 * seg(frame, 22, 32) + 0.08 * seg(frame, 32, 48);
  const slotVis = Math.max(0, Math.min(1, rise * 2) * (1 - reseat));
  const slotEdge = Math.min(1, 0.4 * (1 - reseat)) + 0.6 * (seg(frame, 126, 130) - seg(frame, 130, 134));
  const imageCrop = <Picture asset={page} style={{ width: `${480 / rect.w * 100}%`, height: `${pageH / rect.h * 100}%`, left: `${-rect.x / rect.w * 100}%`, top: `${-rect.y / rect.h * 100}%`, objectFit: "fill" }} />;
  return <>
    <div style={{ ...fill, opacity: seg(frame, 0, 8, shotcraftBezier(0.3, 0, 0.2, 1)), perspective: px(300 * zoom), perspectiveOrigin: "50% 50%" }}>
      <div style={{ position: "absolute", width: px(480), height: px(pageH), zoom, transform: `translate(${px(240 / zoom - camX)}, ${px(height / 2 / zoom - camY)}) rotateY(${34 * p}deg) rotateX(${8 * p}deg) rotateZ(${2 * p}deg)`, transformOrigin: `${px(camX)} ${px(camY)}`, transformStyle: "preserve-3d" }}>
        <Picture asset={page} style={{ objectFit: "fill" }} />
        {slotVis > 0.02 && <div style={{ position: "absolute", left: px(rect.x - 0.5), top: px(rect.y - 0.5), width: px(rect.w + 1), height: px(rect.h + 1), background: patch, borderRadius: px(4), opacity: slotVis }}><div style={{ ...fill, borderRadius: "inherit", border: `${px(0.375)} solid ${accent}`, opacity: slotEdge }} /></div>}
        <div style={{ position: "absolute", left: px(rect.x), top: px(rect.y), width: px(rect.w), height: px(rect.h), transform: `translateZ(${px(z)}) scale(${press})`, transformStyle: "preserve-3d" }}>
          <div style={{ ...fill, borderRadius: px(4), overflow: "hidden", boxShadow: frame >= 130 ? "none" : `0 ${px(2 * lift)} ${px(2.5 + 3 * lift)} #00000033, 0 ${px(11.5 * lift)} ${px(22.5 * lift)} #00000038` }}>
            {imageCrop}
            {hero && <Picture asset={hero} fit="cover" style={{ opacity: seg(frame, 32, 38) }} />}
            <div style={{ ...fill, background: "linear-gradient(160deg, #ffffff80, transparent 40%)", opacity: lift }} />
          </div>
          {(beam1 || beam2) && lift > 0.4 && <svg viewBox={`0 0 ${rect.w + 1.5} ${rect.h + 1.5}`} style={{ position: "absolute", left: px(-0.75), top: px(-0.75), width: px(rect.w + 1.5), height: px(rect.h + 1.5), overflow: "visible", opacity: beam1 ? 1 : 0.62, filter: `drop-shadow(0 0 ${px(1.5)} ${accent})` }}>
            {[0, 1].map((layer) => <rect key={layer} x={0.5} y={0.5} width={rect.w + 0.5} height={rect.h + 0.5} rx={4} fill="none" stroke={layer ? "#fff8e8" : accent} strokeWidth={(beam1 ? 1.25 : 0.875) / (layer + 1)} strokeLinecap="round" pathLength={1} strokeDasharray="0.14 1" strokeDashoffset={-beam} />)}
          </svg>}
          {frame >= 100 && frame < 112 && <div style={{ position: "absolute", inset: px(-0.75), borderRadius: px(4.75), border: `${px(0.375)} solid ${accent}`, opacity: 0.35 * (1 - seg(frame, 100, 112)) }} />}
        </div>
      </div>
    </div>
    <div style={{ ...fill, pointerEvents: "none", opacity: seg(frame, 2, 10), background: `radial-gradient(ellipse ${px(pool * pulse)} ${px(pool * 0.8 * pulse)} at ${spotX}% ${spotY}%, #fff1d61a, rgb(0 0 0 / ${vignette}))` }} />
  </>;
}

function ShotScene({ clip, assets, timeUs, width, height, theme }: SceneProps) {
  const settings = clip.shotcraft ?? defaultShotcraftSettings(clip.compositionId);
  const frame = shotcraftFrame(clip.compositionId, timeUs, settings);
  const shot = shotcraftShot(clip.compositionId);
  const t = frame / Math.max(1, (shot?.frames ?? 1) - 1);
  const appearance = theme ? resolveEffectAppearance(clip, theme) : clip;
  const surface = theme && clip.colorRole && clip.colorRole !== "custom" ? theme.colors.surface : typeof clip.params?.surface === "string" && /^#[0-9a-f]{6}$/iu.test(clip.params.surface) ? clip.params.surface : "#111316";
  const patch = typeof clip.params?.patchColor === "string" && /^#[0-9a-f]{6}$/iu.test(clip.params.patchColor) ? clip.params.patchColor : "#ffffff";
  const fit = clip.params?.fit === "cover" ? "cover" : "contain";
  const slot = (id: string) => (clip.bindings?.find((binding) => binding.slotId === id)?.assetIds ?? []).map((assetId) => assets.find((asset) => asset.id === assetId));
  const cards = slot("cards");
  let content: ReactNode;
  if (clip.compositionId === "shotcraft-blur-slide") content = <BlurTitle text={clip.text} t={t} color={appearance.color} accent={appearance.accentColor} />;
  else if (clip.compositionId === "shotcraft-before-after") content = <BeforeAfter before={slot("before")[0]} after={slot("after")[0]} frame={frame} text={clip.text} revealAfter={clip.params?.revealAfter === true} />;
  else if (clip.compositionId === "shotcraft-cursor-flyover") content = <CursorTour page={slot("page")[0]} settings={settings} t={t} accent={appearance.accentColor} width={width} height={height} />;
  else if (clip.compositionId === "shotcraft-basic-3d") content = <SpatialSteps cards={cards} t={t} text={clip.text} color={appearance.color} accent={appearance.accentColor} surface={surface} />;
  else if (clip.compositionId === "shotcraft-card-stack") content = <CardFan cards={cards.length ? cards : [undefined, undefined]} t={t} fit={fit} />;
  else if (libraryShot(clip.compositionId)) content = <LibraryScene clip={clip} assets={assets} frame={frame} width={width} height={height} appearance={{ color: appearance.color, accent: appearance.accentColor, surface, fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif' }} />;
  else content = <HeroCard page={slot("page")[0]} hero={slot("hero")[0]} settings={settings} frame={frame} height={480 * height / width} accent={appearance.accentColor} patch={patch} />;
  const caption = !["shotcraft-blur-slide", "shotcraft-before-after", "shotcraft-basic-3d"].includes(clip.compositionId) ? clip.text.trim() : "";
  const lines = caption.split(/[|｜\n]/u).filter(Boolean);
  const captionText = clip.compositionId === "shotcraft-cursor-flyover" ? lines[Math.min(lines.length - 1, Math.max(0, [0.52, 0.72, 0.91].filter((at) => t >= at).length))] : lines.join("\n");
  return <div className="shotcraft-scene" style={{ ...fill, containerType: "size", background: surface, color: appearance.color, overflow: "hidden", fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif', letterSpacing: 0 }}>
    <div style={{ ...fill, transform: caption ? lines.length > 1 && clip.compositionId !== "shotcraft-cursor-flyover" ? "translateY(-9%) scale(0.78)" : "translateY(-6%) scale(0.86)" : undefined, overflow: "hidden" }}>{content}</div>
    {caption && <div data-shotcraft-caption style={{ position: "absolute", left: "6%", right: "6%", bottom: "4%", minHeight: "9%", display: "grid", placeItems: "center", textAlign: "center", fontSize: px(14), fontWeight: 600, lineHeight: 1.35, whiteSpace: "pre-line", overflowWrap: "anywhere", opacity: seg(frame, 4, 12) }}>{captionText}</div>}
  </div>;
}

export function ShotcraftComposition(props: CompositionRenderProps) {
  const data = props.shotcraftData;
  if (!data) return null;
  const settings = data.clip.shotcraft ?? defaultShotcraftSettings(data.clip.compositionId);
  const previous = data.previous;
  const assets = props.shotcraftAssets ?? [];
  const scene = <ShotScene clip={data.clip} assets={assets} timeUs={props.timeUs} width={props.canvasWidth} height={props.canvasHeight ?? props.canvasWidth * 9 / 16} theme={props.shotcraftTheme} />;
  if (!previous || settings.transition.preset === "none" || props.timeUs >= settings.transition.durationUs) return scene;
  const state = shotcraftTransitionState(settings.transition.preset, props.timeUs, settings.transition.durationUs);
  const outgoing = <ShotScene clip={previous} assets={assets} timeUs={Math.round((previous.sourceOffsetUs ?? 0) + Math.max(0, previous.durationUs - 1) * previous.speed)} width={props.canvasWidth} height={props.canvasHeight ?? props.canvasWidth * 9 / 16} theme={props.shotcraftTheme} />;
  const transitionShot = libraryTransition(settings.transition.preset);
  if (transitionShot) {
    const stage = (child: ReactNode) => <div style={{ position: "absolute", width: props.canvasWidth, height: props.canvasHeight ?? props.canvasWidth * 9 / 16, transformOrigin: "0 0", transform: `scale(${1920 / props.canvasWidth}, ${1080 / (props.canvasHeight ?? props.canvasWidth * 9 / 16)})` }}>{child}</div>;
    return <LibraryScene clip={{ ...data.clip, compositionId: transitionShot.id }} assets={assets} frame={transitionShot.start + props.timeUs / settings.transition.durationUs * (transitionShot.end - transitionShot.start)} width={props.canvasWidth} height={props.canvasHeight ?? props.canvasWidth * 9 / 16} outgoing={stage(outgoing)} incoming={stage(scene)} />;
  }
  return <div style={{ ...fill, overflow: "hidden", containerType: "size" }}>
    {settings.transition.preset === "push-up" ? <>
      <div style={{ ...fill, transform: `translateY(${state.outgoingY}%)` }}>{outgoing}</div>
      <div style={{ ...fill, transform: `translateY(${state.incomingY}%)` }}>{scene}<div style={{ position: "absolute", left: 0, right: 0, top: px(-10), height: px(10), background: "linear-gradient(to top, #0000004d, transparent)" }} /></div>
    </> : <>{state.showIncoming ? scene : outgoing}<div style={{ ...fill, opacity: state.flash, background: "radial-gradient(ellipse at 50% 45%, #fff8eb, #fff4e08c 55%, transparent 80%)" }} /></>}
  </div>;
}

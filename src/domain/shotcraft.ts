// Timing adaptations from video-shotcraft, Copyright 2026 Wei Yihao (Apache-2.0).
// Modified for editable BVideo projects; see docs/03-Shotcraft镜头.md.
import { z } from "zod";
import type { CompositionDefinition } from "@/domain/effects";
import type { CompositionClip, EditorProject } from "@/domain/project";
import { SHOTCRAFT_LIBRARY, libraryShot } from "@/domain/shotcraftLibrary/catalog";
import { LIBRARY_TRANSITIONS, libraryTransition } from "@/domain/shotcraftLibrary/transitions";

// Reference timings use 30 fps; project clocks stay in integer microseconds.
export const SHOTCRAFT_NATIVE_SHOTS = [
  { id: "shotcraft-blur-slide", card: "blur-slide", name: "柔焦标题", frames: 114, holdFrame: 103, description: "标题逐词上浮收焦，副标题错峰跟进", slots: [] },
  { id: "shotcraft-before-after", card: "before-after-slider-scrub", name: "前后对比", frames: 150, holdFrame: 104, description: "分割杆快甩回弹，再慢扫比较两张图片", slots: [{ id: "before", label: "处理前", kind: "image", minItems: 1, maxItems: 1 }, { id: "after", label: "处理后", kind: "image", minItems: 1, maxItems: 1 }] },
  { id: "shotcraft-cursor-flyover", card: "cursor-flyover", name: "焦点巡览", frames: 180, holdFrame: 172, description: "在真实截图的四个区域间巡览，光标随相机指点", slots: [{ id: "page", label: "页面截图", kind: "image", minItems: 1, maxItems: 1 }] },
  { id: "shotcraft-basic-3d", card: "basic-3d-scene", name: "空间步进", frames: 180, holdFrame: 169, description: "三个画面依次转正特写，最后拉远总览", slots: [{ id: "cards", label: "步骤画面", kind: "image", minItems: 3, maxItems: 3 }] },
  { id: "shotcraft-spotlight-hero-card", card: "spotlight-hero-card", name: "聚光悬浮卡", frames: 145, holdFrame: 112, description: "锁定截图主角，斜侧推近、抬升悬停后归位", slots: [{ id: "page", label: "页面截图", kind: "image", minItems: 1, maxItems: 1 }, { id: "hero", label: "高清主角（可选）", kind: "image", minItems: 0, maxItems: 1 }] },
  { id: "shotcraft-card-stack", card: "card-stack", name: "叠卡扇展", frames: 126, holdFrame: 110, description: "2–8 张图片逐张弹入叠起，落稳后统一展开", slots: [{ id: "cards", label: "卡片图片", kind: "image", minItems: 2, maxItems: 8 }] }
] as const;

export const SHOTCRAFT_SHOTS = [...SHOTCRAFT_NATIVE_SHOTS, ...SHOTCRAFT_LIBRARY];
export type ShotcraftId = `shotcraft-${string}`;
export const SHOTCRAFT_TRANSITIONS = [
  { value: "none", label: "直接切换" }, { value: "flash-cut", label: "流白" }, { value: "push-up", label: "整屏上推" },
  ...LIBRARY_TRANSITIONS.map((item) => ({ value: item.id, label: libraryShot(item.id)!.name }))
];
const regionSchema = z.object({
  x: z.number().finite().min(0).max(99), y: z.number().finite().min(0).max(99),
  width: z.number().finite().min(1).max(100), height: z.number().finite().min(1).max(100)
}).strict().refine((region) => region.x + region.width <= 100 && region.y + region.height <= 100);
const shotcraftSchema = z.object({
  version: z.literal(1),
  holdUs: z.number().int().min(0).max(10_000_000),
  leadInUs: z.number().int().min(0).max(1_500_000).optional(),
  regions: z.array(regionSchema).max(4),
  timeMap: z.array(z.object({ timeUs: z.number().int().min(0).max(120_000_000), frame: z.number().finite().min(0).max(3600) }).strict()).min(2).max(32).optional(),
  transition: z.object({
    preset: z.string().refine((value) => SHOTCRAFT_TRANSITIONS.some((item) => item.value === value), "未知转场"),
    durationUs: z.number().int().min(100_000).max(1_500_000),
    fromClipId: z.string().min(1).max(256).optional()
  }).strict()
}).strict();

export type ShotcraftSettings = z.infer<typeof shotcraftSchema>;
export type ShotcraftRegion = z.infer<typeof regionSchema>;
export interface ShotcraftRenderData { clip: CompositionClip; previous?: CompositionClip }

export function shotcraftShot(id: string) { return SHOTCRAFT_SHOTS.find((shot) => shot.id === id); }
export function isShotcraftComposition(id: string): id is ShotcraftId { return Boolean(shotcraftShot(id)); }

export function defaultShotcraftSettings(id: string): ShotcraftSettings {
  const regions = ["shotcraft-spotlight-hero-card", "shotcraft-crash-impact-real", "shotcraft-crash-zoom-real"].includes(id)
    ? [{ x: 35, y: 35, width: 30, height: 30 }]
    : id === "shotcraft-cursor-flyover"
      ? [{ x: 20, y: 15, width: 30, height: 30 }, { x: 60, y: 15, width: 30, height: 30 }, { x: 60, y: 55, width: 30, height: 30 }, { x: 20, y: 55, width: 30, height: 30 }]
      : [];
  return { version: 1, holdUs: 0, regions, transition: { preset: "none", durationUs: 1_000_000 } };
}

export function normalizeShotcraftSettings(value: unknown, id: string): ShotcraftSettings {
  const result = shotcraftSchema.safeParse(value ?? defaultShotcraftSettings(id));
  const count = defaultShotcraftSettings(id).regions.length;
  if (!result.success || result.data.regions.length !== count) throw new Error("镜头参数或版本无效，请检查焦点区域、停留时间和转场设置");
  const map = result.data.timeMap;
  if (map && (map[0].timeUs !== 0 || map[0].frame !== 0 || map.at(-1)!.frame !== shotcraftShot(id)?.frames || map.some((point, i) => i > 0 && (point.timeUs <= map[i - 1].timeUs || point.frame <= map[i - 1].frame)))) throw new Error("音乐卡点时钟无效，请重新编排镜头");
  return result.data;
}

export const SHOTCRAFT_COMPOSITIONS: readonly CompositionDefinition[] = SHOTCRAFT_SHOTS.map((shot) => ({
  id: shot.id, name: shot.name, category: "展示", renderer: "react", slots: shot.slots,
  description: `Shotcraft · ${shot.description}`, tags: ["Shotcraft", "镜头", shot.name, shot.card, libraryShot(shot.id)?.category ?? "展示"],
  defaultDurationUs: shot.id === "shotcraft-timeline-travel" ? 4_800_000 : Math.round(shot.frames / 30 * 1_000_000),
  defaultText: shot.id === "shotcraft-blur-slide" ? "让创意 成为作品｜从灵感到画面，每一步都清晰" : shot.id === "shotcraft-basic-3d" ? "理解｜创造｜呈现｜让想法成为作品" : shot.id === "shotcraft-before-after" ? "处理前｜处理后" : "",
  defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
  defaultParams: { surface: "#111316", fit: "contain", ...Object.fromEntries((libraryShot(shot.id)?.texts ?? []).map((text) => [text.key, text.default])), ...(shot.id === "shotcraft-spotlight-hero-card" ? { patchColor: "#ffffff" } : {}) },
  recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 }
}));

export function shotcraftFrame(id: string, sourceTimeUs: number, settings: ShotcraftSettings) {
  const shot = shotcraftShot(id);
  if (!shot) return 0;
  const leadInUs = settings.leadInUs ?? 0;
  const holdStartUs = shotcraftFrameTimeUs(shot.holdFrame, settings) - leadInUs;
  const time = Math.max(0, sourceTimeUs - leadInUs);
  const extra = Math.max(0, Math.min(settings.holdUs, time - holdStartUs));
  const adjusted = time - extra;
  const map = settings.timeMap;
  const index = map?.findIndex((point) => point.timeUs > adjusted) ?? -1;
  const a = map?.[Math.max(0, index - 1)], b = map?.[index < 0 ? map.length - 1 : index];
  const frame = a && b ? (index < 0 ? b.frame : a.frame + (b.frame - a.frame) * (adjusted - a.timeUs) / Math.max(1, b.timeUs - a.timeUs)) : adjusted / 1_000_000 * 30;
  const nearest = Math.round(frame);
  // A 30 fps boundary can lose half a microsecond when stored; keep exact landed-state branches.
  return Math.min(shot.frames - 1, Math.abs(frame - nearest) <= 0.00002 ? nearest : frame);
}

export function shotcraftFrameTimeUs(frame: number, settings: ShotcraftSettings) {
  const leadInUs = settings.leadInUs ?? 0;
  const map = settings.timeMap;
  if (!map) return leadInUs + Math.round(frame / 30 * 1_000_000);
  const index = map.findIndex((point) => point.frame >= frame);
  if (index <= 0) return leadInUs + (index < 0 ? map.at(-1)!.timeUs : 0);
  const a = map[index - 1], b = map[index];
  return leadInUs + Math.round(a.timeUs + (b.timeUs - a.timeUs) * (frame - a.frame) / (b.frame - a.frame));
}

export function shotcraftEventTimeUs(id: string, frame: number, settings: ShotcraftSettings) {
  return shotcraftFrameTimeUs(frame, settings) + (frame > (shotcraftShot(id)?.holdFrame ?? Infinity) ? settings.holdUs : 0);
}

export function shotcraftTransitionCutRatio(preset: string) {
  const source = libraryTransition(preset);
  if (source) return (source.cut - source.start) / (source.end - source.start);
  if (preset === "none") return 0;
  if (preset === "push-up") {
    let low = 0, high = 1;
    for (let i = 0; i < 24; i += 1) { const mid = (low + high) / 2; if (pushEase(mid) < 0.5) low = mid; else high = mid; }
    return (low + high) / 2;
  }
  return 0.5;
}

export function shotcraftHoldPatch(clip: CompositionClip, settings: ShotcraftSettings): Partial<CompositionClip> {
  const shot = shotcraftShot(clip.compositionId);
  const oldHold = clip.shotcraft?.holdUs ?? 0;
  if (!shot || oldHold === settings.holdUs) return {};
  const holdStart = shotcraftFrameTimeUs(shot.holdFrame, settings);
  const remap = (timeUs: number) => Math.round(timeUs <= holdStart ? timeUs
    : timeUs < holdStart + oldHold ? holdStart + Math.min(timeUs - holdStart, settings.holdUs)
      : timeUs + settings.holdUs - oldHold);
  const sourceOffsetUs = remap(clip.sourceOffsetUs ?? 0);
  const durationUs = Math.max(100_000, Math.round((remap((clip.sourceOffsetUs ?? 0) + clip.durationUs * clip.speed) - sourceOffsetUs) / clip.speed));
  return { sourceOffsetUs, durationUs, animationDurationUs: shotcraftFrameTimeUs(shot.frames, settings) + settings.holdUs };
}

// Source-relative focus regions are mapped through contain letterboxing before camera motion.
export function shotcraftImageRect(sourceWidth: number, sourceHeight: number, canvasWidth: number, canvasHeight: number) {
  const ratio = Math.max(1, sourceWidth) / Math.max(1, sourceHeight);
  const canvasRatio = Math.max(1, canvasWidth) / Math.max(1, canvasHeight);
  const width = Math.min(100, 100 * ratio / canvasRatio);
  const height = Math.min(100, 100 * canvasRatio / ratio);
  return { x: (100 - width) / 2, y: (100 - height) / 2, width, height };
}

export function shotcraftHeroZoom(regionWidth: number, regionHeight: number, canvasHeight: number) {
  const radians = Math.PI / 180;
  const rx = 8 * radians, ry = 34 * radians, rz = 2 * radians;
  let extentX = 1, extentY = 1;
  // Reserve the largest authored lift (including spring overshoot), before the push begins.
  // CSS zoom scales the camera's 300-unit perspective with the page, so this projection is invariant.
  for (const x of [-regionWidth / 2 + 7.5, regionWidth / 2 + 7.5]) {
    for (const y of [-regionHeight / 2, regionHeight / 2]) {
      for (const z of [0, 32]) {
        const zx = x * Math.cos(rz) - y * Math.sin(rz);
        const zy = x * Math.sin(rz) + y * Math.cos(rz);
        const xy = zy * Math.cos(rx) - z * Math.sin(rx);
        const xz = zy * Math.sin(rx) + z * Math.cos(rx);
        const yx = zx * Math.cos(ry) + xz * Math.sin(ry);
        const yz = -zx * Math.sin(ry) + xz * Math.cos(ry);
        const perspective = 300 / Math.max(1, 300 - yz);
        extentX = Math.max(extentX, Math.abs(yx * perspective));
        extentY = Math.max(extentY, Math.abs(xy * perspective));
      }
    }
  }
  return Math.min(2.6, 480 * 0.43 / extentX, canvasHeight * 0.43 / extentY);
}

export function shotcraftProgress(value: number, start: number, end: number, ease: (t: number) => number = (t) => t) {
  return ease(Math.max(0, Math.min(1, (value - start) / Math.max(0.000001, end - start))));
}

// Cubic Bézier inversion preserves the source's authored curves, including overshoot.
export function shotcraftBezier(x1: number, y1: number, x2: number, y2: number) {
  const curve = (t: number, a: number, b: number) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  return (x: number) => {
    if (x <= 0 || x >= 1) return Math.max(0, Math.min(1, x));
    let low = 0, high = 1;
    for (let i = 0; i < 24; i += 1) { const mid = (low + high) / 2; if (curve(mid, x1, x2) < x) low = mid; else high = mid; }
    return curve((low + high) / 2, y1, y2);
  };
}

const pushEase = shotcraftBezier(0.12, 0.9, 0.2, 1);
export function shotcraftTransitionState(preset: ShotcraftSettings["transition"]["preset"], timeUs: number, durationUs: number) {
  const t = shotcraftProgress(timeUs, 0, durationUs);
  const push = preset === "push-up" ? pushEase(t) : 0;
  return { outgoingY: push === 0 ? 0 : -100 * push, incomingY: 100 * (1 - push),
    showIncoming: preset === "push-up" || t >= 0.5,
    flash: preset === "flash-cut" ? (t <= 0.4 ? t / 0.4 : (1 - t) / 0.6) * 0.85 : 0 };
}

function fullFrameShot(clip: CompositionClip) {
  const t = clip.transform;
  return isShotcraftComposition(clip.compositionId) && t.x === 50 && t.y === 50 && t.scale === 1
    && t.rotation === 0 && t.opacity === 1 && !clip.transformKeyframes?.length
    && (clip.dimAtUs === undefined || clip.dimAtUs >= clip.durationUs);
}

export function shotcraftAdjacentShot(project: Pick<EditorProject, "tracks">, clip: CompositionClip): CompositionClip | undefined {
  if (!fullFrameShot(clip)) return;
  const originUs = clip.startUs - (clip.sourceOffsetUs ?? 0) / clip.speed;
  const candidates = project.tracks.filter((track) => !track.hidden && track.id === clip.trackId).flatMap((track) => track.clips);
  const matches = candidates.filter((candidate): candidate is CompositionClip => candidate.id !== clip.id && candidate.kind === "composition"
    && fullFrameShot(candidate) && Math.abs(candidate.startUs + candidate.durationUs - originUs) < 2);
  return matches.length === 1 ? matches[0] : undefined;
}

export function shotcraftPredecessor(project: Pick<EditorProject, "tracks">, clip: CompositionClip): CompositionClip | undefined {
  const transition = clip.shotcraft?.transition;
  if (!transition?.fromClipId || transition.preset === "none" || (clip.sourceOffsetUs ?? 0) >= transition.durationUs) return;
  const candidate = shotcraftAdjacentShot(project, clip);
  return candidate?.id === transition.fromClipId ? candidate : undefined;
}

export function shotcraftRenderData(project: EditorProject, clip: CompositionClip): ShotcraftRenderData {
  return { clip, previous: shotcraftPredecessor(project, clip) };
}

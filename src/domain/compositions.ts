import { z } from "zod";
import type { CompositionDefinition, CompositionParams } from "@/domain/effects";
import type { CompositionClip, MediaAsset, SceneClip, TransformProps } from "@/domain/project";
import { upsertVisualKeyframe, visualTransformAt } from "@/domain/transforms";
import { DEFAULT_BACKGROUND_LAYER, DEFAULT_EFFECT_LAYER, normalizeLayer } from "@/domain/layers";
import { importedOverlayStudioBackgroundIds } from "@/domain/overlayStudioCatalog";
import { overlayStudioAiMediaSlots, overlayStudioMediaSlots } from "@/domain/overlayStudioMedia";
import { shotcraftShot } from "@/domain/shotcraft";

export interface CompositionSlot {
  id: string;
  label: string;
  kind: "image" | "video" | "visual";
  minItems: number;
  maxItems: number;
}

export interface CompositionBinding {
  slotId: string;
  assetIds: string[];
}

export const FOCUS_CARD_SLOTS: readonly CompositionSlot[] = [
  { id: "presenter", label: "人物视频", kind: "video", minItems: 1, maxItems: 1 }
];

const SEQUENCED_MEDIA_COMPOSITION_SPECS = [
  ["motion-zoom", "动势缩放", "连续推近与切点加速", 2, 10],
  ["slide-gallery", "横向轮播", "横向滑移与中心聚焦", 2, 8],
  ["card-stack", "叠卡翻展", "错位叠卡与逐张翻展", 2, 8],
  ["split-reveal", "分屏揭幕", "分栏错峰展开", 2, 4]
] as const;

const bindingSchema = z.array(z.object({
  slotId: z.string().min(1).max(64),
  assetIds: z.array(z.string().min(1).max(256)).max(12)
})).max(8);

export const MEDIA_COMPOSITIONS: readonly CompositionDefinition[] = [
  {
    id: "poster-wall-3d", name: "3D 海报墙", category: "展示",
    description: "2–12 张图片 · 透明底摄像机运镜", tags: ["图片", "海报", "3D", "多图", "展示"],
    renderer: "three", slots: [{ id: "posters", label: "海报", kind: "image", minItems: 2, maxItems: 12 }],
    defaultDurationUs: 10_000_000, defaultText: "", defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
    defaultParams: { travel: 0.65, spacing: 1 },
    recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 }
  },
  {
    id: "image-duet-3d", name: "双图展示", category: "展示",
    description: "固定 2 张图片 · 双卡片透视入场", tags: ["图片", "对比", "双图", "3D"],
    renderer: "three", slots: [
      { id: "left", label: "左图", kind: "image", minItems: 1, maxItems: 1 },
      { id: "right", label: "右图", kind: "image", minItems: 1, maxItems: 1 }
    ],
    defaultDurationUs: 6_000_000, defaultText: "", defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
    defaultParams: { travel: 0.35, spacing: 1 },
    recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 }
  },
  ...SEQUENCED_MEDIA_COMPOSITION_SPECS.map(([id, name, description, minItems, maxItems]): CompositionDefinition => ({
    id, name, category: "展示", renderer: "canvas", description: `${minItems}–${maxItems} 个素材 · ${description}`,
    tags: ["展示", "图片", "视频", "多素材", name],
    slots: [{ id: "media", label: "素材", kind: "visual", minItems, maxItems }],
    defaultDurationUs: 6_000_000, defaultText: "", defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
    defaultParams: { travel: 0.65, spacing: 1, fit: "contain" },
    recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 }
  })),
  ...([
    ["background-stripes", "斜向条纹", "连续斜线平移", "#173d3b", "#73b6a5"],
    ["background-grid", "透视方格", "空间网格与缓慢运镜", "#191d20", "#536169"],
    ["background-dots", "点阵律动", "规则点阵与波形起伏", "#eceff3", "#737f91"],
    ["background-contours", "等高线", "流动曲线与层叠轮廓", "#231e2b", "#bda6c8"]
  ] as const).map(([id, name, description, background, ink]): CompositionDefinition => ({
    id, name, category: "背景", renderer: id === "background-grid" ? "three" : "canvas", description,
    tags: ["背景", "纹理", name], slots: [], defaultDurationUs: 6_000_000,
    defaultText: "", defaultColor: "#ffffff", defaultAccentColor: "#5fa8ff",
    defaultParams: { background, gridColor: ink, travel: 0.35, density: 1, lineWidth: 1 },
    recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0 }
  }))
];

export function isBackgroundComposition(id: string) {
  return mediaComposition(id)?.category === "背景" || importedOverlayStudioBackgroundIds.includes(id);
}

export function isSequencedMediaComposition(id: string) {
  return SEQUENCED_MEDIA_COMPOSITION_SPECS.some(([compositionId]) => compositionId === id);
}

export function slotAccepts(slot: CompositionSlot, kind: MediaAsset["kind"] | undefined) {
  if (slot.kind === "video") return kind === "video";
  return kind === "image" || (slot.kind === "visual" && kind === "video");
}

export function compositionLayer(clip: Pick<CompositionClip, "compositionId" | "zIndex" | "recipe">) {
  return normalizeLayer(clip.zIndex, isBackgroundComposition(clip.compositionId) || clip.recipe?.sceneBackground ? DEFAULT_BACKGROUND_LAYER : DEFAULT_EFFECT_LAYER);
}

export function mediaComposition(id: string) {
  return MEDIA_COMPOSITIONS.find((definition) => definition.id === id);
}

export function compositionSlots(id: string): readonly CompositionSlot[] {
  if (id === "focus-card") return FOCUS_CARD_SLOTS;
  return shotcraftShot(id)?.slots ?? mediaComposition(id)?.slots ?? overlayStudioMediaSlots(id);
}

export function aiCompositionSlots(id: string): readonly CompositionSlot[] {
  if (id === "focus-card") return FOCUS_CARD_SLOTS;
  return shotcraftShot(id)?.slots ?? mediaComposition(id)?.slots ?? overlayStudioAiMediaSlots(id);
}

export function normalizeBindings(value: unknown): CompositionBinding[] {
  if (value === undefined) return [];
  const result = bindingSchema.safeParse(value);
  if (!result.success) throw new Error("动效素材槽格式无效，请检查工程文件或重新绑定素材");
  const ids = result.data.map((binding) => binding.slotId);
  if (new Set(ids).size !== ids.length) throw new Error("动效素材槽重复，请检查工程文件");
  return result.data;
}

export function compositionBindingIssues(clip: Pick<CompositionClip, "compositionId" | "bindings">, assets: readonly MediaAsset[]): string[] {
  const slots = compositionSlots(clip.compositionId);
  const bindings = clip.bindings ?? [];
  const issues: string[] = [];
  for (const binding of bindings) {
    if (!slots.some((slot) => slot.id === binding.slotId)) issues.push(`未知素材槽：${binding.slotId}`);
  }
  for (const slot of slots) {
    const ids = bindings.find((binding) => binding.slotId === slot.id)?.assetIds ?? [];
    if (ids.length < slot.minItems || ids.length > slot.maxItems) issues.push(`${slot.label}需要 ${slot.minItems === slot.maxItems ? slot.minItems : `${slot.minItems}–${slot.maxItems}`} ${slot.kind === "image" ? "张图片" : slot.kind === "video" ? "个视频" : "个图片或视频"}`);
    for (const id of ids) {
      const asset = assets.find((candidate) => candidate.id === id);
      if (!asset || asset.missing) issues.push(`${slot.label}素材缺失，请重新定位或替换`);
      else if (!slotAccepts(slot, asset.kind)) issues.push(`${slot.label}只接受${slot.kind === "image" ? "图片" : slot.kind === "video" ? "视频" : "图片或视频"}`);
    }
  }
  return issues;
}

export function compositionAssetIds(clip: Pick<CompositionClip, "compositionId" | "bindings">): string[] {
  return compositionSlots(clip.compositionId).flatMap((slot) => clip.bindings?.find((binding) => binding.slotId === slot.id)?.assetIds ?? []);
}

export function compositionNumber(params: CompositionParams | undefined, key: string, fallback: number, min: number, max: number) {
  const value = params?.[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

export function compositionTimeUs(clip: Pick<CompositionClip, "sourceOffsetUs" | "speed">, localUs: number) {
  return Math.max(0, Math.round((clip.sourceOffsetUs ?? 0) + localUs * clip.speed));
}

export function compositionRetimeBounds(clip: CompositionClip) {
  const definition = mediaComposition(clip.compositionId);
  if (isSequencedMediaComposition(clip.compositionId)) return { min: 2_000_000, max: 10_000_000 };
  if (definition || clip.recipe?.sceneBackground) return { min: 250_000, max: Number.MAX_SAFE_INTEGER };
  return { min: Math.max(250_000, Math.ceil(clip.durationUs * clip.speed / 3)), max: Math.floor(clip.durationUs * clip.speed / 0.25) };
}

export function sceneGroupRetimeRatio(members: readonly (CompositionClip | SceneClip)[], requestedRatio: number) {
  const bounds = members.map(clip => clip.kind === "composition" ? compositionRetimeBounds(clip) : { min: 100_000, max: Number.MAX_SAFE_INTEGER });
  // Already-trimmed members may be shorter than authoring limits; keep a ratio of one valid.
  const min = Math.max(...bounds.map((bound, index) => Math.min(1, bound.min / members[index].durationUs)));
  const max = Math.min(...bounds.map((bound, index) => Math.max(1, bound.max / members[index].durationUs)));
  return Math.max(min, Math.min(max, requestedRatio));
}

export function compositionTransformPatch(clip: Pick<CompositionClip, "transform" | "transformKeyframes">, localUs: number, patch: Partial<TransformProps>): Partial<CompositionClip> {
  const current = visualTransformAt(clip.transform, clip.transformKeyframes, localUs);
  if (!clip.transformKeyframes?.length) return { transform: { ...current, ...patch } };
  return {
    transform: { ...clip.transform, rotation: patch.rotation ?? current.rotation, opacity: patch.opacity ?? current.opacity },
    transformKeyframes: upsertVisualKeyframe(clip.transformKeyframes, localUs, { ...current, ...patch })
  };
}

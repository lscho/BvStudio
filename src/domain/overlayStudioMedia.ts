import type { CompositionBinding, CompositionSlot } from "@/domain/compositions";
import type { CompositionParams } from "@/domain/effects";

export interface OverlayStudioMediaSource {
  id: string;
  kind: "image" | "video";
  url: string;
}

type MediaControlMode = "hidden" | "metadata" | "hybrid";

interface MediaSlotSpec extends CompositionSlot {
  paramKeys?: readonly string[];
  preserveUnbound?: boolean;
}

interface MediaEffectSpec {
  slots: readonly MediaSlotSpec[];
  paramKeys: readonly string[];
  controlModes?: Readonly<Record<string, MediaControlMode>>;
  controlLabels?: Readonly<Record<string, string>>;
  resolve?: (params: CompositionParams, sources: Readonly<Record<string, OverlayStudioMediaSource[]>>) => CompositionParams;
}

const slot = (
  id: string,
  label: string,
  kind: CompositionSlot["kind"],
  maxItems: number,
  paramKeys?: readonly string[],
  preserveUnbound = false
): MediaSlotSpec => ({ id, label, kind, minItems: 0, maxItems, paramKeys, preserveUnbound });

const direct = (
  slotSpec: MediaSlotSpec,
  controlModes?: MediaEffectSpec["controlModes"],
  controlLabels?: MediaEffectSpec["controlLabels"]
): MediaEffectSpec => ({ slots: [slotSpec], paramKeys: slotSpec.paramKeys ?? [], controlModes, controlLabels });

function structuredRows(value: CompositionParams[string] | undefined) {
  return typeof value === "string" ? value.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}

function timingAndLabel(line: string) {
  const parts = line.split("|").map((part) => part.trim());
  if (parts.length >= 3) return { start: parts[1] || "0", label: parts.slice(2).join("|") };
  if (parts.length === 2 && Number.isFinite(Number(parts[0]))) return { start: parts[0] || "0", label: parts[1] };
  return { start: "0", label: parts.at(-1) ?? "" };
}

function rebuildStructuredMedia(value: CompositionParams[string] | undefined, sources: readonly OverlayStudioMediaSource[]) {
  const metadata = structuredRows(value).map(timingAndLabel);
  return sources.map((source, index) => {
    const row = metadata[index] ?? { start: "0", label: "" };
    return `${source.url}|${row.start}|${row.label}`;
  }).join("\n");
}

function resolveDemoTour(params: CompositionParams, sources: Readonly<Record<string, OverlayStudioMediaSource[]>>) {
  const source = sources.demo?.[0];
  return {
    ...params,
    videoSrc: source?.kind === "video" ? source.url : "",
    imgSrc: source?.kind === "image" ? source.url : "",
    camSrc: sources.presenter?.[0]?.url ?? ""
  };
}

function resolvePhoneShot(params: CompositionParams, sources: Readonly<Record<string, OverlayStudioMediaSource[]>>) {
  const media = sources.phone ?? [];
  return { ...params, videoSrc: "", img1: media[0]?.url ?? "", img2: media[1]?.url ?? "", img3: media[2]?.url ?? "" };
}

function resolveClipParade(params: CompositionParams, sources: Readonly<Record<string, OverlayStudioMediaSource[]>>) {
  const media = sources.media ?? [];
  return {
    ...params,
    img1: media[0]?.url ?? "",
    img2: media[1]?.url ?? "",
    img3: media[2]?.url ?? "",
    tiles: rebuildStructuredMedia(params.tiles, media)
  };
}

function resolveVideoShowcase(params: CompositionParams, sources: Readonly<Record<string, OverlayStudioMediaSource[]>>) {
  return { ...params, clips: rebuildStructuredMedia(params.clips, sources.clips ?? []) };
}

function resolveIconSwarm(params: CompositionParams, sources: Readonly<Record<string, OverlayStudioMediaSource[]>>) {
  const media = sources.icons ?? [];
  const rows = structuredRows(params.items);
  const count = Math.max(rows.length, media.length);
  return {
    ...params,
    items: Array.from({ length: count }, (_, index) => {
      const [text = `素材 ${index + 1}`, icon = ""] = (rows[index] ?? "").split("|").map((part) => part.trim());
      return `${text}|${media[index]?.url ?? icon}`;
    }).join("\n")
  };
}

function resolveInfoBoard(params: CompositionParams, sources: Readonly<Record<string, OverlayStudioMediaSource[]>>) {
  const queue = [...(sources.media ?? [])];
  const rows = structuredRows(params.rows).map((line) => {
    const fields = line.split("|").map((part) => part.trim());
    const type = (fields[0] ?? "").split("@")[0];
    if ((type === "ent" || type === "img") && queue.length > 0) fields[1] = queue.shift()!.url;
    if (type === "icons" && queue.length > 0) {
      const entries = (fields[1] ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
      fields[1] = entries.map((entry) => {
        if (queue.length === 0) return entry;
        const space = entry.indexOf(" ");
        const label = space > 0 ? entry.slice(space + 1).trim() : "";
        return `${queue.shift()!.url}${label ? ` ${label}` : ""}`;
      }).join(",");
    }
    return fields.join("|");
  });
  while (queue.length > 0) rows.push(`img|${queue.shift()!.url}||`);
  return { ...params, rows: rows.join("\n") };
}

const mediaSpecs = {
  "cam-pan": direct(slot("recording", "录屏", "video", 1, ["videoSrc"])),
  "screen-demo": {
    slots: [slot("recording", "演示录屏", "video", 1, ["videoSrc"]), slot("presenter", "口播视频", "video", 1, ["camSrc"])],
    paramKeys: ["videoSrc", "camSrc"]
  },
  "demo-tour": {
    slots: [slot("demo", "巡览素材", "visual", 1), slot("presenter", "口播视频", "video", 1)],
    paramKeys: ["videoSrc", "imgSrc", "camSrc"],
    resolve: resolveDemoTour
  },
  "demo-rail": direct(slot("recordings", "录屏片段", "visual", 3, ["videoSrc", "videoSrc2", "videoSrc3"])),
  "ghost-video": direct(slot("reference", "参考素材", "visual", 1, ["src"])),
  "doc-scroll": direct(slot("document", "文档长截图", "image", 1, ["img1"])),
  "phone-shot": { slots: [slot("phone", "手机内容", "visual", 3)], paramKeys: ["img1", "img2", "img3", "videoSrc"], resolve: resolvePhoneShot },
  "proof-shot": direct(slot("proof", "证据素材", "visual", 3, ["img1", "img2", "img3"])),
  "proof-wall": direct(slot("proof", "证据素材", "visual", 10, Array.from({ length: 10 }, (_, index) => `img${index + 1}`))),
  "photo-halo": direct(slot("photos", "环绕素材", "visual", 6, Array.from({ length: 6 }, (_, index) => `img${index + 1}`))),
  "cover-stack": direct(slot("covers", "封面素材", "visual", 2, ["img1", "img2"])),
  "cover-flow": direct(slot("covers", "封面素材", "visual", 5, Array.from({ length: 5 }, (_, index) => `img${index + 1}`))),
  "clip-parade": {
    slots: [slot("media", "展示素材", "visual", 12)],
    paramKeys: ["img1", "img2", "img3", "tiles"],
    controlModes: { tiles: "metadata" },
    controlLabels: { tiles: "整墙素材设置（每行：起始秒|标签，顺序对应素材槽）" },
    resolve: resolveClipParade
  },
  "video-showcase": {
    slots: [slot("clips", "展台素材", "visual", 6)],
    paramKeys: ["clips"],
    controlModes: { clips: "metadata" },
    controlLabels: { clips: "素材设置（每行：起始秒|标签，顺序对应素材槽）" },
    resolve: resolveVideoShowcase
  },
  "icon-pop": direct(slot("icon", "App 图标", "image", 1, ["img1"])),
  "quote-cite": direct(slot("avatar", "头像", "image", 1, ["img1"])),
  "chat-volley": direct(slot("avatars", "头像与收尾图标", "image", 3, ["leftImg", "rightImg", "stampIcon"])),
  "clip-flow": direct(slot("zone-icon", "落袋区图标", "image", 1, ["zoneIcon"])),
  "cam-frame": direct(slot("presenter", "口播视频", "video", 1, ["camSrc"])),
  "punch-zoom": direct(slot("presenter", "口播视频", "video", 1, ["camSrc"])),
  "info-board": {
    slots: [slot("media", "信息板图片", "visual", 12)],
    paramKeys: ["rows"],
    controlModes: { rows: "hybrid" },
    controlLabels: { rows: "板上各行（图片行按上方素材顺序填充）" },
    resolve: resolveInfoBoard
  },
  "icon-swarm": {
    slots: [slot("icons", "词条图片图标", "image", 8)],
    paramKeys: ["items"],
    controlModes: { items: "hybrid" },
    controlLabels: { items: "词条（每行：文字|矢量图标名；图片按素材顺序覆盖）" },
    resolve: resolveIconSwarm
  },
  "hand-lift": {
    slots: [slot("icons", "托举图片图标", "image", 2, ["leftIcon", "rightIcon"], true)],
    paramKeys: ["leftIcon", "rightIcon"],
    controlModes: { leftIcon: "hybrid", rightIcon: "hybrid" },
    controlLabels: { leftIcon: "左侧矢量图标名（图片使用素材槽）", rightIcon: "右侧矢量图标名（图片使用素材槽）" }
  }
} as const satisfies Readonly<Record<string, MediaEffectSpec>>;

const aiRequiredSlotIds = {
  "cam-pan": ["recording"],
  "screen-demo": ["recording"],
  "demo-tour": ["demo"],
  "demo-rail": ["recordings"],
  "ghost-video": ["reference"],
  "doc-scroll": ["document"],
  "phone-shot": ["phone"],
  "proof-shot": ["proof"],
  "proof-wall": ["proof"],
  "photo-halo": ["photos"],
  "cover-stack": ["covers"],
  "cover-flow": ["covers"],
  "clip-parade": ["media"],
  "video-showcase": ["clips"],
  "icon-pop": ["icon"],
  "quote-cite": ["avatar"],
  "chat-volley": ["avatars"],
  "clip-flow": ["zone-icon"],
  "cam-frame": ["presenter"],
  "punch-zoom": ["presenter"]
} as const satisfies Readonly<Partial<Record<keyof typeof mediaSpecs, readonly string[]>>>;

export const overlayStudioMediaEffectIds = Object.keys(mediaSpecs);

function mediaSpec(compositionId: string): MediaEffectSpec | undefined {
  return mediaSpecs[compositionId as keyof typeof mediaSpecs];
}

export function overlayStudioMediaSlots(compositionId: string): readonly CompositionSlot[] {
  return mediaSpec(compositionId)?.slots ?? [];
}

/** AI may only select material-driven effects when the project can supply their essential slots. */
export function overlayStudioAiMediaSlots(compositionId: string): readonly CompositionSlot[] {
  const slots = overlayStudioMediaSlots(compositionId);
  const required = new Set<string>(aiRequiredSlotIds[compositionId as keyof typeof aiRequiredSlotIds] ?? []);
  return slots.map((mediaSlot) => required.has(mediaSlot.id) ? { ...mediaSlot, minItems: 1 } : mediaSlot);
}

export function overlayStudioMediaParamKeys(compositionId: string): readonly string[] {
  return mediaSpec(compositionId)?.paramKeys ?? [];
}

export function overlayStudioMediaControlMode(compositionId: string, field: string): MediaControlMode | undefined {
  const spec = mediaSpec(compositionId);
  if (!spec?.paramKeys.includes(field)) return undefined;
  return spec.controlModes?.[field] ?? "hidden";
}

export function overlayStudioMediaControlLabel(compositionId: string, field: string) {
  return mediaSpec(compositionId)?.controlLabels?.[field];
}

function runtimeUrl(source: OverlayStudioMediaSource | undefined) {
  if (!source?.url) return undefined;
  if (source.kind !== "video" || /\.(mp4|mov|webm|m4v)(?:[?#]|$)/iu.test(source.url)) return source;
  if (source.url.startsWith("data:image/")) return { ...source, url: "" };
  return { ...source, url: `${source.url}#bvideo-video` };
}

export function resolveOverlayStudioMediaParams(
  compositionId: string,
  params: CompositionParams | undefined,
  bindings: readonly CompositionBinding[] | undefined,
  sourceForAsset: (assetId: string) => OverlayStudioMediaSource | undefined
): CompositionParams {
  const spec = mediaSpec(compositionId);
  const result: CompositionParams = { ...(params ?? {}) };
  if (!spec) return result;
  const sources: Record<string, OverlayStudioMediaSource[]> = {};
  for (const mediaSlot of spec.slots) {
    const ids = bindings?.find((binding) => binding.slotId === mediaSlot.id)?.assetIds ?? [];
    const resolved = ids.map((id) => runtimeUrl(sourceForAsset(id))).filter((source): source is OverlayStudioMediaSource => Boolean(source?.url));
    sources[mediaSlot.id] = resolved;
    if (!mediaSlot.paramKeys) continue;
    mediaSlot.paramKeys.forEach((key, index) => {
      if (resolved[index]) result[key] = resolved[index].url;
      else if (!mediaSlot.preserveUnbound) result[key] = "";
    });
  }
  return spec.resolve ? spec.resolve(result, sources) : result;
}

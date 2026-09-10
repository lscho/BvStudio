import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CompositionClip } from "@/domain/project";
import { libraryShot } from "@/domain/shotcraftLibrary/catalog";
import { libraryLoaders, type DemoFactory } from "@/compositions/shotcraftLibrary/loaders";
import { ShotcraftFrameContext, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";
import type { ShotcraftAsset } from "@/compositions/shotcraft";

const factories = new Map<string, DemoFactory>();
const pending = new Map<string, Promise<void>>();

function useStageSize(width: number, height: number, ready: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width, height });
  useLayoutEffect(() => {
    const stage = ref.current;
    if (!stage) return;
    const measure = () => {
      const nextWidth = stage.clientWidth;
      const nextHeight = stage.clientHeight;
      if (nextWidth <= 0 || nextHeight <= 0) return;
      setSize((current) => current.width === nextWidth && current.height === nextHeight ? current : { width: nextWidth, height: nextHeight });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [width, height, ready]);
  return { ref, size };
}

export function preloadLibraryShot(id: string): Promise<void> {
  if (!libraryLoaders[id] || factories.has(id)) return Promise.resolve();
  const request = pending.get(id) ?? libraryLoaders[id]().then((module) => { factories.set(id, module.createDemo); }).catch((error: unknown) => { pending.delete(id); throw error; });
  pending.set(id, request);
  return request;
}
export function LibraryScene({ clip, assets, frame, width, height, outgoing, incoming, appearance }: {
  clip: CompositionClip; assets: readonly ShotcraftAsset[]; frame: number; width: number; height: number; outgoing?: ReactNode; incoming?: ReactNode; appearance?: ShotcraftContent["appearance"];
}) {
  const shot = libraryShot(clip.compositionId);
  const [loaded, setLoaded] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => { let active = true; setError(""); preloadLibraryShot(clip.compositionId).then(() => { if (active) setLoaded((n) => n + 1); }).catch(() => { if (active) setError("镜头加载失败，请重新打开工程"); }); return () => { active = false; }; }, [clip.compositionId]);
  const content = useMemo<ShotcraftContent>(() => ({
    texts: Object.fromEntries((shot?.texts ?? []).map((field, index) => [field.key, typeof clip.params?.[field.key] === "string" ? String(clip.params[field.key]) : index === 0 && clip.text ? clip.text : field.default])),
    imageKeys: shot?.imageKeys ?? [],
    images: (clip.bindings?.find((binding) => binding.slotId === "images")?.assetIds ?? []).map((id) => assets.find((asset) => asset.id === id)?.objectUrl ?? ""),
    imageSizes: (clip.bindings?.find((binding) => binding.slotId === "images")?.assetIds ?? []).map((id) => { const asset = assets.find((item) => item.id === id); return { width: asset?.width ?? 1920, height: asset?.height ?? 1080 }; }),
    regions: clip.shotcraft?.regions,
    appearance,
    brandMark: assets.find((asset) => asset.id === clip.bindings?.find((binding) => binding.slotId === "logo")?.assetIds[0])?.objectUrl,
    outgoing, incoming, linked: Boolean(outgoing && incoming)
  }), [shot, clip.params, clip.text, clip.bindings, clip.shotcraft?.regions, assets, outgoing, incoming, appearance]);
  const textKey = JSON.stringify({ texts: content.texts, regions: content.regions, imageSizes: content.imageSizes, appearance: content.appearance });
  const linked = content.linked;
  const Component = useMemo(() => factories.get(clip.compositionId)?.({ ...JSON.parse(textKey) as Pick<ShotcraftContent, "texts" | "regions" | "imageSizes" | "appearance">, images: [], imageKeys: [], linked }), [clip.compositionId, textKey, loaded, linked]);
  const stage = useStageSize(width, height, Boolean(Component));
  if (!shot) return null;
  if (!Component) return <div className="shotcraft-missing" role={error ? "alert" : "status"}>{error || "正在加载镜头"}</div>;
  const scale = Math.min(stage.size.width / 1920, stage.size.height / 1080);
  return <ShotcraftFrameContext.Provider value={{ ...content, frame, durationInFrames: shot.frames, width: 1920, height: 1080 }}>
    <div ref={stage.ref} data-shotcraft-stage style={{ position: "absolute", width: "100%", height: "100%", overflow: "hidden", textAlign: "left" }}><div data-shotcraft-design-stage style={{ position: "absolute", width: 1920, height: 1080, left: "50%", top: "50%", transform: `translate(-50%, -50%) scale(${linked ? `${stage.size.width / 1920}, ${stage.size.height / 1080}` : scale})`, transformOrigin: "center", overflow: "hidden" }}><Component /></div></div>
  </ShotcraftFrameContext.Provider>;
}

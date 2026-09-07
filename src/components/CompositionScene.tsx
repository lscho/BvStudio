import { useEffect, useRef, useState } from "react";
import { Images } from "lucide-react";
import type { CompositionClip, MediaAsset } from "@/domain/project";
import { compositionAssetIds, compositionBindingIssues, compositionTimeUs } from "@/domain/compositions";
import type { MediaCompositionRenderer } from "@/compositions/threeRenderer";

export function CompositionScene({ clip, assets, width, height, localUs, selected, onSelect }: {
  clip: CompositionClip;
  assets: readonly MediaAsset[];
  width: number;
  height: number;
  localUs: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<MediaCompositionRenderer | null>(null);
  const latest = useRef({ clip, localUs });
  latest.current = { clip, localUs };
  const [status, setStatus] = useState("正在加载素材");
  const issues = compositionBindingIssues(clip, assets);
  const sources = compositionAssetIds(clip).map((id) => {
    const asset = assets.find((asset) => asset.id === id);
    return { id, url: asset?.objectUrl ?? "", kind: asset?.kind === "video" ? "video" as const : "image" as const };
  });
  const requestFrame = useRef<(() => void) | null>(null);
  const sourceKey = JSON.stringify(sources);
  const paramsKey = JSON.stringify(clip.params ?? {});
  const issueText = issues[0] ?? (sources.some((source) => !source.url) ? "素材暂不可用，请重新导入素材" : "");
  useEffect(() => {
    if (issueText) return;
    const controller = new AbortController();
    let instance: MediaCompositionRenderer | undefined;
    setStatus("正在加载素材");
    void import("@/compositions/threeRenderer").then(({ createMediaCompositionRenderer }) => createMediaCompositionRenderer(width, height, sources, clip.params, controller.signal, clip.compositionId)).then((renderer) => {
      if (controller.signal.aborted) { renderer.dispose(); return; }
      instance = renderer;
      rendererRef.current = renderer;
      host.current?.append(renderer.canvas);
      let busy = false;
      let pending = false;
      const draw = async () => {
        if (busy) { pending = true; return; }
        busy = true;
        try {
          do {
            pending = false;
            const current = latest.current;
            const time = compositionTimeUs(current.clip, current.localUs);
            const duration = current.clip.animationDurationUs ?? current.clip.durationUs;
            await renderer.prepareFrame?.(time, duration);
            if (controller.signal.aborted) return;
            renderer.render(time, duration);
            setStatus("");
          } while (pending && !controller.signal.aborted);
        } catch {
          if (!controller.signal.aborted) setStatus("素材帧读取失败，请检查视频格式或重新导入");
        } finally { busy = false; }
      };
      requestFrame.current = () => { void draw(); };
      requestFrame.current();
    }).catch(() => {
      if (!controller.signal.aborted) setStatus("场景加载失败，请检查素材并确认硬件加速可用");
    });
    return () => {
      controller.abort();
      rendererRef.current = null;
      requestFrame.current = null;
      if (instance) { instance.canvas.remove(); instance.dispose(); }
    };
    // Serialized inputs avoid reloading textures on each timeline tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, paramsKey, width, height, issueText, clip.compositionId]);
  useEffect(() => {
    requestFrame.current?.();
  }, [clip, localUs]);
  return <div className="composition-scene">
    <div className="composition-render-host" ref={host} />
    {(issueText || status) && <div className="composition-scene-status" role={issueText ? "status" : undefined}><Images size={28} /><strong>{clip.label}</strong><span>{issueText || status}</span></div>}
    <button type="button" className="composition-scene-select" aria-label={`选择 ${clip.label}`} aria-pressed={selected} onClick={onSelect} />
  </div>;
}

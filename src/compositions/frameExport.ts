import type { RenderPlan, RenderTextOverlay } from "@/services/media";
import { localMediaUrl } from "@/services/media";
import { desktopCompositionFrames, type CompositionFrameSink } from "@/services/compositionFrames";
import { visualTransformAt } from "@/domain/transforms";

export interface CompositionExportOptions {
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
  sink?: CompositionFrameSink;
  sequences: string[];
}

export async function streamCompositionFrames(overlay: RenderTextOverlay, plan: RenderPlan, options: CompositionExportOptions): Promise<RenderTextOverlay> {
  const { createMediaCompositionRenderer } = await import("@/compositions/threeRenderer");
  options.signal?.throwIfAborted();
  const renderer = await createMediaCompositionRenderer(plan.width, plan.height, (overlay.compositionImages ?? []).map((source) => ({ id: source.id, kind: source.kind, url: localMediaUrl(source.path) })), overlay.params, options.signal, overlay.compositionId);
  const sink = options.sink ?? desktopCompositionFrames;
  try {
    const id = await sink.begin();
    options.sequences.push(id);
    const fps = Math.max(1, Math.min(120, plan.fps));
    const total = Math.ceil(overlay.durationUs / 1_000_000 * fps);
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建导出画布");
    for (let index = 0; index < total; index += 1) {
      options.signal?.throwIfAborted();
      const localUs = Math.round(index / fps * 1_000_000);
      const sourceTimeUs = (overlay.sourceOffsetUs ?? 0) + localUs * overlay.speed;
      const durationUs = overlay.animationDurationUs ?? overlay.durationUs;
      await renderer.prepareFrame?.(sourceTimeUs, durationUs);
      options.signal?.throwIfAborted();
      renderer.render(sourceTimeUs, durationUs);
      const transform = visualTransformAt(overlay, overlay.transformKeyframes, localUs);
      context.clearRect(0, 0, plan.width, plan.height);
      context.save();
      context.translate(plan.width * transform.x / 100, plan.height * transform.y / 100);
      context.rotate(transform.rotation * Math.PI / 180);
      context.scale(transform.scale, transform.scale);
      context.globalAlpha = transform.opacity;
      context.drawImage(renderer.canvas, -plan.width / 2, -plan.height / 2);
      context.restore();
      const data = canvas.toDataURL("image/png").split(",")[1];
      await sink.append(id, index, data);
      options.onProgress?.(index + 1, total);
    }
    // Scene transforms are baked into the full-frame PNGs; FFmpeg must not apply them again.
    return { ...overlay, sequenceId: id, sequenceFps: fps, compositionImages: undefined, x: 50, y: 50, scale: 1, rotation: 0, transformKeyframes: undefined, opacity: 1, speed: 1 };
  } finally {
    renderer.dispose();
  }
}

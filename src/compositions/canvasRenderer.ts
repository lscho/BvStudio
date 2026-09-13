import type { CompositionParams } from "@/domain/effects";
import { compositionNumber, isBackgroundComposition, isSequencedMediaComposition } from "@/domain/compositions";
import { compositionMediaTimeUs, compositionMomentum, compositionSegment } from "@/domain/compositionPlayback";
import { focusCardMediaRect, focusCardMoveProgress, type FocusCardRect } from "@/domain/focusCard";
import { loadCompositionVideo, releaseCompositionVideo, seekCompositionVideo } from "@/services/compositionVideo";
import type { CompositionImageSource, MediaCompositionRenderer } from "@/compositions/threeRenderer";

export function backgroundDotVisual(timeUs: number, xRatio: number, yRatio: number, travel: number) {
  const phase = timeUs / 1_000_000 * (0.65 + travel * 1.4) * Math.PI * 2;
  const wave = (Math.sin(xRatio * Math.PI * 5 + yRatio * Math.PI * 4 - phase) + 1) / 2;
  return {
    radiusScale: 0.55 + wave * 0.65,
    opacity: 0.4 + wave * 0.6
  };
}

export async function createCanvasCompositionRenderer(width: number, height: number, sources: readonly CompositionImageSource[], params: CompositionParams, signal: AbortSignal | undefined, id: string): Promise<MediaCompositionRenderer> {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建动效画布");
  const media: (HTMLImageElement | HTMLVideoElement)[] = [];
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const dispose = () => {
    controller.abort(); signal?.removeEventListener("abort", abort);
    media.forEach((item) => { if (item instanceof HTMLVideoElement) releaseCompositionVideo(item); });
  };
  try {
    signal?.throwIfAborted();
    for (const source of sources) {
      controller.signal.throwIfAborted();
      if (source.kind === "video") media.push(await loadCompositionVideo(source.url, controller.signal));
      else {
        const image = new Image(); image.crossOrigin = "anonymous"; image.src = source.url;
        await image.decode(); controller.signal.throwIfAborted(); media.push(image);
      }
    }
    const travel = compositionNumber(params, "travel", 0.65, 0, 1);
    const spacing = compositionNumber(params, "spacing", 1, 0.8, 1.6);
    const color = (key: string, fallback: string) => typeof params[key] === "string" && /^#[0-9a-f]{6}$/iu.test(params[key]) ? params[key] : fallback;
    const drawMedia = (index: number, x: number, y: number, w: number, h: number, scale = 1, rotation = 0, opacity = 1, fitOverride?: "cover" | "contain", filter = "none") => {
      const item = media[index]; if (!item) return;
      const sourceW = item instanceof HTMLVideoElement ? item.videoWidth : item.naturalWidth;
      const sourceH = item instanceof HTMLVideoElement ? item.videoHeight : item.naturalHeight;
      const fit = fitOverride ?? (params.fit === "cover" ? "cover" : "contain");
      const ratio = (fit === "cover" ? Math.max : Math.min)(w / sourceW, h / sourceH);
      context.save(); context.translate(x, y); context.rotate(rotation); context.scale(scale, scale); context.globalAlpha = opacity;
      context.filter = filter;
      context.beginPath(); context.rect(-w / 2, -h / 2, w, h); context.clip();
      context.drawImage(item, -sourceW * ratio / 2, -sourceH * ratio / 2, sourceW * ratio, sourceH * ratio);
      context.restore();
    };
    const drawFocusMedia = (timeUs: number) => {
      const item = media[0];
      if (!item) return;
      const source = ["focusSourceX", "focusSourceY", "focusSourceWidth", "focusSourceHeight", "focusSourceRadius"].every((key) => typeof params[key] === "number") ? {
        x: params.focusSourceX,
        y: params.focusSourceY,
        width: params.focusSourceWidth,
        height: params.focusSourceHeight,
        radius: params.focusSourceRadius
      } as FocusCardRect : undefined;
      const rect = focusCardMediaRect(params, width, height, timeUs, source);
      const sourceW = item instanceof HTMLVideoElement ? item.videoWidth : item.naturalWidth;
      const sourceH = item instanceof HTMLVideoElement ? item.videoHeight : item.naturalHeight;
      const ratio = Math.max(rect.width / sourceW, rect.height / sourceH);
      const radius = Math.max(0, Math.min(rect.radius, rect.width / 2, rect.height / 2));
      const roundedRect = () => {
        context.beginPath();
        context.moveTo(rect.x + radius, rect.y);
        context.lineTo(rect.x + rect.width - radius, rect.y);
        context.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + radius);
        context.lineTo(rect.x + rect.width, rect.y + rect.height - radius);
        context.quadraticCurveTo(rect.x + rect.width, rect.y + rect.height, rect.x + rect.width - radius, rect.y + rect.height);
        context.lineTo(rect.x + radius, rect.y + rect.height);
        context.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - radius);
        context.lineTo(rect.x, rect.y + radius);
        context.quadraticCurveTo(rect.x, rect.y, rect.x + radius, rect.y);
        context.closePath();
      };
      context.save();
      roundedRect();
      context.clip();
      const focusX = compositionNumber(params, "focusMediaFocusX", 50, 0, 100) / 100;
      const focusY = compositionNumber(params, "focusMediaFocusY", 50, 0, 100) / 100;
      context.drawImage(item, rect.x + (rect.width - sourceW * ratio) * focusX, rect.y + (rect.height - sourceH * ratio) * focusY, sourceW * ratio, sourceH * ratio);
      context.restore();
      if (params.showRing !== false) {
        context.save();
        roundedRect();
        context.globalAlpha = focusCardMoveProgress(params, timeUs);
        context.strokeStyle = color("focusMediaAccentColor", "#5fa8ff");
        context.lineWidth = Math.max(2, width / 640);
        context.stroke();
        context.restore();
      }
    };
    return {
      canvas, dispose,
      async prepareFrame(timeUs, durationUs) {
        for (let index = 0; index < media.length; index += 1) {
          const item = media[index];
          if (item instanceof HTMLVideoElement) {
            const mediaTimeUs = id === "focus-card-media"
              ? compositionNumber(params, "focusMediaSourceInUs", 0, 0, Number.MAX_SAFE_INTEGER) + timeUs / compositionNumber(params, "focusEffectSpeed", 1, 0.25, 3) * compositionNumber(params, "focusMediaPlaybackRate", 1, 0.25, 4)
              : compositionMediaTimeUs(id, index, timeUs, durationUs, media.length);
            await seekCompositionVideo(item, mediaTimeUs, controller.signal);
          }
        }
      },
      render(timeUs, durationUs) {
        context.clearRect(0, 0, width, height);
        const progress = Math.max(0, Math.min(1, timeUs / Math.max(1, durationUs)));
        if (id === "focus-card-media") {
          drawFocusMedia(timeUs);
          return;
        }
        if (isBackgroundComposition(id)) {
          context.fillStyle = color("background", "#191d20"); context.fillRect(0, 0, width, height);
          context.strokeStyle = color("gridColor", "#536169"); context.fillStyle = context.strokeStyle;
          const unit = Math.min(width, height) / 18 / compositionNumber(params, "density", 1, 0.5, 2);
          context.lineWidth = Math.max(1, Math.min(width, height) / 720 * compositionNumber(params, "lineWidth", 1, 0.5, 3));
          const phase = progress * travel * 4;
          if (id === "background-stripes") {
            context.beginPath();
            for (let x = -height - unit * 2; x < width + height; x += unit) { const at = x + phase % 1 * unit; context.moveTo(at, 0); context.lineTo(at + height * 0.6, height); }
            context.stroke();
          } else if (id === "background-dots") {
            for (let y = unit / 2; y < height; y += unit) for (let x = unit / 2; x < width; x += unit) {
              const dot = backgroundDotVisual(timeUs, x / width, y / height, travel);
              context.globalAlpha = dot.opacity;
              context.beginPath(); context.arc(x, y, unit * 0.065 * dot.radiusScale, 0, Math.PI * 2); context.fill();
            }
            context.globalAlpha = 1;
          } else {
            for (let row = -3; row < height / unit + 4; row += 1) {
              context.beginPath();
              for (let x = -10; x <= width + 10; x += 8) {
                const y = row * unit + Math.sin(x / width * 6 + phase + row * 0.12) * unit * 1.8 + Math.cos(x / width * 10 - phase * 0.5) * unit;
                if (x === -10) context.moveTo(x, y); else context.lineTo(x, y);
              }
              context.stroke();
            }
          }
          return;
        }
        if (id === "still-image-motion") {
          const blur = compositionNumber(params, "backgroundBlur", 18, 0, 40);
          const drift = (progress - 0.5) * travel;
          context.fillStyle = color("background", "#111316");
          context.fillRect(0, 0, width, height);
          drawMedia(0, width / 2, height / 2, width, height, 1.08 + progress * 0.035 * travel, 0, 0.48, "cover", `blur(${blur}px)`);
          context.fillStyle = "rgb(0 0 0 / 0.22)";
          context.fillRect(0, 0, width, height);
          const fit = params.fit === "cover" ? "cover" : "contain";
          const frameWidth = fit === "cover" ? width : width * 0.94;
          const frameHeight = fit === "cover" ? height : height * 0.92;
          drawMedia(0, width / 2 + drift * width * 0.035, height / 2 - drift * height * 0.02, frameWidth, frameHeight, 1 + progress * 0.045 * travel, 0, 1, fit);
          return;
        }
        const segment = compositionSegment(timeUs, durationUs, media.length);
        if (isSequencedMediaComposition(id) && typeof params.storyboardBackground === "string") {
          context.fillStyle = color("storyboardBackground", "#111316");
          context.fillRect(0, 0, width, height);
        }
        if (id === "motion-zoom") {
          const motion = compositionMomentum(segment.localUs, segment.durationUs, segment.index, media.length);
          drawMedia(segment.index, width / 2, height / 2, width, height, 1 + (motion.scale - 1) * travel);
        } else if (id === "slide-gallery") {
          const cursor = progress * Math.max(0, media.length - 1);
          media.forEach((_, index) => {
            const offset = index - cursor;
            const scale = 1 - Math.min(0.2, Math.abs(offset) * 0.12 * travel);
            drawMedia(index, width / 2 + offset * width * 0.7 * spacing, height / 2, width * 0.64, height * 0.8, scale);
          });
        } else if (id === "card-stack") {
          for (let index = Math.min(media.length - 1, segment.index + 2); index >= segment.index; index -= 1) {
            const depth = index - segment.index;
            const leave = index === segment.index && index < media.length - 1 ? Math.max(0, (segment.localUs / segment.durationUs - 0.65) / 0.35) : 0;
            drawMedia(index, width / 2 + depth * width * 0.025 - leave ** 2 * width, height / 2 + depth * height * 0.018, width * 0.7, height * 0.78, 1 - depth * 0.045, depth * 0.035 - leave * travel * 0.2, 1 - leave);
          }
        } else if (id === "split-reveal") {
          const vertical = width >= height;
          const cellW = vertical ? width / media.length : width;
          const cellH = vertical ? height : height / media.length;
          media.forEach((_, index) => {
            const reveal = 1 - (1 - Math.max(0, Math.min(1, (progress - index * 0.055) / 0.25))) ** 3;
            const x = vertical ? index * cellW : 0, y = vertical ? 0 : index * cellH;
            context.save(); context.beginPath(); context.rect(x, y, cellW, cellH * reveal); context.clip();
            drawMedia(index, x + cellW / 2, y + cellH / 2, cellW - width * 0.008, cellH - height * 0.008, 1 + (1 - reveal) * travel * 0.15);
            context.restore();
          });
        }
      }
    };
  } catch (error) { dispose(); throw error; }
}

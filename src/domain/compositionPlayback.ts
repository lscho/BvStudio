import { momentumTransitionVisualState } from "@/domain/videoPresentation";

export function compositionSegment(timeUs: number, durationUs: number, count: number) {
  const length = Math.max(1, count);
  const duration = Math.max(1, Math.round(durationUs));
  const time = Math.max(0, Math.min(duration - 1, Math.round(timeUs)));
  const index = Math.min(length - 1, Math.floor(time / duration * length));
  const startUs = Math.round(index * duration / length);
  const endUs = Math.round((index + 1) * duration / length);
  return { index, startUs, localUs: Math.max(0, time - startUs), durationUs: Math.max(1, endUs - startUs) };
}

export function compositionMediaTimeUs(id: string, index: number, timeUs: number, durationUs: number, count: number) {
  if (id === "motion-zoom" || id === "card-stack") return Math.max(0, timeUs - Math.round(index * durationUs / Math.max(1, count)));
  return Math.max(0, timeUs);
}

export function compositionMomentum(timeUs: number, durationUs: number, index: number, count: number) {
  const transition = { preset: "momentum-zoom" as const, durationUs: Math.min(400_000, Math.round(durationUs * 0.4)), easing: "ease-in-out" as const };
  return momentumTransitionVisualState({
    id: "preview", trackId: "preview", kind: "image", assetId: "preview", label: "", locked: false,
    startUs: 0, durationUs, speed: 1, entrance: "none", transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
    transition: index > 0 ? transition : { ...transition, preset: "none" }
  }, timeUs, index < count - 1 ? transition : undefined);
}

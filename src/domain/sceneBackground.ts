import type { CompositionClip, SceneClip, TimelineTrack } from "@/domain/project";

export function sceneBackgroundComposition(scene: SceneClip, trackId = scene.trackId): CompositionClip {
  const { kind: _kind, background, opacity, ...common } = scene;
  return {
    ...common, trackId, kind: "composition", text: "", color: background.primaryColor,
    accentColor: background.borderColor, fontSize: 48, speed: 1, bindings: [], sourceOffsetUs: 0,
    animationDurationUs: scene.durationUs, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity },
    recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0, sceneBackground: background },
    zIndex: 0
  };
}

export function migrateSceneTracks(tracks: readonly TimelineTrack[]): TimelineTrack[] {
  return tracks.flatMap((track) => {
    if (track.kind === "scene" && !track.clips.length) return [];
    return [{ ...track, kind: track.kind === "scene" ? "composition" as const : track.kind,
      name: track.kind === "scene" ? "背景动效" : track.name,
      clips: track.clips.map((clip) => clip.kind === "scene" ? sceneBackgroundComposition(clip, track.id) : clip)
    }];
  });
}

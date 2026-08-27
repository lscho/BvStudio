import { createEmptyProject, projectEndUs, type EditorProject } from "@/domain/project";
import { effectById } from "@/domain/effects";
import { cameraMotionForPreset } from "@/domain/camera";

export function serializeProject(project: EditorProject): string {
  const snapshot = structuredClone(project);
  for (const asset of snapshot.assets) {
    delete asset.objectUrl;
    delete asset.proxyPath;
    delete asset.proxyObjectUrl;
    delete asset.proxyHeight;
    delete asset.missing;
  }
  return JSON.stringify(snapshot, null, 2);
}

export function parseProject(contents: string): EditorProject {
  let raw: unknown;
  try {
    raw = JSON.parse(contents);
  } catch {
    throw new Error("工程文件不是有效的 JSON");
  }
  if (!raw || typeof raw !== "object") throw new Error("工程文件结构无效");
  const candidate = raw as Omit<Partial<EditorProject>, "schemaVersion"> & { schemaVersion?: number };
  if (![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(candidate.schemaVersion ?? -1)) throw new Error("不支持此工程文件版本");
  if (!Array.isArray(candidate.assets) || !Array.isArray(candidate.tracks) || !candidate.canvas) throw new Error("工程文件缺少素材、轨道或画布信息");
  const fallback = createEmptyProject();
  const tracks = candidate.tracks.map((track) => ({
    ...track,
    name: track.kind === "audio" && track.id === "audio-main" && track.name === "音频" ? "背景音乐" : track.name,
    locked: track.locked ?? false,
    muted: track.muted ?? false,
    hidden: track.hidden ?? false,
    audioRole: track.kind === "audio" ? track.audioRole ?? track.clips.find((clip) => clip.kind === "audio")?.role ?? "music" : undefined,
    clips: track.clips.map((clip) => clip.kind === "audio" ? {
      ...clip,
      sourceInUs: clip.sourceInUs ?? 0,
      playbackRate: clip.playbackRate ?? 1,
      volume: clip.volume ?? 1,
      fadeInUs: clip.fadeInUs ?? 0,
      fadeOutUs: clip.fadeOutUs ?? 0,
      role: clip.role ?? "music"
    } : clip.kind === "video" ? { ...clip, camera: clip.camera ?? cameraMotionForPreset("none") }
      : clip.kind === "effect" ? { ...clip, recipe: clip.recipe ?? structuredClone(effectById(clip.effectId).recipe) }
      : clip.kind === "generated" ? { ...clip, scenes: clip.scenes.map((scene) => ({
        ...scene,
        textColor: scene.textColor ?? "#ffffff",
        accentColor: scene.accentColor ?? (scene as typeof scene & { color?: string }).color ?? "#ffb84d",
        fontSize: scene.fontSize ?? 58,
        speed: scene.speed ?? 1,
        transform: scene.transform ?? { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
        mediaSourceInUs: scene.mediaSourceInUs ?? 0,
        mediaFit: scene.mediaFit ?? "cover",
        mediaVolume: scene.mediaVolume ?? 0,
        camera: scene.camera ?? cameraMotionForPreset("none"),
        recipe: scene.recipe ?? structuredClone(effectById(scene.effectId).recipe)
      })) }
      : clip.kind === "image" ? { ...clip, transform: clip.transform ?? { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, entrance: clip.entrance ?? "pop", speed: clip.speed ?? 1 }
        : clip)
  })) as EditorProject["tracks"];
  for (const fallbackTrack of fallback.tracks) {
    const exists = fallbackTrack.kind === "audio"
      ? tracks.some((track) => track.kind === "audio" && track.audioRole === fallbackTrack.audioRole)
      : tracks.some((track) => track.kind === fallbackTrack.kind);
    if (!exists) tracks.push(structuredClone(fallbackTrack));
  }
  const trackOrder = (track: EditorProject["tracks"][number]) => {
    if (track.kind === "video") return 0;
    if (track.kind === "image") return 1;
    if (track.kind === "generated") return 2;
    if (track.kind === "effect") return 3;
    if (track.kind === "subtitle") return 4;
    if (track.audioRole === "voice") return 5;
    if (track.audioRole === "music") return 6;
    return 7;
  };
  tracks.sort((left, right) => trackOrder(left) - trackOrder(right));
  const project = {
    ...fallback,
    ...candidate,
    schemaVersion: 9 as const,
    canvas: { ...fallback.canvas, ...candidate.canvas },
    assets: candidate.assets,
    tracks
  } as EditorProject;
  project.updatedAt = new Date().toISOString();
  project.durationUs = projectEndUs(project);
  return project;
}

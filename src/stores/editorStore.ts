import { create } from "zustand";
import { effectById, retrieveEffects } from "@/domain/effects";
import { cameraMotionForPreset } from "@/domain/camera";
import { timedTextSegments } from "@/domain/captions";
import {
  createEmptyProject,
  projectEndUs,
  type AudioClip,
  type AudioRole,
  type EditorProject,
  type EffectClip,
  type GeneratedBlock,
  type ImageClip,
  type InsertMode,
  type MediaAsset,
  type SubtitleClip,
  type TimelineClip,
  type VideoClip
} from "@/domain/project";
import type { AiVideoPlan } from "@/services/ai/schema";

interface EditorState {
  project: EditorProject;
  selectedClipId: string | null;
  selectedClipIds: string[];
  playheadUs: number;
  zoom: number;
  rangeStartUs: number | null;
  rangeEndUs: number | null;
  past: EditorProject[];
  future: EditorProject[];
  selectClip: (clipId: string | null, additive?: boolean) => void;
  setPlayhead: (timeUs: number) => void;
  setZoom: (zoom: number) => void;
  setRangeStart: (timeUs: number | null) => void;
  setRangeEnd: (timeUs: number | null) => void;
  clearRange: () => void;
  updateCanvas: (canvas: EditorProject["canvas"]) => void;
  addEffect: (effectId: string) => void;
  addVideo: (asset: MediaAsset) => void;
  addImage: (asset: MediaAsset) => void;
  addAudio: (asset: MediaAsset, role?: AudioRole, startUs?: number) => void;
  addExtractedAudio: (asset: MediaAsset, sourceVideoAssetId: string) => void;
  placeAsset: (assetId: string) => void;
  updateAsset: (assetId: string, patch: Partial<MediaAsset>) => void;
  replaceProject: (project: EditorProject) => void;
  addGeneratedPlan: (plan: AiVideoPlan, prompt: string, mode: InsertMode, target?: { startUs: number; durationUs?: number }) => void;
  updateEffect: (clipId: string, patch: Partial<EffectClip>) => void;
  updateVideo: (clipId: string, patch: Partial<VideoClip>) => void;
  updateImage: (clipId: string, patch: Partial<ImageClip>) => void;
  updateAudio: (clipId: string, patch: Partial<AudioClip>) => void;
  updateGenerated: (clipId: string, patch: Partial<GeneratedBlock>) => void;
  updateGeneratedScene: (clipId: string, sceneId: string, patch: Partial<GeneratedBlock["scenes"][number]>) => void;
  addSubtitles: (assetId: string, segments: Array<{ startSeconds: number; endSeconds: number; text: string }>) => void;
  updateSubtitle: (clipId: string, patch: Partial<SubtitleClip>) => void;
  moveClips: (clipIds: string[], deltaUs: number) => void;
  trimClip: (clipId: string, edge: "start" | "end", deltaUs: number) => void;
  splitSelected: () => void;
  copySelected: () => void;
  pasteAtPlayhead: () => void;
  setTrackState: (trackId: string, patch: { locked?: boolean; muted?: boolean; hidden?: boolean }) => void;
  removeSelected: () => void;
  undo: () => void;
  redo: () => void;
  clipboard: TimelineClip[];
}

function cloneProject(project: EditorProject): EditorProject {
  return structuredClone(project);
}

function isSourceClip(clip: TimelineClip): clip is VideoClip | AudioClip {
  return clip.kind === "video" || clip.kind === "audio";
}

function findClip(project: EditorProject, clipId: string | null): TimelineClip | null {
  if (!clipId) return null;
  return project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === clipId) ?? null;
}

function trimGeneratedStart(clip: GeneratedBlock, deltaUs: number) {
  if (deltaUs < 0) {
    if (clip.scenes[0]) clip.scenes[0].durationUs -= deltaUs;
    return;
  }
  let remaining = deltaUs;
  const scenes = [] as GeneratedBlock["scenes"];
  for (const scene of clip.scenes) {
    if (remaining >= scene.durationUs) {
      remaining -= scene.durationUs;
    } else {
      scenes.push({ ...scene, durationUs: scene.durationUs - remaining });
      remaining = 0;
    }
  }
  clip.scenes = scenes.length ? scenes : clip.scenes.slice(-1).map((scene) => ({ ...scene, durationUs: 100_000 }));
}

function trimGeneratedEnd(clip: GeneratedBlock, targetDurationUs: number) {
  let remaining = targetDurationUs;
  const scenes = [] as GeneratedBlock["scenes"];
  for (const scene of clip.scenes) {
    if (remaining <= 0) break;
    const durationUs = Math.min(scene.durationUs, remaining);
    scenes.push({ ...scene, durationUs });
    remaining -= durationUs;
  }
  if (remaining > 0 && scenes.length) scenes[scenes.length - 1].durationUs += remaining;
  clip.scenes = scenes.length ? scenes : clip.scenes.slice(0, 1).map((scene) => ({ ...scene, durationUs: targetDurationUs }));
}

function splitGeneratedScenes(clip: GeneratedBlock, atUs: number) {
  let cursor = 0;
  const leading = [] as GeneratedBlock["scenes"];
  const trailing = [] as GeneratedBlock["scenes"];
  for (const scene of clip.scenes) {
    const sceneEnd = cursor + scene.durationUs;
    if (sceneEnd <= atUs) {
      leading.push(scene);
    } else if (cursor >= atUs) {
      trailing.push({ ...scene, id: crypto.randomUUID() });
    } else {
      leading.push({ ...scene, durationUs: atUs - cursor });
      trailing.push({ ...scene, id: crypto.randomUUID(), durationUs: sceneEnd - atUs });
    }
    cursor = sceneEnd;
  }
  return { leading, trailing };
}

function commit(state: EditorState, mutate: (project: EditorProject) => void) {
  const project = cloneProject(state.project);
  mutate(project);
  project.updatedAt = new Date().toISOString();
  project.durationUs = projectEndUs(project);
  return { project, past: [...state.past.slice(-39), state.project], future: [] };
}

function shiftForInsert(project: EditorProject, atUs: number, durationUs: number) {
  for (const track of project.tracks) {
    const additions: TimelineClip[] = [];
    for (const clip of track.clips) {
      const clipEnd = clip.startUs + clip.durationUs;
      if (clip.startUs >= atUs) {
        clip.startUs += durationUs;
      } else if (isSourceClip(clip) && clipEnd > atUs) {
        const trailingDuration = clipEnd - atUs;
        const trailing = {
          ...clip,
          id: crypto.randomUUID(),
          startUs: atUs + durationUs,
          durationUs: trailingDuration,
          sourceInUs: clip.sourceInUs + (atUs - clip.startUs) * clip.playbackRate,
          label: `${clip.label}（续）`
        } as TimelineClip;
        clip.durationUs = atUs - clip.startUs;
        additions.push(trailing);
      }
    }
    track.clips.push(...additions);
  }
}

function replaceVideoRange(project: EditorProject, startUs: number, durationUs: number) {
  const endUs = startUs + durationUs;
  const videoTracks = project.tracks.filter((track) => track.kind === "video");
  for (const track of videoTracks) {
    const next: TimelineClip[] = [];
    for (const clip of track.clips) {
      if (clip.kind !== "video") {
        next.push(clip);
        continue;
      }
      const clipEnd = clip.startUs + clip.durationUs;
      if (clipEnd <= startUs || clip.startUs >= endUs) {
        next.push(clip);
        continue;
      }
      if (clip.startUs < startUs) {
        next.push({ ...clip, durationUs: startUs - clip.startUs });
      }
      if (clipEnd > endUs) {
        next.push({
          ...clip,
          id: crypto.randomUUID(),
          label: `${clip.label}（续）`,
          startUs: endUs,
          durationUs: clipEnd - endUs,
          sourceInUs: clip.sourceInUs + (endUs - clip.startUs) * clip.playbackRate
        });
      }
    }
    track.clips = next;
  }
}

function clearSubtitleRange(project: EditorProject, startUs: number, durationUs: number) {
  const endUs = startUs + durationUs;
  const track = project.tracks.find((candidate) => candidate.kind === "subtitle");
  if (!track) return;
  track.clips = track.clips.flatMap((clip) => {
    if (clip.kind !== "subtitle" || clip.startUs >= endUs || clip.startUs + clip.durationUs <= startUs) return [clip];
    const clipEnd = clip.startUs + clip.durationUs;
    const parts: SubtitleClip[] = [];
    if (clip.startUs < startUs) parts.push({ ...clip, durationUs: startUs - clip.startUs });
    if (clipEnd > endUs) parts.push({ ...clip, id: crypto.randomUUID(), startUs: endUs, durationUs: clipEnd - endUs });
    return parts;
  });
}

function replaceGeneratedCaptions(project: EditorProject, block: GeneratedBlock) {
  const track = project.tracks.find((candidate) => candidate.kind === "subtitle")!;
  track.clips = track.clips.filter((clip) => clip.kind !== "subtitle" || clip.sourceAssetId !== block.id);
  let sceneStartUs = block.startUs;
  for (const scene of block.scenes) {
    for (const cue of timedTextSegments(scene.narration, scene.durationUs)) {
      const startUs = sceneStartUs + Math.round(cue.startSeconds * 1_000_000);
      const endUs = sceneStartUs + Math.round(cue.endSeconds * 1_000_000);
      if (endUs <= startUs) continue;
      track.clips.push({
        id: crypto.randomUUID(), trackId: track.id, kind: "subtitle", label: cue.text,
        startUs, durationUs: endUs - startUs, locked: false, text: cue.text,
        sourceAssetId: block.id, color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88
      });
    }
    sceneStartUs += scene.durationUs;
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: createEmptyProject(),
  selectedClipId: null,
  selectedClipIds: [],
  playheadUs: 0,
  zoom: 1,
  rangeStartUs: null,
  rangeEndUs: null,
  past: [],
  future: [],
  clipboard: [],
  selectClip: (selectedClipId, additive = false) => set((state) => {
    if (!selectedClipId) return { selectedClipId: null, selectedClipIds: [] };
    if (!additive) return { selectedClipId, selectedClipIds: [selectedClipId] };
    const selectedClipIds = state.selectedClipIds.includes(selectedClipId)
      ? state.selectedClipIds.filter((id) => id !== selectedClipId)
      : [...state.selectedClipIds, selectedClipId];
    return { selectedClipIds, selectedClipId: selectedClipIds.includes(selectedClipId) ? selectedClipId : selectedClipIds.at(-1) ?? null };
  }),
  setPlayhead: (playheadUs) => set({ playheadUs: Math.max(0, playheadUs) }),
  setZoom: (zoom) => set({ zoom: Math.min(3, Math.max(0.6, zoom)) }),
  setRangeStart: (timeUs) => set({ rangeStartUs: timeUs === null ? null : Math.max(0, Math.round(timeUs)) }),
  setRangeEnd: (timeUs) => set({ rangeEndUs: timeUs === null ? null : Math.max(0, Math.round(timeUs)) }),
  clearRange: () => set({ rangeStartUs: null, rangeEndUs: null }),
  updateCanvas: (canvas) => set((state) => commit(state, (project) => {
    project.canvas = {
      width: Math.max(64, Math.min(7680, Math.round(canvas.width / 2) * 2)),
      height: Math.max(64, Math.min(7680, Math.round(canvas.height / 2) * 2)),
      fpsNumerator: Math.max(1, Math.min(240_000, Math.round(canvas.fpsNumerator))),
      fpsDenominator: Math.max(1, Math.min(10_000, Math.round(canvas.fpsDenominator)))
    };
  })),
  addEffect: (effectId) => {
    const definition = effectById(effectId);
    const id = crypto.randomUUID();
    set((state) => ({
      ...commit(state, (project) => {
        const track = project.tracks.find((candidate) => candidate.kind === "effect");
        const clip: EffectClip = {
          id,
          trackId: track!.id,
          kind: "effect",
          label: definition.name,
          startUs: state.playheadUs,
          durationUs: definition.defaultDurationUs,
          locked: false,
          effectId,
          text: definition.defaultText,
          color: definition.defaultColor,
          accentColor: definition.defaultAccentColor,
          fontSize: 56,
          speed: 1,
          transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 },
          recipe: structuredClone(definition.recipe)
        };
        track!.clips.push(clip);
      }),
      selectedClipId: id,
      selectedClipIds: [id]
    }));
  },
  addVideo: (asset) => {
    const id = crypto.randomUUID();
    set((state) => ({
      ...commit(state, (project) => {
        const hasVisualContent = project.tracks.some((track) => ["video", "image", "generated", "effect"].includes(track.kind) && track.clips.length > 0);
        if (!hasVisualContent && asset.width && asset.height) {
          project.canvas = {
            width: Math.max(64, Math.min(7680, Math.round(asset.width / 2) * 2)),
            height: Math.max(64, Math.min(7680, Math.round(asset.height / 2) * 2)),
            fpsNumerator: asset.fpsNumerator ?? project.canvas.fpsNumerator,
            fpsDenominator: asset.fpsDenominator ?? project.canvas.fpsDenominator
          };
        }
        project.assets.push(asset);
        const track = project.tracks.find((candidate) => candidate.kind === "video")!;
        track.clips.push({
          id,
          trackId: track.id,
          kind: "video",
          label: asset.name,
          startUs: state.playheadUs,
          durationUs: asset.durationUs,
          locked: false,
          assetId: asset.id,
          sourceInUs: 0,
          playbackRate: 1,
          volume: 1,
          fit: "cover",
          camera: cameraMotionForPreset("none")
        });
      }),
      selectedClipId: id,
      selectedClipIds: [id]
    }));
  },
  addImage: (asset) => {
    const id = crypto.randomUUID();
    set((state) => ({
      ...commit(state, (project) => {
        project.assets.push(asset);
        const track = project.tracks.find((candidate) => candidate.kind === "image")!;
        track.clips.push({
          id,
          trackId: track.id,
          kind: "image",
          label: asset.name,
          startUs: state.playheadUs,
          durationUs: asset.durationUs || 5_000_000,
          locked: false,
          assetId: asset.id,
          transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
          entrance: "pop",
          speed: 1
        });
      }),
      selectedClipId: id,
      selectedClipIds: [id]
    }));
  },
  addAudio: (asset, role = "music", startUs) => {
    const id = crypto.randomUUID();
    set((state) => ({
      ...commit(state, (project) => {
        project.assets.push(asset);
        const track = project.tracks.find((candidate) => candidate.kind === "audio" && candidate.audioRole === role)
          ?? project.tracks.find((candidate) => candidate.kind === "audio")!;
        track.clips.push({
          id,
          trackId: track.id,
          kind: "audio",
          label: asset.name,
          startUs: startUs ?? state.playheadUs,
          durationUs: asset.durationUs,
          locked: false,
          assetId: asset.id,
          sourceInUs: 0,
          playbackRate: 1,
          volume: role === "music" ? 0.65 : 1,
          fadeInUs: role === "music" ? 500_000 : 50_000,
          fadeOutUs: role === "music" ? 500_000 : 80_000,
          role
        });
      }),
      selectedClipId: id,
      selectedClipIds: [id]
    }));
  },
  addExtractedAudio: (asset, sourceVideoAssetId) => set((state) => {
    const selectedIds: string[] = [];
    const next = commit(state, (project) => {
      project.assets.push(asset);
      const track = project.tracks.find((candidate) => candidate.kind === "audio" && candidate.audioRole === "sound")
        ?? project.tracks.find((candidate) => candidate.kind === "audio")!;
      const sourceClips = project.tracks.flatMap((candidate) => candidate.clips).filter((clip): clip is VideoClip => clip.kind === "video" && clip.assetId === sourceVideoAssetId);
      if (!sourceClips.length) {
        const id = crypto.randomUUID();
        selectedIds.push(id);
        track.clips.push({ id, trackId: track.id, kind: "audio", label: asset.name, startUs: state.playheadUs, durationUs: asset.durationUs, locked: false, assetId: asset.id, sourceInUs: 0, playbackRate: 1, volume: 1, fadeInUs: 0, fadeOutUs: 0, role: "sound" });
        return;
      }
      for (const video of sourceClips) {
        const id = crypto.randomUUID();
        selectedIds.push(id);
        track.clips.push({ id, trackId: track.id, kind: "audio", label: `${video.label} · 分离音频`, startUs: video.startUs, durationUs: video.durationUs, locked: false, assetId: asset.id, sourceInUs: video.sourceInUs, playbackRate: video.playbackRate, volume: video.volume, fadeInUs: 0, fadeOutUs: 0, role: "sound" });
        video.volume = 0;
      }
    });
    return { ...next, selectedClipId: selectedIds[0] ?? null, selectedClipIds: selectedIds };
  }),
  placeAsset: (assetId) => {
    const id = crypto.randomUUID();
    set((state) => {
      const asset = state.project.assets.find((candidate) => candidate.id === assetId);
      if (!asset || asset.missing) return state;
      return {
        ...commit(state, (project) => {
          if (asset.kind === "video") {
            const track = project.tracks.find((candidate) => candidate.kind === "video")!;
            track.clips.push({ id, trackId: track.id, kind: "video", label: asset.name, startUs: state.playheadUs, durationUs: asset.durationUs, locked: false, assetId, sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForPreset("none") });
          } else if (asset.kind === "image") {
            const track = project.tracks.find((candidate) => candidate.kind === "image")!;
            track.clips.push({ id, trackId: track.id, kind: "image", label: asset.name, startUs: state.playheadUs, durationUs: asset.durationUs || 5_000_000, locked: false, assetId, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, entrance: "pop", speed: 1 });
          } else {
            const track = project.tracks.find((candidate) => candidate.kind === "audio" && candidate.audioRole === "music")!;
            track.clips.push({ id, trackId: track.id, kind: "audio", label: asset.name, startUs: state.playheadUs, durationUs: asset.durationUs, locked: false, assetId, sourceInUs: 0, playbackRate: 1, volume: 0.65, fadeInUs: 500_000, fadeOutUs: 500_000, role: "music" });
          }
        }),
        selectedClipId: id,
        selectedClipIds: [id]
      };
    });
  },
  updateAsset: (assetId, patch) => set((state) => commit(state, (project) => {
    const asset = project.assets.find((candidate) => candidate.id === assetId);
    if (asset) Object.assign(asset, patch);
  })),
  replaceProject: (project) => set({ project, selectedClipId: null, selectedClipIds: [], playheadUs: 0, rangeStartUs: null, rangeEndUs: null, past: [], future: [] }),
  addGeneratedPlan: (plan, prompt, mode, target) => {
    const id = crypto.randomUUID();
    const plannedDurationUs = Math.max(1_000_000, plan.scenes.reduce((sum, scene) => sum + scene.durationSeconds * 1_000_000, 0));
    const durationUs = Math.max(100_000, target?.durationUs ?? plannedDurationUs);
    const startUs = Math.max(0, target?.startUs ?? get().playheadUs);
    const durationScale = durationUs / plannedDurationUs;
    let remainingDurationUs = durationUs;
    const sceneDurations = plan.scenes.map((scene, index) => {
      if (index === plan.scenes.length - 1) return Math.max(1, remainingDurationUs);
      const scenesAfter = plan.scenes.length - index - 1;
      const proposed = Math.max(1, Math.round(scene.durationSeconds * 1_000_000 * durationScale));
      const allocated = Math.min(proposed, Math.max(1, remainingDurationUs - scenesAfter));
      remainingDurationUs -= allocated;
      return allocated;
    });
    set((state) => ({
      ...commit(state, (project) => {
        if (mode === "insert") shiftForInsert(project, startUs, durationUs);
        if (mode === "replace") {
          replaceVideoRange(project, startUs, durationUs);
          clearSubtitleRange(project, startUs, durationUs);
        }
        const track = project.tracks.find((candidate) => candidate.kind === "generated")!;
        const clip: GeneratedBlock = {
          id,
          trackId: track.id,
          kind: "generated",
          label: plan.title,
          startUs,
          durationUs,
          locked: false,
          article: plan.article,
          narration: plan.narration,
          prompt,
          insertMode: mode,
          scenes: plan.scenes.map((scene, sceneIndex) => {
            const matchedEffect = retrieveEffects(`${scene.title} ${scene.narration}`, 1)[0] ?? effectById(scene.effectId);
            return ({
            ...(function () {
              const media = scene.mediaAssetId ? project.assets.find((asset) => asset.id === scene.mediaAssetId && asset.kind === "video" && !asset.missing) : undefined;
              const sceneDurationUs = sceneDurations[sceneIndex];
              const usableMedia = media && media.durationUs > 0 ? media : undefined;
              return {
                mediaAssetId: usableMedia?.id,
                mediaSourceInUs: usableMedia ? Math.min(Math.round(scene.mediaSourceInSeconds * 1_000_000), Math.max(0, usableMedia.durationUs - 1)) : 0,
                durationUs: sceneDurationUs
              };
            })(),
            id: crypto.randomUUID(),
            title: scene.title,
            narration: scene.narration,
            effectId: matchedEffect.id,
            textColor: "#ffffff",
            accentColor: scene.color,
            fontSize: 58,
            speed: 1,
            transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
            mediaFit: "cover",
            mediaVolume: 0,
            camera: cameraMotionForPreset(scene.cameraPreset),
            recipe: structuredClone(matchedEffect.recipe)
          }); })
        };
        track.clips.push(clip);
        replaceGeneratedCaptions(project, clip);
      }),
      selectedClipId: id,
      selectedClipIds: [id]
    }));
  },
  updateEffect: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "effect") return;
    Object.assign(clip, patch);
  })),
  updateVideo: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "video") return;
    Object.assign(clip, patch);
  })),
  updateImage: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "image") return;
    Object.assign(clip, patch);
  })),
  updateAudio: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "audio") return;
    Object.assign(clip, patch);
  })),
  updateGenerated: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "generated") return;
    Object.assign(clip, patch);
  })),
  updateGeneratedScene: (clipId, sceneId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "generated") return;
    const scene = clip.scenes.find((candidate) => candidate.id === sceneId);
    if (!scene) return;
    Object.assign(scene, patch);
    clip.durationUs = Math.max(1_000_000, clip.scenes.reduce((sum, candidate) => sum + candidate.durationUs, 0));
    replaceGeneratedCaptions(project, clip);
  })),
  addSubtitles: (assetId, segments) => set((state) => commit(state, (project) => {
    const subtitleTrack = project.tracks.find((track) => track.kind === "subtitle")!;
    const videoClips = project.tracks.flatMap((track) => track.clips).filter((clip): clip is VideoClip => clip.kind === "video" && clip.assetId === assetId);
    subtitleTrack.clips = subtitleTrack.clips.filter((clip) => clip.kind !== "subtitle" || clip.sourceAssetId !== assetId);
    for (const video of videoClips) {
      const sourceStart = video.sourceInUs;
      const sourceEnd = sourceStart + video.durationUs * video.playbackRate;
      for (const segment of segments) {
        const cueStart = Math.round(segment.startSeconds * 1_000_000);
        const cueEnd = Math.round(segment.endSeconds * 1_000_000);
        const overlapStart = Math.max(sourceStart, cueStart);
        const overlapEnd = Math.min(sourceEnd, cueEnd);
        if (overlapEnd <= overlapStart || !segment.text.trim()) continue;
        const clip: SubtitleClip = {
          id: crypto.randomUUID(), trackId: subtitleTrack.id, kind: "subtitle", label: segment.text.trim(),
          startUs: Math.round(video.startUs + (overlapStart - sourceStart) / video.playbackRate),
          durationUs: Math.max(100_000, Math.round((overlapEnd - overlapStart) / video.playbackRate)),
          locked: false, text: segment.text.trim(), sourceAssetId: assetId, color: "#ffffff",
          backgroundColor: "#000000", fontSize: 44, positionY: 88
        };
        subtitleTrack.clips.push(clip);
      }
    }
  })),
  updateSubtitle: (clipId, patch) => set((state) => commit(state, (project) => {
    const clip = findClip(project, clipId);
    if (!clip || clip.kind !== "subtitle") return;
    Object.assign(clip, patch);
  })),
  moveClips: (clipIds, deltaUs) => {
    if (!clipIds.length || Math.abs(deltaUs) < 1) return;
    set((state) => commit(state, (project) => {
      const selected = new Set(clipIds);
      const clips = project.tracks.flatMap((track) => track.locked ? [] : track.clips).filter((clip) => selected.has(clip.id) && !clip.locked);
      const minimumStart = clips.reduce((minimum, clip) => Math.min(minimum, clip.startUs), Number.POSITIVE_INFINITY);
      const boundedDelta = Math.max(deltaUs, -minimumStart);
      for (const clip of clips) clip.startUs = Math.round(clip.startUs + boundedDelta);
    }));
  },
  trimClip: (clipId, edge, deltaUs) => {
    if (Math.abs(deltaUs) < 1) return;
    set((state) => commit(state, (project) => {
      const clip = findClip(project, clipId);
      const track = clip ? project.tracks.find((candidate) => candidate.id === clip.trackId) : undefined;
      if (!clip || clip.locked || track?.locked) return;
      const minimumDuration = clip.kind === "subtitle" ? 100_000 : 250_000;
      if (edge === "start") {
        const actualDelta = Math.min(deltaUs, clip.durationUs - minimumDuration);
        const sourceLimit = isSourceClip(clip) ? -clip.sourceInUs / clip.playbackRate : -clip.startUs;
        const boundedDelta = Math.max(actualDelta, -clip.startUs, sourceLimit);
        clip.startUs += boundedDelta;
        clip.durationUs -= boundedDelta;
        if (isSourceClip(clip)) clip.sourceInUs = Math.max(0, Math.round(clip.sourceInUs + boundedDelta * clip.playbackRate));
        if (clip.kind === "generated") trimGeneratedStart(clip, boundedDelta);
      } else {
        let durationUs = Math.max(minimumDuration, Math.round(clip.durationUs + deltaUs));
        if (isSourceClip(clip)) {
          const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
          if (asset) durationUs = Math.min(durationUs, Math.max(minimumDuration, (asset.durationUs - clip.sourceInUs) / clip.playbackRate));
        }
        clip.durationUs = durationUs;
        if (clip.kind === "generated") trimGeneratedEnd(clip, durationUs);
      }
    }));
  },
  splitSelected: () => {
    const { selectedClipIds, playheadUs } = get();
    if (!selectedClipIds.length) return;
    const created: string[] = [];
    set((state) => ({
      ...commit(state, (project) => {
        for (const track of project.tracks) {
          if (track.locked) continue;
          const additions: TimelineClip[] = [];
          for (const clip of track.clips) {
            if (!selectedClipIds.includes(clip.id) || clip.locked || playheadUs <= clip.startUs || playheadUs >= clip.startUs + clip.durationUs) continue;
            const firstDuration = playheadUs - clip.startUs;
            const trailing = structuredClone(clip);
            trailing.id = crypto.randomUUID();
            trailing.label = `${clip.label}（后段）`;
            trailing.startUs = playheadUs;
            trailing.durationUs = clip.durationUs - firstDuration;
            if (isSourceClip(trailing)) trailing.sourceInUs = Math.round(trailing.sourceInUs + firstDuration * trailing.playbackRate);
            if (clip.kind === "generated" && trailing.kind === "generated") {
              const scenes = splitGeneratedScenes(clip, firstDuration);
              clip.scenes = scenes.leading;
              trailing.scenes = scenes.trailing;
            }
            clip.durationUs = firstDuration;
            additions.push(trailing);
            created.push(trailing.id);
          }
          track.clips.push(...additions);
        }
      }),
      selectedClipId: created.at(-1) ?? state.selectedClipId,
      selectedClipIds: created.length ? created : state.selectedClipIds
    }));
  },
  copySelected: () => set((state) => ({ clipboard: state.project.tracks.flatMap((track) => track.clips).filter((clip) => state.selectedClipIds.includes(clip.id)).map((clip) => structuredClone(clip)) })),
  pasteAtPlayhead: () => {
    const clipboard = get().clipboard;
    if (!clipboard.length) return;
    const minimumStart = Math.min(...clipboard.map((clip) => clip.startUs));
    const created: string[] = [];
    set((state) => ({
      ...commit(state, (project) => {
        for (const source of clipboard) {
          const track = project.tracks.find((candidate) => candidate.id === source.trackId && !candidate.locked);
          if (!track) continue;
          const clip = structuredClone(source);
          clip.id = crypto.randomUUID();
          clip.startUs = Math.round(state.playheadUs + source.startUs - minimumStart);
          clip.locked = false;
          if (clip.kind === "generated") clip.scenes = clip.scenes.map((scene) => ({ ...scene, id: crypto.randomUUID() }));
          track.clips.push(clip);
          created.push(clip.id);
        }
      }),
      selectedClipId: created.at(-1) ?? null,
      selectedClipIds: created
    }));
  },
  setTrackState: (trackId, patch) => set((state) => commit(state, (project) => {
    const track = project.tracks.find((candidate) => candidate.id === trackId);
    if (track) Object.assign(track, patch);
  })),
  removeSelected: () => {
    const selected = new Set(get().selectedClipIds);
    if (!selected.size) return;
    set((state) => ({
      ...commit(state, (project) => {
        for (const track of project.tracks) if (!track.locked) track.clips = track.clips.filter((clip) => clip.locked || (!selected.has(clip.id) && !(clip.kind === "subtitle" && clip.sourceAssetId && selected.has(clip.sourceAssetId))));
      }),
      selectedClipId: null,
      selectedClipIds: []
    }));
  },
  undo: () => set((state) => {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return { project: previous, past: state.past.slice(0, -1), future: [state.project, ...state.future], selectedClipId: null, selectedClipIds: [] };
  }),
  redo: () => set((state) => {
    const next = state.future[0];
    if (!next) return state;
    return { project: next, past: [...state.past, state.project], future: state.future.slice(1), selectedClipId: null, selectedClipIds: [] };
  })
}));

export function selectedClip(project: EditorProject, selectedClipId: string | null) {
  return findClip(project, selectedClipId);
}

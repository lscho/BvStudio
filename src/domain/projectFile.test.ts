import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@/domain/project";
import { parseProject, serializeProject } from "@/domain/projectFile";

describe("project files", () => {
  it("removes transient object URLs and restores a project", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "asset", name: "source.mp4", kind: "video", durationUs: 1_000_000, sourcePath: "/source.mp4", objectUrl: "blob:temporary", missing: true });
    const serialized = serializeProject(project);
    expect(serialized).not.toContain("blob:temporary");
    expect(serialized).not.toContain("missing");
    expect(parseProject(serialized)).toMatchObject({ schemaVersion: 20, id: project.id, assets: [{ sourcePath: "/source.mp4" }] });
  });

  it("creates separate scene and effect tracks", () => {
    const project = createEmptyProject();
    expect(project.schemaVersion).toBe(20);
    expect(project.tracks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "scene-main", kind: "scene", name: "场景", clips: [] }),
      expect.objectContaining({ id: "effect-main", kind: "effect", name: "动效", clips: [] })
    ]));
  });

  it("migrates v19 projects with the default motion theme", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 19;
    delete raw.motionTheme;
    expect(parseProject(JSON.stringify(raw))).toMatchObject({
      schemaVersion: 20,
      motionTheme: { skin: "dark", style: "minimal", font: "sans", colors: { text: "#ffffff", data: "#5fa8ff" } }
    });
  });

  it("normalizes motion theme and effect lint metadata", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.motionTheme = { skin: "neon", style: "unknown", font: "remote", colors: { text: "white", data: "#123456" } };
    const track = raw.tracks.find((candidate: { kind: string }) => candidate.kind === "effect");
    track.clips.push({
      id: "themed", trackId: track.id, kind: "effect", label: "主题动效", startUs: 0, durationUs: 1_000_000, locked: false,
      effectId: "test-title-slide", text: "数据", color: "#ffffff", accentColor: "#47d7ac", fontSize: 48, speed: 1,
      transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }, colorRole: "remote", dimAtUs: 9_000_000,
      lintOff: ["unsafe-bounds", "not valid!", 1]
    });
    const restored = parseProject(JSON.stringify(raw));
    expect(restored.motionTheme).toMatchObject({ skin: "dark", style: "minimal", font: "sans", colors: { text: "#ffffff", data: "#123456" } });
    expect(restored.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "themed")).toMatchObject({ colorRole: "custom", dimAtUs: 1_000_000, lintOff: ["unsafe-bounds"] });
  });

  it("repairs a truncated generated voice clip when its asset matches the AI block duration", () => {
    const project = createEmptyProject();
    const generatedTrack = project.tracks.find((track) => track.kind === "generated")!;
    const voiceTrack = project.tracks.find((track) => track.kind === "audio" && track.audioRole === "voice")!;
    project.assets.push({ id: "voice-asset", name: "voice.wav", kind: "audio", durationUs: 4_000_000, hasAudio: true });
    generatedTrack.clips.push({
      id: "generated", trackId: generatedTrack.id, kind: "generated", label: "AI 内容", startUs: 1_000_000, durationUs: 4_000_000,
      locked: false, article: "正文", narration: "口播", prompt: "主题", insertMode: "insert", scenes: []
    });
    voiceTrack.clips.push({
      id: "voice", trackId: voiceTrack.id, kind: "audio", label: "voice.wav", startUs: 1_000_000, durationUs: 3_100_000,
      locked: false, assetId: "voice-asset", sourceInUs: 0, playbackRate: 1, volume: 1, fadeInUs: 50_000, fadeOutUs: 50_000,
      role: "voice", sourceBlockId: "generated"
    });

    const restored = parseProject(serializeProject(project));
    expect(restored.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "voice")).toMatchObject({
      startUs: 1_000_000,
      durationUs: 4_000_000
    });
  });

  it("migrates v18 chapter progress to the top dark preset", () => {
    const legacy = JSON.parse(serializeProject(createEmptyProject()));
    legacy.schemaVersion = 18;
    legacy.chapterProgress = {
      enabled: true,
      backgroundColor: "#222222",
      activeColor: "#ffaa00",
      textColor: "#ffffff",
      height: 60,
      chapters: [{ id: "intro", title: "开场", startUs: 0 }]
    };

    expect(parseProject(JSON.stringify(legacy))).toMatchObject({
      schemaVersion: 20,
      chapterProgress: {
        enabled: true,
        preset: "top-dark",
        position: "top",
        style: "segments",
        backgroundColor: "#222222",
        backgroundOpacity: 0.9,
        activeColor: "#ffaa00",
        inactiveColor: "#7d8793",
        showTitles: true
      }
    });
  });

  it("normalizes malformed chapter appearance fields", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.chapterProgress = {
      ...raw.chapterProgress,
      preset: "remote-theme",
      position: "left",
      style: "unknown",
      backgroundColor: "black",
      backgroundOpacity: 12,
      inactiveColor: null,
      height: 500,
      showTitles: "yes"
    };

    expect(parseProject(JSON.stringify(raw)).chapterProgress).toMatchObject({
      preset: "custom",
      position: "top",
      style: "segments",
      backgroundColor: "#111316",
      backgroundOpacity: 1,
      inactiveColor: "#7d8793",
      height: 120,
      showTitles: true
    });
  });

  it("refreshes named chapter presets while preserving custom heights", () => {
    const named = JSON.parse(serializeProject(createEmptyProject()));
    named.chapterProgress = { ...named.chapterProgress, preset: "bottom-steps", height: 72 };
    expect(parseProject(JSON.stringify(named)).chapterProgress.height).toBe(96);

    const custom = JSON.parse(serializeProject(createEmptyProject()));
    custom.chapterProgress = { ...custom.chapterProgress, preset: "custom", height: 72 };
    expect(parseProject(JSON.stringify(custom)).chapterProgress.height).toBe(72);
  });

  it("migrates v17 scene background effects onto the scene track", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 17;
    raw.tracks = raw.tracks.filter((track: { kind: string }) => track.kind !== "scene");
    const effectTrack = raw.tracks.find((track: { kind: string }) => track.kind === "effect");
    effectTrack.clips.push({
      id: "legacy-scene", trackId: effectTrack.id, kind: "effect", label: "深色网格", startUs: 1_000_000, durationUs: 4_000_000,
      locked: false, effectId: "scene-dark-grid", text: "", color: "#15191f", accentColor: "#47d7ac", fontSize: 48, speed: 1,
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 0.8 },
      recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0, sceneBackground: { preset: "dark-grid", primaryColor: "#15191f", secondaryColor: "#29313b", borderColor: "#47d7ac", intensity: 0.72 } },
      soundCues: [{ soundId: "demo:notice", offsetUs: 0, volume: 0.5, durationUs: 500_000, sourcePath: "/cache/notice.wav" }]
    });

    const migrated = parseProject(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(20);
    expect(migrated.tracks.find((track) => track.kind === "effect")?.clips).toHaveLength(0);
    expect(migrated.tracks.find((track) => track.kind === "scene")?.clips).toEqual([
      expect.objectContaining({
        id: "legacy-scene", trackId: "scene-main", kind: "scene", effectId: "scene-dark-grid", opacity: 0.8,
        background: expect.objectContaining({ preset: "dark-grid" }),
        soundCues: [expect.objectContaining({ soundId: "demo:notice" })]
      })
    ]);
  });

  it("normalizes malformed current scene fields from the registered preset", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    const sceneTrack = raw.tracks.find((track: { kind: string }) => track.kind === "scene");
    sceneTrack.clips.push({
      id: "malformed-scene", trackId: sceneTrack.id, kind: "scene", label: "损坏场景", startUs: 0, durationUs: 2_000_000,
      locked: false, effectId: "scene-dark-grid", opacity: 4,
      background: { preset: "remote-script", primaryColor: "red", secondaryColor: null, borderColor: "#47d7ac", intensity: 20 }
    });

    const scene = parseProject(JSON.stringify(raw)).tracks.flatMap((track) => track.clips).find((clip) => clip.id === "malformed-scene");
    expect(scene).toMatchObject({
      kind: "scene", opacity: 1,
      background: { preset: "dark-grid", primaryColor: "#15191f", secondaryColor: "#29313b", borderColor: "#47d7ac", intensity: 1 }
    });
  });

  it("migrates v16 projects with subtitle, chapter and effect-sound defaults", () => {
    const project = createEmptyProject();
    const legacy = JSON.parse(serializeProject(project));
    legacy.schemaVersion = 16;
    delete legacy.chapterProgress;
    legacy.tracks.find((track: { kind: string }) => track.kind === "subtitle").clips.push({
      id: "caption", trackId: "subtitle-main", kind: "subtitle", label: "示例字幕", startUs: 0, durationUs: 1_000_000,
      locked: false, text: "示例字幕", color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88
    });
    legacy.tracks.find((track: { kind: string }) => track.kind === "effect").clips.push({
      id: "effect-16", trackId: "effect-main", kind: "effect", label: "旧动效", startUs: 0, durationUs: 1_000_000,
      locked: false, effectId: "test-title-slide", text: "重点", color: "#ffffff", accentColor: "#ffb84d", fontSize: 48, speed: 1,
      transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }
    });
    expect(parseProject(JSON.stringify(legacy))).toMatchObject({
      schemaVersion: 20,
      chapterProgress: { enabled: false, chapters: [] },
      tracks: expect.arrayContaining([
        expect.objectContaining({ clips: expect.arrayContaining([expect.objectContaining({ id: "caption", stylePreset: "classic", highlightWords: [] })]) }),
        expect.objectContaining({ clips: expect.arrayContaining([expect.objectContaining({ id: "effect-16", soundCues: [] })]) })
      ])
    });
  });

  it("preserves instant video presentation cues", () => {
    const project = createEmptyProject();
    const videoTrack = project.tracks.find((track) => track.kind === "video")!;
    videoTrack.clips.push({
      id: "video", trackId: videoTrack.id, kind: "video", label: "讲解人", startUs: 0, durationUs: 2_000_000,
      locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForTest(),
      presentationCues: [{
        id: "cue", offsetUs: 0, transitionDurationUs: 0, presetId: "presenter-circle-bottom-right",
        transform: { x: 84, y: 80, scale: 0.26, rotation: 0, opacity: 1 },
        mask: { shape: "circle", radius: 0, feather: 0, borderWidth: 3, borderColor: "#ffffff", focusX: 50, focusY: 38 },
        focus: { enabled: false, startOffsetUs: 0, durationUs: 2_000_000, x: 50, y: 50, zoom: 1.8, radius: 14, feather: 6, dimOpacity: 0.58, showCursor: true },
        camera: cameraMotionForTest(), fit: "cover"
      }]
    });

    expect(parseProject(serializeProject(project)).tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video")).toMatchObject({
      presentationCues: [{ transitionDurationUs: 0 }]
    });
  });

  it("rejects unsupported schemas", () => {
    expect(() => parseProject('{"schemaVersion":99,"assets":[],"tracks":[],"canvas":{}}')).toThrow("不支持");
  });

  it("normalizes untrusted effect sound cues", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    const effectTrack = raw.tracks.find((track: { kind: string }) => track.kind === "effect");
    effectTrack.clips.push({
      id: "effect-sound", trackId: effectTrack.id, kind: "effect", label: "提示", startUs: 0, durationUs: 2_000_000,
      locked: false, effectId: "test-title-slide", text: "重点", color: "#ffffff", accentColor: "#ffb84d", fontSize: 48, speed: 1,
      transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 },
      soundCues: [
        { soundId: "demo:notice", offsetUs: 100_000.4, volume: 0.5, durationUs: 600_000.2, sourcePath: "/cache/notice.wav" },
        { soundId: "demo:loud", offsetUs: 0, volume: 3, durationUs: 600_000, sourcePath: "/cache/loud.wav" },
        { soundId: "demo:broken", offsetUs: "now", volume: 0.5, durationUs: 600_000 }
      ]
    });

    const effect = parseProject(JSON.stringify(raw)).tracks.flatMap((track) => track.clips).find((clip) => clip.id === "effect-sound");
    expect(effect?.kind === "effect" ? effect.soundCues : undefined).toEqual([
      { soundId: "demo:notice", offsetUs: 100_000, volume: 0.5, durationUs: 600_000, sourcePath: "/cache/notice.wav" }
    ]);
  });

  it("migrates schema 13 video masks with a centered crop focus", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 13;
    const videoTrack = raw.tracks.find((track: { kind: string }) => track.kind === "video");
    videoTrack.clips.push({
      id: "video-13", trackId: videoTrack.id, kind: "video", label: "旧圆形视频", startUs: 0, durationUs: 1_000_000,
      locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover",
      camera: cameraMotionForTest(), mask: { shape: "circle", radius: 50, feather: 0, borderWidth: 2, borderColor: "#ffffff" }
    });

    const migrated = parseProject(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(20);
    expect(migrated.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video-13")).toMatchObject({ mask: { shape: "circle", focusX: 50, focusY: 50 } });
  });

  it("migrates schema 14 videos without presentation cues", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 14;
    const videoTrack = raw.tracks.find((track: { kind: string }) => track.kind === "video");
    videoTrack.clips.push({
      id: "video-14", trackId: videoTrack.id, kind: "video", label: "旧视频", startUs: 0, durationUs: 2_000_000,
      locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover",
      camera: cameraMotionForTest()
    });

    const migrated = parseProject(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(20);
    expect(migrated.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video-14")).toMatchObject({ presentationCues: [] });
  });

  it("migrates schema 12 projects while preserving scene background snapshots", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 12;
    const effectTrack = raw.tracks.find((track: { kind: string }) => track.kind === "effect");
    effectTrack.clips.push({
      id: "scene", trackId: effectTrack.id, kind: "effect", label: "白色边框", startUs: 0, durationUs: 2_000_000,
      locked: false, effectId: "scene-white-frame", text: "", color: "#ffffff", accentColor: "#111111", fontSize: 48, speed: 1,
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
      recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0, sceneBackground: { preset: "white-frame", primaryColor: "#ffffff", secondaryColor: "#f5f5f5", borderColor: "#111111", intensity: 0.7 } }
    });
    const migrated = parseProject(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(20);
    expect(migrated.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "scene")).toMatchObject({ kind: "scene", trackId: "scene-main", background: { preset: "white-frame" } });
  });

  it("migrates legacy tracks and adds the current image and audio layout", () => {
    const project = createEmptyProject();
    const raw = JSON.parse(serializeProject(project));
    raw.schemaVersion = 4;
    raw.tracks = raw.tracks.filter((track: { kind: string }) => track.kind !== "audio" && track.kind !== "image");
    raw.tracks.push({ id: "audio-main", kind: "audio", name: "音频", locked: false, muted: false, hidden: false, clips: [] });

    const migrated = parseProject(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(20);
    expect(migrated.tracks.some((track) => track.kind === "image" && track.name === "贴图")).toBe(true);
    expect(migrated.tracks.filter((track) => track.kind === "audio").map((track) => [track.name, track.audioRole])).toEqual([
      ["配音", "voice"], ["背景音乐", "music"], ["音效", "sound"]
    ]);
  });

  it("migrates schema 7 AI scenes to editable effect and material fields", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 7;
    const generatedTrack = raw.tracks.find((track: { kind: string }) => track.kind === "generated");
    generatedTrack.clips.push({
      id: "generated",
      trackId: generatedTrack.id,
      kind: "generated",
      label: "Legacy AI",
      startUs: 0,
      durationUs: 2_000_000,
      locked: false,
      article: "",
      narration: "",
      prompt: "",
      insertMode: "insert",
      scenes: [{ id: "scene", title: "旧分镜", narration: "", durationUs: 2_000_000, effectId: "title-highlight", color: "#123456" }]
    });

    const migrated = parseProject(JSON.stringify(raw));
    const clip = migrated.tracks.flatMap((track) => track.clips).find((item) => item.id === "generated");
    expect(clip?.kind).toBe("generated");
    if (clip?.kind !== "generated") return;
    expect(clip.scenes[0]).toMatchObject({ textColor: "#ffffff", accentColor: "#123456", fontSize: 58, speed: 1, mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, camera: { preset: "none", startScale: 1, endScale: 1 } });
  });

  it("migrates schema 8 video clips to fixed camera motion", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 8;
    const videoTrack = raw.tracks.find((track: { kind: string }) => track.kind === "video");
    videoTrack.clips.push({ id: "video", trackId: videoTrack.id, kind: "video", label: "Legacy", startUs: 0, durationUs: 1_000_000, locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover" });

    const migrated = parseProject(JSON.stringify(raw));
    expect(migrated.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video")).toMatchObject({ camera: { preset: "none", startScale: 1, endScale: 1, startX: 0, endX: 0 } });
  });

  it("migrates schema 9 generated scenes to the multi-effect schema", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 9;
    const generatedTrack = raw.tracks.find((track: { kind: string }) => track.kind === "generated");
    generatedTrack.clips.push({
      id: "generated-9", trackId: generatedTrack.id, kind: "generated", label: "旧 AI 分镜", startUs: 0,
      durationUs: 1_000_000, locked: false, article: "", narration: "", prompt: "", insertMode: "overlay",
      scenes: [{ id: "scene-9", title: "旧字幕", narration: "", durationUs: 1_000_000, effectId: "title-highlight", textColor: "#ffffff", accentColor: "#ffb84d", fontSize: 58, speed: 1, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, camera: { preset: "none", startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" } }]
    });

    const migrated = parseProject(JSON.stringify(raw));
    const clip = migrated.tracks.flatMap((track) => track.clips).find((item) => item.id === "generated-9");
    expect(migrated.schemaVersion).toBe(20);
    expect(clip?.kind === "generated" ? clip.scenes[0].additionalEffects : undefined).toEqual([]);
  });

  it("migrates schema 11 video roles, masks, transitions, focus and effect backgrounds", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 11;
    const videoTrack = raw.tracks.find((track: { kind: string }) => track.kind === "video");
    videoTrack.id = "video-main";
    videoTrack.name = "主视频";
    videoTrack.clips.push({ id: "legacy-video", trackId: "video-main", kind: "video", label: "旧视频", startUs: 0, durationUs: 2_000_000, locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForTest() });
    const effectTrack = raw.tracks.find((track: { kind: string }) => track.kind === "effect");
    effectTrack.clips.push({ id: "legacy-effect", trackId: effectTrack.id, kind: "effect", label: "旧动效", startUs: 0, durationUs: 1_000_000, locked: false, effectId: "test-title-slide", text: "重点", color: "#ffffff", accentColor: "#ffb84d", fontSize: 48, speed: 1, transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 } });

    const migrated = parseProject(JSON.stringify(raw));
    const video = migrated.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "legacy-video");
    const effect = migrated.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "legacy-effect");
    expect(migrated.schemaVersion).toBe(20);
    expect(migrated.tracks.find((track) => track.kind === "video")?.name).toBe("视频");
    expect(video).toMatchObject({ kind: "video", role: "a-roll", cameraOffsetUs: 0, cameraDurationUs: 2_000_000, mask: { shape: "rectangle", focusX: 50, focusY: 50 }, transition: { preset: "none" } });
    expect(effect).toMatchObject({ kind: "effect", backdrop: { enabled: true, color: "#111316", opacity: 0.64 } });
  });

  it("repairs legacy AI layers that were all persisted at the canvas center", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    const generatedTrack = raw.tracks.find((track: { kind: string }) => track.kind === "generated");
    const centered = { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };
    generatedTrack.clips.push({
      id: "generated-centered", trackId: generatedTrack.id, kind: "generated", label: "居中旧脚本", startUs: 0,
      durationUs: 2_000_000, locked: false, article: "", narration: "", prompt: "", insertMode: "overlay",
      scenes: [{
        id: "scene-centered", title: "增长 42%", narration: "", durationUs: 2_000_000, effectId: "title-highlight",
        textColor: "#ffffff", accentColor: "#47d7ac", fontSize: 58, speed: 1, transform: centered,
        mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, camera: { preset: "none", startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" },
        additionalEffects: [
          { id: "number", effectId: "number-pop", text: "42%", textColor: "#ffffff", accentColor: "#47d7ac", fontSize: 58, speed: 1, transform: centered, startOffsetUs: 0, durationUs: 2_000_000, zIndex: 21, source: "ai" },
          { id: "manual", effectId: "quote-card", text: "手动", textColor: "#ffffff", accentColor: "#47d7ac", fontSize: 58, speed: 1, transform: { ...centered, x: 61 }, startOffsetUs: 0, durationUs: 2_000_000, zIndex: 22, source: "manual" }
        ]
      }]
    });

    const migrated = parseProject(JSON.stringify(raw));
    const clip = migrated.tracks.flatMap((track) => track.clips).find((item) => item.id === "generated-centered");
    expect(clip?.kind).toBe("generated");
    if (clip?.kind !== "generated") return;
    expect(clip.scenes[0].transform).toMatchObject({ x: 50, y: 22 });
    expect(clip.scenes[0].additionalEffects?.[0].transform).toMatchObject({ x: 76, y: 30 });
    expect(clip.scenes[0].additionalEffects?.[1].transform).toMatchObject({ x: 61, y: 50 });
  });
});

function cameraMotionForTest() {
  return { preset: "none" as const, startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" as const };
}

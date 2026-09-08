import { describe, expect, it } from "vitest";
import { createEmptyProject } from "@/domain/project";
import { estimateMotionLayoutRect, motionLayoutRectsOverlap, type MotionLayoutLayer } from "@/domain/motionLayout";
import { compositionById } from "@/domain/effects";
import { parseProject, serializeProject } from "@/domain/projectFile";
import { createEffectPreviewClip } from "@/domain/effectPreview";
import { cameraMotionForPreset } from "@/domain/camera";
import { createVideoPresentationCue, DEFAULT_VIDEO_MASK } from "@/domain/videoPresentation";
import type { VideoClip } from "@/domain/project";
import { lintMotionProject } from "@/domain/motionLint";

describe("project files", () => {
  it("round-trips subtitle themes and migrates version 29 without recoloring existing subtitles", () => {
    const project = createEmptyProject();
    project.subtitleTheme = { color: "#47d7ac", highlightColor: "#ff7b72" };
    const track = project.tracks.find((track) => track.kind === "subtitle")!;
    track.clips.push({ id: "caption", trackId: track.id, kind: "subtitle", label: "字幕", text: "字幕", startUs: 0, durationUs: 1_000_000, locked: false, color: "#123456", highlightColor: "#abcdef", backgroundColor: "#000000", fontSize: 44, positionY: 88 });
    expect(parseProject(serializeProject(project)).subtitleTheme).toEqual(project.subtitleTheme);
    const { subtitleTheme: _theme, ...legacy } = project;
    expect(parseProject(JSON.stringify({ ...legacy, schemaVersion: 29 }))).toMatchObject({ schemaVersion: 30, subtitleTheme: { color: "#ffffff", highlightColor: "#ffb84d" } });
    expect(parseProject(JSON.stringify({ ...legacy, schemaVersion: 29 })).tracks.find((track) => track.kind === "subtitle")!.clips[0]).toMatchObject({ color: "#123456", highlightColor: "#abcdef" });
  });

  it.each([null, [], "red", { color: "red", highlightColor: 3 }])("normalizes a malformed subtitle theme %j", (subtitleTheme) => {
    expect(parseProject(JSON.stringify({ ...createEmptyProject(), subtitleTheme })).subtitleTheme).toEqual({ color: "#ffffff", highlightColor: "#ffb84d" });
  });

  it("round-trips custom presenter geometry and migrates version 28 presets", () => {
    const project = createEmptyProject();
    project.presenterSafeArea = { position: "custom", xPercent: 13, yPercent: 18, widthPercent: 36, heightPercent: 65 };
    expect(parseProject(serializeProject(project)).presenterSafeArea).toEqual(project.presenterSafeArea);
    const legacy = { ...project, schemaVersion: 28, presenterSafeArea: { position: "left", widthPercent: 38 } };
    expect(parseProject(JSON.stringify(legacy))).toMatchObject({ schemaVersion: 30, presenterSafeArea: { position: "left", widthPercent: 38 } });
  });

  it("normalizes incomplete custom presenter geometry on load", () => {
    const raw = { ...createEmptyProject(), presenterSafeArea: { position: "custom", xPercent: 100, yPercent: "invalid", widthPercent: 40, heightPercent: -1 } };
    expect(parseProject(JSON.stringify(raw)).presenterSafeArea).toEqual({ position: "custom", xPercent: 60, yPercent: 6, widthPercent: 40, heightPercent: 18 });
  });

  it("migrates relative layers from version 27 and round-trips container crops", () => {
    const project = createEmptyProject();
    const video: VideoClip = { id: "video", trackId: "video-main", kind: "video", label: "Video", locked: false, startUs: 0, durationUs: 5_000_000, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "contain", camera: cameraMotionForPreset("none"), zIndex: 10 };
    project.tracks.find((track) => track.kind === "video")!.clips.push(video);
    const background = { ...createEffectPreviewClip("background-grid", project.motionTheme, []), zIndex: 20 };
    const effect = { ...createEffectPreviewClip("punch-pill", project.motionTheme, []), zIndex: 35 };
    project.tracks.find((track) => track.kind === "composition")!.clips.push(background, effect);
    const migrated = parseProject(JSON.stringify({ ...project, schemaVersion: 27 }));
    expect(migrated.schemaVersion).toBe(30);
    expect(migrated.tracks.flatMap((track) => track.clips)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "video", zIndex: 30 }),
      expect.objectContaining({ id: background.id, zIndex: 0 }),
      expect.objectContaining({ id: effect.id, zIndex: 235 })
    ]));
    video.zIndex = 240;
    video.mask = { ...DEFAULT_VIDEO_MASK, widthPercent: 25, heightPercent: 80, focusX: 65 };
    const cue = createVideoPresentationCue("picture-in-picture-top-right", video, 2_000_000);
    cue.mask = { ...video.mask, widthPercent: 30 };
    video.presentationCues = [cue];
    const restored = parseProject(serializeProject(project));
    expect(restored.tracks.flatMap((track) => track.clips).find((clip) => clip.id === video.id)).toMatchObject({ zIndex: 240, mask: video.mask, presentationCues: [{ mask: cue.mask }] });
    const malformed = { ...project, tracks: project.tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => clip.id === video.id ? {
      ...video, mask: { ...video.mask, widthPercent: "25" }, zIndex: "240",
      presentationCues: [{ ...cue, mask: { ...cue.mask, heightPercent: -1 } }]
    } : clip) })) };
    expect(parseProject(JSON.stringify(malformed)).tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video")).toMatchObject({ zIndex: 20, mask: { widthPercent: undefined }, presentationCues: [{ mask: { heightPercent: 5 } }] });
  });

  it("removes transient object URLs and restores a project", () => {
    const project = createEmptyProject();
    project.assets.push({ id: "asset", name: "source.mp4", kind: "video", durationUs: 1_000_000, sourcePath: "/source.mp4", objectUrl: "blob:temporary", missing: true });
    const serialized = serializeProject(project);
    expect(serialized).not.toContain("blob:temporary");
    expect(serialized).not.toContain("missing");
    expect(parseProject(serialized)).toMatchObject({ schemaVersion: 30, id: project.id, assets: [{ sourcePath: "/source.mp4" }] });
  });

  it("creates composition tracks without an independent scene track", () => {
    const project = createEmptyProject();
    expect(project.schemaVersion).toBe(30);
    expect(project.tracks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "effect-main", kind: "composition", name: "动效", clips: [] })
    ]));
  });

  it("migrates v19 projects with the default motion theme", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 19;
    delete raw.motionTheme;
    expect(parseProject(JSON.stringify(raw))).toMatchObject({
      schemaVersion: 30,
      motionTheme: { skin: "dark", style: "minimal", font: "sans", colors: { text: "#ffffff", data: "#5fa8ff" } }
    });
  });

  it("migrates v21 projects with the default presenter safe area", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 21;
    delete raw.presenterSafeArea;

    expect(parseProject(JSON.stringify(raw))).toMatchObject({
      schemaVersion: 30,
      presenterSafeArea: { position: "none", widthPercent: 32 }
    });
  });

  it("migrates v22 projects and preserves existing video transitions", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 22;
    const videoTrack = raw.tracks.find((track: { kind: string }) => track.kind === "video");
    videoTrack.clips.push({
      id: "video-22", trackId: videoTrack.id, kind: "video", label: "旧视频", startUs: 0, durationUs: 2_000_000,
      locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover",
      camera: cameraMotionForTest(), transition: { preset: "zoom", durationUs: 400_000, easing: "ease-out" }
    });

    expect(parseProject(JSON.stringify(raw))).toMatchObject({
      schemaVersion: 30,
      tracks: expect.arrayContaining([expect.objectContaining({ clips: expect.arrayContaining([
        expect.objectContaining({ id: "video-22", transition: { preset: "zoom", durationUs: 400_000, easing: "ease-out" } })
      ]) })])
    });
  });

  it("migrates v23 image clips with normalized transitions", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 23;
    const imageTrack = raw.tracks.find((track: { kind: string }) => track.kind === "image");
    imageTrack.clips.push({
      id: "image-23", trackId: imageTrack.id, kind: "image", label: "旧贴图", startUs: 1_000_000, durationUs: 2_000_000,
      locked: false, assetId: "image", transform: { x: 60, y: 40, scale: 0.8, rotation: 0, opacity: 1 }, entrance: "pop", speed: 1
    });

    expect(parseProject(JSON.stringify(raw))).toMatchObject({
      schemaVersion: 30,
      tracks: expect.arrayContaining([expect.objectContaining({ clips: expect.arrayContaining([
        expect.objectContaining({ id: "image-23", transition: { preset: "none", durationUs: 500_000, easing: "ease-in-out" } })
      ]) })])
    });
  });

  it("round-trips momentum transitions and normalizes malformed transition input", () => {
    const project = createEmptyProject();
    const videoTrack = project.tracks.find((track) => track.kind === "video")!;
    videoTrack.clips.push({
      id: "momentum", trackId: videoTrack.id, kind: "video", label: "动势转场", startUs: 0, durationUs: 2_000_000,
      locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover",
      camera: cameraMotionForTest(), transition: { preset: "momentum-zoom", durationUs: 450_000, easing: "ease-in-out", fromClipId: "previous" }
    });
    const imageTrack = project.tracks.find((track) => track.kind === "image")!;
    imageTrack.clips.push({
      id: "image", trackId: imageTrack.id, kind: "image", label: "贴图", startUs: 2_000_000, durationUs: 2_000_000,
      locked: false, assetId: "image-asset", transform: { x: 70, y: 40, scale: 0.8, rotation: 5, opacity: 0.9 }, entrance: "pop", speed: 1,
      transition: { preset: "momentum-zoom", durationUs: 350_000, easing: "ease-in-out", fromClipId: "momentum" }
    });
    const restored = parseProject(serializeProject(project)).tracks.flatMap((track) => track.clips);
    expect(restored.find((clip) => clip.id === "momentum")).toMatchObject({
      transition: { preset: "momentum-zoom", durationUs: 450_000, easing: "ease-in-out", fromClipId: "previous" }
    });
    expect(restored.find((clip) => clip.id === "image")).toMatchObject({ transition: { preset: "momentum-zoom", durationUs: 350_000, fromClipId: "momentum" } });

    const malformed = JSON.parse(serializeProject(project));
    malformed.tracks.find((track: { kind: string }) => track.kind === "video").clips[0].transition = { preset: "unknown", durationUs: -1, easing: "unknown" };
    expect(parseProject(JSON.stringify(malformed)).tracks.flatMap((track) => track.clips).find((clip) => clip.id === "momentum")).toMatchObject({
      transition: { preset: "none", durationUs: 500_000, easing: "ease-in-out" }
    });
  });

  it("clears persisted placeholder copy and normalizes generated component sizing in v21 projects", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 21;
    const track = raw.tracks.find((candidate: { kind: string }) => candidate.kind === "composition");
    track.clips.push({
      id: "ai-term", trackId: track.id, kind: "composition", label: "AI 动效 · 术语解释卡", startUs: 0, durationUs: 2_000_000,
      locked: false, compositionId: "term-card", text: "复利", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 64, speed: 1,
      sourceSubtitleId: "caption", transform: { x: 72, y: 50, scale: 2.5, rotation: 0, opacity: 1 },
      params: { theme: "light", position: "right", en: "TERM CARD", term: "复利", definition: "视频里出现新名词时，用一句话给它下定义。" }
    });

    const effect = parseProject(JSON.stringify(raw)).tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "ai-term");
    expect(effect).toMatchObject({
      fontSize: 48,
      transform: { scale: 1 },
      params: { theme: "light", position: "right", en: "", term: "复利", definition: "" }
    });
  });

  it("recenters generated reference-stage effects from current projects", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    const track = raw.tracks.find((candidate: { kind: string }) => candidate.kind === "composition");
    track.clips.push({
      id: "ai-info-board", trackId: track.id, kind: "composition", label: "AI 动效 · 累积信息板", startUs: 0, durationUs: 4_000_000,
      locked: false, compositionId: "info-board", text: "表达问题", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, speed: 1,
      sourceSubtitleId: "caption", transform: { x: 84, y: 30, scale: 1, rotation: 0, opacity: 1 },
      params: { position: "right", offsetX: 0, offsetY: 0 }
    });

    const effect = parseProject(JSON.stringify(raw)).tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "ai-info-board");
    expect(effect).toMatchObject({
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
      params: { position: "right", offsetX: 0, offsetY: 0 }
    });
  });

  it("repositions overlapping generated component effects when migrating v21 projects", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 21;
    raw.presenterSafeArea = { position: "center", widthPercent: 32 };
    const track = raw.tracks.find((candidate: { kind: string }) => candidate.kind === "composition");
    for (const id of ["first", "second"]) {
      track.clips.push({
        id, trackId: track.id, kind: "composition", label: "AI 动效 · 环形指标", startUs: 0, durationUs: 2_000_000,
        locked: false, compositionId: "ring-metric", text: "完成率 82%", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 64, speed: 1,
        sourceSubtitleId: id, transform: { x: 50, y: 50, scale: 2, rotation: 0, opacity: 1 }
      });
    }

    const project = parseProject(JSON.stringify(raw));
    const effects = project.tracks.flatMap((candidate) => candidate.clips).filter((clip) => clip.kind === "composition");
    const layers: MotionLayoutLayer[] = effects.map((effect) => ({
      id: effect.id,
      compositionId: effect.compositionId,
      startUs: effect.startUs,
      durationUs: effect.durationUs,
      desiredX: effect.transform.x,
      desiredY: effect.transform.y,
      scale: effect.transform.scale,
      fontSize: effect.fontSize,
      text: effect.text,
      recipe: effect.recipe ?? compositionById(effect.compositionId).recipe,
      priority: "primary"
    }));
    const rects = effects.map((effect, index) => estimateMotionLayoutRect(layers[index], effect.transform, project.canvas));
    const presenterRect = { left: 34, top: 6, right: 66, bottom: 78 };

    expect(effects).toHaveLength(2);
    expect(rects.every((rect) => !motionLayoutRectsOverlap(rect, presenterRect))).toBe(true);
    expect(motionLayoutRectsOverlap(rects[0], rects[1])).toBe(false);
  });

  it("normalizes malformed presenter safe area settings", () => {
    const invalidPosition = JSON.parse(serializeProject(createEmptyProject()));
    invalidPosition.presenterSafeArea = { position: "diagonal", widthPercent: 90 };
    expect(parseProject(JSON.stringify(invalidPosition)).presenterSafeArea).toEqual({ position: "none", widthPercent: 60 });

    const invalidWidth = JSON.parse(serializeProject(createEmptyProject()));
    invalidWidth.presenterSafeArea = { position: "right", widthPercent: "wide" };
    expect(parseProject(JSON.stringify(invalidWidth)).presenterSafeArea).toEqual({ position: "right", widthPercent: 32 });
  });

  it("migrates v20 effect params and preserves validated primitive values", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 20;
    const track = raw.tracks.find((candidate: { kind: string }) => candidate.kind === "composition");
    track.clips.push({
      id: "metric", trackId: track.id, kind: "composition", label: "环形指标", startUs: 0, durationUs: 2_000_000, locked: false,
      compositionId: "ring-metric", text: "比例", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, speed: 1,
      transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 },
      params: { value: 76.5, unit: "分", enabled: true, nested: { unsafe: true }, array: [1], infinite: "not-a-number" }
    });

    const restored = parseProject(JSON.stringify(raw));
    const effect = restored.tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "metric");
    expect(restored.schemaVersion).toBe(30);
    expect(effect?.kind === "composition" ? effect.params : undefined).toMatchObject({
      kicker: "比例指标", value: 76.5, max: 100, decimals: 1, unit: "分", label: "圆环注水到这个比例", enabled: true, infinite: "not-a-number"
    });
    expect(parseProject(serializeProject(restored)).tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "metric")).toMatchObject({ params: effect?.kind === "composition" ? effect.params : {} });
  });

  it("restores defaults when an effect params payload is malformed", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    const track = raw.tracks.find((candidate: { kind: string }) => candidate.kind === "composition");
    track.clips.push({
      id: "odometer", trackId: track.id, kind: "composition", label: "翻牌计数器", startUs: 0, durationUs: 2_000_000, locked: false,
      compositionId: "odometer", text: "计数", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 48, speed: 1,
      transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }, params: ["invalid"]
    });
    const effect = parseProject(JSON.stringify(raw)).tracks.flatMap((candidate) => candidate.clips).find((clip) => clip.id === "odometer");
    expect(effect?.kind === "composition" ? effect.params : undefined).toMatchObject({ kicker: "整数计数", value: 500, unit: "万", label: "里程表翻牌，机械感十足", theme: "dark", position: "center" });
  });

  it("normalizes motion theme and effect lint metadata", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.motionTheme = { skin: "neon", style: "unknown", font: "remote", colors: { text: "white", data: "#123456" } };
    const track = raw.tracks.find((candidate: { kind: string }) => candidate.kind === "composition");
    track.clips.push({
      id: "themed", trackId: track.id, kind: "composition", label: "主题动效", startUs: 0, durationUs: 1_000_000, locked: false,
      compositionId: "test-title-slide", text: "数据", color: "#ffffff", accentColor: "#47d7ac", fontSize: 48, speed: 1,
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
      schemaVersion: 30,
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

  it("migrates v17 backgrounds while retaining their composition track", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 17;
    raw.tracks = raw.tracks.filter((track: { kind: string }) => track.kind !== "scene");
    const effectTrack = raw.tracks.find((track: { kind: string }) => track.kind === "composition");
    effectTrack.clips.push({
      id: "legacy-scene", trackId: effectTrack.id, kind: "composition", label: "深色网格", startUs: 1_000_000, durationUs: 4_000_000,
      locked: false, compositionId: "scene-dark-grid", text: "", color: "#15191f", accentColor: "#47d7ac", fontSize: 48, speed: 1,
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 0.8 },
      recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0, sceneBackground: { preset: "dark-grid", primaryColor: "#15191f", secondaryColor: "#29313b", borderColor: "#47d7ac", intensity: 0.72 } },
      soundCues: [{ soundId: "demo:notice", offsetUs: 0, volume: 0.5, durationUs: 500_000, sourcePath: "/cache/notice.wav" }]
    });

    const migrated = parseProject(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(30);
    expect(migrated.tracks.some((track) => track.kind === "scene")).toBe(false);
    expect(migrated.tracks.find((track) => track.kind === "composition")?.clips).toEqual([
      expect.objectContaining({
        id: "legacy-scene", trackId: effectTrack.id, kind: "composition", compositionId: "scene-dark-grid", transform: expect.objectContaining({ opacity: 0.8 }),
        recipe: expect.objectContaining({ sceneBackground: expect.objectContaining({ preset: "dark-grid" }) }),
        soundCues: [expect.objectContaining({ soundId: "demo:notice" })]
      })
    ]);
  });

  it("normalizes malformed current scene fields from the registered preset", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    const sceneTrack = raw.tracks.find((track: { kind: string }) => track.kind === "composition");
    sceneTrack.clips.push({
      id: "malformed-scene", trackId: sceneTrack.id, kind: "scene", label: "损坏场景", startUs: 0, durationUs: 2_000_000,
      locked: false, compositionId: "scene-dark-grid", opacity: 4,
      background: { preset: "remote-script", primaryColor: "red", secondaryColor: null, borderColor: "#47d7ac", intensity: 20 }
    });

    const scene = parseProject(JSON.stringify(raw)).tracks.flatMap((track) => track.clips).find((clip) => clip.id === "malformed-scene");
    expect(scene).toMatchObject({
      kind: "composition", transform: { opacity: 1 },
      recipe: { sceneBackground: { preset: "dark-grid", primaryColor: "#15191f", secondaryColor: "#29313b", borderColor: "#47d7ac", intensity: 1 } }
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
    legacy.tracks.find((track: { kind: string }) => track.kind === "composition").clips.push({
      id: "effect-16", trackId: "effect-main", kind: "composition", label: "旧动效", startUs: 0, durationUs: 1_000_000,
      locked: false, compositionId: "test-title-slide", text: "重点", color: "#ffffff", accentColor: "#ffb84d", fontSize: 48, speed: 1,
      transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 }
    });
    expect(parseProject(JSON.stringify(legacy))).toMatchObject({
      schemaVersion: 30,
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
    const effectTrack = raw.tracks.find((track: { kind: string }) => track.kind === "composition");
    effectTrack.clips.push({
      id: "effect-sound", trackId: effectTrack.id, kind: "composition", label: "提示", startUs: 0, durationUs: 2_000_000,
      locked: false, compositionId: "test-title-slide", text: "重点", color: "#ffffff", accentColor: "#ffb84d", fontSize: 48, speed: 1,
      transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 },
      soundCues: [
        { soundId: "demo:notice", offsetUs: 100_000.4, volume: 0.5, durationUs: 600_000.2, sourcePath: "/cache/notice.wav" },
        { soundId: "demo:loud", offsetUs: 0, volume: 3, durationUs: 600_000, sourcePath: "/cache/loud.wav" },
        { soundId: "demo:broken", offsetUs: "now", volume: 0.5, durationUs: 600_000 }
      ]
    });

    const effect = parseProject(JSON.stringify(raw)).tracks.flatMap((track) => track.clips).find((clip) => clip.id === "effect-sound");
    expect(effect?.kind === "composition" ? effect.soundCues : undefined).toEqual([
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
    expect(migrated.schemaVersion).toBe(30);
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
    expect(migrated.schemaVersion).toBe(30);
    expect(migrated.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "video-14")).toMatchObject({ presentationCues: [] });
  });

  it("migrates schema 12 projects while preserving scene background snapshots", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 12;
    const effectTrack = raw.tracks.find((track: { kind: string }) => track.kind === "composition");
    effectTrack.clips.push({
      id: "scene", trackId: effectTrack.id, kind: "composition", label: "白色边框", startUs: 0, durationUs: 2_000_000,
      locked: false, compositionId: "scene-white-frame", text: "", color: "#ffffff", accentColor: "#111111", fontSize: 48, speed: 1,
      transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 },
      recipe: { layout: "frame", entrance: "none", paddingX: 0, paddingY: 0, borderWidth: 0, borderRadius: 0, backgroundOpacity: 0, sceneBackground: { preset: "white-frame", primaryColor: "#ffffff", secondaryColor: "#f5f5f5", borderColor: "#111111", intensity: 0.7 } }
    });
    const migrated = parseProject(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(30);
    expect(migrated.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "scene")).toMatchObject({ kind: "composition", trackId: effectTrack.id, recipe: { sceneBackground: { preset: "white-frame" } } });
  });

  it("migrates legacy tracks and adds the current image and audio layout", () => {
    const project = createEmptyProject();
    const raw = JSON.parse(serializeProject(project));
    raw.schemaVersion = 4;
    raw.tracks = raw.tracks.filter((track: { kind: string }) => track.kind !== "audio" && track.kind !== "image");
    raw.tracks.push({ id: "audio-main", kind: "audio", name: "音频", locked: false, muted: false, hidden: false, clips: [] });

    const migrated = parseProject(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(30);
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
      scenes: [{ id: "scene", title: "旧分镜", narration: "", durationUs: 2_000_000, compositionId: "title-highlight", color: "#123456" }]
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
      scenes: [{ id: "scene-9", title: "旧字幕", narration: "", durationUs: 1_000_000, compositionId: "title-highlight", textColor: "#ffffff", accentColor: "#ffb84d", fontSize: 58, speed: 1, transform: { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 }, mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, camera: { preset: "none", startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" } }]
    });

    const migrated = parseProject(JSON.stringify(raw));
    const clip = migrated.tracks.flatMap((track) => track.clips).find((item) => item.id === "generated-9");
    expect(migrated.schemaVersion).toBe(30);
    expect(clip?.kind === "generated" ? clip.scenes[0].additionalEffects : undefined).toEqual([]);
  });

  it("migrates schema 11 video roles, masks, transitions, focus and effect backgrounds", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    raw.schemaVersion = 11;
    const videoTrack = raw.tracks.find((track: { kind: string }) => track.kind === "video");
    videoTrack.id = "video-main";
    videoTrack.name = "主视频";
    videoTrack.clips.push({ id: "legacy-video", trackId: "video-main", kind: "video", label: "旧视频", startUs: 0, durationUs: 2_000_000, locked: false, assetId: "asset", sourceInUs: 0, playbackRate: 1, volume: 1, fit: "cover", camera: cameraMotionForTest() });
    const effectTrack = raw.tracks.find((track: { kind: string }) => track.kind === "composition");
    effectTrack.clips.push({ id: "legacy-effect", trackId: effectTrack.id, kind: "composition", label: "旧动效", startUs: 0, durationUs: 1_000_000, locked: false, compositionId: "test-title-slide", text: "重点", color: "#ffffff", accentColor: "#ffb84d", fontSize: 48, speed: 1, transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 } });

    const migrated = parseProject(JSON.stringify(raw));
    const video = migrated.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "legacy-video");
    const effect = migrated.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "legacy-effect");
    expect(migrated.schemaVersion).toBe(30);
    expect(migrated.tracks.find((track) => track.kind === "video")?.name).toBe("视频");
    expect(video).toMatchObject({ kind: "video", role: "a-roll", cameraOffsetUs: 0, cameraDurationUs: 2_000_000, mask: { shape: "rectangle", focusX: 50, focusY: 50 }, transition: { preset: "none" } });
    expect(effect).toMatchObject({ kind: "composition", backdrop: { enabled: true, color: "#111316", opacity: 0.64 } });
  });

  it("repairs legacy AI layers that were all persisted at the canvas center", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    const generatedTrack = raw.tracks.find((track: { kind: string }) => track.kind === "generated");
    const centered = { x: 50, y: 50, scale: 1, rotation: 0, opacity: 1 };
    generatedTrack.clips.push({
      id: "generated-centered", trackId: generatedTrack.id, kind: "generated", label: "居中旧脚本", startUs: 0,
      durationUs: 2_000_000, locked: false, article: "", narration: "", prompt: "", insertMode: "overlay",
      scenes: [{
        id: "scene-centered", title: "增长 42%", narration: "", durationUs: 2_000_000, compositionId: "title-highlight",
        textColor: "#ffffff", accentColor: "#47d7ac", fontSize: 58, speed: 1, transform: centered,
        mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, camera: { preset: "none", startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" },
        additionalEffects: [
          { id: "number", compositionId: "number-pop", text: "42%", textColor: "#ffffff", accentColor: "#47d7ac", fontSize: 58, speed: 1, transform: centered, startOffsetUs: 0, durationUs: 2_000_000, zIndex: 21, source: "ai" },
          { id: "manual", compositionId: "quote-card", text: "手动", textColor: "#ffffff", accentColor: "#47d7ac", fontSize: 58, speed: 1, transform: { ...centered, x: 61 }, startOffsetUs: 0, durationUs: 2_000_000, zIndex: 22, source: "manual" }
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

  it("repairs fractional timeline ranges when loading an existing project", () => {
    const raw = JSON.parse(serializeProject(createEmptyProject()));
    const generatedTrack = raw.tracks.find((track: { kind: string }) => track.kind === "generated");
    const subtitleTrack = raw.tracks.find((track: { kind: string }) => track.kind === "subtitle");
    generatedTrack.clips.push({
      id: "fractional-ai", trackId: generatedTrack.id, kind: "generated", label: "AI 口播视频制作的痛点与解决方案",
      startUs: 1_234_567.8, durationUs: 3_000_000.4, locked: false, article: "", narration: "", prompt: "", insertMode: "overlay",
      scenes: [{
        id: "fractional-scene", title: "痛点与解决方案", narration: "", durationUs: 3_000_000, compositionId: "quote-lockup",
        textColor: "#ffffff", accentColor: "#47d7ac", fontSize: 58, speed: 1, transform: { x: 50, y: 30, scale: 1, rotation: 0, opacity: 1 },
        mediaSourceInUs: 0, mediaFit: "cover", mediaVolume: 0, camera: cameraMotionForTest()
      }]
    });
    subtitleTrack.clips.push({
      id: "fractional-subtitle", trackId: subtitleTrack.id, kind: "subtitle", label: "痛点与解决方案",
      startUs: 1_234_567.8, durationUs: 3_000_000.4, locked: false, text: "痛点与解决方案",
      color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88
    });

    const restored = parseProject(JSON.stringify(raw));
    const clips = restored.tracks.flatMap((track) => track.clips);
    expect(clips.find((clip) => clip.id === "fractional-ai")).toMatchObject({ startUs: 1_234_568, durationUs: 3_000_000 });
    expect(clips.find((clip) => clip.id === "fractional-subtitle")).toMatchObject({ startUs: 1_234_568, durationUs: 3_000_000 });
    expect(lintMotionProject(restored).filter((issue) => issue.ruleId === "invalid-time")).toEqual([]);
  });
});

function cameraMotionForTest() {
  return { preset: "none" as const, startScale: 1, endScale: 1, startX: 0, endX: 0, startY: 0, endY: 0, easing: "linear" as const };
}

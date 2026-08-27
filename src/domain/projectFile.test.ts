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
    expect(parseProject(serialized)).toMatchObject({ schemaVersion: 11, id: project.id, assets: [{ sourcePath: "/source.mp4" }] });
  });

  it("rejects unsupported schemas", () => {
    expect(() => parseProject('{"schemaVersion":99,"assets":[],"tracks":[],"canvas":{}}')).toThrow("不支持");
  });

  it("migrates legacy tracks and adds the current image and audio layout", () => {
    const project = createEmptyProject();
    const raw = JSON.parse(serializeProject(project));
    raw.schemaVersion = 4;
    raw.tracks = raw.tracks.filter((track: { kind: string }) => track.kind !== "audio" && track.kind !== "image");
    raw.tracks.push({ id: "audio-main", kind: "audio", name: "音频", locked: false, muted: false, hidden: false, clips: [] });

    const migrated = parseProject(JSON.stringify(raw));
    expect(migrated.schemaVersion).toBe(11);
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
    expect(migrated.schemaVersion).toBe(11);
    expect(clip?.kind === "generated" ? clip.scenes[0].additionalEffects : undefined).toEqual([]);
  });
});

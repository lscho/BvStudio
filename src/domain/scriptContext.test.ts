import { describe, expect, it } from "vitest";
import { createEmptyProject, type GeneratedBlock, type SubtitleClip } from "@/domain/project";
import { narrationContext } from "@/domain/scriptContext";

function fixture() {
  const project = createEmptyProject();
  const blocks: GeneratedBlock[] = [0, 1].map(i => ({ id: `b${i}`, trackId: "generated-main", kind: "generated", label: `脚本${i}`, article: "", narration: `原稿${i}`, prompt: "", insertMode: "insert", startUs: i * 10_000_000, durationUs: 5_000_000, locked: false, scenes: [] }));
  const subtitles: SubtitleClip[] = blocks.map((b, i) => ({ id: `s${i}`, trackId: "subtitle-main", kind: "subtitle", sourceBlockId: b.id, text: `字幕${i}`, label: `字幕${i}`, startUs: b.startUs, durationUs: b.durationUs, locked: false, color: "#ffffff", backgroundColor: "#000000", fontSize: 44, positionY: 88 }));
  project.tracks.find(t => t.kind === "generated")!.clips = blocks;
  project.tracks.find(t => t.kind === "subtitle")!.clips = subtitles;
  return project;
}

describe("script narration context", () => {
  it("resolves the script through its selected subtitle instead of the first block", () => {
    const project = fixture();
    expect(narrationContext(project, ["s1"], 0)).toMatchObject({ block: { id: "b1" }, subtitles: [{ id: "s1" }], text: "字幕1", startUs: 10_000_000 });
    expect(narrationContext(project, ["b0"], 12_000_000).block?.id).toBe("b0");
  });
  it("uses the active script only without an explicit subtitle target", () => {
    const project = fixture();
    expect(narrationContext(project, [], 12_000_000).block?.id).toBe("b1");
    expect(narrationContext(project, [], 8_000_000).block).toBeUndefined();
    expect(narrationContext(project, ["s0", "s1"], 0).block).toBeUndefined();
    project.tracks.find(t => t.kind === "generated")!.clips = [];
    expect(narrationContext(project, ["s1"], 0)).toMatchObject({ block: undefined, subtitles: [{ id: "s1" }], text: "字幕1", startUs: 10_000_000 });
  });
  it("keeps all selected subtitles when the selection includes an independent subtitle", () => {
    const project = fixture();
    const subtitle = project.tracks.find(t => t.kind === "subtitle")!.clips[1];
    delete subtitle.sourceBlockId;
    expect(narrationContext(project, ["s0", "s1"], 0)).toMatchObject({ block: undefined, subtitles: [{ id: "s0" }, { id: "s1" }], text: "字幕0\n字幕1" });
  });
});

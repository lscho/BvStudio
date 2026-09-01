import { describe, expect, it } from "vitest";
import { autoChapterMarkers, chapterProgressAt, displaySubtitleText, highlightedTextParts, motionKeywordsForSubtitle } from "@/domain/videoDecorations";

describe("video decorations", () => {
  it("builds editable chapter markers from timed subtitles", () => {
    const chapters = autoChapterMarkers([
      { startUs: 0, durationUs: 2_000_000, text: "先认识剪辑流程" },
      { startUs: 2_000_000, durationUs: 2_000_000, text: "准备素材文件" },
      { startUs: 4_000_000, durationUs: 2_000_000, text: "开始正式剪辑" },
      { startUs: 6_000_000, durationUs: 2_000_000, text: "最后导出成片" }
    ], 8_000_000, 3);
    expect(chapters).toHaveLength(3);
    expect(chapters[0]).toMatchObject({ startUs: 0, title: "先认识剪辑流程" });
    expect(chapters.map((chapter) => chapter.startUs)).toEqual([0, 2_000_000, 6_000_000]);
  });

  it("computes active chapter and local fill from the playhead", () => {
    const chapters = [
      { id: "a", title: "开场", startUs: 0 },
      { id: "b", title: "方法", startUs: 4_000_000 },
      { id: "c", title: "总结", startUs: 9_000_000 }
    ];
    expect(chapterProgressAt(chapters, 6_000_000, 12_000_000)).toMatchObject({ activeIndex: 1, localProgress: 0.4 });
    expect(chapterProgressAt(chapters, 12_000_000, 12_000_000)).toMatchObject({ activeIndex: 2, localProgress: 1 });
  });

  it("uses only AI phrases that exist in the subtitle", () => {
    expect(motionKeywordsForSubtitle("这一步需要先整理素材，再开始剪辑", ["整理素材", "不存在的结论", "开始剪辑"])).toEqual(["整理素材", "开始剪辑"]);
    expect(highlightedTextParts("先整理素材再剪辑", ["整理素材"])).toEqual([
      { text: "先", highlighted: false },
      { text: "整理素材", highlighted: true },
      { text: "再剪辑", highlighted: false }
    ]);
  });

  it("hides ordinary trailing punctuation without changing expressive endings", () => {
    expect(displaySubtitleText("充电桩市场正在增长。")).toBe("充电桩市场正在增长");
    expect(displaySubtitleText("截至2023年底，")).toBe("截至2023年底");
    expect(displaySubtitleText("“同比增长六成。”")).toBe("“同比增长六成”");
    expect(displaySubtitleText("真的增长了六成？")).toBe("真的增长了六成？");
    expect(displaySubtitleText("增长仍在继续……")).toBe("增长仍在继续……");
    expect(displaySubtitleText("。")).toBe("。");
  });
});

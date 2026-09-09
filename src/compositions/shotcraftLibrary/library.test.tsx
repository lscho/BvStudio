import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SHOTCRAFT_LIBRARY } from "@/domain/shotcraftLibrary/catalog";
import { libraryLoaders } from "@/compositions/shotcraftLibrary/loaders";
import { ShotcraftFrameContext, interpolate, spring, type ShotcraftContent } from "@/compositions/shotcraftLibrary/runtime";

describe("完整 Shotcraft 镜头库", () => {
  it.each(SHOTCRAFT_LIBRARY)("$name 在首、中、尾帧可渲染", async (shot) => {
    const content: ShotcraftContent = { texts: {}, images: [], imageKeys: shot.imageKeys };
    const Component = (await libraryLoaders[shot.id]()).createDemo(content);
    for (const frame of [0, Math.floor(shot.frames / 2), shot.frames - 1]) {
      const markup = renderToStaticMarkup(<ShotcraftFrameContext.Provider value={{ ...content, frame, durationInFrames: shot.frames, width: 1920, height: 1080 }}><Component /></ShotcraftFrameContext.Provider>);
      expect(markup).toMatch(/^<(?:div|svg)/u);
      if (frame === Math.floor(shot.frames / 2)) expect(markup.length).toBeGreaterThan(100);
      expect(markup).not.toMatch(/(?:NaN|Infinity)(?:px|deg|%|;|\))/u);
    }
  });
  it("文字替换进入原始动画布局", async () => {
    const shot = SHOTCRAFT_LIBRARY.find((item) => item.id === "shotcraft-marker-underline-title")!;
    const content: ShotcraftContent = { texts: { copy0: "真实项目标题" }, images: [], imageKeys: [] };
    const Component = (await libraryLoaders[shot.id]()).createDemo(content);
    const markup = renderToStaticMarkup(<ShotcraftFrameContext.Provider value={{ ...content, frame: shot.frames - 1, durationInFrames: shot.frames, width: 1920, height: 1080 }}><Component /></ShotcraftFrameContext.Provider>);
    expect(markup).toContain("真实项目标题");
  });
  it("连接真实前后镜头时气泡转场不带演示文案或持续呼吸缩放", async () => {
    const content: ShotcraftContent = { texts: {}, images: [], imageKeys: [], linked: true, outgoing: <span>前镜</span>, incoming: <span>后镜</span> };
    const Component = (await libraryLoaders["shotcraft-bubble-swarm-takeover"]()).createDemo(content);
    const frame = (value: number) => renderToStaticMarkup(<ShotcraftFrameContext.Provider value={{ ...content, frame: value, durationInFrames: 150, width: 1920, height: 1080 }}><Component /></ShotcraftFrameContext.Provider>);
    expect(frame(75)).not.toMatch(/Hallo|Hola|Ciao/u);
    expect(frame(122)).toContain("transform:scale(1)");
  });
  it.each(["shotcraft-crash-zoom-real", "shotcraft-crash-impact-real"])("%s 的主截图固定在相机原点", async (id) => {
    const content: ShotcraftContent = { texts: {}, images: ["data:image/png;base64,a"], imageKeys: [] };
    const Component = (await libraryLoaders[id]()).createDemo(content);
    const markup = renderToStaticMarkup(<ShotcraftFrameContext.Provider value={{ ...content, frame: 90, durationInFrames: 150, width: 1920, height: 1080 }}><Component /></ShotcraftFrameContext.Provider>);
    const host = document.createElement("div");
    host.innerHTML = markup;
    expect(host.querySelector("img")?.style).toMatchObject({ position: "absolute", left: "0px", top: "0px" });
  });
  it("文字蒙版使用用户标题并安全编码 SVG 文本", async () => {
    const shot = SHOTCRAFT_LIBRARY.find((item) => item.id === "shotcraft-text-as-mask")!;
    expect(shot.texts.some((field) => field.key === "copy1")).toBe(true);
    const content: ShotcraftContent = { texts: { copy1: "新品<&>" }, images: [], imageKeys: [] };
    const Component = (await libraryLoaders[shot.id]()).createDemo(content);
    const markup = renderToStaticMarkup(<ShotcraftFrameContext.Provider value={{ ...content, frame: 30, durationInFrames: shot.frames, width: 1920, height: 1080 }}><Component /></ShotcraftFrameContext.Provider>);
    const host = document.createElement("div");
    host.innerHTML = markup;
    const mask = host.querySelector<HTMLElement>("[style*='data:image/svg+xml']")!;
    const url = mask.style.getPropertyValue("mask-image");
    const svg = new DOMParser().parseFromString(decodeURIComponent(url.slice(url.indexOf(",") + 1, url.lastIndexOf('"'))), "image/svg+xml");
    expect(svg.querySelector("parsererror")).toBeNull();
    expect(svg.querySelector("text")?.textContent).toBe("新品<&>");
    expect(svg.querySelectorAll("text > *")).toHaveLength(0);
    expect(svg.documentElement.textContent).not.toContain("SCALE");
  });
  it("插值保持边界与回弹，而非裁掉运动超调", () => {
    expect(interpolate(-10, [0, 10], [0, 100], { extrapolateLeft: "clamp" })).toBe(0);
    expect(interpolate(15, [0, 10], [0, 100])).toBe(150);
    expect(spring({ frame: -1, fps: 30 })).toBe(0);
    expect(spring({ frame: 10, fps: 30, config: { damping: 4 } })).toBeGreaterThan(1);
    expect(spring({ frame: 300, fps: 30 })).toBeCloseTo(1, 5);
  });
  it("保留源码弹簧的指定时长与临界阻尼语义", () => {
    expect(spring({ frame: 7, fps: 30, durationInFrames: 34, config: { damping: 16, stiffness: 60 } })).toBeCloseTo(0.4516800892898144, 8);
    expect(spring({ frame: 10.5, fps: 30, durationInFrames: 34, config: { damping: 14, stiffness: 160, mass: 0.8 } })).toBeCloseTo(0.9850958848731809, 8);
    expect(spring({ frame: 35, fps: 30, durationInFrames: 34 })).toBe(1);
  });
  it.each([
    ["shotcraft-marker-underline-title", 42], ["shotcraft-font-weight-pump", 120],
    ["shotcraft-cloner-depth-echo", 83], ["shotcraft-clock-wipe", 96],
    ["shotcraft-odometer-digit-roll", 84], ["shotcraft-title-demote-to-label", 188]
  ] as const)("%s 包含完整动作与尾部", (id, lastAction) => {
    expect(SHOTCRAFT_LIBRARY.find((shot) => shot.id === id)!.frames).toBeGreaterThan(lastAction);
  });
});

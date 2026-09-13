import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InformationScene } from "@/compositions/InformationScene";
import { compositionById } from "@/domain/effects";

it.each([[1920, 1080], [1080, 1920], [1080, 1080]])("renders a subtitle-focused matrix at %i x %i", (canvasWidth, canvasHeight) => {
  const props = { compositionId: "quad-map", text: "四大风险", color: "#ffffff", accentColor: "#5fa8ff", fontSize: 72,
    recipe: compositionById("quad-map").recipe, canvasWidth, canvasHeight, durationUs: 26_000_000,
    params: { sceneLayout: "matrix", cells: "||投入|增容和租金\n||选址|车流不等于需求\n||运营|平台分成\n||迭代|设备贬值", revealTimesUs: "0|2400000|9700000|19000000", theme: "dark" } };
  const markup = renderToStaticMarkup(<InformationScene {...props} timeUs={10_000_000} />);
  expect(markup).toContain('data-scene-layout="matrix"');
  expect(markup).toContain('data-active-item="2"');
  expect(markup).toContain("投入");
  expect(markup).toContain("运营");
  expect(markup).not.toContain("NaN");
  expect(markup).toBe(renderToStaticMarkup(<InformationScene {...props} timeUs={10_000_000} />));
  expect(renderToStaticMarkup(<InformationScene {...props} timeUs={25_000_000} />)).toContain('data-active-item="-1"');
});

it("renders icon graphics and readable light-theme text in the columns layout", () => {
  const markup = renderToStaticMarkup(<InformationScene compositionId="glow-badges" text="三重支撑" color="#ffffff" accentColor="#5fa8ff" fontSize={72}
    recipe={compositionById("glow-badges").recipe} canvasWidth={1920} canvasHeight={1080} timeUs={2_000_000} durationUs={10_000_000}
    params={{ sceneLayout: "columns", tZh: "三重支撑", badges: "需求,trending-up,需求增长,公共充电|政策,shield,政策支持,建设补贴", theme: "light", revealTimesUs: "0|1000000" }} />);
  expect(markup).toContain("<svg");
  expect(markup).not.toContain(">shield<");
  expect(markup).not.toContain(">trending-up<");
  expect(markup).toContain("#1b1d21");
});

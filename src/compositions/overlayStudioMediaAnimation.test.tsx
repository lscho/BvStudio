import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CompositionContent } from "@/compositions/registry";
import { compositionById } from "@/domain/effects";

function renderAt(compositionId: string, params: Record<string, string | number | boolean>, timeUs: number) {
  const definition = compositionById(compositionId);
  return render(<CompositionContent
    compositionId={compositionId}
    text={definition.defaultText}
    color={definition.defaultColor}
    accentColor={definition.defaultAccentColor}
    fontSize={48}
    recipe={definition.recipe}
    params={{ ...definition.defaultParams, ...params }}
    timeUs={timeUs}
    durationUs={definition.defaultDurationUs}
    canvasWidth={1920}
    canvasHeight={1080}
  />);
}

describe("material effect timeline motion", () => {
  it("renders extensionless project blob URLs as images in hybrid icon fields", () => {
    const hand = renderAt("hand-lift", { leftIcon: "blob:left", rightIcon: "code" }, 2_000_000);
    expect(hand.container.querySelector(".hlf-img")).toHaveAttribute("src", "blob:left");
    hand.unmount();

    const swarm = renderAt("icon-swarm", { items: "第一项|blob:icon" }, 2_000_000);
    expect(swarm.container.querySelector(".isw-img")).toHaveAttribute("src", "blob:icon");
  });

  it("moves the ghost reference after its entrance instead of becoming static", () => {
    const view = renderAt("ghost-video", { src: "data:image/png;base64,AA==" }, 1_000_000);
    const first = view.container.querySelector<HTMLElement>(".gsv")?.style.getPropertyValue("--gsv-drift-y");
    view.rerender(<CompositionContent
      compositionId="ghost-video" text="" color="#fff" accentColor="#5fa8ff" fontSize={48}
      recipe={compositionById("ghost-video").recipe} params={{ ...compositionById("ghost-video").defaultParams, src: "data:image/png;base64,AA==" }}
      timeUs={3_000_000} durationUs={8_000_000} canvasWidth={1920} canvasHeight={1080}
    />);
    expect(view.container.querySelector<HTMLElement>(".gsv")?.style.getPropertyValue("--gsv-drift-y")).not.toBe(first);
  });

  it("scrolls the translucent document placeholder according to the playhead", () => {
    const view = renderAt("doc-scroll", { img1: "" }, 1_000_000);
    const first = view.container.querySelector<HTMLElement>(".dsc-empty")?.style.transform;
    view.rerender(<CompositionContent
      compositionId="doc-scroll" text="" color="#fff" accentColor="#5fa8ff" fontSize={48}
      recipe={compositionById("doc-scroll").recipe} params={{ ...compositionById("doc-scroll").defaultParams, img1: "", scrollMs: 8_000 }}
      timeUs={6_000_000} durationUs={8_000_000} canvasWidth={1920} canvasHeight={1080}
    />);
    expect(view.container.querySelector<HTMLElement>(".dsc-empty")?.style.transform).not.toBe(first);
  });
});

import { describe, expect, it, vi } from "vitest";
import { exportRasterDimension } from "@/services/media";

describe("export raster dimensions", () => {
  it("uses render-plan pixels instead of the display device pixel ratio", () => {
    vi.stubGlobal("devicePixelRatio", 2);
    expect(exportRasterDimension(540)).toBe(540);
    expect(exportRasterDimension(540.2)).toBe(541);
    vi.unstubAllGlobals();
  });
});

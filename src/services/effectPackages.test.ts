import { describe, expect, it } from "vitest";
import { compositionById } from "@/domain/effects";
import { adaptEffectPackage } from "@/services/effectPackages";

describe("legacy package adapter", () => {
  it("maps wire effect kinds and scene references without changing signed package metadata", () => {
    const info = adaptEffectPackage({
      schemaVersion: 6, manifest: { id: "sample", name: "示例", version: "1.0.0", author: "test", description: "" },
      soundCount: 0, verified: true, path: "/packages/sample.bveffect",
      effects: [{ ...compositionById("quote-lockup"), kind: "effect", sceneLayers: undefined }, {
        ...compositionById("quote-lockup"), id: "scene", kind: "scene", sceneLayers: [{ effectId: "quote-lockup", x: 50, y: 50, zIndex: 20 }]
      }]
    });
    expect(info).toMatchObject({ schemaVersion: 6, verified: true, effects: [{ kind: "composition", renderer: "react" }, { kind: "scene", sceneLayers: [{ compositionId: "quote-lockup" }] }] });
    expect(info.effects[1].sceneLayers?.[0]).not.toHaveProperty("effectId");
  });
});

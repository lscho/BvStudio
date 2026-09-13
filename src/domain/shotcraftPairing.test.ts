import { expect, it } from "vitest";
import { shotcraftPairingProfile, shotcraftVisualPairAllowed } from "@/domain/shotcraftPairing";

it("only pairs explicitly supported backgrounds and readable information cards", () => {
  expect(shotcraftVisualPairAllowed("shotcraft-glow-orb-ambient", "checklist")).toBe(true);
  expect(shotcraftVisualPairAllowed("shotcraft-radial-wave", "ring-metric")).toBe(true);
  expect(shotcraftVisualPairAllowed("shotcraft-radial-wave", "quad-map")).toBe(true);
  expect(shotcraftVisualPairAllowed("shotcraft-glow-orb-ambient", "card-swap")).toBe(false);
  expect(shotcraftVisualPairAllowed("shotcraft-card-stack", "checklist")).toBe(false);
  expect(shotcraftPairingProfile("shotcraft-blur-slide")).toBeUndefined();
});

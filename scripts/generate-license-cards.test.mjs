import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CARD_KEY_RE } from "../edge/license-core.mjs";
import { generateCards } from "./generate-license-cards.mjs";

test("generates unique well-formed lifetime cards with importable KV records", async () => {
  const manifest = await generateCards({ count: 50, plan: "lifetime" });

  assert.equal(manifest.plan, "lifetime");
  assert.equal(manifest.days, null);
  assert.equal(manifest.cards.length, 50);

  const keys = new Set();
  for (const card of manifest.cards) {
    assert.match(card.cardKey, CARD_KEY_RE);
    keys.add(card.cardKey);
    assert.equal(card.kvKey, `card:${createHash("sha256").update(card.cardKey).digest("hex")}`);
    assert.deepEqual(card.kvValue, {
      status: "unused",
      plan: "lifetime",
      days: null,
      maskedKey: `${card.cardKey.slice(0, 4)}****${card.cardKey.slice(-4)}`,
      hash: card.kvKey.slice("card:".length),
      issuedAt: manifest.cards[0].kvValue.issuedAt
    });
  }
  assert.equal(keys.size, 50);
});

test("computes period expiry inputs and rejects invalid options", async () => {
  const period = await generateCards({ count: 3, plan: "period", days: 365 });
  assert.equal(period.days, 365);
  for (const card of period.cards) {
    assert.equal(card.kvValue.plan, "period");
    assert.equal(card.kvValue.days, 365);
  }

  await assert.rejects(() => generateCards({ count: 0, plan: "lifetime" }), /count/);
  await assert.rejects(() => generateCards({ count: 20001, plan: "lifetime" }), /count/);
  await assert.rejects(() => generateCards({ count: 1, plan: "monthly" }), /plan/);
  await assert.rejects(() => generateCards({ count: 1, plan: "period" }), /days/);
  await assert.rejects(() => generateCards({ count: 1, plan: "period", days: 0 }), /days/);
});

test("cli writes a manifest to the requested output path", async () => {
  const directory = mkdtempSync(join(tmpdir(), "bvideo-cards-"));
  try {
    const output = join(directory, "cards.json");
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    await promisify(execFile)(process.execPath, [
      "scripts/generate-license-cards.mjs", "--count", "3", "--plan", "period", "--days", "30", "--output", output
    ]);

    const manifest = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(manifest.plan, "period");
    assert.equal(manifest.days, 30);
    assert.equal(manifest.cards.length, 3);
    for (const card of manifest.cards) {
      assert.match(card.cardKey, CARD_KEY_RE);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

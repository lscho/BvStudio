import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { prepareShotcraftAssets } from "./prepare-shotcraft-assets.mjs";

test("音频通过全部校验后才复制，拒绝路径穿越和版本不符", async () => {
  const root = await mkdtemp(join(tmpdir(), "shotcraft-assets-"));
  try {
    const input = join(root, "source"), output = join(root, "output");
    await mkdir(join(input, "assets/audio/sfx/impact"), { recursive: true });
    await writeFile(join(input, "assets/audio/sfx/impact/test.mp3"), "fixture");
    const item = { file: "sfx/impact/test.mp3", sha256: createHash("sha256").update("fixture").digest("hex") };
    await assert.rejects(prepareShotcraftAssets(input, output, [item, { ...item, file: "../secret.mp3" }]), /路径/u);
    await assert.rejects(access(output));
    await assert.rejects(prepareShotcraftAssets(input, output, [{ ...item, sha256: "0".repeat(64) }]), /版本/u);
    assert.equal(await prepareShotcraftAssets(input, output, [item]), 1);
    assert.equal(await readFile(join(output, item.file), "utf8"), "fixture");
  } finally { await rm(root, { recursive: true, force: true }); }
});

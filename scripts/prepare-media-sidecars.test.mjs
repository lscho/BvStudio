import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareMediaSidecars, resolveSidecarSources, reusePreparedSidecars, targetTripleFor } from "./prepare-media-sidecars.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "bvideo-sidecars-"));
  const source = join(root, "source");
  writeFileSync(source, "fixture", "utf8");
  writeFileSync(`${source}.LICENSE`, "license fixture", "utf8");
  return { root, source, output: join(root, "output") };
}

test("copies, validates and describes both sidecars", () => {
  const item = fixture();
  try {
    const calls = [];
    const runner = (path, args) => {
      calls.push({ path, args });
      return { status: 0, stdout: `${path.includes("ffprobe") ? "ffprobe" : "ffmpeg"} version test\n`, stderr: "" };
    };
    const { manifest } = prepareMediaSidecars({
      sources: { ffmpeg: item.source, ffprobe: item.source, platform: "darwin", arch: "arm64", compatibleTarget: "darwin-arm64", targetTriple: "aarch64-apple-darwin", ffprobePackage: "fixture", extension: "" },
      outputDirectory: item.output,
      runner
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map((call) => call.args), [["-version"], ["-version"]]);
    assert.equal(statSync(join(item.output, "ffmpeg-aarch64-apple-darwin")).mode & 0o111, 0o111);
    assert.equal(statSync(join(item.output, "ffprobe-aarch64-apple-darwin")).mode & 0o111, 0o111);
    assert.equal(manifest.tools.ffmpeg.version, "ffmpeg version test");
    assert.equal(JSON.parse(readFileSync(join(item.output, "media-sidecars.json"), "utf8")).platform, "darwin");
    assert.equal(readFileSync(join(item.output, "FFMPEG-LICENSE.txt"), "utf8"), "license fixture");
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("copies the FFmpeg license named after a Windows executable", () => {
  const item = fixture();
  const ffmpeg = join(item.root, "ffmpeg.exe");
  try {
    writeFileSync(ffmpeg, "fixture", "utf8");
    writeFileSync(`${ffmpeg}.LICENSE`, "windows license", "utf8");
    prepareMediaSidecars({
      sources: { ffmpeg, ffprobe: item.source, platform: "win32", arch: "x64", compatibleTarget: "win32-x64", targetTriple: "x86_64-pc-windows-msvc", ffprobePackage: "fixture", extension: ".exe" },
      outputDirectory: item.output,
      runner: (path) => ({ status: 0, stdout: `${path.includes("ffprobe") ? "ffprobe" : "ffmpeg"} version test\n`, stderr: "" })
    });
    assert.equal(readFileSync(join(item.output, "FFMPEG-LICENSE.txt"), "utf8"), "windows license");
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("fails before preparing sidecars when the FFmpeg license is missing", () => {
  const item = fixture();
  try {
    rmSync(`${item.source}.LICENSE`);
    assert.throws(() => prepareMediaSidecars({
      sources: { ffmpeg: item.source, ffprobe: item.source, platform: "linux", arch: "x64", compatibleTarget: "linux-x64", targetTriple: "x86_64-unknown-linux-gnu", ffprobePackage: "fixture", extension: "" },
      outputDirectory: item.output,
      runner: () => ({ status: 0, stdout: "version test\n", stderr: "" })
    }), /FFmpeg license is missing/u);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("maps every release architecture to its Tauri target triple", () => {
  assert.equal(targetTripleFor("darwin", "arm64"), "aarch64-apple-darwin");
  assert.equal(targetTripleFor("win32", "arm64"), "aarch64-pc-windows-msvc");
  assert.equal(targetTripleFor("linux", "x64"), "x86_64-unknown-linux-gnu");
  assert.throws(() => targetTripleFor("freebsd", "x64"), /Unsupported/u);
});

test("uses x64 media binaries for Windows ARM64", () => {
  const root = mkdtempSync(join(tmpdir(), "bvideo-sidecars-"));
  try {
    const ffmpeg = join(root, "node_modules", "ffmpeg-static", "ffmpeg.exe");
    const ffprobe = join(root, "node_modules", "@ffprobe-installer", "win32-x64", "ffprobe.exe");
    mkdirSync(join(root, "node_modules", "ffmpeg-static"), { recursive: true });
    mkdirSync(join(root, "node_modules", "@ffprobe-installer", "win32-x64"), { recursive: true });
    writeFileSync(ffmpeg, "fixture");
    writeFileSync(ffprobe, "fixture");
    const resolved = resolveSidecarSources({ platform: "win32", arch: "arm64", root, ffmpegOverride: ffmpeg, ffprobeOverride: ffprobe });
    assert.equal(resolved.ffmpeg, ffmpeg);
    assert.equal(resolved.ffprobe, ffprobe);
    assert.equal(resolved.compatibleTarget, "win32-x64");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reuses validated prepared sidecars for local development", () => {
  const item = fixture();
  try {
    mkdirSync(item.output, { recursive: true });
    writeFileSync(join(item.output, "ffmpeg-aarch64-apple-darwin"), "fixture");
    writeFileSync(join(item.output, "ffprobe-aarch64-apple-darwin"), "fixture");
    const calls = [];
    const reused = reusePreparedSidecars({
      platform: "darwin",
      arch: "arm64",
      outputDirectory: item.output,
      runner: (path, args) => {
        calls.push({ path, args });
        return { status: 0, stdout: `${path.includes("ffprobe") ? "ffprobe" : "ffmpeg"} version cached\n`, stderr: "" };
      }
    });
    assert.equal(reused.ffmpegVersion, "ffmpeg version cached");
    assert.equal(reused.ffprobeVersion, "ffprobe version cached");
    assert.equal(calls.length, 2);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("does not reuse incomplete prepared sidecars", () => {
  const item = fixture();
  try {
    mkdirSync(item.output, { recursive: true });
    writeFileSync(join(item.output, "ffmpeg-aarch64-apple-darwin"), "fixture");
    assert.throws(() => reusePreparedSidecars({ platform: "darwin", arch: "arm64", outputDirectory: item.output }), /Prepared media sidecars are missing/u);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

test("fails when a binary cannot report its version", () => {
  const item = fixture();
  try {
    assert.throws(() => prepareMediaSidecars({
      sources: { ffmpeg: item.source, ffprobe: item.source, platform: "linux", arch: "x64", compatibleTarget: "linux-x64", targetTriple: "x86_64-unknown-linux-gnu", ffprobePackage: "fixture", extension: "" },
      outputDirectory: item.output,
      runner: () => ({ status: 1, stdout: "", stderr: "broken" })
    }), /validation failed: broken/u);
  } finally {
    rmSync(item.root, { recursive: true, force: true });
  }
});

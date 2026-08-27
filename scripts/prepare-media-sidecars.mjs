import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

function packageMetadata(packageName) {
  try {
    const value = require(`${packageName}/package.json`);
    return { version: value.version ?? "unknown", license: value.license ?? "unknown", homepage: value.homepage ?? null };
  } catch {
    return { version: "unknown", license: "unknown", homepage: null };
  }
}

function firstExisting(candidates) {
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

export function targetTripleFor(platform, arch) {
  if (platform === "darwin" && arch === "arm64") return "aarch64-apple-darwin";
  if (platform === "darwin" && arch === "x64") return "x86_64-apple-darwin";
  if (platform === "win32" && arch === "arm64") return "aarch64-pc-windows-msvc";
  if (platform === "win32" && arch === "x64") return "x86_64-pc-windows-msvc";
  if (platform === "linux" && arch === "x64") return "x86_64-unknown-linux-gnu";
  if (platform === "linux" && arch === "arm64") return "aarch64-unknown-linux-gnu";
  throw new Error(`Unsupported Tauri sidecar target: ${platform}-${arch}`);
}

export function resolveSidecarSources({
  platform = process.env.npm_config_platform || process.platform,
  arch = process.env.npm_config_arch || process.arch,
  root = repoRoot,
  ffmpegOverride = process.env.BVIDEO_SIDECAR_FFMPEG,
  ffprobeOverride = process.env.BVIDEO_SIDECAR_FFPROBE
} = {}) {
  const extension = platform === "win32" ? ".exe" : "";
  let ffmpeg = ffmpegOverride;
  if (!ffmpeg) {
    try {
      ffmpeg = require("ffmpeg-static");
    } catch {
      ffmpeg = undefined;
    }
  }
  ffmpeg = firstExisting([
    ffmpeg,
    join(root, "node_modules", "ffmpeg-static", `ffmpeg${extension}`)
  ]);

  let ffprobe = ffprobeOverride;
  if (!ffprobe) {
    try {
      ffprobe = require("@ffprobe-installer/ffprobe").path;
    } catch {
      ffprobe = undefined;
    }
  }
  const requestedTarget = `${platform}-${arch}`;
  const compatibleTarget = platform === "win32" && arch === "arm64" ? "win32-x64" : requestedTarget;
  ffprobe = firstExisting([
    ffprobe,
    join(root, "node_modules", "@ffprobe-installer", compatibleTarget, `ffprobe${extension}`),
    join(root, "node_modules", "@ffprobe-installer", requestedTarget, `ffprobe${extension}`)
  ]);

  if (!ffmpeg) throw new Error(`FFmpeg sidecar is missing for ${requestedTarget}; run npm ci with install scripts enabled`);
  if (!ffprobe) throw new Error(`FFprobe sidecar is missing for ${requestedTarget}; run npm ci with the matching optional dependency`);
  return { ffmpeg: resolve(ffmpeg), ffprobe: resolve(ffprobe), platform, arch, compatibleTarget, targetTriple: process.env.TAURI_ENV_TARGET_TRIPLE || targetTripleFor(platform, arch), ffprobePackage: `@ffprobe-installer/${compatibleTarget}`, extension };
}

function verifyBinary(path, label, runner) {
  const result = runner(path, ["-version"], { encoding: "utf8", timeout: 15_000 });
  if (result.error) throw new Error(`${label} sidecar could not start: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} sidecar validation failed: ${(result.stderr || "unknown error").trim()}`);
  const firstLine = (result.stdout || result.stderr || "").split(/\r?\n/u).find(Boolean)?.trim();
  if (!firstLine) throw new Error(`${label} sidecar did not report a version`);
  return firstLine;
}

export function prepareMediaSidecars({
  sources = resolveSidecarSources(),
  outputDirectory = join(repoRoot, "src-tauri", "binaries"),
  runner = spawnSync
} = {}) {
  const ffmpegPackage = packageMetadata("ffmpeg-static");
  const ffprobePackage = packageMetadata(sources.ffprobePackage ?? "@ffprobe-installer/ffprobe");
  mkdirSync(outputDirectory, { recursive: true });
  const targetTriple = sources.targetTriple ?? targetTripleFor(sources.platform, sources.arch);
  const ffmpegTarget = join(outputDirectory, `ffmpeg-${targetTriple}${sources.extension}`);
  const ffprobeTarget = join(outputDirectory, `ffprobe-${targetTriple}${sources.extension}`);
  copyFileSync(sources.ffmpeg, ffmpegTarget);
  copyFileSync(sources.ffprobe, ffprobeTarget);
  chmodSync(ffmpegTarget, 0o755);
  chmodSync(ffprobeTarget, 0o755);

  const ffmpegVersion = verifyBinary(ffmpegTarget, "FFmpeg", runner);
  const ffprobeVersion = verifyBinary(ffprobeTarget, "FFprobe", runner);
  const manifest = {
    generated: true,
    platform: sources.platform,
    requestedArch: sources.arch,
    targetTriple,
    binaryArch: sources.compatibleTarget.split("-").at(-1),
    windowsArm64UsesX64Emulation: sources.platform === "win32" && sources.arch === "arm64",
    tools: {
      ffmpeg: {
        file: basename(ffmpegTarget),
        version: ffmpegVersion,
        package: `ffmpeg-static@${ffmpegPackage.version}`,
        license: ffmpegPackage.license,
        source: "https://github.com/eugeneware/ffmpeg-static"
      },
      ffprobe: {
        file: basename(ffprobeTarget),
        version: ffprobeVersion,
        package: `${sources.ffprobePackage ?? "@ffprobe-installer/ffprobe"}@${ffprobePackage.version}`,
        license: ffprobePackage.license,
        source: ffprobePackage.homepage ?? "https://github.com/descriptinc/ffprobe-installer"
      }
    }
  };
  writeFileSync(join(outputDirectory, "media-sidecars.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const ffmpegLicense = join(dirname(sources.ffmpeg), "ffmpeg.LICENSE");
  if (existsSync(ffmpegLicense)) copyFileSync(ffmpegLicense, join(outputDirectory, "FFMPEG-LICENSE.txt"));
  return { outputDirectory, manifest };
}

function isMainModule() {
  return process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  const outputDirectory = process.env.BVIDEO_SIDECAR_OUTPUT_DIR
    ? resolve(process.env.BVIDEO_SIDECAR_OUTPUT_DIR)
    : join(repoRoot, "src-tauri", "binaries");
  const { manifest } = prepareMediaSidecars({ outputDirectory });
  console.log(`Prepared ${manifest.tools.ffmpeg.version}`);
  console.log(`Prepared ${manifest.tools.ffprobe.version}`);
  console.log(outputDirectory);
}

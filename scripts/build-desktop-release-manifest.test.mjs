import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const scriptPath = join(repoRoot, "scripts", "build-desktop-release-manifest.mjs");

const WINDOWS_SIGNATURE = "windows-signature-line-1\nwindows-signature-line-2";
const MACOS_X64_SIGNATURE = "macos-x64-signature";
const MACOS_ARM_SIGNATURE = "macos-arm-signature";
const LINUX_SIGNATURE = "linux-x64-signature";

const PLATFORM_FILES = {
  "tauri-base-windows-x64": [
    ["tauri-base_0.1.0_x64-setup.exe", "windows-x64-installer-bytes"],
    ["tauri-base_0.1.0_x64-setup.exe.sig", WINDOWS_SIGNATURE]
  ],
  "tauri-base-windows-arm64": [
    ["tauri-base_0.1.0_arm64-setup.exe", "windows-arm64-installer-bytes"],
    ["tauri-base_0.1.0_arm64-setup.exe.sig", "windows-arm-signature"]
  ],
  "tauri-base-macos-x64": [
    ["tauri-base_0.1.0_x64.dmg", "macos-x64-dmg-bytes"],
    ["tauri-base_0.1.0_aarch64_x64.app.tar.gz", "macos-x64-updater-bytes"],
    ["tauri-base_0.1.0_aarch64_x64.app.tar.gz.sig", MACOS_X64_SIGNATURE]
  ],
  "tauri-base-macos-arm64": [
    ["tauri-base_0.1.0_arm64.dmg", "macos-arm64-dmg-bytes"],
    ["tauri-base_0.1.0_aarch64_arm64.app.tar.gz", "macos-arm64-updater-bytes"],
    ["tauri-base_0.1.0_aarch64_arm64.app.tar.gz.sig", MACOS_ARM_SIGNATURE]
  ],
  "tauri-base-linux-x64": [
    ["tauri-base_0.1.0_amd64.AppImage", "linux-appimage-bytes"],
    ["tauri-base_0.1.0_amd64.AppImage.tar.gz", "linux-updater-bytes"],
    ["tauri-base_0.1.0_amd64.AppImage.tar.gz.sig", LINUX_SIGNATURE],
    ["tauri-base_0.1.0_amd64.deb", "linux-deb-bytes"]
  ]
};

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function createArtifactTree(root) {
  for (const [directory, files] of Object.entries(PLATFORM_FILES)) {
    const dirPath = join(root, directory);
    mkdirSync(dirPath, { recursive: true });
    for (const [name, content] of files) {
      writeFileSync(join(dirPath, name), content);
    }
  }
}

function runScript(env) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function baseEnv(artifactsDir, manifestPath) {
  return {
    RELEASE_VERSION: "0.1.0",
    RELEASE_ARTIFACTS_DIR: artifactsDir,
    RELEASE_MANIFEST_PATH: manifestPath,
    RELEASE_TAG: "v0.1.0",
    GITHUB_REPOSITORY: "example/tauri-base",
    GITHUB_SHA: "0123456789abcdef0123456789abcdef01234567",
    PUBLISH_GITHUB_RELEASE: "true"
  };
}

test("emits the exact schema for a complete five-platform artifact set", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tauri-base-manifest-"));
  try {
    const artifactsDir = join(tempRoot, "release-artifacts");
    createArtifactTree(artifactsDir);
    const manifestPath = join(tempRoot, "desktop-release-manifest.json");

    const { status, stdout, stderr } = runScript(baseEnv(artifactsDir, manifestPath));
    assert.equal(status, 0, stderr);
    assert.equal(stdout, manifestPath);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.version, "0.1.0");
    assert.equal(manifest.tag, "v0.1.0");
    assert.equal(manifest.repository, "example/tauri-base");
    assert.equal(manifest.commitSha, "0123456789abcdef0123456789abcdef01234567");
    assert.ok(Date.parse(manifest.generatedAt) <= Date.now());

    assert.deepEqual(
      manifest.platforms.map((entry) => entry.platform),
      ["windows-x86", "windows-arm", "macos-x86", "macos-arm", "linux-x86"]
    );

    const releaseBase = "https://github.com/example/tauri-base/releases/download/v0.1.0";
    const byPlatform = Object.fromEntries(manifest.platforms.map((entry) => [entry.platform, entry]));

    const windowsX64 = byPlatform["windows-x86"];
    assert.equal(windowsX64.installer.fileName, "tauri-base_0.1.0_x64-setup.exe");
    assert.equal(windowsX64.installer.fileSize, "windows-x64-installer-bytes".length);
    assert.equal(windowsX64.installer.sha256, sha256Text("windows-x64-installer-bytes"));
    assert.equal(windowsX64.installer.sourceUrl, `${releaseBase}/tauri-base_0.1.0_x64-setup.exe`);
    assert.equal(windowsX64.updater.fileName, "tauri-base_0.1.0_x64-setup.exe");
    assert.equal(windowsX64.updater.signatureFileName, "tauri-base_0.1.0_x64-setup.exe.sig");
    assert.equal(windowsX64.updater.signature, WINDOWS_SIGNATURE);

    const macosX64 = byPlatform["macos-x86"];
    assert.equal(macosX64.installer.fileName, "tauri-base_0.1.0_x64.dmg");
    assert.equal(macosX64.updater.fileName, "tauri-base_0.1.0_aarch64_x64.app.tar.gz");
    assert.equal(macosX64.updater.sha256, sha256Text("macos-x64-updater-bytes"));
    assert.equal(macosX64.updater.sourceUrl, `${releaseBase}/tauri-base_0.1.0_aarch64_x64.app.tar.gz`);
    assert.equal(macosX64.updater.signatureFileName, "tauri-base_0.1.0_aarch64_x64.app.tar.gz.sig");
    assert.equal(macosX64.updater.signature, MACOS_X64_SIGNATURE);

    const macosArm = byPlatform["macos-arm"];
    assert.equal(macosArm.installer.fileName, "tauri-base_0.1.0_arm64.dmg");
    assert.equal(macosArm.updater.fileName, "tauri-base_0.1.0_aarch64_arm64.app.tar.gz");
    assert.equal(macosArm.updater.signature, MACOS_ARM_SIGNATURE);
    assert.equal(macosArm.updater.sourceUrl, `${releaseBase}/tauri-base_0.1.0_aarch64_arm64.app.tar.gz`);

    const linuxX64 = byPlatform["linux-x86"];
    assert.equal(linuxX64.installer.fileName, "tauri-base_0.1.0_amd64.AppImage");
    assert.equal(linuxX64.updater.fileName, "tauri-base_0.1.0_amd64.AppImage.tar.gz");
    assert.equal(linuxX64.updater.signature, LINUX_SIGNATURE);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("manual builds (no GitHub release) get null source URLs", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tauri-base-manifest-"));
  try {
    const artifactsDir = join(tempRoot, "release-artifacts");
    createArtifactTree(artifactsDir);
    const manifestPath = join(tempRoot, "desktop-release-manifest.json");

    const { status, stderr } = runScript({
      ...baseEnv(artifactsDir, manifestPath),
      PUBLISH_GITHUB_RELEASE: "false"
    });
    assert.equal(status, 0, stderr);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    for (const entry of manifest.platforms) {
      assert.equal(entry.installer.sourceUrl, null);
      assert.equal(entry.updater.sourceUrl, null);
    }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("fails before emitting a manifest for missing platform artifacts", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tauri-base-manifest-"));
  try {
    const artifactsDir = join(tempRoot, "release-artifacts");
    createArtifactTree(artifactsDir);
    rmSync(join(artifactsDir, "tauri-base-windows-arm64"), { recursive: true, force: true });
    const manifestPath = join(tempRoot, "desktop-release-manifest.json");

    const { status, stderr } = runScript(baseEnv(artifactsDir, manifestPath));
    assert.notEqual(status, 0);
    assert.match(stderr, /Missing artifact directory/);
    assert.equal(existsSync(manifestPath), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("fails before emitting a manifest when a signature is missing", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tauri-base-manifest-"));
  try {
    const artifactsDir = join(tempRoot, "release-artifacts");
    createArtifactTree(artifactsDir);
    rmSync(join(artifactsDir, "tauri-base-windows-x64", "tauri-base_0.1.0_x64-setup.exe.sig"));
    const manifestPath = join(tempRoot, "desktop-release-manifest.json");

    const { status, stderr } = runScript(baseEnv(artifactsDir, manifestPath));
    assert.notEqual(status, 0);
    assert.match(stderr, /Expected exactly one windows-x86 updater signature/);
    assert.equal(existsSync(manifestPath), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("fails before emitting a manifest when a signature is empty", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tauri-base-manifest-"));
  try {
    const artifactsDir = join(tempRoot, "release-artifacts");
    createArtifactTree(artifactsDir);
    writeFileSync(join(artifactsDir, "tauri-base-macos-arm64", "tauri-base_0.1.0_aarch64_arm64.app.tar.gz.sig"), "\n  \n");
    const manifestPath = join(tempRoot, "desktop-release-manifest.json");

    const { status, stderr } = runScript(baseEnv(artifactsDir, manifestPath));
    assert.notEqual(status, 0);
    assert.match(stderr, /Updater signature is empty/);
    assert.equal(existsSync(manifestPath), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("fails before emitting a manifest when a macOS updater lacks the architecture suffix", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tauri-base-manifest-"));
  try {
    const artifactsDir = join(tempRoot, "release-artifacts");
    createArtifactTree(artifactsDir);
    rmSync(join(artifactsDir, "tauri-base-macos-x64", "tauri-base_0.1.0_aarch64_x64.app.tar.gz"));
    writeFileSync(join(artifactsDir, "tauri-base-macos-x64", "tauri-base_0.1.0_aarch64.app.tar.gz"), "bytes");
    const manifestPath = join(tempRoot, "desktop-release-manifest.json");

    const { status, stderr } = runScript(baseEnv(artifactsDir, manifestPath));
    assert.notEqual(status, 0);
    assert.match(stderr, /Expected exactly one macos-x86 updater package/);
    assert.equal(existsSync(manifestPath), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("fails before emitting a manifest for duplicate GitHub Release asset names", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tauri-base-manifest-"));
  try {
    const artifactsDir = join(tempRoot, "release-artifacts");
    createArtifactTree(artifactsDir);
    // windows-arm64 目录中唯一的安装包与 windows-x86 同名：作为 Release 资产上传时会冲突。
    rmSync(join(artifactsDir, "tauri-base-windows-arm64", "tauri-base_0.1.0_arm64-setup.exe"));
    rmSync(join(artifactsDir, "tauri-base-windows-arm64", "tauri-base_0.1.0_arm64-setup.exe.sig"));
    writeFileSync(join(artifactsDir, "tauri-base-windows-arm64", "tauri-base_0.1.0_x64-setup.exe"), "dup");
    writeFileSync(join(artifactsDir, "tauri-base-windows-arm64", "tauri-base_0.1.0_x64-setup.exe.sig"), "dup-sig");
    const manifestPath = join(tempRoot, "desktop-release-manifest.json");

    const { status, stderr } = runScript(baseEnv(artifactsDir, manifestPath));
    assert.notEqual(status, 0);
    assert.match(stderr, /Duplicate GitHub Release asset name/);
    assert.equal(existsSync(manifestPath), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("rejects a release tag that does not match the version", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tauri-base-manifest-"));
  try {
    const artifactsDir = join(tempRoot, "release-artifacts");
    createArtifactTree(artifactsDir);
    const manifestPath = join(tempRoot, "desktop-release-manifest.json");

    const { status, stderr } = runScript({
      ...baseEnv(artifactsDir, manifestPath),
      RELEASE_TAG: "v0.2.0"
    });
    assert.notEqual(status, 0);
    assert.match(stderr, /does not match version/);
    assert.equal(existsSync(manifestPath), false);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

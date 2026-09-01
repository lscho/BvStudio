import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const scriptPath = join(repoRoot, "scripts", "write-tauri-release-config.mjs");

const PUBLIC_KEY = "RExhHuaweiTestPublicKeyThatLooksLongEnoughForTheTestFixture";
const ENDPOINT = "https://updates.example.com/api/desktop-updates/latest?platform={{target}}";

function runScript(env) {
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env }
  });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function outputPath(runnerTemp) {
  return join(runnerTemp, "tauri-base-release", "tauri.release.conf.json");
}

test("writes a transient override containing only release version and updater settings", () => {
  const runnerTemp = mkdtempSync(join(tmpdir(), "tauri-base-config-"));
  try {
    const { status, stdout, stderr } = runScript({
      RELEASE_VERSION: "v0.1.0",
      TAURI_SIGNING_PUBLIC_KEY: PUBLIC_KEY,
      TAURI_UPDATER_ENDPOINT: ENDPOINT,
      RUNNER_TEMP: runnerTemp
    });
    assert.equal(status, 0, stderr);
    assert.equal(stdout, outputPath(runnerTemp));

    const override = JSON.parse(readFileSync(outputPath(runnerTemp), "utf8"));
    assert.deepEqual(Object.keys(override).sort(), ["bundle", "plugins", "version"]);
    assert.equal(override.version, "0.1.0");
    assert.deepEqual(override.bundle, { createUpdaterArtifacts: true });
    assert.deepEqual(override.plugins, {
      updater: {
        endpoints: [ENDPOINT],
        pubkey: PUBLIC_KEY,
        windows: { installMode: "passive" }
      }
    });
  } finally {
    rmSync(runnerTemp, { recursive: true, force: true });
  }
});

test("strips a leading v from the version", () => {
  const runnerTemp = mkdtempSync(join(tmpdir(), "tauri-base-config-"));
  try {
    const { status, stderr } = runScript({
      RELEASE_VERSION: "v1.2.3",
      TAURI_SIGNING_PUBLIC_KEY: PUBLIC_KEY,
      TAURI_UPDATER_ENDPOINT: ENDPOINT,
      RUNNER_TEMP: runnerTemp
    });
    assert.equal(status, 0, stderr);
    const override = JSON.parse(readFileSync(outputPath(runnerTemp), "utf8"));
    assert.equal(override.version, "1.2.3");
  } finally {
    rmSync(runnerTemp, { recursive: true, force: true });
  }
});

test("disables updater endpoints when TAURI_UPDATER_ENDPOINT is not configured", () => {
  const runnerTemp = mkdtempSync(join(tmpdir(), "tauri-base-config-"));
  try {
    const { status, stderr } = runScript({
      RELEASE_VERSION: "0.1.0",
      TAURI_SIGNING_PUBLIC_KEY: PUBLIC_KEY,
      TAURI_UPDATER_ENDPOINT: "",
      RUNNER_TEMP: runnerTemp
    });
    assert.equal(status, 0, stderr);

    const override = JSON.parse(readFileSync(outputPath(runnerTemp), "utf8"));
    assert.deepEqual(override.plugins.updater.endpoints, []);
  } finally {
    rmSync(runnerTemp, { recursive: true, force: true });
  }
});

test("rejects missing environment values", () => {
  const runnerTemp = mkdtempSync(join(tmpdir(), "tauri-base-config-"));
  try {
    const base = {
      RELEASE_VERSION: "0.1.0",
      TAURI_SIGNING_PUBLIC_KEY: PUBLIC_KEY,
      TAURI_UPDATER_ENDPOINT: ENDPOINT,
      RUNNER_TEMP: runnerTemp
    };
    for (const name of ["RELEASE_VERSION", "TAURI_SIGNING_PUBLIC_KEY", "RUNNER_TEMP"]) {
      const env = { ...base };
      delete env[name];
      const result = runScript(env);
      assert.notEqual(result.status, 0, `${name} should be required`);
      assert.match(result.stderr, /Missing required environment variable/);
    }
  } finally {
    rmSync(runnerTemp, { recursive: true, force: true });
  }
});

test("rejects malformed semantic versions", () => {
  const runnerTemp = mkdtempSync(join(tmpdir(), "tauri-base-config-"));
  try {
    for (const version of ["not-a-version", "1.2", "1.2.3.4", "v", "1.02.3"]) {
      const { status, stderr } = runScript({
        RELEASE_VERSION: version,
        TAURI_SIGNING_PUBLIC_KEY: PUBLIC_KEY,
        TAURI_UPDATER_ENDPOINT: ENDPOINT,
        RUNNER_TEMP: runnerTemp
      });
      assert.notEqual(status, 0, `${version} should be rejected`);
      assert.match(stderr, /Invalid semantic version/);
    }
  } finally {
    rmSync(runnerTemp, { recursive: true, force: true });
  }
});

test("rejects non-HTTPS endpoints and endpoints without the {{target}} placeholder", () => {
  const runnerTemp = mkdtempSync(join(tmpdir(), "tauri-base-config-"));
  try {
    const httpResult = runScript({
      RELEASE_VERSION: "0.1.0",
      TAURI_SIGNING_PUBLIC_KEY: PUBLIC_KEY,
      TAURI_UPDATER_ENDPOINT: "http://updates.example.com/latest?platform={{target}}",
      RUNNER_TEMP: runnerTemp
    });
    assert.notEqual(httpResult.status, 0);
    assert.match(httpResult.stderr, /must use HTTPS/);

    const noPlaceholderResult = runScript({
      RELEASE_VERSION: "0.1.0",
      TAURI_SIGNING_PUBLIC_KEY: PUBLIC_KEY,
      TAURI_UPDATER_ENDPOINT: "https://updates.example.com/latest",
      RUNNER_TEMP: runnerTemp
    });
    assert.notEqual(noPlaceholderResult.status, 0);
    assert.match(noPlaceholderResult.stderr, /must contain the \{\{target\}\} placeholder/);

    const invalidUrlResult = runScript({
      RELEASE_VERSION: "0.1.0",
      TAURI_SIGNING_PUBLIC_KEY: PUBLIC_KEY,
      TAURI_UPDATER_ENDPOINT: "not a url",
      RUNNER_TEMP: runnerTemp
    });
    assert.notEqual(invalidUrlResult.status, 0);
    assert.match(invalidUrlResult.stderr, /not a valid URL/);
  } finally {
    rmSync(runnerTemp, { recursive: true, force: true });
  }
});

test("never writes the override when validation fails", () => {
  const runnerTemp = mkdtempSync(join(tmpdir(), "tauri-base-config-"));
  try {
    const { status } = runScript({
      RELEASE_VERSION: "bogus",
      TAURI_SIGNING_PUBLIC_KEY: PUBLIC_KEY,
      TAURI_UPDATER_ENDPOINT: ENDPOINT,
      RUNNER_TEMP: runnerTemp
    });
    assert.notEqual(status, 0);
    assert.throws(() => readFileSync(outputPath(runnerTemp), "utf8"));
  } finally {
    rmSync(runnerTemp, { recursive: true, force: true });
  }
});

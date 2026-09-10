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
const SERVER_URL = "https://license.example.com";
const ENDPOINT = "https://license.example.com/api/desktop-updates/latest?platform={{target}}";
/** 开发机 shell 或 .env 可能残留同名变量，逐条用例显式构造，保证测试自洽。 */
const CONTROLLED_KEYS = ["VITE_ENABLE_UPDATER", "VITE_LICENSE_SERVER_URL", "TAURI_UPDATER_ENDPOINT"];

const BASE_ENV = {
  RELEASE_VERSION: "0.1.0",
  TAURI_SIGNING_PUBLIC_KEY: PUBLIC_KEY,
  VITE_ENABLE_UPDATER: "true",
  VITE_LICENSE_SERVER_URL: SERVER_URL
};

function runScript(env) {
  const inherited = { ...process.env };
  for (const key of CONTROLLED_KEYS) delete inherited[key];
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...inherited, ...env }
  });
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

function outputPath(runnerTemp) {
  return join(runnerTemp, "bframe-studio-release", "tauri.release.conf.json");
}

/**
 * 在临时 RUNNER_TEMP 下跑一次脚本，再把结果交给断言。
 * 显式传入的 RUNNER_TEMP: undefined 会被移除，用于验证该变量缺失时的行为。
 */
function withOverride(env, assertion) {
  const runnerTemp = mkdtempSync(join(tmpdir(), "bframe-studio-config-"));
  try {
    const merged = { RUNNER_TEMP: runnerTemp, ...env };
    for (const key of Object.keys(merged)) {
      if (merged[key] === undefined) delete merged[key];
    }
    return assertion(runScript(merged), runnerTemp);
  } finally {
    rmSync(runnerTemp, { recursive: true, force: true });
  }
}

function readOverride(runnerTemp) {
  return JSON.parse(readFileSync(outputPath(runnerTemp), "utf8"));
}

test("derives the updater endpoint from the license server URL", () => {
  withOverride({ ...BASE_ENV, RELEASE_VERSION: "v0.1.0" }, ({ status, stdout, stderr }, runnerTemp) => {
    assert.equal(status, 0, stderr);
    assert.equal(stdout, outputPath(runnerTemp));

    const override = readOverride(runnerTemp);
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
  });
});

test("normalizes a trailing slash instead of doubling the path separator", () => {
  for (const serverUrl of [SERVER_URL, `${SERVER_URL}/`, `  ${SERVER_URL}/  `]) {
    withOverride({ ...BASE_ENV, VITE_LICENSE_SERVER_URL: serverUrl }, ({ status, stderr }, runnerTemp) => {
      assert.equal(status, 0, stderr);
      assert.deepEqual(readOverride(runnerTemp).plugins.updater.endpoints, [ENDPOINT]);
    });
  }
});

test("strips a leading v from the version", () => {
  withOverride({ ...BASE_ENV, RELEASE_VERSION: "v1.2.3" }, ({ status, stderr }, runnerTemp) => {
    assert.equal(status, 0, stderr);
    assert.equal(readOverride(runnerTemp).version, "1.2.3");
  });
});

test("keeps endpoints empty unless VITE_ENABLE_UPDATER is exactly true", () => {
  for (const flag of [undefined, "", "false", "1", "TRUE", "yes", " true"]) {
    withOverride({ ...BASE_ENV, VITE_ENABLE_UPDATER: flag }, ({ status, stderr }, runnerTemp) => {
      assert.equal(status, 0, stderr);
      assert.deepEqual(readOverride(runnerTemp).plugins.updater.endpoints, [], `flag=${JSON.stringify(flag)}`);
    });
  }
});

test("requires the license server URL once the updater is enabled", () => {
  withOverride({ ...BASE_ENV, VITE_LICENSE_SERVER_URL: undefined }, ({ status, stderr }) => {
    assert.notEqual(status, 0);
    assert.match(stderr, /VITE_ENABLE_UPDATER is true but VITE_LICENSE_SERVER_URL is not set/);
  });
});

test("rejects a server URL that is not a bare HTTPS origin", () => {
  const cases = [
    { value: "http://license.example.com", expected: /must use HTTPS/ },
    { value: "not a url", expected: /is not a valid URL/ },
    { value: "https://license.example.com/api", expected: /must contain only the origin/ },
    { value: `${SERVER_URL}/?platform=x`, expected: /must contain only the origin/ }
  ];
  for (const { value, expected } of cases) {
    withOverride({ ...BASE_ENV, VITE_LICENSE_SERVER_URL: value }, ({ status, stderr }) => {
      assert.notEqual(status, 0, `${value} should be rejected`);
      assert.match(stderr, expected);
    });
  }
});

test("rejects missing environment values", () => {
  for (const name of ["RELEASE_VERSION", "TAURI_SIGNING_PUBLIC_KEY", "RUNNER_TEMP"]) {
    withOverride({ ...BASE_ENV, [name]: undefined }, ({ status, stderr }) => {
      assert.notEqual(status, 0, `${name} should be required`);
      assert.match(stderr, /Missing required environment variable/);
    });
  }
});

test("rejects malformed semantic versions", () => {
  for (const version of ["not-a-version", "1.2", "1.2.3.4", "v", "1.02.3"]) {
    withOverride({ ...BASE_ENV, RELEASE_VERSION: version }, ({ status, stderr }) => {
      assert.notEqual(status, 0, `${version} should be rejected`);
      assert.match(stderr, /Invalid semantic version/);
    });
  }
});

test("never writes the override when validation fails", () => {
  withOverride({ ...BASE_ENV, RELEASE_VERSION: "bogus" }, ({ status }, runnerTemp) => {
    assert.notEqual(status, 0);
    assert.throws(() => readFileSync(outputPath(runnerTemp), "utf8"));
  });
});

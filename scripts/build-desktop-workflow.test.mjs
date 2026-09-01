import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workflowPath = fileURLToPath(new URL("../.github/workflows/build-desktop.yml", import.meta.url));
const workflow = readFileSync(workflowPath, "utf8");

test("installs only the x64 FFprobe compatibility package for Windows ARM64", () => {
  assert.match(
    workflow,
    /- name: Install Windows ARM64 FFprobe compatibility package\n\s+if: matrix\.target == 'aarch64-pc-windows-msvc'\n\s+run: npm install --no-save --package-lock=false --ignore-scripts --force @ffprobe-installer\/win32-x64@5\.1\.0/u
  );

  const installDependencies = workflow.match(/- name: Install frontend dependencies[\s\S]*?run: npm ci/u)?.[0];
  assert.ok(installDependencies);
  assert.doesNotMatch(installDependencies, /npm_config_cpu/u);
});

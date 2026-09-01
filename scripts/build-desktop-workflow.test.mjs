import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const workflowPath = fileURLToPath(new URL("../.github/workflows/build-desktop.yml", import.meta.url));
const workflow = readFileSync(workflowPath, "utf8");

test("installs only the x64 FFprobe compatibility package for Windows ARM64", () => {
  assert.match(
    workflow,
    /- name: Install Windows ARM64 FFprobe compatibility package\n\s+if: matrix\.target == 'aarch64-pc-windows-msvc'[\s\S]*?npm install --prefix "\$RUNNER_TEMP\/ffprobe-compat" --no-save --package-lock=false --ignore-scripts --force @ffprobe-installer\/win32-x64@5\.1\.0[\s\S]*?BVIDEO_SIDECAR_FFPROBE=\$RUNNER_TEMP\/ffprobe-compat\/node_modules\/@ffprobe-installer\/win32-x64\/ffprobe\.exe/u
  );

  const installDependencies = workflow.match(/- name: Install frontend dependencies[\s\S]*?run: npm ci/u)?.[0];
  assert.ok(installDependencies);
  assert.doesNotMatch(installDependencies, /npm_config_cpu/u);

  const compatibilityInstall = workflow.match(/- name: Install Windows ARM64 FFprobe compatibility package[\s\S]*?(?=\n\s+- name:)/u)?.[0];
  assert.ok(compatibilityInstall);
  assert.match(compatibilityInstall, /--prefix "\$RUNNER_TEMP\/ffprobe-compat"/u);
});

test("prepares the signed Linux updater before uploading artifacts", () => {
  const prepareUpdater = workflow.match(/- name: Prepare Linux updater[\s\S]*?(?=\n\s+- name:)/u)?.[0];
  assert.ok(prepareUpdater);
  assert.match(prepareUpdater, /if: runner\.os == 'Linux'/u);
  assert.match(prepareUpdater, /LINUX_UPDATER_DIRECTORY: src-tauri\/target\/\$\{\{ matrix\.target \}\}\/release\/bundle\/appimage/u);
  assert.match(prepareUpdater, /TAURI_SIGNING_PRIVATE_KEY: \$\{\{ secrets\.TAURI_SIGNING_PRIVATE_KEY \}\}/u);
  assert.match(prepareUpdater, /run: node scripts\/prepare-linux-updater\.mjs/u);

  assert.ok(workflow.indexOf("- name: Prepare Linux updater") < workflow.indexOf("- name: Upload desktop bundles"));
});

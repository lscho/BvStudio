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

test("wires the license server URL into the updater config and every release build", () => {
  // 端点域名不再单独配置：写进 YAML 却不被引用的变量不会进入构建环境，等于静默失效。
  assert.doesNotMatch(workflow, /TAURI_UPDATER_ENDPOINT/u);

  const configStep = workflow.match(/- name: Prepare signed updater configuration[\s\S]*?(?=\n\s+- name:)/u)?.[0];
  assert.ok(configStep);
  assert.match(configStep, /VITE_ENABLE_UPDATER: \$\{\{ vars\.VITE_ENABLE_UPDATER == 'true' && 'true' \|\| 'false' \}\}/u);
  assert.match(configStep, /VITE_LICENSE_SERVER_URL: \$\{\{ vars\.VITE_LICENSE_SERVER_URL \}\}/u);

  const buildSteps = workflow.match(/- name: Build [^\n]*bundles[\s\S]*?run: npm run tauri -- build[^\n]*/gu) ?? [];
  assert.equal(buildSteps.length, 3);
  for (const step of buildSteps) {
    assert.match(step, /VITE_ENABLE_UPDATER: \$\{\{ vars\.VITE_ENABLE_UPDATER/u);
    assert.match(step, /VITE_LICENSE_SERVER_URL: \$\{\{ vars\.VITE_LICENSE_SERVER_URL \}\}/u);
    assert.match(
      step,
      /VITE_LICENSE_RESPONSE_KEY: \$\{\{ vars\.VITE_LICENSE_RESPONSE_KEY \|\| secrets\.VITE_LICENSE_RESPONSE_KEY \}\}/u
    );
  }
});

test("titles published releases with the product name instead of the upstream template", () => {
  // Release 标题只在「新建 Release」分支写入，既有的 Release 不会被后续构建改写，
  // 因此这里必须锁住字面值，避免模板名再次漏进用户可见的发布页。
  const releaseStep = workflow.match(/- name: Create or update release[\s\S]*/u)?.[0];
  assert.ok(releaseStep);
  assert.match(releaseStep, /--title "BFrame Studio \$GITHUB_REF_NAME"/u);
  assert.doesNotMatch(workflow, /Tauri Base/u);
});

test("uploads release assets to OSS after the manifest is validated", () => {
  const resolveStep = workflow.match(/- name: Resolve release asset base URL[\s\S]*?(?=\n\s+- name:)/u)?.[0];
  assert.ok(resolveStep);
  assert.match(resolveStep, /CONFIGURED_ASSET_BASE_URL: \$\{\{ vars\.RELEASE_ASSET_BASE_URL \}\}/u);

  // 应用名必须进路径：下载域名可能同时托管多个应用，靠应用名分子目录隔离
  assert.match(resolveStep, /app_slug="\$\(node -p /u);
  assert.match(resolveStep, /require\('\.\/package\.json'\)\.name/u);
  // 应用名读不出来时要直接失败，不能拿猜出来的路径去上传
  assert.match(resolveStep, /无法从 package\.json 读取应用名/u);

  // 版本号必须进对象前缀，否则重发旧版本会覆盖新版本的产物
  assert.match(resolveStep, /baseUrl=\$\{CONFIGURED_ASSET_BASE_URL%\/\}\/\$\{app_slug\}\/releases\/v\$\{version\}/u);
  assert.match(resolveStep, /objectPrefix=\$\{app_slug\}\/releases\/v\$\{version\}/u);

  // 清单必须拿到自建基址，否则会退回 GitHub URL，出现「官网走 CDN、客户端走 GitHub」的错配
  const manifestStep = workflow.match(/- name: Validate bundles and create desktop release manifest[\s\S]*?(?=\n\s+- name:)/u)?.[0];
  assert.ok(manifestStep);
  assert.match(manifestStep, /RELEASE_ASSET_BASE_URL: \$\{\{ steps\.asset-base\.outputs\.baseUrl \}\}/u);

  const uploadStep = workflow.match(/- name: Upload release assets to Aliyun OSS[\s\S]*?(?=\n\s+- name:)/u)?.[0];
  assert.ok(uploadStep);
  // 未配置基址时必须整步跳过，让仓库在没有 OSS 的情况下仍能正常发布
  assert.match(uploadStep, /if: steps\.asset-base\.outputs\.baseUrl != ''/u);
  assert.match(uploadStep, /OSS_ACCESS_KEY_ID: \$\{\{ secrets\.OSS_ACCESS_KEY_ID \}\}/u);
  assert.match(uploadStep, /OSS_ACCESS_KEY_SECRET: \$\{\{ secrets\.OSS_ACCESS_KEY_SECRET \}\}/u);
  // 无 --disable-ignore-error 时批量上传出错会被记为 report 后继续，静默漏传文件
  assert.match(uploadStep, /--disable-ignore-error/u);
  assert.match(uploadStep, /ossutil cp -r "\$staging\/" "oss:\/\/\$\{OSS_BUCKET\}\/\$\{OBJECT_PREFIX\}\/"/u);

  // 上传必须发生在清单发布之前：上传失败就不能让指向空对象的清单流出去
  assert.ok(workflow.indexOf("- name: Upload release assets to Aliyun OSS") < workflow.indexOf("- name: Upload desktop release manifest"));
  // 上传前必须先完成清单校验，它同时保证文件名全局唯一（扁平化上传依赖这一点）
  assert.ok(workflow.indexOf("- name: Validate bundles and create desktop release manifest") < workflow.indexOf("- name: Upload release assets to Aliyun OSS"));
});

test("verifies the downloaded ossutil binary against its checksum", () => {
  const installStep = workflow.match(/- name: Install ossutil[\s\S]*?(?=\n\s+- name:)/u)?.[0];
  assert.ok(installStep);
  assert.match(installStep, /if: steps\.asset-base\.outputs\.baseUrl != ''/u);
  assert.match(installStep, /https:\/\/gosspublic\.alicdn\.com\/ossutil\/v2\/\$\{OSSUTIL_VERSION\}\/ossutil-\$\{OSSUTIL_VERSION\}-linux-amd64\.zip/u);
  assert.match(installStep, /sha256sum -c -/u);
  assert.match(installStep, /OSSUTIL_SHA256: "[0-9a-f]{64}"/u);
});

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
  assert.match(uploadStep, /OSS_REGION: \$\{\{ vars\.OSS_REGION \}\}/u);
  assert.match(uploadStep, /OSS_ACCESS_KEY_ID: \$\{\{ secrets\.OSS_ACCESS_KEY_ID \}\}/u);
  assert.match(uploadStep, /OSS_ACCESS_KEY_SECRET: \$\{\{ secrets\.OSS_ACCESS_KEY_SECRET \}\}/u);
  assert.match(uploadStep, /for name in OSS_REGION OSS_ENDPOINT OSS_BUCKET OSS_ACCESS_KEY_ID OSS_ACCESS_KEY_SECRET; do/u);
  // 逐个文件上传：批量 `cp -r` 下单个文件失败只会被记进 report 再继续，job 仍成功，
  // 产物就静默漏传。单文件 cp 失败会以非零码退出，配合 set -e 让 job 失败。
  assert.match(uploadStep, /for file in "\$\{files\[@\]\}"; do/u);
  // 暂存目录为空时必须失败，不能安静地传 0 个文件
  assert.match(uploadStep, /暂存目录为空，没有可上传的产物/u);

  // 断言只针对真正的命令行（先把 `\` 续行接起来），否则说明性注释里出现过的
  // flag 名字会被下面的否定断言误伤。
  const ossutilCommands = uploadStep
    .replace(/\\\n\s*/gu, " ")
    .split("\n")
    .filter((line) => line.trimStart().startsWith("ossutil "))
    .join("\n");
  assert.ok(ossutilCommands, "未找到 ossutil 命令行");
  assert.match(ossutilCommands, /ossutil cp "\$file" "oss:\/\/\$\{OSS_BUCKET\}\/\$\{OBJECT_PREFIX\}\/\$\{name\}"/u);
  assert.match(ossutilCommands, /--region "\$OSS_REGION"/u);
  assert.doesNotMatch(ossutilCommands, /cp -r/u);
  // ossutil 2.x 没有 1.x 的 disable-ignore-error，写了会直接报 unknown flag；
  // no-error-report 只关报告文件，不改变退出码语义，加了也没用。
  assert.doesNotMatch(ossutilCommands, /disable-ignore-error/u);
  assert.doesNotMatch(ossutilCommands, /no-error-report/u);

  // 上传必须发生在清单发布之前：上传失败就不能让指向空对象的清单流出去
  assert.ok(workflow.indexOf("- name: Upload release assets to Aliyun OSS") < workflow.indexOf("- name: Upload desktop release manifest"));
  // 上传前必须先完成清单校验，它同时保证文件名全局唯一（扁平化上传依赖这一点）
  assert.ok(workflow.indexOf("- name: Validate bundles and create desktop release manifest") < workflow.indexOf("- name: Upload release assets to Aliyun OSS"));
});

test("publishes tag releases to ESA EdgeKV after the GitHub Release succeeds", () => {
  const publishJob = workflow.match(/\n  publish-esa-release:\n[\s\S]*$/u)?.[0];
  assert.ok(publishJob);
  assert.match(publishJob, /if: startsWith\(github\.ref, 'refs\/tags\/v'\)/u);
  assert.match(publishJob, /needs: \[prepare-release, release\]/u);
  assert.match(publishJob, /uses: actions\/download-artifact@v4/u);
  assert.match(publishJob, /name: bframe-studio-desktop-release-manifest/u);
  assert.match(publishJob, /ESA_KV_NAMESPACE: \$\{\{ vars\.ESA_KV_NAMESPACE \}\}/u);
  assert.match(publishJob, /ESA_ACCESS_KEY_ID: \$\{\{ secrets\.ESA_ACCESS_KEY_ID \}\}/u);
  assert.match(publishJob, /ESA_ACCESS_KEY_SECRET: \$\{\{ secrets\.ESA_ACCESS_KEY_SECRET \}\}/u);
  assert.match(
    publishJob,
    /node scripts\/import-desktop-release\.mjs[\s\S]*--manifest release-manifest\/desktop-release-manifest\.json[\s\S]*--namespace "\$ESA_KV_NAMESPACE"/u
  );
});

test("verifies the downloaded ossutil binary against its checksum", () => {
  const installStep = workflow.match(/- name: Install ossutil[\s\S]*?(?=\n\s+- name:)/u)?.[0];
  assert.ok(installStep);
  assert.match(installStep, /if: steps\.asset-base\.outputs\.baseUrl != ''/u);
  assert.match(installStep, /https:\/\/gosspublic\.alicdn\.com\/ossutil\/v2\/\$\{OSSUTIL_VERSION\}\/ossutil-\$\{OSSUTIL_VERSION\}-linux-amd64\.zip/u);
  assert.match(installStep, /sha256sum -c -/u);
  assert.match(installStep, /OSSUTIL_SHA256: "[0-9a-f]{64}"/u);
  // 官方 zip 内含一层 ossutil-<版本>-linux-amd64/ 目录，必须用 -j 扁平化解压；
  // 不带 -j 会解到子目录里，chmod 报 "cannot access .../ossutil"（曾真实失败过）。
  assert.match(installStep, /unzip -j -q -o "\$archive" -d "\$RUNNER_TEMP\/ossutil-bin"/u);
  assert.match(installStep, /\[ ! -f "\$RUNNER_TEMP\/ossutil-bin\/ossutil" \]/u);
});

test("builds only Windows x64 and macOS Apple Silicon", () => {
  const matrix = workflow.match(/matrix:\n[\s\S]*?(?=\n    steps:)/u)?.[0];
  assert.ok(matrix);
  const targets = [...matrix.matchAll(/target: (\S+)/gu)].map((match) => match[1]);
  assert.deepEqual(targets, ["x86_64-pc-windows-msvc", "aarch64-apple-darwin"]);

  // artifact 名即清单脚本的 artifactDirectory 输入，同样只保留这两个，
  // 避免矩阵裁剪后这里还留着已不构建的平台。
  const artifacts = [...matrix.matchAll(/artifact: (\S+)/gu)].map((match) => match[1]);
  assert.deepEqual(artifacts, ["bframe-studio-windows-x64", "bframe-studio-macos-arm64"]);

  // 其余平台的构建步骤仍按 runner.os 门控保留，恢复某个平台只需加回一条矩阵条目。
  assert.match(workflow, /- name: Build Linux bundles\n\s+if: runner\.os == 'Linux'/u);
  assert.match(workflow, /- name: Build Windows bundles\n\s+if: runner\.os == 'Windows'/u);
});

test("every matrix artifact maps to a known artifact directory", () => {
  // 清单脚本按「产物目录是否存在」决定平台集合，目录名对不上会被静默跳过（只打一行提示），
  // 相当于那个平台永远发不出去。这里反向核对，把重命名漂移挡在 CI 之前。
  const manifestScript = readFileSync(
    fileURLToPath(new URL("../scripts/build-desktop-release-manifest.mjs", import.meta.url)),
    "utf8"
  );
  const knownDirectories = new Set(
    [...manifestScript.matchAll(/artifactDirectory: "([^"]+)"/gu)].map((match) => match[1])
  );
  assert.ok(knownDirectories.size >= 5, "清单脚本的平台目录清单疑似被删减");

  const matrix = workflow.match(/matrix:\n[\s\S]*?(?=\n    steps:)/u)?.[0];
  assert.ok(matrix);
  for (const [, artifact] of matrix.matchAll(/artifact: (\S+)/gu)) {
    assert.ok(
      knownDirectories.has(artifact),
      `矩阵 artifact「${artifact}」不在清单脚本的 artifactDirectory 中，会被静默跳过而永不发布`
    );
  }
});

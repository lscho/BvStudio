import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const PLATFORM_ARTIFACTS = [
  {
    platform: "windows-x86",
    artifactDirectory: "bframe-studio-windows-x64",
    installerSuffix: ".exe",
    updaterSuffix: ".exe",
    updaterUsesInstaller: true,
    updaterArchSuffix: null
  },
  {
    platform: "windows-arm",
    artifactDirectory: "bframe-studio-windows-arm64",
    installerSuffix: ".exe",
    updaterSuffix: ".exe",
    updaterUsesInstaller: true,
    updaterArchSuffix: null
  },
  {
    platform: "macos-x86",
    artifactDirectory: "bframe-studio-macos-x64",
    installerSuffix: ".dmg",
    updaterSuffix: ".app.tar.gz",
    updaterUsesInstaller: false,
    updaterArchSuffix: "_x64"
  },
  {
    platform: "macos-arm",
    artifactDirectory: "bframe-studio-macos-arm64",
    installerSuffix: ".dmg",
    updaterSuffix: ".app.tar.gz",
    updaterUsesInstaller: false,
    updaterArchSuffix: "_arm64"
  },
  {
    platform: "linux-x86",
    artifactDirectory: "bframe-studio-linux-x64",
    installerSuffix: ".AppImage",
    updaterSuffix: ".AppImage.tar.gz",
    updaterUsesInstaller: false,
    updaterArchSuffix: null
  }
];

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function normalizeVersion(value) {
  const version = value.replace(/^v/u, "");
  if (
    !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u.test(
      version
    )
  ) {
    throw new Error(`Invalid semantic version: ${value}`);
  }
  return version;
}

function filesUnder(directory) {
  if (!existsSync(directory)) throw new Error(`Missing artifact directory: ${directory}`);

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function exactlyOne(files, predicate, description) {
  const matches = files.filter(predicate);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one ${description}, found ${matches.length}: ${matches.map((path) => basename(path)).join(", ")}`);
  }
  return matches[0];
}

function updaterPredicate(definition) {
  return (path) => basename(path).endsWith(definition.updaterSuffix)
    && (!definition.updaterArchSuffix || basename(path).includes(`${definition.updaterArchSuffix}${definition.updaterSuffix}`));
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

function assetUrl(baseUrl, fileName) {
  return baseUrl ? `${baseUrl.replace(/\/$/u, "")}/${encodeURIComponent(fileName)}` : null;
}

async function fileMetadata(path, sourceAssetBaseUrl) {
  const fileName = basename(path);
  return {
    fileName,
    fileSize: statSync(path).size,
    sha256: await sha256(path),
    sourceUrl: assetUrl(sourceAssetBaseUrl, fileName)
  };
}

const version = normalizeVersion(requiredEnvironment("RELEASE_VERSION"));
const releaseTag = process.env.RELEASE_TAG?.trim();
const tag = releaseTag ? `v${releaseTag.replace(/^v/u, "")}` : `v${version}`;
if (normalizeVersion(tag) !== version) throw new Error(`Release tag ${tag} does not match version ${version}`);
const artifactsDirectory = resolve(process.env.RELEASE_ARTIFACTS_DIR?.trim() || "release-artifacts");
const outputPath = resolve(process.env.RELEASE_MANIFEST_PATH?.trim() || "desktop-release-manifest.json");
const repository = process.env.GITHUB_REPOSITORY?.trim() || null;
const commitSha = process.env.GITHUB_SHA?.trim() || null;
const githubServerUrl = process.env.GITHUB_SERVER_URL?.trim() || "https://github.com";
const publishGitHubRelease = process.env.PUBLISH_GITHUB_RELEASE === "true";

/**
 * 发布资产的公开基址。配置后（例如自建 OSS + CDN）清单里的 sourceUrl 一律指向它，
 * 客户端更新与官网下载页都会跟着切换；未配置时保持原有行为，回退到 GitHub Release。
 * 只接受 https：客户端与 edge 侧都会校验下载地址的协议。
 */
const configuredAssetBaseUrl = process.env.RELEASE_ASSET_BASE_URL?.trim() || null;
if (configuredAssetBaseUrl) {
  let parsedAssetBaseUrl;
  try {
    parsedAssetBaseUrl = new URL(configuredAssetBaseUrl);
  } catch {
    throw new Error(`RELEASE_ASSET_BASE_URL is not a valid URL: ${configuredAssetBaseUrl}`);
  }
  if (parsedAssetBaseUrl.protocol !== "https:") {
    throw new Error("RELEASE_ASSET_BASE_URL must use HTTPS");
  }
}

const sourceAssetBaseUrl =
  configuredAssetBaseUrl ??
  (publishGitHubRelease && repository
    ? `${githubServerUrl.replace(/\/$/u, "")}/${repository}/releases/download/${encodeURIComponent(tag)}`
    : null);
const usedAssetNames = new Set();

const platforms = [];
const skippedPlatforms = [];
for (const definition of PLATFORM_ARTIFACTS) {
  const directory = join(artifactsDirectory, definition.artifactDirectory);
  /**
   * 平台集合以「实际构建出的产物」为准：构建矩阵里没有的平台不会有对应 artifact 目录。
   * 目录存在但缺文件仍按错误处理（上传步骤有 if-no-files-found: error 兜底），
   * 避免把「构建失败」误判成「该平台本次未启用」。
   */
  if (!existsSync(directory)) {
    skippedPlatforms.push(definition.platform);
    continue;
  }
  const files = filesUnder(directory);
  const installerPath = exactlyOne(
    files,
    (path) => basename(path).endsWith(definition.installerSuffix),
    `${definition.platform} installer (${definition.installerSuffix})`
  );
  const updaterPath = definition.updaterUsesInstaller
    ? installerPath
    : exactlyOne(
        files,
        updaterPredicate(definition),
        `${definition.platform} updater package (${definition.updaterArchSuffix ?? ""}${definition.updaterSuffix})`
      );
  const updaterFileName = basename(updaterPath);
  const signaturePath = exactlyOne(
    files,
    (path) => basename(path) === `${updaterFileName}.sig`,
    `${definition.platform} updater signature (${updaterFileName}.sig)`
  );
  const signature = readFileSync(signaturePath, "utf8").trim();
  if (!signature) throw new Error(`Updater signature is empty: ${signaturePath}`);

  for (const path of new Set([installerPath, updaterPath, signaturePath])) {
    const fileName = basename(path);
    if (usedAssetNames.has(fileName)) throw new Error(`Duplicate GitHub Release asset name: ${fileName}`);
    usedAssetNames.add(fileName);
  }

  platforms.push({
    platform: definition.platform,
    installer: await fileMetadata(installerPath, sourceAssetBaseUrl),
    updater: {
      ...(await fileMetadata(updaterPath, sourceAssetBaseUrl)),
      signatureFileName: basename(signaturePath),
      signature
    }
  });
}

if (!platforms.length) {
  throw new Error(
    `未找到任何平台产物目录，请检查 ${artifactsDirectory} 与构建矩阵。已跳过：${skippedPlatforms.join(", ") || "（无）"}`
  );
}
if (skippedPlatforms.length) {
  console.error(`提示：以下平台本次未构建，不会出现在清单中：${skippedPlatforms.join(", ")}`);
}

const manifest = {
  schemaVersion: 1,
  version,
  tag,
  generatedAt: new Date().toISOString(),
  repository,
  commitSha,
  platforms
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(outputPath);

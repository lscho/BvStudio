import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 生成 `$RUNNER_TEMP/bframe-studio-release/tauri.release.conf.json`，作为 `tauri build --config` 的临时覆盖。
 *
 * 更新端点不再单独配置：域名只从 VITE_LICENSE_SERVER_URL 取（授权服务与桌面更新服务共用同一个
 * ESA 边缘函数），路径与平台占位符由本脚本拼接。开关 VITE_ENABLE_UPDATER 与客户端
 * src/services/updater.ts 的 `import.meta.env.VITE_ENABLE_UPDATER === "true"` 判定保持一致，
 * 未开启时端点为「无」，避免留下「已配置但被前端挡住」的死配置。
 */

/** 更新端点路径，与 edge/update-server.mjs 的 UPDATE_PATH 一致。 */
const UPDATE_PATH = "/api/desktop-updates/latest";
/** 客户端 Tauri updater 在运行期替换该占位符，服务端只认五个平台值。 */
const TARGET_PLACEHOLDER = "{{target}}";

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

/** 从授权服务域名推导更新端点。域名必须只含 origin，避免拼出 /api/api/... 这类错误路径。 */
function updateEndpointFrom(serverUrl) {
  const raw = (serverUrl ?? "").trim();
  if (!raw) {
    throw new Error("VITE_ENABLE_UPDATER is true but VITE_LICENSE_SERVER_URL is not set");
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`VITE_LICENSE_SERVER_URL is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error("VITE_LICENSE_SERVER_URL must use HTTPS");
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error(`VITE_LICENSE_SERVER_URL must contain only the origin (no path, query or hash): ${raw}`);
  }

  const endpoint = `${parsed.origin}${UPDATE_PATH}?platform=${TARGET_PLACEHOLDER}`;
  // 不变式自检：占位符缺失会让全部平台都拿不到正确的更新包
  if (!endpoint.includes(TARGET_PLACEHOLDER)) {
    throw new Error("updater endpoint is missing the {{target}} placeholder");
  }
  return endpoint;
}

const releaseVersion = requiredEnvironment("RELEASE_VERSION").replace(/^v/u, "");
const publicKey = requiredEnvironment("TAURI_SIGNING_PUBLIC_KEY");
const runnerTemp = requiredEnvironment("RUNNER_TEMP");

if (
  !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u.test(
    releaseVersion
  )
) {
  throw new Error(`Invalid semantic version: ${releaseVersion}`);
}

// 与客户端判定保持严格一致（src/services/updater.ts 同样是 === "true"），
// 因此这里不 trim：带空格的取值在两侧都会视为「未开启」。
const updaterEnabled = process.env.VITE_ENABLE_UPDATER === "true";
const endpoints = updaterEnabled ? [updateEndpointFrom(process.env.VITE_LICENSE_SERVER_URL)] : [];

const outputDirectory = join(runnerTemp, "bframe-studio-release");
const outputPath = join(outputDirectory, "tauri.release.conf.json");
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      version: releaseVersion,
      bundle: { createUpdaterArtifacts: true },
      plugins: {
        updater: {
          endpoints,
          pubkey: publicKey,
          windows: { installMode: "passive" }
        }
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

console.log(outputPath);

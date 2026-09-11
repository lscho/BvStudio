#!/usr/bin/env node
/**
 * 把 desktop-release-manifest.json 校验后导入线上 ESA EdgeKV，发布桌面更新记录。
 *
 * 用法（推荐通过 npm 快捷方式，工作目录固定在仓库根目录）：
 *   npm run esa:import-release -- --manifest release-manifest/desktop-release-manifest.json
 *   npm run esa:import-release -- --manifest <path> --notes "修复导出偶发失败" --force-update
 *   npm run esa:import-release -- --manifest <path> --notes-file CHANGELOG.md
 *   npm run esa:import-release -- --manifest <path> --dry-run          # 只校验和打印，不写入
 *
 * 全部五个平台必须先通过校验再整体写入：任一条不合格则整批中止，
 * 避免出现「只剩某个平台停在旧版本」的半发布状态。
 *
 * 凭证解析优先级：环境变量 ESA_ACCESS_KEY_ID/ESA_ACCESS_KEY_SECRET > esa-cli 登录态。
 * 命名空间默认读取 edge/config.js 的 KV_NAMESPACE（该文件已 gitignore），可用 --namespace 覆盖。
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  CLIENT_UPDATE_PLATFORMS,
  fileNameFromUrl,
  isHttpsUrl,
  isRfc3339,
  isSemver,
  isValidUpdatePlatform,
  normalizeVersion,
  positiveInteger,
  releaseKeyFor,
  trimmedString
} from "../edge/release-core.mjs";
import { loadSavedEsaCredentials, resolveNamespace } from "./import-license-cards.mjs";

const require = createRequire(import.meta.url);

function parseArgs(argv) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        args[token.slice(2)] = true;
      } else {
        args[token.slice(2)] = value;
        index += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

const SEMVER_PARTS_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** SemVer 比较，返回 -1 / 0 / 1；任一侧无法解析时返回 null。预发布版本小于同号正式版。 */
export function compareSemver(left, right) {
  const parse = (value) => {
    const match = SEMVER_PARTS_RE.exec(normalizeVersion(value));
    if (!match) return null;
    return { numbers: [match[1], match[2], match[3]].map(Number), prerelease: match[4] ? match[4].split(".") : [] };
  };
  const a = parse(left);
  const b = parse(right);
  if (!a || !b) return null;

  for (let index = 0; index < 3; index += 1) {
    if (a.numbers[index] !== b.numbers[index]) return a.numbers[index] < b.numbers[index] ? -1 : 1;
  }
  if (!a.prerelease.length && !b.prerelease.length) return 0;
  if (!a.prerelease.length) return 1;
  if (!b.prerelease.length) return -1;

  for (let index = 0; index < Math.max(a.prerelease.length, b.prerelease.length); index += 1) {
    const x = a.prerelease[index];
    const y = b.prerelease[index];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xNumeric = /^\d+$/.test(x);
    const yNumeric = /^\d+$/.test(y);
    if (xNumeric && yNumeric) {
      if (Number(x) !== Number(y)) return Number(x) < Number(y) ? -1 : 1;
      continue;
    }
    if (xNumeric !== yNumeric) return xNumeric ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/**
 * 按 repository + tag + 文件名推导 GitHub Release 资产地址。
 * 正式发布（tag 推送）时清单自带 sourceUrl，只有手工触发 workflow 才会走到这里；
 * 信息不足时返回空串，由调用方作为清单缺陷上报。
 */
export function deriveUpdaterUrl(manifest, updater) {
  const repository = trimmedString(manifest?.repository);
  const tag = trimmedString(manifest?.tag);
  const fileName = trimmedString(updater?.fileName);
  if (!repository || !tag || !fileName) return "";
  return `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(fileName)}`;
}

/**
 * 清单 → 五平台 KV 记录。返回 { records, problems }，
 * problems 非空时调用方必须整批中止。
 */
export function buildReleaseRecords(
  manifest,
  { notes = "", isForceUpdate = false, pubDate = null, importedAt = new Date().toISOString() } = {}
) {
  const problems = [];

  const version = normalizeVersion(manifest?.version);
  if (!isSemver(version)) problems.push(`清单 version 不是合法 SemVer：${JSON.stringify(manifest?.version)}`);

  const date = trimmedString(pubDate) || trimmedString(manifest?.generatedAt);
  if (!isRfc3339(date)) {
    problems.push(`pub_date 必须是带时区的 RFC3339 时间戳，当前为：${JSON.stringify(date)}`);
  }

  const platforms = Array.isArray(manifest?.platforms) ? manifest.platforms : [];
  if (!platforms.length) problems.push("清单缺少 platforms 数组");

  for (const entry of platforms) {
    if (!isValidUpdatePlatform(entry?.platform)) {
      problems.push(`清单含未知平台：${JSON.stringify(entry?.platform)}`);
    }
  }

  const tag = trimmedString(manifest?.tag);
  const repository = trimmedString(manifest?.repository);
  const commitSha = trimmedString(manifest?.commitSha);
  const records = [];

  for (const platform of CLIENT_UPDATE_PLATFORMS) {
    const entry = platforms.find((item) => item?.platform === platform);
    if (!entry) {
      problems.push(`清单缺少平台 ${platform}`);
      continue;
    }

    const updater = entry.updater ?? {};
    // 清单自带的 sourceUrl 优先；非空却不合法时明确报错，不静默换成推导地址。
    const rawSourceUrl = trimmedString(updater.sourceUrl);
    const url = rawSourceUrl || deriveUpdaterUrl(manifest, updater);
    if (!isHttpsUrl(url)) {
      problems.push(
        rawSourceUrl
          ? `${platform} 清单中的 sourceUrl 不是合法的 https 地址：${JSON.stringify(rawSourceUrl)}`
          : `${platform} 缺少可用的更新包地址（sourceUrl 为空且无法按 tag 推导）`
      );
    }

    const signature = trimmedString(updater.signature);
    if (!signature) problems.push(`${platform} 更新包签名缺失或为空`);

    const fileSize = positiveInteger(updater.fileSize);
    if (fileSize === null) problems.push(`${platform} 更新包 fileSize 不是正整数`);

    /**
     * 安装包与更新包在 macOS/Linux 上是两个不同文件（`.dmg` vs `.app.tar.gz`、`.AppImage` vs
     * `*.AppImage.tar.gz`），Windows 上才是同一个 `.exe`。Tauri 更新契约要求 `url` 必须是更新包，
     * 因此官网下载页需要单独一份安装包地址，否则「下载 DMG」会拿到 `.app.tar.gz`。
     */
    const installer = entry.installer ?? {};
    const rawInstallerUrl = trimmedString(installer.sourceUrl);
    const installerUrl = rawInstallerUrl || deriveUpdaterUrl(manifest, installer);
    if (!isHttpsUrl(installerUrl)) {
      problems.push(
        rawInstallerUrl
          ? `${platform} 清单中的安装包 sourceUrl 不是合法的 https 地址：${JSON.stringify(rawInstallerUrl)}`
          : `${platform} 缺少可用的安装包地址（sourceUrl 为空且无法按 tag 推导）`
      );
    }
    const installerFileSize = positiveInteger(installer.fileSize);
    if (installerFileSize === null) problems.push(`${platform} 安装包 fileSize 不是正整数`);

    records.push({
      platform,
      version,
      url,
      signature,
      fileName: trimmedString(updater.fileName) || fileNameFromUrl(url),
      fileSize,
      installerUrl,
      installerFileName: trimmedString(installer.fileName) || fileNameFromUrl(installerUrl),
      installerFileSize,
      notes: trimmedString(notes),
      pub_date: date,
      isForceUpdate: isForceUpdate === true,
      tag,
      repository,
      commitSha,
      importedAt
    });
  }

  return { records, problems };
}

/**
 * 决定单条记录是否写入。已发布版本更高时默认拒绝，
 * 避免重跑旧 tag 把全体客户端回滚到旧版本。
 */
export function decideImport({ existing, candidate, allowDowngrade = false }) {
  if (!existing || typeof existing !== "object") return { action: "publish" };

  const current = trimmedString(existing.version);
  const order = compareSemver(candidate.version, current);
  if (order === null) {
    return { action: "publish", warning: `已发布版本 ${JSON.stringify(current)} 无法比较，直接覆盖` };
  }
  if (order === 0) return { action: "publish", warning: `同版本重复导入，覆盖为最新元数据：${candidate.version}` };
  if (order > 0) return { action: "publish" };
  if (allowDowngrade) return { action: "publish", warning: `降级发布：${current} → ${candidate.version}` };
  return { action: "skip", reason: `已发布版本 ${current} 高于待导入的 ${candidate.version}` };
}

const THROTTLE_RE = /Throttling|user flow control/i;
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];
const NOT_FOUND_RE = /InvalidKey\.NotFound|KeyNotFound|NotFound/i;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createEdgeKvClient({ accessKeyId, accessKeySecret, securityToken, endpoint }) {
  const { default: Client } = require("@alicloud/esa20240910/dist/client.js");
  const { Config } = require("@alicloud/openapi-core/dist/utils.js");
  const { GetKvRequest, PutKvRequest } = require("@alicloud/esa20240910");
  const client = new Client(new Config({ accessKeyId, accessKeySecret, securityToken, endpoint }));
  return {
    async get(namespace, key) {
      try {
        const response = await client.getKv(new GetKvRequest({ namespace, key }));
        return response.body?.value ?? null;
      } catch (error) {
        // 键不存在不是错误：首次发布时所有 release:latest:* 都还没有值
        if (NOT_FOUND_RE.test(String(error?.message ?? error))) return null;
        throw error;
      }
    },
    async put(namespace, key, value) {
      await client.putKv(new PutKvRequest({ namespace, key, value }));
    }
  };
}

/** 有限次退避重试；putKv 幂等，失败后整批重跑安全。 */
async function withRetry(operation, onRetry) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const message = String(error?.message ?? error);
      if (attempt >= RETRY_DELAYS_MS.length || !THROTTLE_RE.test(message)) throw error;
      onRetry?.(attempt + 1);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

function readNotes(args) {
  if (typeof args["notes-file"] === "string") {
    if (!existsSync(args["notes-file"])) throw new Error(`更新说明文件不存在：${args["notes-file"]}`);
    return readFileSync(args["notes-file"], "utf8");
  }
  return typeof args.notes === "string" ? args.notes : "";
}

/** 顺序写入：只有 5 条记录，并发收益可忽略，顺序执行便于定位单平台失败。 */
export async function importReleaseRecords({ records, namespace, kv, allowDowngrade = false, onEvent = null }) {
  const failures = [];
  const skipped = [];
  for (const record of records) {
    const key = releaseKeyFor(record.platform);
    try {
      const raw = await withRetry(() => kv.get(namespace, key), (attempt) =>
        onEvent?.({ type: "retry", platform: record.platform, phase: "read", attempt })
      );
      let existing = null;
      if (raw) {
        try {
          existing = JSON.parse(raw);
        } catch {
          onEvent?.({ type: "warning", platform: record.platform, message: "已发布记录不是合法 JSON，将覆盖" });
        }
      }

      const decision = decideImport({ existing, candidate: record, allowDowngrade });
      if (decision.warning) onEvent?.({ type: "warning", platform: record.platform, message: decision.warning });
      if (decision.action === "skip") {
        skipped.push({ platform: record.platform, reason: decision.reason });
        onEvent?.({ type: "skip", platform: record.platform, message: decision.reason });
        continue;
      }

      await withRetry(() => kv.put(namespace, key, JSON.stringify(record)), (attempt) =>
        onEvent?.({ type: "retry", platform: record.platform, phase: "write", attempt })
      );
      onEvent?.({ type: "published", platform: record.platform, version: record.version });
    } catch (error) {
      failures.push({ platform: record.platform, error: String(error?.message ?? error) });
      onEvent?.({ type: "failure", platform: record.platform, message: String(error?.message ?? error) });
    }
  }
  return { failures, skipped };
}

async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const manifestPath = typeof args.manifest === "string" ? args.manifest : "desktop-release-manifest.json";
  if (!existsSync(manifestPath)) {
    throw new Error(`未找到发布清单：${manifestPath}（用 --manifest <path> 指定）`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const notes = readNotes(args).trim();
  const { records, problems } = buildReleaseRecords(manifest, {
    notes,
    isForceUpdate: args["force-update"] === true,
    pubDate: typeof args["pub-date"] === "string" ? args["pub-date"] : null
  });

  if (problems.length) {
    console.error(`清单校验未通过，共 ${problems.length} 项，已整批中止：`);
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.warn(
    `清单校验通过：v${normalizeVersion(manifest.version)}，${records.length} 个平台` +
      `${args["force-update"] === true ? "，标记为强制更新" : ""}${notes ? `，说明 ${notes.length} 字` : "，无更新说明"}。`
  );

  if (args["dry-run"]) {
    console.log(JSON.stringify(records, null, 2));
    console.warn("dry-run：未执行上传。");
    return;
  }

  const namespace = await resolveNamespace(args);
  const saved = loadSavedEsaCredentials();
  const accessKeyId = process.env.ESA_ACCESS_KEY_ID ?? saved?.accessKeyId;
  const accessKeySecret = process.env.ESA_ACCESS_KEY_SECRET ?? saved?.accessKeySecret;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("缺少凭证：先 esa-cli login，或 export ESA_ACCESS_KEY_ID / ESA_ACCESS_KEY_SECRET");
  }
  const endpoint = process.env.ESA_ENDPOINT ?? saved?.endpoint ?? "esa.cn-hangzhou.aliyuncs.com";

  const kv = createEdgeKvClient({
    accessKeyId,
    accessKeySecret,
    securityToken: saved?.securityToken,
    endpoint
  });

  const { failures, skipped } = await importReleaseRecords({
    records,
    namespace,
    kv,
    allowDowngrade: args["allow-downgrade"] === true,
    onEvent: (event) => {
      if (event.type === "published") console.log(`已发布 ${event.platform} → v${event.version}`);
      else if (event.type === "skip") console.warn(`跳过 ${event.platform}：${event.message}`);
      else if (event.type === "warning") console.warn(`注意 ${event.platform}：${event.message}`);
      else if (event.type === "retry") console.warn(`限流退避（第 ${event.attempt} 次重试）：${event.platform} ${event.phase}`);
    }
  });

  if (failures.length) {
    console.error(`${failures.length} 个平台写入失败（putKv 幂等，可直接重跑同一命令）：`);
    for (const failure of failures) console.error(`  ${failure.platform}  →  ${failure.error}`);
    process.exitCode = 1;
    return;
  }

  const published = records.length - skipped.length;
  console.warn(
    `完成：命名空间 ${namespace} 已更新 ${published} 个平台${skipped.length ? `，跳过 ${skipped.length} 个（版本已更高）` : ""}。`
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

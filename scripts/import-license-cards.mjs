#!/usr/bin/env node
/**
 * 批量生成卡密并直接写入线上 ESA EdgeKV（PutKv OpenAPI），随后打印卡密清单。
 *
 * 用法（推荐通过 npm 快捷方式，工作目录固定在仓库根目录）：
 *   npm run esa:import -- --count 100 --plan lifetime
 *   npm run esa:import -- --count 100 --plan monthly
 *   npm run esa:import -- --count 50 --plan period --days 365
 *   npm run esa:import -- --input license-cards-2026.json          # 导入已生成的清单（幂等，重复 put 覆盖）
 *   npm run esa:import -- --count 1 --plan lifetime --dry-run      # 只生成和展示，不上传
 *
 * 凭证解析优先级：环境变量 ESA_ACCESS_KEY_ID/ESA_ACCESS_KEY_SECRET > esa-cli 登录态（~/.esa/config/default.toml）。
 * 环境变量适合 CI；本地交互使用直接复用 `esa-cli login` 的凭证，无需再导出。
 *
 * 命名空间默认读取 edge/config.js 的 KV_NAMESPACE（该文件已 gitignore），可用 --namespace 覆盖。
 * 输出清单含卡密明文，license-cards* 已被 .gitignore 忽略，仅限离线保存与发放。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { generateCards } from "./generate-license-cards.mjs";

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

export async function resolveNamespace(args) {
  if (Object.hasOwn(args ?? {}, "namespace")) {
    if (typeof args.namespace !== "string" || !args.namespace.trim()) {
      throw new Error("--namespace 必须是非空名称");
    }
    return args.namespace.trim();
  }

  const configUrl = new URL("../edge/config.js", import.meta.url);
  if (existsSync(configUrl)) {
    const config = await import(configUrl.href);
    if (config.CONFIG?.KV_NAMESPACE) return config.CONFIG.KV_NAMESPACE;
  }
  throw new Error("未指定命名空间：传入 --namespace <名称>，或先创建 edge/config.js");
}

/**
 * 读取 esa-cli login 保存的凭证（~/.esa/config/default.toml）。
 * 文件结构固定：endpoint = "..." 与 [auth] 段的 accessKeyId/accessKeySecret/securityToken；
 * 用正则提取避免引入 TOML 依赖。
 */
export function loadSavedEsaCredentials() {
  const configPath = new URL(`file://${process.env.HOME}/.esa/config/default.toml`);
  if (!existsSync(configPath)) return null;
  const raw = readFileSync(configPath, "utf8");
  const pick = (name) => raw.match(new RegExp(`^\\s*${name}\\s*=\\s*"([^"]*)"`, "m"))?.[1];
  const accessKeyId = pick("accessKeyId");
  const accessKeySecret = pick("accessKeySecret");
  if (!accessKeyId || !accessKeySecret) return null;
  return { accessKeyId, accessKeySecret, securityToken: pick("securityToken"), endpoint: pick("endpoint") };
}

function createPutKvClient({ accessKeyId, accessKeySecret, securityToken, endpoint }) {
  const { default: Client } = require("@alicloud/esa20240910/dist/client.js");
  const { Config } = require("@alicloud/openapi-core/dist/utils.js");
  const { PutKvRequest } = require("@alicloud/esa20240910");
  const client = new Client(new Config({ accessKeyId, accessKeySecret, securityToken, endpoint }));
  return async (key, value, namespace) => {
    await client.putKv(new PutKvRequest({ namespace, key, value }));
  };
}

/** ESA OpenAPI 限流错误特征；命中后按退避间隔重试。 */
const THROTTLE_RE = /Throttling|user flow control/i;
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function putWithRetry(putKv, card, namespace, onRetry = null) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await putKv(card.kvKey, JSON.stringify(card.kvValue), namespace);
      return;
    } catch (error) {
      const message = String(error?.message ?? error);
      if (attempt >= RETRY_DELAYS_MS.length || !THROTTLE_RE.test(message)) throw error;
      onRetry?.(card.cardKey, attempt + 1);
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

/** 受控导入：并发逐条 put，限流自动退避重试；putKv 幂等，失败后整批重跑安全。 */
export async function importCards({ cards, namespace, putKv, concurrency = 4, onRetry = null }) {
  const failures = [];
  let cursor = 0;
  async function worker() {
    while (cursor < cards.length) {
      const card = cards[cursor];
      cursor += 1;
      try {
        await putWithRetry(putKv, card, namespace, onRetry);
      } catch (error) {
        failures.push({ cardKey: card.cardKey, kvKey: card.kvKey, error: String(error?.message ?? error) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cards.length) }, worker));
  return failures;
}

/** 成功后的输出：每行一张卡密，方便直接复制或重定向到文件。 */
function printCardKeys(cards) {
  for (const card of cards) console.log(card.cardKey);
}

async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const plan = args.plan ?? "lifetime";
  const days = args.days === undefined ? null : Number.parseInt(args.days, 10);

  let manifest;
  if (args.input) {
    manifest = JSON.parse(readFileSync(args.input, "utf8"));
    if (!Array.isArray(manifest.cards)) throw new Error("输入清单格式无效：缺少 cards 数组");
  } else {
    manifest = await generateCards({ count: Number.parseInt(args.count ?? "1", 10), plan, days });
    const output = args.output ?? `license-cards-${Date.now()}.json`;
    writeFileSync(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.warn(`卡密明文清单已写入 ${output}（含明文，严禁提交；发放后离线妥善保管）`);
  }

  const namespace = await resolveNamespace(args);

  if (args["dry-run"]) {
    console.warn(`dry-run（共 ${manifest.cards.length} 张，命名空间 ${namespace}）：未执行上传。`);
    printCardKeys(manifest.cards);
    return;
  }

  const saved = loadSavedEsaCredentials();
  const accessKeyId = process.env.ESA_ACCESS_KEY_ID ?? saved?.accessKeyId;
  const accessKeySecret = process.env.ESA_ACCESS_KEY_SECRET ?? saved?.accessKeySecret;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("缺少凭证：先 esa-cli login，或 export ESA_ACCESS_KEY_ID / ESA_ACCESS_KEY_SECRET");
  }
  const endpoint = process.env.ESA_ENDPOINT ?? saved?.endpoint ?? "esa.cn-hangzhou.aliyuncs.com";

  const putKv = createPutKvClient({ accessKeyId, accessKeySecret, securityToken: saved?.securityToken, endpoint });
  const failures = await importCards({
    cards: manifest.cards,
    namespace,
    putKv,
    onRetry: (cardKey, attempt) => console.warn(`限流退避（第 ${attempt} 次重试）：${cardKey}`)
  });

  if (failures.length) {
    console.error(`${failures.length} 条写入失败（putKv 幂等，可直接重跑整批）：`);
    for (const failure of failures) console.error(`  ${failure.cardKey}  →  ${failure.error}`);
    process.exitCode = 1;
  } else {
    console.warn(`已写入 ${manifest.cards.length} 张卡密到命名空间 ${namespace}，卡密列表：`);
    printCardKeys(manifest.cards);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

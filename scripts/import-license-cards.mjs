#!/usr/bin/env node
/**
 * 批量生成卡密并直接写入线上 ESA EdgeKV（PutKv OpenAPI），随后打印卡密清单。
 *
 * 用法（推荐通过 npm 快捷方式，工作目录固定在仓库根目录）：
 *   npm run esa:import -- --count 100 --plan lifetime
 *   npm run esa:import -- --count 50 --plan period --days 365
 *   npm run esa:import -- --input license-cards-2026.json          # 导入已生成的清单（幂等，重复 put 覆盖）
 *   npm run esa:import -- --count 1 --plan lifetime --dry-run      # 只生成和展示，不上传
 *
 * 凭证（不写入任何文件，只走环境变量）：
 *   export ESA_ACCESS_KEY_ID=...        # RAM 子账号 AccessKey，授权 AliyunESAFullAccess
 *   export ESA_ACCESS_KEY_SECRET=...
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

async function resolveNamespace(args) {
  if (args.namespace) return args.namespace;
  const configUrl = new URL("../edge/config.js", import.meta.url);
  if (existsSync(configUrl)) {
    const config = await import(configUrl.href);
    if (config.CONFIG?.KV_NAMESPACE) return config.CONFIG.KV_NAMESPACE;
  }
  throw new Error("未指定命名空间：传入 --namespace <名称>，或先创建 edge/config.js");
}

function createPutKvClient({ accessKeyId, accessKeySecret }) {
  const { default: Client } = require("@alicloud/esa20240910/dist/client.js");
  const { Config } = require("@alicloud/openapi-core/dist/utils.js");
  const { PutKvRequest } = require("@alicloud/esa20240910");
  const client = new Client(new Config({ accessKeyId, accessKeySecret, endpoint: "esa.cn-hangzhou.aliyuncs.com" }));
  return async (key, value, namespace) => {
    await client.putKv(new PutKvRequest({ namespace, key, value }));
  };
}

/** 受控导入：逐条 put（可并发），返回失败清单；putKv 幂等，失败后整批重跑安全。 */
export async function importCards({ cards, namespace, putKv, concurrency = 8 }) {
  const failures = [];
  let cursor = 0;
  async function worker() {
    while (cursor < cards.length) {
      const card = cards[cursor];
      cursor += 1;
      try {
        await putKv(card.kvKey, JSON.stringify(card.kvValue), namespace);
      } catch (error) {
        failures.push({ cardKey: card.cardKey, kvKey: card.kvKey, error: String(error?.message ?? error) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cards.length) }, worker));
  return failures;
}

function printCards(cards, namespace) {
  console.log(`命名空间：${namespace}`);
  for (const [index, card] of cards.entries()) {
    console.log(`${String(index + 1).padStart(4)}  ${card.cardKey}  →  ${card.kvKey}`);
  }
}

async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const plan = args.plan ?? "lifetime";
  const days = plan === "period" ? Number.parseInt(args.days ?? "", 10) : null;

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
  console.log(`共 ${manifest.cards.length} 张卡密，目标命名空间：${namespace}`);
  printCards(manifest.cards, namespace);

  if (args["dry-run"]) {
    console.log("dry-run：未执行上传。");
    return;
  }

  const accessKeyId = process.env.ESA_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ESA_ACCESS_KEY_SECRET;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("缺少凭证：请先 export ESA_ACCESS_KEY_ID / ESA_ACCESS_KEY_SECRET（RAM 子账号，授权 AliyunESAFullAccess）");
  }

  const putKv = createPutKvClient({ accessKeyId, accessKeySecret });
  const failures = await importCards({ cards: manifest.cards, namespace, putKv });

  if (failures.length) {
    console.error(`\n${failures.length} 条写入失败（putKv 幂等，可直接重跑整批）：`);
    for (const failure of failures) console.error(`  ${failure.cardKey}  →  ${failure.error}`);
    process.exitCode = 1;
  } else {
    console.log("\n全部写入完成。");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

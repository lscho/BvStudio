#!/usr/bin/env node
/**
 * 清空 ESA EdgeKV 命名空间（或按前缀清理）。
 *
 * 用法：
 *   npm run esa:clear-kv                # 清空命名空间全部键
 *   npm run esa:clear-kv -- --prefix device:
 *   npm run esa:clear-kv -- --dry-run   # 只列出将删除的键
 *
 * 危险操作：删除后无法恢复（卡密需重新生成导入，发布记录需重新执行 esa:import-release）。
 * 凭证与命名空间解析同 esa:import（环境变量 > esa-cli 登录态；--namespace 可覆盖）。
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { loadSavedEsaCredentials, resolveNamespace } from "./import-license-cards.mjs";

const require = createRequire(import.meta.url);
const THROTTLE_RE = /Throttling|user flow control/i;
const RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 8000];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createEsaClient() {
  const saved = loadSavedEsaCredentials();
  const accessKeyId = process.env.ESA_ACCESS_KEY_ID ?? saved?.accessKeyId;
  const accessKeySecret = process.env.ESA_ACCESS_KEY_SECRET ?? saved?.accessKeySecret;
  if (!accessKeyId || !accessKeySecret) {
    throw new Error("缺少凭证：先 esa-cli login，或 export ESA_ACCESS_KEY_ID / ESA_ACCESS_KEY_SECRET");
  }
  const endpoint = process.env.ESA_ENDPOINT ?? saved?.endpoint ?? "esa.cn-hangzhou.aliyuncs.com";
  const { default: Client } = require("@alicloud/esa20240910/dist/client.js");
  const { Config } = require("@alicloud/openapi-core/dist/utils.js");
  const { ListKvsRequest, DeleteKvRequest } = require("@alicloud/esa20240910");
  const client = new Client(new Config({ accessKeyId, accessKeySecret, securityToken: saved?.securityToken, endpoint }));
  return {
    /** 始终取第 1 页：删除会改变排序，逐轮清空即可。 */
    async listKeys(namespace, prefix) {
      const response = await client.listKvs(new ListKvsRequest({ namespace, pageNumber: 1, pageSize: 100, ...(prefix ? { prefix } : {}) }));
      return (response.body?.keys ?? []).map((entry) => entry.name).filter(Boolean);
    },
    async deleteKey(namespace, key) {
      for (let attempt = 0; ; attempt += 1) {
        try {
          await client.deleteKv(new DeleteKvRequest({ namespace, key }));
          return;
        } catch (error) {
          const message = String(error?.message ?? error);
          // 列表最终一致会重复返回已删除的键，404 即目标已消失
          if (/InvalidKey\.NotFound/i.test(message)) return;
          if (attempt >= RETRY_DELAYS_MS.length || !THROTTLE_RE.test(message)) throw error;
          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }
    }
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token.startsWith("--")) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) args[token.slice(2)] = true;
      else {
        args[token.slice(2)] = value;
        index += 1;
      }
    }
  }
  return args;
}

export async function clearNamespace({ namespace, prefix, listKeys, deleteKey, onProgress = null }) {
  const failures = [];
  const failedKeys = new Set();
  let deleted = 0;
  for (;;) {
    const keys = (await listKeys(namespace, prefix)).filter((key) => !failedKeys.has(key));
    if (!keys.length) break;
    for (const key of keys) {
      try {
        await deleteKey(namespace, key);
        deleted += 1;
        onProgress?.(key);
      } catch (error) {
        failures.push({ key, error: String(error?.message ?? error) });
        failedKeys.add(key);
      }
    }
  }
  return { deleted, failures };
}

async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const namespace = await resolveNamespace(args);
  const prefix = typeof args.prefix === "string" ? args.prefix : undefined;
  const esa = createEsaClient();

  const firstPage = await esa.listKeys(namespace, prefix);
  if (!firstPage.length) {
    console.log(`命名空间 ${namespace}${prefix ? ` 前缀 ${prefix}` : ""} 没有键，无需清理。`);
    return;
  }

  if (args["dry-run"]) {
    console.log(`dry-run：将删除命名空间 ${namespace} 中以下键（本轮 ${firstPage.length} 个）：`);
    for (const key of firstPage) console.log(`  ${key}`);
    return;
  }

  console.warn(`危险操作：将删除命名空间 ${namespace}${prefix ? ` 前缀 ${prefix}` : ""} 的全部键，且无法恢复。`);
  const { deleted, failures } = await clearNamespace({
    namespace,
    prefix,
    listKeys: (ns, pf) => esa.listKeys(ns, pf),
    deleteKey: (ns, key) => esa.deleteKey(ns, key),
    onProgress: (key) => console.warn(`已删除 ${key}`)
  });

  if (failures.length) {
    console.error(`${failures.length} 条删除失败：`);
    for (const failure of failures) console.error(`  ${failure.key}  →  ${failure.error}`);
    process.exitCode = 1;
  } else {
    console.log(`清理完成：共删除 ${deleted} 个键。`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

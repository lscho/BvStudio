#!/usr/bin/env node
/**
 * 卡密生成脚本：批量生成一卡一机绑定的 VIP 卡密。
 *
 * 用法：
 *   node scripts/generate-license-cards.mjs --count 100 --plan lifetime
 *   node scripts/generate-license-cards.mjs --count 100 --plan monthly
 *   node scripts/generate-license-cards.mjs --count 50 --plan period --days 365 --output license-cards-2026.json
 *
 * 输出文件包含卡密明文（用于发放），已被 .gitignore 忽略，严禁提交或外泄。
 * cards[].kvKey / cards[].kvValue 可直接导入 ESA EdgeKV（card:<sha256> 命名空间）。
 */
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { CARD_KEY_CHARSET, CARD_KEY_RE, MONTHLY_CARD_DAYS, sha256Hex } from "../edge/license-core.mjs";

function generateCardKey(randomSource = randomBytes) {
  // 32 个字符且 256 % 32 === 0，按字节取模无偏
  const bytes = randomSource(16);
  let key = "VIP-";
  for (let index = 0; index < 16; index += 1) {
    key += CARD_KEY_CHARSET[bytes[index] % CARD_KEY_CHARSET.length];
    if (index === 3 || index === 7 || index === 11) key += "-";
  }
  return key;
}

function maskCardKey(cardKey) {
  return `${cardKey.slice(0, 4)}****${cardKey.slice(-4)}`;
}

/**
 * 生成卡密清单。
 * plan: "lifetime"（永久）| "monthly"（月卡，固定 30 天）| "period"（按天数，需 days）。
 */
export async function generateCards({ count, plan, days = null, issuedAt = Date.now(), randomSource = randomBytes }) {
  if (!Number.isInteger(count) || count < 1 || count > 10000) {
    throw new Error("count 必须是 1-10000 之间的整数");
  }
  if (plan !== "lifetime" && plan !== "monthly" && plan !== "period") {
    throw new Error('plan 必须是 "lifetime"、"monthly" 或 "period"');
  }
  if (plan === "monthly" && days !== null) {
    throw new Error(`月卡固定 ${MONTHLY_CARD_DAYS} 天，无需指定 days`);
  }
  if (plan === "period" && (!Number.isInteger(days) || days < 1)) {
    throw new Error('plan 为 "period" 时必须提供正整数 days');
  }

  const effectiveDays = plan === "monthly" ? MONTHLY_CARD_DAYS : plan === "period" ? days : null;

  const cards = [];
  const seen = new Set();
  while (cards.length < count) {
    const cardKey = generateCardKey(randomSource);
    if (seen.has(cardKey)) continue;
    seen.add(cardKey);
    const hash = await sha256Hex(cardKey);
    cards.push({
      cardKey,
      kvKey: `card:${hash}`,
      kvValue: {
        status: "unused",
        plan,
        days: effectiveDays,
        maskedKey: maskCardKey(cardKey),
        hash,
        issuedAt
      }
    });
  }

  return { generatedAt: new Date(issuedAt).toISOString(), plan, days: effectiveDays, cards };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index]?.replace(/^--/, "");
    args[name] = argv[index + 1];
  }
  return args;
}

async function runCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const plan = args.plan ?? "lifetime";
  const days = args.days === undefined ? null : Number.parseInt(args.days, 10);
  const manifest = await generateCards({ count: Number.parseInt(args.count ?? "1", 10), plan, days });

  const output = JSON.stringify(manifest, null, 2);
  if (args.output) {
    writeFileSync(args.output, `${output}\n`, "utf8");
    console.log(`已生成 ${manifest.cards.length} 张卡密并写入 ${args.output}`);
  } else {
    console.log(output);
  }
  console.warn("提醒：输出包含卡密明文，仅限离线保存与发放，严禁提交到版本库。");
  console.warn("导入方式：对每张卡执行 EdgeKV put(cards[i].kvKey, JSON.stringify(cards[i].kvValue))。");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}

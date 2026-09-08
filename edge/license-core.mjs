/**
 * BVideo 会员授权服务的纯逻辑核心。
 *
 * 该模块不依赖任何运行时全局 API（仅使用标准 Web Crypto），
 * 可同时运行在 ESA Edge Routine、Node 22 与 Vitest 中，
 * 供边缘函数、卡密生成脚本与单元测试共用。
 *
 * 注意：签名串构造与客户端 src/services/license.ts 中的
 * canonicalLicenseString 必须保持一致，任何调整需两侧同步。
 */

export const SIGNATURE_CONTEXT = "bvideo-license-v1";
/** 签名时间戳容忍窗口，防止旧响应重放 */
export const SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

/** 设备编码格式：BV-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX（32 位十六进制） */
export const DEVICE_ID_RE = /^BV-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/;
/** 卡密格式：VIP-XXXX-XXXX-XXXX-XXXX，剔除易混淆字符（I/L/O/0/1） */
export const CARD_KEY_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CARD_KEY_RE = /^VIP-[A-HJK-NP-Z2-9]{4}-[A-HJK-NP-Z2-9]{4}-[A-HJK-NP-Z2-9]{4}-[A-HJK-NP-Z2-9]{4}$/;
/** 兑换失败限速：1 小时窗口内最多 10 次失败尝试 */
export const REDEEM_WINDOW_MS = 60 * 60 * 1000;
export const MAX_REDEEM_ATTEMPTS_PER_WINDOW = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return toHex(digest);
}

export async function hmacSha256Hex(secret, text) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return toHex(signature);
}

/**
 * 构造待签名的规范化字符串。字段顺序与取值即契约，
 * 客户端验签使用完全相同的拼接规则。
 */
export function canonicalLicenseString(status, ts) {
  return [
    SIGNATURE_CONTEXT,
    String(ts),
    String(status.isVip),
    status.planName ?? "",
    status.expireAt ?? "",
    status.activatedAt ?? "",
    status.licenseKey ?? ""
  ].join("\n");
}

/** 服务端对状态签名，返回网络响应信封。 */
export async function signLicenseStatus(secret, status, ts) {
  const sig = await hmacSha256Hex(secret, canonicalLicenseString(status, ts));
  return { status, ts, sig };
}

/**
 * 客户端验签：校验时间戳新鲜度与 HMAC 一致性。
 * 返回布尔值；信封结构不合法视为验签失败。
 */
export async function verifyLicenseStatusEnvelope(secret, envelope, now = Date.now()) {
  if (!envelope || typeof envelope !== "object") return false;
  const { status, ts, sig } = envelope;
  if (!status || typeof status !== "object" || typeof ts !== "number" || typeof sig !== "string") return false;
  if (!Number.isFinite(ts) || Math.abs(now - ts) > SIGNATURE_MAX_AGE_MS) return false;
  const expected = await hmacSha256Hex(secret, canonicalLicenseString(status, ts));
  return sig === expected;
}

export function isValidDeviceId(deviceId) {
  return typeof deviceId === "string" && DEVICE_ID_RE.test(deviceId);
}

export function isValidCardKey(cardKey) {
  return typeof cardKey === "string" && CARD_KEY_RE.test(cardKey);
}

/** 卡密统一大写后哈希，用户输入大小写不敏感。 */
export function normalizeCardKey(cardKey) {
  return String(cardKey ?? "").trim().toUpperCase();
}

export function freeStatus() {
  return { isVip: false, planName: "普通用户", expireAt: null, activatedAt: null, licenseKey: null };
}

export function planLabelForCard(card) {
  if (card.plan === "lifetime") return "终身 VIP 会员";
  return `${card.days} 天 VIP 会员`;
}

/**
 * 由设备记录推导对外状态。expireAt 到期在读取时即时判定，
 * 无需服务端写入即可自动生效。
 */
export function statusForDeviceRecord(record, now) {
  if (!record || record.isVip !== true) return freeStatus();
  const expired = typeof record.expireAt === "number" && record.expireAt <= now;
  return {
    isVip: !expired,
    planName: expired ? "会员已过期" : record.planName,
    expireAt: record.expireAt ?? null,
    activatedAt: record.activatedAt ?? null,
    licenseKey: record.licenseKey ?? null
  };
}

function buildDeviceRecord(card, deviceId, activatedAt, expireAt) {
  return {
    isVip: true,
    planName: planLabelForCard(card),
    expireAt: expireAt ?? null,
    activatedAt,
    licenseKey: card.maskedKey ?? null,
    cardHash: card.hash ?? null
  };
}

/**
 * 纯函数兑换决策。一卡一机绑定：
 * - unused：可绑定，返回卡密补丁与设备记录；
 * - bound + 同设备：幂等成功（重复兑换返回当前状态）；
 * - bound + 其他设备：拒绝；
 * - revoked：拒绝。
 */
export function decideRedemption(card, deviceId, now) {
  if (!card) return { outcome: "error", message: "卡密不存在或已失效" };
  if (card.status === "revoked") return { outcome: "error", message: "卡密已被吊销，请联系客服处理" };
  if (card.status === "bound") {
    if (card.boundDeviceId === deviceId) {
      return { outcome: "idempotent", deviceRecord: buildDeviceRecord(card, deviceId, card.boundAt ?? now, card.expireAt ?? null) };
    }
    return { outcome: "error", message: "卡密已被其他设备绑定，一张卡密仅可绑定一台设备" };
  }

  const expireAt = card.plan === "lifetime" || !card.days ? null : now + card.days * DAY_MS;
  const cardPatch = { ...card, status: "bound", boundDeviceId: deviceId, boundAt: now };
  return { outcome: "bind", cardPatch, deviceRecord: buildDeviceRecord(card, deviceId, now, expireAt) };
}

/** KV 键构造。EdgeKV 仅允许字母、数字、中划线与下划线。 */
export const cardKeyFor = (hash) => `card:${hash}`;
export const deviceKeyFor = (deviceId) => `device:${deviceId}`;
export const failureKeyFor = (deviceId) => `fail:${deviceId}`;

/** 计算一次失败后的限速状态；跨窗口自动重置。 */
export function nextFailureState(record, now) {
  const withinWindow = record && typeof record.windowStart === "number" && now - record.windowStart < REDEEM_WINDOW_MS;
  const windowStart = withinWindow ? record.windowStart : now;
  const count = (withinWindow ? record.count : 0) + 1;
  return { count, windowStart, blocked: count > MAX_REDEEM_ATTEMPTS_PER_WINDOW };
}

/** 当前是否已被限速。 */
export function isRateLimited(record, now) {
  return Boolean(
    record &&
      typeof record.windowStart === "number" &&
      now - record.windowStart < REDEEM_WINDOW_MS &&
      record.count >= MAX_REDEEM_ATTEMPTS_PER_WINDOW
  );
}

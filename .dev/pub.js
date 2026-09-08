// edge/license-core.mjs
var SIGNATURE_CONTEXT = "bvideo-license-v1";
var SIGNATURE_MAX_AGE_MS = 5 * 60 * 1e3;
var DEVICE_ID_RE = /^BV-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/;
var CARD_KEY_RE = /^VIP-[A-HJK-NP-Z2-9]{4}-[A-HJK-NP-Z2-9]{4}-[A-HJK-NP-Z2-9]{4}-[A-HJK-NP-Z2-9]{4}$/;
var REDEEM_WINDOW_MS = 60 * 60 * 1e3;
var MAX_REDEEM_ATTEMPTS_PER_WINDOW = 10;
var DAY_MS = 24 * 60 * 60 * 1e3;
var encoder = new TextEncoder();
function toHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return toHex(digest);
}
async function hmacSha256Hex(secret, text) {
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
function canonicalLicenseString(status, ts) {
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
async function signLicenseStatus(secret, status, ts) {
  const sig = await hmacSha256Hex(secret, canonicalLicenseString(status, ts));
  return { status, ts, sig };
}
function isValidDeviceId(deviceId) {
  return typeof deviceId === "string" && DEVICE_ID_RE.test(deviceId);
}
function isValidCardKey(cardKey) {
  return typeof cardKey === "string" && CARD_KEY_RE.test(cardKey);
}
function normalizeCardKey(cardKey) {
  return String(cardKey ?? "").trim().toUpperCase();
}
function freeStatus() {
  return { isVip: false, planName: "\u666E\u901A\u7528\u6237", expireAt: null, activatedAt: null, licenseKey: null };
}
function planLabelForCard(card) {
  if (card.plan === "lifetime") return "\u7EC8\u8EAB VIP \u4F1A\u5458";
  return `${card.days} \u5929 VIP \u4F1A\u5458`;
}
function statusForDeviceRecord(record, now) {
  if (!record || record.isVip !== true) return freeStatus();
  const expired = typeof record.expireAt === "number" && record.expireAt <= now;
  return {
    isVip: !expired,
    planName: expired ? "\u4F1A\u5458\u5DF2\u8FC7\u671F" : record.planName,
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
function decideRedemption(card, deviceId, now) {
  if (!card) return { outcome: "error", message: "\u5361\u5BC6\u4E0D\u5B58\u5728\u6216\u5DF2\u5931\u6548" };
  if (card.status === "revoked") return { outcome: "error", message: "\u5361\u5BC6\u5DF2\u88AB\u540A\u9500\uFF0C\u8BF7\u8054\u7CFB\u5BA2\u670D\u5904\u7406" };
  if (card.status === "bound") {
    if (card.boundDeviceId === deviceId) {
      return { outcome: "idempotent", deviceRecord: buildDeviceRecord(card, deviceId, card.boundAt ?? now, card.expireAt ?? null) };
    }
    return { outcome: "error", message: "\u5361\u5BC6\u5DF2\u88AB\u5176\u4ED6\u8BBE\u5907\u7ED1\u5B9A\uFF0C\u4E00\u5F20\u5361\u5BC6\u4EC5\u53EF\u7ED1\u5B9A\u4E00\u53F0\u8BBE\u5907" };
  }
  const expireAt = card.plan === "lifetime" || !card.days ? null : now + card.days * DAY_MS;
  const cardPatch = { ...card, status: "bound", boundDeviceId: deviceId, boundAt: now };
  return { outcome: "bind", cardPatch, deviceRecord: buildDeviceRecord(card, deviceId, now, expireAt) };
}
var cardKeyFor = (hash) => `card:${hash}`;
var deviceKeyFor = (deviceId) => `device:${deviceId}`;
var failureKeyFor = (deviceId) => `fail:${deviceId}`;
function nextFailureState(record, now) {
  const withinWindow = record && typeof record.windowStart === "number" && now - record.windowStart < REDEEM_WINDOW_MS;
  const windowStart = withinWindow ? record.windowStart : now;
  const count = (withinWindow ? record.count : 0) + 1;
  return { count, windowStart, blocked: count > MAX_REDEEM_ATTEMPTS_PER_WINDOW };
}
function isRateLimited(record, now) {
  return Boolean(
    record && typeof record.windowStart === "number" && now - record.windowStart < REDEEM_WINDOW_MS && record.count >= MAX_REDEEM_ATTEMPTS_PER_WINDOW
  );
}

// edge/license-server.mjs
var JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
function createEdgeKv(namespace) {
  const kv2 = new EdgeKV({ namespace });
  return {
    async get(key) {
      const raw = await kv2.get(key, { type: "text" });
      if (raw === null || raw === void 0 || raw === "") return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    },
    async put(key, value) {
      await kv2.put(key, JSON.stringify(value));
    },
    async remove(key) {
      await kv2.delete(key);
    }
  };
}
function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), { status, headers: { ...JSON_HEADERS, ...CORS_HEADERS } });
}
async function readJsonBody(request) {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function routeKey(request) {
  const url = new URL(request.url);
  return `${request.method} ${url.pathname.replace(/\/+$/, "") || "/"}`;
}
async function handleLicenseRequest(request, { kv: kv2, secret, now = Date.now() }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  try {
    switch (routeKey(request)) {
      case "POST /api/license/verify":
        return await handleVerify(await readJsonBody(request), { kv: kv2, secret, now });
      case "POST /api/license/redeem":
        return await handleRedeem(await readJsonBody(request), { kv: kv2, secret, now });
      default:
        return jsonResponse(404, { message: "Not Found" });
    }
  } catch {
    return jsonResponse(500, { message: "\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" });
  }
}
async function handleVerify(body, { kv: kv2, secret, now }) {
  const deviceId = body?.deviceId;
  if (!isValidDeviceId(deviceId)) {
    return jsonResponse(400, { message: "\u8BBE\u5907\u7F16\u7801\u683C\u5F0F\u65E0\u6548" });
  }
  const device = await kv2.get(deviceKeyFor(deviceId));
  if (!device) {
    return jsonResponse(200, await signLicenseStatus(secret, freeStatus(), now));
  }
  if (device.cardHash) {
    const card = await kv2.get(cardKeyFor(device.cardHash));
    if (!card || card.status === "revoked" || card.boundDeviceId !== deviceId) {
      await kv2.remove(deviceKeyFor(deviceId));
      return jsonResponse(200, await signLicenseStatus(secret, freeStatus(), now));
    }
  }
  return jsonResponse(200, await signLicenseStatus(secret, statusForDeviceRecord(device, now), now));
}
async function handleRedeem(body, { kv: kv2, secret, now }) {
  const { deviceId, cardKey } = body ?? {};
  if (!isValidDeviceId(deviceId) || !isValidCardKey(normalizeCardKey(cardKey))) {
    return jsonResponse(400, { message: "\u8BBE\u5907\u7F16\u7801\u6216\u5361\u5BC6\u683C\u5F0F\u65E0\u6548" });
  }
  const failureRecord = await kv2.get(failureKeyFor(deviceId));
  if (isRateLimited(failureRecord, now)) {
    return jsonResponse(429, { message: "\u5151\u6362\u5C1D\u8BD5\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7 1 \u5C0F\u65F6\u540E\u518D\u8BD5" });
  }
  const hash = await sha256Hex(normalizeCardKey(cardKey));
  const card = await kv2.get(cardKeyFor(hash));
  const decision = decideRedemption(card, deviceId, now);
  if (decision.outcome === "error") {
    await kv2.put(failureKeyFor(deviceId), nextFailureState(failureRecord, now));
    return jsonResponse(400, { message: decision.message });
  }
  if (decision.outcome === "bind") {
    await kv2.put(cardKeyFor(hash), decision.cardPatch);
    await kv2.put(deviceKeyFor(deviceId), decision.deviceRecord);
    const persisted = await kv2.get(cardKeyFor(hash));
    if (!persisted || persisted.boundDeviceId !== deviceId) {
      await kv2.remove(deviceKeyFor(deviceId));
      return jsonResponse(409, { message: "\u5361\u5BC6\u6FC0\u6D3B\u51B2\u7A81\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5" });
    }
  } else {
    await kv2.put(deviceKeyFor(deviceId), decision.deviceRecord);
  }
  const status = statusForDeviceRecord(decision.deviceRecord, now);
  return jsonResponse(200, {
    message: "\u5361\u5BC6\u5151\u6362\u6210\u529F\uFF0CVIP \u6743\u9650\u5DF2\u4E0E\u5F53\u524D\u8BBE\u5907\u7ED1\u5B9A",
    ...await signLicenseStatus(secret, status, now)
  });
}

// edge/config.js
var CONFIG = {
  /** ESA 控制台创建的 EdgeKV 命名空间名称 */
  KV_NAMESPACE: "bv_studio",
  /** HMAC 签名密钥：至少 32 位强随机字符串；必须与客户端
   * src/services/license.ts 中 VITE_LICENSE_RESPONSE_KEY 的构建期注入值保持一致 */
  HMAC_SECRET: "1vt9LnfpuHEm4sy9ka_PrAKWu5ZO5k_b_AceOW3AjD0"
};

// edge/index.js
var kv = createEdgeKv(CONFIG.KV_NAMESPACE);
var index_default = {
  async fetch(request) {
    return handleLicenseRequest(request, { kv, secret: CONFIG.HMAC_SECRET });
  }
};
export {
  index_default as default
};

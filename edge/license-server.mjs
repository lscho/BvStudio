/**
 * BVideo 会员授权服务的请求处理层（ESA Edge Routine）。
 *
 * KV 与密钥均通过参数注入，便于单元测试；部署入口见 index.js。
 * EdgeKV API 参考：new EdgeKV({ namespace }) / get(key, { type: "text" }) /
 * put(key, value) / delete(key)，仅允许字母、数字、中划线、下划线作为键名。
 */
import {
  cardKeyFor,
  cardExpiryAt,
  decideRedemption,
  deviceKeyFor,
  failureKeyFor,
  freeStatus,
  isRateLimited,
  isValidCardKey,
  isValidDeviceId,
  nextFailureState,
  normalizeCardKey,
  sha256Hex,
  signLicenseStatus,
  statusForDeviceRecord
} from "./license-core.mjs";

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
const CARD_READ_PROPAGATION_GRACE_MS = 60 * 1000;

/** 创建 EdgeKV 适配器；仅在边缘运行时被调用（测试注入假 KV）。 */
export function createEdgeKv(namespace) {
  const kv = new EdgeKV({ namespace });
  return {
    async get(key) {
      const raw = await kv.get(key, { type: "text" });
      if (raw === null || raw === undefined || raw === "") return null;
      try {
        return JSON.parse(raw);
      } catch (error) { console.error("DEBUG:", error);
        return null;
      }
    },
    async put(key, value) {
      await kv.put(key, JSON.stringify(value));
    },
    async remove(key) {
      await kv.delete(key);
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
  } catch (error) { console.error("DEBUG:", error);
    return null;
  }
}

function routeKey(request) {
  const url = new URL(request.url);
  return `${request.method} ${url.pathname.replace(/\/+$/, "") || "/"}`;
}

export async function handleLicenseRequest(request, { kv, secret, now = Date.now() }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    switch (routeKey(request)) {
      case "POST /api/license/verify":
        return await handleVerify(await readJsonBody(request), { kv, secret, now });
      case "POST /api/license/redeem":
        return await handleRedeem(await readJsonBody(request), { kv, secret, now });
      default:
        return jsonResponse(404, { message: "Not Found" });
    }
  } catch {
    return jsonResponse(500, { message: "服务暂时不可用，请稍后重试" });
  }
}

async function handleVerify(body, { kv, secret, now }) {
  const deviceId = body?.deviceId;
  if (!isValidDeviceId(deviceId)) {
    return jsonResponse(400, { message: "设备编码格式无效" });
  }

  const device = await kv.get(deviceKeyFor(deviceId));
  if (!device) {
    return jsonResponse(200, await signLicenseStatus(secret, freeStatus(), now));
  }

  // 卡密级自愈：设备记录指向的卡密被吊销或已改绑其他设备时，立即降级为 Free。
  if (device.cardHash) {
    const card = await kv.get(cardKeyFor(device.cardHash));
    const reboundElsewhere = Boolean(card?.boundDeviceId && card.boundDeviceId !== deviceId);
    if (card?.status === "revoked" || reboundElsewhere) {
      await kv.remove(deviceKeyFor(deviceId));
      return jsonResponse(200, await signLicenseStatus(secret, freeStatus(), now));
    }
    const activationAgeMs = typeof device.activatedAt === "number" ? now - device.activatedAt : Number.POSITIVE_INFINITY;
    const awaitingCardPropagation = (!card || card.status !== "bound" || card.boundDeviceId !== deviceId)
      && activationAgeMs >= 0
      && activationAgeMs <= CARD_READ_PROPAGATION_GRACE_MS;
    if ((!card || card.status !== "bound" || card.boundDeviceId !== deviceId) && !awaitingCardPropagation) {
      await kv.remove(deviceKeyFor(deviceId));
      return jsonResponse(200, await signLicenseStatus(secret, freeStatus(), now));
    }
    // 到期时间自愈：以卡密记录为准修复历史写入错误（如重复兑换把年卡刷成永久）。
    if (!awaitingCardPropagation) {
      const expectedExpireAt = card.expireAt ?? cardExpiryAt(card, card.boundAt ?? now);
      if (device.expireAt !== expectedExpireAt) {
        device.expireAt = expectedExpireAt;
        await kv.put(deviceKeyFor(deviceId), device);
      }
    }
  }

  return jsonResponse(200, await signLicenseStatus(secret, statusForDeviceRecord(device, now), now));
}

async function handleRedeem(body, { kv, secret, now }) {
  const { deviceId, cardKey } = body ?? {};
  if (!isValidDeviceId(deviceId) || !isValidCardKey(normalizeCardKey(cardKey))) {
    return jsonResponse(400, { message: "设备编码或卡密格式无效" });
  }

  const failureRecord = await kv.get(failureKeyFor(deviceId));
  if (isRateLimited(failureRecord, now)) {
    return jsonResponse(429, { message: "兑换尝试过于频繁，请 1 小时后再试" });
  }

  const hash = await sha256Hex(normalizeCardKey(cardKey));
  const card = await kv.get(cardKeyFor(hash));
  const decision = decideRedemption(card, deviceId, now);

  if (decision.outcome === "error") {
    await kv.put(failureKeyFor(deviceId), nextFailureState(failureRecord, now));
    return jsonResponse(400, { message: decision.message });
  }

  if (decision.outcome === "bind") {
    await kv.put(cardKeyFor(hash), decision.cardPatch);
    await kv.put(deviceKeyFor(deviceId), decision.deviceRecord);

    // EdgeKV 最终一致：回读可能拿到写入前的旧值（unused），不能视为冲突。
    // 只有明确读到"已绑定到其他设备"才认定并发抢绑失败。
    const persisted = await kv.get(cardKeyFor(hash));
    if (persisted?.boundDeviceId && persisted.boundDeviceId !== deviceId) {
      await kv.remove(deviceKeyFor(deviceId));
      return jsonResponse(409, { message: "卡密激活冲突，请稍后重试" });
    }
  } else {
    await kv.put(deviceKeyFor(deviceId), decision.deviceRecord);
  }

  const status = statusForDeviceRecord(decision.deviceRecord, now);
  return jsonResponse(200, {
    message: "卡密兑换成功，VIP 权限已与当前设备绑定",
    ...(await signLicenseStatus(secret, status, now))
  });
}

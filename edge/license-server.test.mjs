import { describe, expect, it } from "vitest";
import {
  cardKeyFor,
  deviceKeyFor,
  failureKeyFor,
  sha256Hex,
  verifyLicenseStatusEnvelope
} from "./license-core.mjs";
import { handleLicenseRequest } from "./license-server.mjs";

const SECRET = "test-secret";
const DEVICE_ID = "BV-A1B2C3D4-E5F60718-29384756-AABBCCDD";
const OTHER_DEVICE = "BV-11111111-22222222-33333333-44444444";
const CARD_KEY = "VIP-ABCD-EFGH-JKNP-QRST";
const NOW = 1_700_000_000_000;

function createFakeKv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    async get(key) {
      return store.has(key) ? structuredClone(store.get(key)) : null;
    },
    async put(key, value) {
      store.set(key, structuredClone(value));
    },
    async remove(key) {
      store.delete(key);
    }
  };
}

function unusedCard(overrides = {}) {
  return {
    status: "unused",
    plan: "lifetime",
    days: null,
    maskedKey: "VIP-ABCD****QRST",
    hash: "<filled-at-runtime>",
    issuedAt: NOW,
    ...overrides
  };
}

async function seededKv(overrides = {}) {
  const hash = await sha256Hex(CARD_KEY);
  const kv = createFakeKv({
    [cardKeyFor(hash)]: unusedCard({ hash, ...overrides })
  });
  return { kv, hash };
}

function request(path, body) {
  return new Request(`https://license.example.com${path}`, {
    method: body === undefined ? "POST" : "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? "{}" : JSON.stringify(body)
  });
}

async function verifyEnvelope(response, secret = SECRET) {
  expect(response.status).toBe(200);
  const envelope = await response.json();
  expect(await verifyLicenseStatusEnvelope(secret, envelope, NOW)).toBe(true);
  return envelope;
}

describe("routing", () => {
  it("answers CORS preflight and unknown routes", async () => {
    const kv = createFakeKv();
    const preflight = await handleLicenseRequest(new Request("https://x/api/license/verify", { method: "OPTIONS" }), { kv, secret: SECRET, now: NOW });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("*");

    const missing = await handleLicenseRequest(request("/api/license/unknown", {}), { kv, secret: SECRET, now: NOW });
    expect(missing.status).toBe(404);
  });

  it("rejects malformed request bodies", async () => {
    const kv = createFakeKv();
    const malformed = await handleLicenseRequest(request("/api/license/verify", { deviceId: "wrong" }), { kv, secret: SECRET, now: NOW });
    expect(malformed.status).toBe(400);

    const broken = await handleLicenseRequest(new Request("https://x/api/license/verify", { method: "POST", body: "not-json" }), { kv, secret: SECRET, now: NOW });
    expect(broken.status).toBe(400);
  });
});

describe("verify", () => {
  it("returns a signed free status for unknown devices", async () => {
    const { kv } = await seededKv();
    const response = await handleLicenseRequest(request("/api/license/verify", { deviceId: DEVICE_ID }), { kv, secret: SECRET, now: NOW });
    const envelope = await verifyEnvelope(response);
    expect(envelope.status.isVip).toBe(false);
  });

  it("returns the bound vip status for a redeemed device", async () => {
    const { kv, hash } = await seededKv();
    await handleLicenseRequest(request("/api/license/redeem", { deviceId: DEVICE_ID, cardKey: CARD_KEY }), { kv, secret: SECRET, now: NOW });

    const response = await handleLicenseRequest(request("/api/license/verify", { deviceId: DEVICE_ID }), { kv, secret: SECRET, now: NOW });
    const envelope = await verifyEnvelope(response);
    expect(envelope.status).toMatchObject({ isVip: true, planName: "终身 VIP 会员", licenseKey: "VIP-ABCD****QRST" });
    expect(await kv.get(deviceKeyFor(DEVICE_ID))).toBeTruthy();
    expect(kv.store.get(cardKeyFor(hash)).status).toBe("bound");
  });

  it("downgrades to free and clears the device when the card is revoked or rebound elsewhere", async () => {
    const revoked = await seededKv({ status: "revoked", boundDeviceId: DEVICE_ID, boundAt: NOW });
    await revoked.kv.put(deviceKeyFor(DEVICE_ID), { isVip: true, planName: "终身 VIP 会员", expireAt: null, activatedAt: NOW, licenseKey: "VIP-ABCD****QRST", cardHash: revoked.hash });
    const response = await handleLicenseRequest(request("/api/license/verify", { deviceId: DEVICE_ID }), { kv: revoked.kv, secret: SECRET, now: NOW });
    const envelope = await verifyEnvelope(response);
    expect(envelope.status.isVip).toBe(false);
    expect(revoked.kv.store.has(deviceKeyFor(DEVICE_ID))).toBe(false);

    const rebound = await seededKv({ status: "bound", boundDeviceId: OTHER_DEVICE, boundAt: NOW, expireAt: null });
    await rebound.kv.put(deviceKeyFor(DEVICE_ID), { isVip: true, planName: "终身 VIP 会员", expireAt: null, activatedAt: NOW, licenseKey: "VIP-ABCD****QRST", cardHash: rebound.hash });
    const rebounded = await handleLicenseRequest(request("/api/license/verify", { deviceId: DEVICE_ID }), { kv: rebound.kv, secret: SECRET, now: NOW });
    expect((await rebounded.json()).status.isVip).toBe(false);
  });
  it("repairs a device record whose expireAt was corrupted to lifetime", async () => {
    const boundAt = NOW - 3 * 24 * 60 * 60 * 1000;
    const expectedExpireAt = boundAt + 365 * 24 * 60 * 60 * 1000;
    const { kv } = await seededKv({ plan: "period", days: 365, status: "bound", boundDeviceId: DEVICE_ID, boundAt, expireAt: expectedExpireAt });
    await kv.put(deviceKeyFor(DEVICE_ID), { isVip: true, planName: "365 天 VIP 会员", expireAt: null, activatedAt: boundAt, licenseKey: "VIP-ABCD****QRST", cardHash: await sha256Hex(CARD_KEY) });

    const response = await handleLicenseRequest(request("/api/license/verify", { deviceId: DEVICE_ID }), { kv, secret: SECRET, now: NOW });
    const envelope = await verifyEnvelope(response);
    expect(envelope.status.expireAt).toBe(expectedExpireAt);
    expect((await kv.get(deviceKeyFor(DEVICE_ID))).expireAt).toBe(expectedExpireAt);
  });

  it("expires time-limited plans at read time", async () => {
    const boundAt = NOW - 400 * 24 * 60 * 60 * 1000;
    const expireAt = NOW - 1000;
    const { kv } = await seededKv({ plan: "period", days: 365, status: "bound", boundDeviceId: DEVICE_ID, boundAt, expireAt });
    await kv.put(deviceKeyFor(DEVICE_ID), { isVip: true, planName: "365 天 VIP 会员", expireAt, activatedAt: boundAt, licenseKey: "VIP-ABCD****QRST", cardHash: await sha256Hex(CARD_KEY) });
    const response = await handleLicenseRequest(request("/api/license/verify", { deviceId: DEVICE_ID }), { kv, secret: SECRET, now: NOW });
    const envelope = await verifyEnvelope(response);
    expect(envelope.status.isVip).toBe(false);
    expect(envelope.status.planName).toBe("会员已过期");
  });
});

describe("redeem", () => {
  it("binds an unused card to the requesting device", async () => {
    const { kv, hash } = await seededKv();
    const response = await handleLicenseRequest(request("/api/license/redeem", { deviceId: DEVICE_ID, cardKey: CARD_KEY.toLowerCase() }), { kv, secret: SECRET, now: NOW });
    const payload = await verifyEnvelope(response);
    expect(payload.message).toContain("兑换成功");
    expect(payload.status.isVip).toBe(true);
    expect(kv.store.get(cardKeyFor(hash)).boundDeviceId).toBe(DEVICE_ID);
  });

  it("is idempotent for the same device and rejects other devices", async () => {
    const { kv } = await seededKv();
    await handleLicenseRequest(request("/api/license/redeem", { deviceId: DEVICE_ID, cardKey: CARD_KEY }), { kv, secret: SECRET, now: NOW });

    const again = await handleLicenseRequest(request("/api/license/redeem", { deviceId: DEVICE_ID, cardKey: CARD_KEY }), { kv, secret: SECRET, now: NOW });
    expect((await verifyEnvelope(again)).status.isVip).toBe(true);

    const stolen = await handleLicenseRequest(request("/api/license/redeem", { deviceId: OTHER_DEVICE, cardKey: CARD_KEY }), { kv, secret: SECRET, now: NOW });
    expect(stolen.status).toBe(400);
    expect((await stolen.json()).message).toContain("仅可绑定一台设备");
  });

  it("reports unknown cards and counts failures toward the rate limit", async () => {
    const { kv } = await seededKv();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const failed = await handleLicenseRequest(request("/api/license/redeem", { deviceId: DEVICE_ID, cardKey: "VIP-ZZZZ-ZZZZ-ZZZZ-ZZZZ" }), { kv, secret: SECRET, now: NOW });
      expect(failed.status).toBe(400);
    }
    expect(kv.store.get(failureKeyFor(DEVICE_ID)).count).toBe(10);

    const limited = await handleLicenseRequest(request("/api/license/redeem", { deviceId: DEVICE_ID, cardKey: CARD_KEY }), { kv, secret: SECRET, now: NOW });
    expect(limited.status).toBe(429);
  });

  it("detects a lost bind race via the post-write check", async () => {
    const { kv, hash } = await seededKv();
    const racingKv = {
      ...kv,
      async put(key, value) {
        await kv.put(key, value);
        // 模拟并发节点抢先绑定同一张卡
        if (key === cardKeyFor(hash)) {
          await kv.put(key, { ...value, boundDeviceId: OTHER_DEVICE });
        }
      }
    };

    const response = await handleLicenseRequest(request("/api/license/redeem", { deviceId: DEVICE_ID, cardKey: CARD_KEY }), { kv: racingKv, secret: SECRET, now: NOW });
    expect(response.status).toBe(409);
    expect((await response.json()).message).toContain("冲突");
    expect(racingKv.store.has(deviceKeyFor(DEVICE_ID))).toBe(false);
  });

  it("treats a stale pre-write read as success, not a conflict", async () => {
    const { kv, hash } = await seededKv();
    // 模拟最终一致：写入后回读仍返回写入前的 unused 旧值
    const staleKv = {
      ...kv,
      async get(key) {
        if (key === cardKeyFor(hash)) return unusedCard({ hash });
        return kv.get(key);
      }
    };

    const response = await handleLicenseRequest(request("/api/license/redeem", { deviceId: DEVICE_ID, cardKey: CARD_KEY }), { kv: staleKv, secret: SECRET, now: NOW });
    const payload = await verifyEnvelope(response);
    expect(payload.status.isVip).toBe(true);
    expect(staleKv.store.has(deviceKeyFor(DEVICE_ID))).toBe(true);
  });
});

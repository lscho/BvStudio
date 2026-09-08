import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalLicenseString,
  decideRedemption,
  isRateLimited,
  isValidCardKey,
  isValidDeviceId,
  MAX_REDEEM_ATTEMPTS_PER_WINDOW,
  nextFailureState,
  normalizeCardKey,
  sha256Hex,
  signLicenseStatus,
  statusForDeviceRecord,
  verifyLicenseStatusEnvelope
} from "./license-core.mjs";

const SECRET = "test-secret";
const DEVICE_ID = "BV-A1B2C3D4-E5F60718-29384756-AABBCCDD";
const CARD_KEY = "VIP-ABCD-EFGH-JKNP-QRST";
const NOW = 1_700_000_000_000;

function unusedCard(overrides = {}) {
  return { status: "unused", plan: "lifetime", days: null, maskedKey: "VIP-ABCD****QRST", hash: "abc123", issuedAt: NOW, ...overrides };
}

describe("format validation", () => {
  it("accepts the unified device id format", () => {
    expect(isValidDeviceId(DEVICE_ID)).toBe(true);
    expect(isValidDeviceId("BV-A1B2C3D4-E5F60718-29384756-AABBCCD")).toBe(false);
    expect(isValidDeviceId("random")).toBe(false);
    expect(isValidDeviceId(undefined)).toBe(false);
  });

  it("accepts card keys without ambiguous characters and rejects others", () => {
    expect(isValidCardKey(CARD_KEY)).toBe(true);
    expect(isValidCardKey("vip-abcd-efgh-jknp-qrst")).toBe(false);
    expect(isValidCardKey("VIP-ABCD-EFGH-IJKL-MNOP")).toBe(false);
    expect(isValidCardKey("VIP-ABCD-EFGH-JKNP")).toBe(false);
  });

  it("normalizes card key input to trimmed uppercase", () => {
    expect(normalizeCardKey(" vip-abcd-efgh-jknp-qrst ")).toBe(CARD_KEY);
  });
});

describe("crypto helpers", () => {
  it("computes sha-256 identical to node crypto", async () => {
    expect(await sha256Hex(CARD_KEY)).toBe(createHash("sha256").update(CARD_KEY).digest("hex"));
  });

  it("round-trips a signed status envelope", async () => {
    const status = { isVip: true, planName: "终身 VIP 会员", expireAt: null, activatedAt: NOW, licenseKey: "VIP-ABCD****QRST" };
    const envelope = await signLicenseStatus(SECRET, status, NOW);
    expect(await verifyLicenseStatusEnvelope(SECRET, envelope, NOW + 1000)).toBe(true);
  });

  it("rejects tampered signatures, wrong keys and stale timestamps", async () => {
    const status = { isVip: true, planName: "终身 VIP 会员", expireAt: null, activatedAt: NOW, licenseKey: null };
    const envelope = await signLicenseStatus(SECRET, status, NOW);

    const tampered = { ...envelope, status: { ...status, isVip: false } };
    expect(await verifyLicenseStatusEnvelope(SECRET, tampered, NOW)).toBe(false);
    expect(await verifyLicenseStatusEnvelope("other-secret", envelope, NOW)).toBe(false);
    expect(await verifyLicenseStatusEnvelope(SECRET, envelope, NOW + 6 * 60 * 1000)).toBe(false);
    expect(await verifyLicenseStatusEnvelope(SECRET, null, NOW)).toBe(false);
  });

  it("signs the canonical string that node-side hmac reproduces", async () => {
    const status = { isVip: true, planName: "年度 VIP 会员", expireAt: 123, activatedAt: 456, licenseKey: "VIP-ABCD****QRST" };
    const envelope = await signLicenseStatus(SECRET, status, 789);
    const expected = createHmac("sha256", SECRET)
      .update(["bvideo-license-v1", "789", "true", "年度 VIP 会员", "123", "456", "VIP-ABCD****QRST"].join("\n"))
      .digest("hex");
    expect(envelope.sig).toBe(expected);
  });
});

describe("decideRedemption", () => {
  it("binds an unused card with a device record", () => {
    const decision = decideRedemption(unusedCard(), DEVICE_ID, NOW);
    expect(decision.outcome).toBe("bind");
    expect(decision.cardPatch.status).toBe("bound");
    expect(decision.cardPatch.boundDeviceId).toBe(DEVICE_ID);
    expect(decision.deviceRecord).toMatchObject({ isVip: true, planName: "终身 VIP 会员", expireAt: null, activatedAt: NOW });
  });

  it("computes expiry for period plans", () => {
    const decision = decideRedemption(unusedCard({ plan: "period", days: 365 }), DEVICE_ID, NOW);
    expect(decision.deviceRecord.expireAt).toBe(NOW + 365 * 24 * 60 * 60 * 1000);
  });

  it("is idempotent for the same device and rejects other devices", () => {
    const bound = unusedCard({ status: "bound", boundDeviceId: DEVICE_ID, boundAt: NOW, expireAt: null });
    expect(decideRedemption(bound, DEVICE_ID, NOW).outcome).toBe("idempotent");

    const otherDevice = "BV-11111111-22222222-33333333-44444444";
    const rejected = decideRedemption(bound, otherDevice, NOW);
    expect(rejected.outcome).toBe("error");
    expect(rejected.message).toContain("仅可绑定一台设备");
  });
});

describe("statusForDeviceRecord", () => {
  it("returns free status for missing or non-vip records", () => {
    expect(statusForDeviceRecord(null, NOW).isVip).toBe(false);
    expect(statusForDeviceRecord({ isVip: false }, NOW).isVip).toBe(false);
  });

  it("marks expired records as non-vip at read time", () => {
    const record = { isVip: true, planName: "年度 VIP 会员", expireAt: NOW - 1000, activatedAt: NOW - 2000, licenseKey: "VIP-ABCD****QRST" };
    const status = statusForDeviceRecord(record, NOW);
    expect(status.isVip).toBe(false);
    expect(status.planName).toBe("会员已过期");
  });
});

describe("redeem failure rate limiting", () => {
  it("counts failures inside the window and resets across windows", () => {
    const first = nextFailureState(null, NOW);
    expect(first).toMatchObject({ count: 1, windowStart: NOW, blocked: false });

    const tenth = nextFailureState({ count: 9, windowStart: NOW }, NOW);
    expect(tenth.count).toBe(10);
    expect(tenth.blocked).toBe(false);
    expect(nextFailureState({ count: 10, windowStart: NOW }, NOW).blocked).toBe(true);

    const later = NOW + 2 * 60 * 60 * 1000;
    const reset = nextFailureState({ count: 10, windowStart: NOW }, later);
    expect(reset).toMatchObject({ count: 1, windowStart: later });
  });

  it("blocks when the failure count reaches the threshold", () => {
    expect(isRateLimited({ count: MAX_REDEEM_ATTEMPTS_PER_WINDOW, windowStart: NOW }, NOW + 1000)).toBe(true);
    expect(isRateLimited({ count: 3, windowStart: NOW }, NOW + 1000)).toBe(false);
    expect(isRateLimited({ count: 10, windowStart: NOW - 2 * 60 * 60 * 1000 }, NOW)).toBe(false);
    expect(isRateLimited(null, NOW)).toBe(false);
  });
});

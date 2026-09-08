import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "@/services/runtime";
import {
  clearCachedVipStatus,
  DEFAULT_VIP_STATUS,
  getHardwareDeviceId,
  isVipActive,
  maskLicenseKey,
  readCachedVipStatus,
  redeemCardKey,
  saveCachedVipStatus,
  verifyVipStatus
} from "./license";
import type { VipStatus } from "./license";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

vi.mock("@/services/runtime", () => ({
  isDesktopRuntime: vi.fn(() => false)
}));

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    getItem(key) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    }
  } as Storage;
}

describe("license service", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.clearAllMocks();
    vi.mocked(isDesktopRuntime).mockReturnValue(false);
  });

  describe("maskLicenseKey", () => {
    it("masks keys properly", () => {
      expect(maskLicenseKey("12345")).toBe("********");
      expect(maskLicenseKey("VIP-1234-5678-ABCD")).toBe("VIP-****ABCD");
    });
  });

  describe("isVipActive", () => {
    it("returns false for null or non-vip", () => {
      expect(isVipActive(null)).toBe(false);
      expect(isVipActive(DEFAULT_VIP_STATUS)).toBe(false);
    });

    it("returns true for permanent vip without expireAt", () => {
      const vip: VipStatus = {
        isVip: true,
        planName: "永久会员",
        expireAt: null,
        activatedAt: Date.now()
      };
      expect(isVipActive(vip)).toBe(true);
    });

    it("evaluates expireAt timestamp correctly", () => {
      const activeVip: VipStatus = {
        isVip: true,
        planName: "年度会员",
        expireAt: Date.now() + 86400000,
        activatedAt: Date.now()
      };
      expect(isVipActive(activeVip)).toBe(true);

      const expiredVip: VipStatus = {
        isVip: true,
        planName: "年度会员",
        expireAt: Date.now() - 1000,
        activatedAt: Date.now() - 86400000
      };
      expect(isVipActive(expiredVip)).toBe(false);
    });
  });

  describe("getHardwareDeviceId", () => {
    it("generates and persists a stable browser device ID when in web environment", async () => {
      const id1 = await getHardwareDeviceId();
      expect(id1).toMatch(/^BV-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}-[0-9A-F]{8}$/);

      const id2 = await getHardwareDeviceId();
      expect(id2).toBe(id1);
    });

    it("invokes Tauri command when in desktop runtime", async () => {
      vi.mocked(isDesktopRuntime).mockReturnValue(true);
      vi.mocked(invoke).mockResolvedValue("BV-12345678-87654321-AABBCCDD-EEFF0011");

      const id = await getHardwareDeviceId();
      expect(invoke).toHaveBeenCalledWith("get_device_id");
      expect(id).toBe("BV-12345678-87654321-AABBCCDD-EEFF0011");
    });
  });

  describe("caching and verification", () => {
    it("reads and writes cached vip status", () => {
      expect(readCachedVipStatus()).toEqual(DEFAULT_VIP_STATUS);

      const sample: VipStatus = {
        isVip: true,
        planName: "测试会员",
        expireAt: null,
        activatedAt: 123456789,
        licenseKey: "VIP-****-1234"
      };
      saveCachedVipStatus(sample);
      expect(readCachedVipStatus()).toEqual({ ...sample, cachedAt: expect.any(Number) });

      clearCachedVipStatus();
      expect(readCachedVipStatus()).toEqual(DEFAULT_VIP_STATUS);
    });

    it("verifyVipStatus returns cached status and handles expiration", async () => {
      const expired: VipStatus = {
        isVip: true,
        planName: "已过期会员",
        expireAt: Date.now() - 5000,
        activatedAt: Date.now() - 100000
      };
      saveCachedVipStatus(expired);

      const status = await verifyVipStatus("BV-TEST-DEVICE-ID");
      expect(status.isVip).toBe(false);
      expect(status.planName).toBe("会员已过期");
    });
  });

  describe("redeemCardKey", () => {
    it("rejects empty or short keys", async () => {
      const res1 = await redeemCardKey("", "VIP-123456");
      expect(res1.success).toBe(false);
      expect(res1.message).toContain("未获取到有效的硬件编码");

      const res2 = await redeemCardKey("BV-TEST", "   ");
      expect(res2.success).toBe(false);
      expect(res2.message).toContain("请输入卡密兑换码");

      const res3 = await redeemCardKey("BV-TEST", "12345");
      expect(res3.success).toBe(false);
      expect(res3.message).toContain("至少为 6 个字符");
    });

    it("activates vip successfully with valid key in mock stub", async () => {
      const res = await redeemCardKey("BV-TEST-DEVICE-123", "VIP-9999-8888-7777");
      expect(res.success).toBe(true);
      expect(res.status?.isVip).toBe(true);
      expect(res.status?.planName).toBe("终身 VIP 会员");
      expect(res.status?.licenseKey).toBe("VIP-****7777");

      // Verifies it is saved to cache
      const cached = readCachedVipStatus();
      expect(cached.isVip).toBe(true);
    });
  });

  describe("network license server", () => {
    const SERVER_URL = "https://license.example.com";
    const RESPONSE_KEY = "test-response-key";
    const DEVICE_ID = "BV-A1B2C3D4-E5F60718-29384756-AABBCCDD";

    function canonical(status: VipStatus, ts: number): string {
      return [
        "bvideo-license-v1",
        String(ts),
        String(status.isVip),
        status.planName ?? "",
        status.expireAt ?? "",
        status.activatedAt ?? "",
        status.licenseKey ?? ""
      ].join("\n");
    }

    async function signEnvelope(payload: { status: VipStatus; ts: number; message?: string }, key = RESPONSE_KEY): Promise<string> {
      const encoded = new TextEncoder().encode(canonical(payload.status, payload.ts));
      const keyHandle = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const signature = await crypto.subtle.sign("HMAC", keyHandle, encoded);
      return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    function fakeResponse(payload: unknown, ok = true, status = 200): Response {
      return { ok, status, json: async () => payload } as unknown as Response;
    }

    function vipStatus(overrides: Partial<VipStatus> = {}): VipStatus {
      return { isVip: true, planName: "终身 VIP 会员", expireAt: null, activatedAt: Date.now(), licenseKey: "VIP-ABCD****QRST", ...overrides };
    }

    it("verifyVipStatus posts to the server, verifies the signature and caches the result", async () => {
      vi.stubEnv("VITE_LICENSE_SERVER_URL", SERVER_URL);
      vi.stubEnv("VITE_LICENSE_RESPONSE_KEY", RESPONSE_KEY);
      const ts = Date.now();
      const envelope = { status: vipStatus(), ts, sig: await signEnvelope({ status: vipStatus(), ts }) };
      const fetchMock = vi.fn().mockResolvedValue(fakeResponse(envelope));
      vi.stubGlobal("fetch", fetchMock);

      const status = await verifyVipStatus(DEVICE_ID);

      expect(fetchMock).toHaveBeenCalledWith(`${SERVER_URL}/api/license/verify`, expect.objectContaining({ method: "POST" }));
      expect(status.isVip).toBe(true);
      expect(readCachedVipStatus().isVip).toBe(true);
    });

    it("falls back to a fresh cached status when the server is unreachable", async () => {
      vi.stubEnv("VITE_LICENSE_SERVER_URL", SERVER_URL);
      vi.stubEnv("VITE_LICENSE_RESPONSE_KEY", RESPONSE_KEY);
      saveCachedVipStatus(vipStatus());
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

      const status = await verifyVipStatus(DEVICE_ID);
      expect(status.isVip).toBe(true);
    });

    it("rejects responses with tampered signatures", async () => {
      vi.stubEnv("VITE_LICENSE_SERVER_URL", SERVER_URL);
      vi.stubEnv("VITE_LICENSE_RESPONSE_KEY", RESPONSE_KEY);
      saveCachedVipStatus(vipStatus());
      const ts = Date.now();
      const forged = { status: vipStatus(), ts, sig: "0".repeat(64) };
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeResponse(forged)));

      const status = await verifyVipStatus(DEVICE_ID);
      // 响应不可信：回退到缓存而非采纳伪造状态
      expect(status.isVip).toBe(true);
      expect(readCachedVipStatus().planName).toBe("终身 VIP 会员");
    });

    it("downgrades long-offline cached status outside the grace window", async () => {
      vi.stubEnv("VITE_LICENSE_SERVER_URL", SERVER_URL);
      vi.stubEnv("VITE_LICENSE_RESPONSE_KEY", RESPONSE_KEY);
      const stale = { ...vipStatus(), cachedAt: Date.now() - 4 * 24 * 60 * 60 * 1000 };
      localStorage.setItem("bvideo:vip-status", JSON.stringify(stale));
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network down")));

      const status = await verifyVipStatus(DEVICE_ID);
      expect(status.isVip).toBe(false);
      expect(status.planName).toBe("待联网核验会员状态");
    });

    it("redeems through the server and surfaces server error messages", async () => {
      vi.stubEnv("VITE_LICENSE_SERVER_URL", SERVER_URL);
      vi.stubEnv("VITE_LICENSE_RESPONSE_KEY", RESPONSE_KEY);
      const ts = Date.now();
      const successEnvelope = { message: "卡密兑换成功", status: vipStatus(), ts, sig: await signEnvelope({ status: vipStatus(), ts }) };
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(fakeResponse({ message: "卡密不存在或已失效" }, false, 400))
        .mockResolvedValueOnce(fakeResponse(successEnvelope));
      vi.stubGlobal("fetch", fetchMock);

      const failed = await redeemCardKey(DEVICE_ID, "VIP-ABCD-EFGH-JKNP-QRST");
      expect(failed.success).toBe(false);
      expect(failed.message).toBe("卡密不存在或已失效");

      const redeemed = await redeemCardKey(DEVICE_ID, "VIP-ABCD-EFGH-JKNP-QRST");
      expect(redeemed.success).toBe(true);
      expect(redeemed.status?.isVip).toBe(true);
      expect(readCachedVipStatus().isVip).toBe(true);
    });
  });
});

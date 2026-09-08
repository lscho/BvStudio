import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLicenseStore } from "./licenseStore";
import * as licenseService from "@/services/license";

vi.mock("@/services/license", async (importOriginal) => {
  const actual = await importOriginal<typeof licenseService>();
  return {
    ...actual,
    getHardwareDeviceId: vi.fn(),
    verifyVipStatus: vi.fn(),
    redeemCardKey: vi.fn()
  };
});

describe("licenseStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLicenseStore.setState({
      deviceId: "",
      status: licenseService.DEFAULT_VIP_STATUS,
      isInitialized: false,
      isChecking: false,
      isRedeeming: false,
      error: null,
      lastCheckedAt: null
    });
  });

  it("initializes deviceId and checks vip status", async () => {
    vi.mocked(licenseService.getHardwareDeviceId).mockResolvedValue("BV-11112222-33334444-55556666-77778888");
    vi.mocked(licenseService.verifyVipStatus).mockResolvedValue({
      isVip: false,
      planName: "普通用户",
      expireAt: null,
      activatedAt: null
    });

    await useLicenseStore.getState().initialize();

    expect(useLicenseStore.getState().deviceId).toBe("BV-11112222-33334444-55556666-77778888");
    expect(useLicenseStore.getState().isInitialized).toBe(true);
    expect(useLicenseStore.getState().status.isVip).toBe(false);
  });

  it("redeems card key and updates vip status on success", async () => {
    useLicenseStore.setState({ deviceId: "BV-DEVICE-123" });
    const newStatus = {
      isVip: true,
      planName: "终身 VIP 会员",
      expireAt: null,
      activatedAt: Date.now(),
      licenseKey: "VIP-****-9999"
    };
    vi.mocked(licenseService.redeemCardKey).mockResolvedValue({
      success: true,
      message: "兑换成功",
      status: newStatus
    });

    const result = await useLicenseStore.getState().redeem("VIP-TEST-KEY-9999");
    expect(result.success).toBe(true);
    expect(useLicenseStore.getState().status.isVip).toBe(true);
    expect(useLicenseStore.getState().status.planName).toBe("终身 VIP 会员");
  });
});


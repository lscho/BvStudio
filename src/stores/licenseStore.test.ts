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
      baseStatus: licenseService.DEFAULT_VIP_STATUS,
      devOverride: null,
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
    expect(useLicenseStore.getState().baseStatus.isVip).toBe(true);
    expect(useLicenseStore.getState().devOverride).toBeNull();
  });

  it("keeps a redeemed identity when initialization is requested again", async () => {
    const redeemed = {
      isVip: true,
      planName: "终身 VIP 会员",
      expireAt: null,
      activatedAt: Date.now(),
      licenseKey: "VIP-****-9999"
    };
    useLicenseStore.setState({
      deviceId: "BV-DEVICE-123",
      baseStatus: redeemed,
      status: redeemed,
      isInitialized: true
    });
    vi.mocked(licenseService.verifyVipStatus).mockResolvedValue({
      isVip: false,
      planName: "普通用户",
      expireAt: null,
      activatedAt: null,
      licenseKey: null
    });

    await useLicenseStore.getState().initialize();

    expect(licenseService.verifyVipStatus).not.toHaveBeenCalled();
    expect(useLicenseStore.getState().status).toEqual(redeemed);
  });

  it("ignores a verification response that started before a successful redemption", async () => {
    let resolveVerification!: (status: licenseService.VipStatus) => void;
    vi.mocked(licenseService.verifyVipStatus).mockImplementation(() => new Promise((resolve) => {
      resolveVerification = resolve;
    }));
    const redeemed = {
      isVip: true,
      planName: "终身 VIP 会员",
      expireAt: null,
      activatedAt: Date.now(),
      licenseKey: "VIP-****-9999"
    };
    vi.mocked(licenseService.redeemCardKey).mockResolvedValue({ success: true, message: "兑换成功", status: redeemed });
    useLicenseStore.setState({ deviceId: "BV-DEVICE-123" });

    const verification = useLicenseStore.getState().checkVipStatus();
    await Promise.resolve();
    await useLicenseStore.getState().redeem("VIP-TEST-KEY-9999");
    resolveVerification({ isVip: false, planName: "普通用户", expireAt: null, activatedAt: null, licenseKey: null });
    await verification;

    expect(useLicenseStore.getState().status).toEqual(redeemed);
  });

  it("only simulates free/pro identity after a card key is redeemed", () => {
    useLicenseStore.getState().setDevOverride("pro");
    expect(useLicenseStore.getState().status.isVip).toBe(false);
    expect(useLicenseStore.getState().devOverride).toBeNull();

    const redeemed = {
      isVip: true,
      planName: "终身 VIP 会员",
      expireAt: null,
      activatedAt: Date.now(),
      licenseKey: "VIP-****-9999"
    };
    useLicenseStore.setState({ baseStatus: redeemed, status: redeemed });

    useLicenseStore.getState().setDevOverride("free");
    expect(useLicenseStore.getState().status.isVip).toBe(false);
    expect(useLicenseStore.getState().status.licenseKey).toBe("VIP-****-9999");

    useLicenseStore.getState().setDevOverride("pro");
    expect(useLicenseStore.getState().status.isVip).toBe(true);

    useLicenseStore.getState().setDevOverride(null);
    expect(useLicenseStore.getState().status.isVip).toBe(true);
  });

  it("re-applies the simulated identity on refresh and drops it once the license is gone", async () => {
    const redeemed = {
      isVip: true,
      planName: "终身 VIP 会员",
      expireAt: null,
      activatedAt: Date.now(),
      licenseKey: "VIP-****-9999"
    };
    useLicenseStore.setState({ deviceId: "BV-DEVICE-123", baseStatus: redeemed, status: redeemed });
    useLicenseStore.getState().setDevOverride("free");

    vi.mocked(licenseService.verifyVipStatus).mockResolvedValue(redeemed);
    await useLicenseStore.getState().checkVipStatus();
    expect(useLicenseStore.getState().status.isVip).toBe(false);

    vi.mocked(licenseService.verifyVipStatus).mockResolvedValue({
      isVip: false,
      planName: "普通用户",
      expireAt: null,
      activatedAt: null,
      licenseKey: null
    });
    await useLicenseStore.getState().checkVipStatus();
    expect(useLicenseStore.getState().status.isVip).toBe(false);
    expect(useLicenseStore.getState().status.licenseKey).toBeNull();
  });
});

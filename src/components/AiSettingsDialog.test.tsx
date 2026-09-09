import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiSettingsDialog } from "./AiSettingsDialog";
import { DEFAULT_SETTINGS } from "@/services/storage";
import { useLicenseStore } from "@/stores/licenseStore";
import * as licenseService from "@/services/license";

vi.mock("@/services/license", async (importOriginal) => {
  const actual = await importOriginal<typeof licenseService>();
  return {
    ...actual,
    getHardwareDeviceId: vi.fn().mockResolvedValue("BV-A1B2C3D4-E5F60718-29384756-AABBCCDD"),
    verifyVipStatus: vi.fn().mockResolvedValue({
      isVip: false,
      planName: "普通用户",
      expireAt: null,
      activatedAt: null,
      licenseKey: null
    }),
    redeemCardKey: vi.fn()
  };
});

vi.mock("@/services/ai/provider", () => ({
  browserApiKey: vi.fn(() => ""),
  hasApiKey: vi.fn().mockResolvedValue(false),
  saveApiKey: vi.fn().mockResolvedValue(undefined),
  providerEndpoint: vi.fn(() => "https://api.openai.com/v1"),
  verifyProviderConfiguration: vi.fn()
}));

vi.mock("@/services/cloudSpeech", () => ({
  hasSpeechApiKey: vi.fn().mockResolvedValue(false),
  saveSpeechApiKey: vi.fn().mockResolvedValue(undefined),
  validateCloudSpeechTtsConfig: vi.fn(),
  verifyCloudSpeech: vi.fn(),
  MIMO_TTS_MODELS: ["mimo-v2.5-tts"],
  MIMO_TTS_VOICES: ["冰糖"]
}));

vi.mock("@/services/media", () => ({
  getMediaToolStatus: vi.fn().mockResolvedValue({
    ready: true,
    bundled: true,
    recommendedEncoder: "software",
    availableEncoders: ["software"]
  })
}));

describe("AiSettingsDialog License tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLicenseStore.setState({
      deviceId: "BV-A1B2C3D4-E5F60718-29384756-AABBCCDD",
      status: {
        isVip: false,
        planName: "普通用户",
        expireAt: null,
        activatedAt: null,
        licenseKey: null
      },
      baseStatus: {
        isVip: false,
        planName: "普通用户",
        expireAt: null,
        activatedAt: null,
        licenseKey: null
      },
      devOverride: null,
      isInitialized: true,
      isChecking: false,
      isRedeeming: false,
      error: null,
      lastCheckedAt: null
    });
  });

  it("renders license section with Free/Pro identity, clean placeholder, and no manual check button", async () => {
    render(
      <AiSettingsDialog
        open={true}
        settings={DEFAULT_SETTINGS}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    // Switch to license tab
    const licenseNavButton = screen.getByRole("button", { name: /会员与授权/ });
    fireEvent.click(licenseNavButton);

    expect(screen.getByText("当前身份")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText(/当前为 Free 基础版/)).toBeInTheDocument();

    // Input placeholder without parentheses
    expect(screen.getByPlaceholderText("请输入卡密兑换码")).toBeInTheDocument();

    // Subtle copy link below input
    expect(screen.getByRole("button", { name: "复制本机硬件码" })).toBeInTheDocument();
    expect(screen.getByText("硬件码")).toBeInTheDocument();
    // No manual network check button
    expect(screen.queryByText("联网检测")).not.toBeInTheDocument();
  });

  it("allows redeeming a card key and shows success message, updating to Pro", async () => {
    vi.mocked(licenseService.redeemCardKey).mockResolvedValue({
      success: true,
      message: "卡密兑换成功，VIP 权限已激活",
      status: {
        isVip: true,
        planName: "终身 VIP 会员",
        expireAt: null,
        activatedAt: Date.now(),
        licenseKey: "VIP-****-9999"
      }
    });

    render(
      <AiSettingsDialog
        open={true}
        settings={DEFAULT_SETTINGS}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /会员与授权/ }));

    const cardKeyInput = screen.getByPlaceholderText("请输入卡密兑换码");
    fireEvent.change(cardKeyInput, { target: { value: "VIP-9999-8888-7777" } });

    const redeemButton = screen.getByRole("button", { name: "立即兑换" });
    expect(redeemButton).not.toBeDisabled();
    fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(screen.getByText("卡密兑换成功，VIP 权限已激活")).toBeInTheDocument();
    });

    // The store should reflect the Pro status
    expect(screen.getByText(/已激活 Pro 专业版/)).toBeInTheDocument();
    expect(screen.getByText(/永久授权/)).toBeInTheDocument();
  });

  it("exposes the dev identity switch only after a card key is redeemed", async () => {
    vi.mocked(licenseService.redeemCardKey).mockResolvedValue({
      success: true,
      message: "兑换成功",
      status: {
        isVip: true,
        planName: "终身 VIP 会员",
        expireAt: null,
        activatedAt: Date.now(),
        licenseKey: "VIP-****-9999"
      }
    });

    render(
      <AiSettingsDialog
        open={true}
        settings={DEFAULT_SETTINGS}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /会员与授权/ }));
    expect(screen.queryByRole("group", { name: "模拟会员身份" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("请输入卡密兑换码"), { target: { value: "VIP-9999-8888-7777" } });
    fireEvent.click(screen.getByRole("button", { name: "立即兑换" }));

    await waitFor(() => {
      expect(screen.getByRole("group", { name: "模拟会员身份" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Free" }));
    expect(screen.getByText(/当前为 Free 基础版/)).toBeInTheDocument();
    expect(useLicenseStore.getState().status.licenseKey).toBe("VIP-****-9999");

    fireEvent.click(screen.getByRole("button", { name: "Pro" }));
    expect(screen.getByText(/已激活 Pro 专业版/)).toBeInTheDocument();
  });

  it("shows error when redemption fails", async () => {
    vi.mocked(licenseService.redeemCardKey).mockResolvedValue({
      success: false,
      message: "卡密已被使用或不存在"
    });

    render(
      <AiSettingsDialog
        open={true}
        settings={DEFAULT_SETTINGS}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /会员与授权/ }));

    const cardKeyInput = screen.getByPlaceholderText("请输入卡密兑换码");
    fireEvent.change(cardKeyInput, { target: { value: "INVALID-KEY-1234" } });

    const redeemButton = screen.getByRole("button", { name: "立即兑换" });
    expect(redeemButton).not.toBeDisabled();
    fireEvent.click(redeemButton);

    await waitFor(() => {
      expect(screen.getByText("卡密已被使用或不存在")).toBeInTheDocument();
    });
  });

  it("copies device ID to clipboard when subtle copy link is clicked", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      configurable: true,
      writable: true
    });

    render(
      <AiSettingsDialog
        open={true}
        settings={DEFAULT_SETTINGS}
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /会员与授权/ }));
    const copyLink = screen.getByRole("button", { name: "复制本机硬件码" });
    expect(screen.getByText("硬件码")).toBeInTheDocument();
    fireEvent.click(copyLink);

    expect(writeTextMock).toHaveBeenCalledWith("BV-A1B2C3D4-E5F60718-29384756-AABBCCDD");
    await waitFor(() => {
      expect(screen.getByText("已复制硬件码")).toBeInTheDocument();
    });
  });
});

import { create } from "zustand";
import {
  DEFAULT_VIP_STATUS,
  getHardwareDeviceId,
  redeemCardKey,
  verifyVipStatus
} from "@/services/license";
import type { RedeemResult, VipStatus } from "@/services/license";

/** 开发环境专用的身份模拟值；发布构建中该能力被整体裁剪。 */
export type DevLicenseOverride = "free" | "pro";

/**
 * 开发环境身份模拟：在真实授权身份之上叠加 free/pro，用于验证 Pro 功能。
 * 未兑换卡密（无 licenseKey）或非开发环境时恒返回真实身份。
 */
function resolveStatus(base: VipStatus, override: DevLicenseOverride | null): VipStatus {
  if (!import.meta.env.DEV || !override || !base.licenseKey) return base;
  return override === "pro"
    ? { ...base, isVip: true, expireAt: null }
    : { ...base, isVip: false };
}

let licenseStatusRequestId = 0;

interface LicenseState {
  deviceId: string;
  /** 界面实际生效的身份（开发环境可能已被模拟覆盖） */
  status: VipStatus;
  /** 授权服务/缓存返回的真实身份，作为退出模拟时的还原基准 */
  baseStatus: VipStatus;
  devOverride: DevLicenseOverride | null;
  isInitialized: boolean;
  isChecking: boolean;
  isRedeeming: boolean;
  error: string | null;
  lastCheckedAt: number | null;
  initialize: () => Promise<void>;
  checkVipStatus: () => Promise<void>;
  redeem: (cardKey: string) => Promise<RedeemResult>;
  setDevOverride: (override: DevLicenseOverride | null) => void;
}

export const useLicenseStore = create<LicenseState>((set, get) => ({
  deviceId: "",
  status: DEFAULT_VIP_STATUS,
  baseStatus: DEFAULT_VIP_STATUS,
  devOverride: null,
  isInitialized: false,
  isChecking: false,
  isRedeeming: false,
  error: null,
  lastCheckedAt: null,

  initialize: async () => {
    if (get().isInitialized || get().isChecking) return;
    set({ isChecking: true, error: null });
    try {
      let deviceId = get().deviceId;
      if (!deviceId) {
        deviceId = await getHardwareDeviceId();
        set({ deviceId });
      }
      await get().checkVipStatus();
      set({ isInitialized: true });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "获取硬件授权信息失败",
        isInitialized: true,
        isChecking: false
      });
    }
  },

  checkVipStatus: async () => {
    const requestId = ++licenseStatusRequestId;
    const currentDeviceId = get().deviceId || (await getHardwareDeviceId());
    set({ deviceId: currentDeviceId, isChecking: true, error: null });
    try {
      const baseStatus = await verifyVipStatus(currentDeviceId);
      if (requestId !== licenseStatusRequestId) return;
      set({
        baseStatus,
        status: resolveStatus(baseStatus, get().devOverride),
        lastCheckedAt: Date.now(),
        isChecking: false
      });
    } catch (error) {
      if (requestId !== licenseStatusRequestId) return;
      set({
        error: error instanceof Error ? error.message : "联网识别会员状态失败",
        isChecking: false
      });
    }
  },

  redeem: async (cardKey: string) => {
    licenseStatusRequestId += 1;
    let currentDeviceId = get().deviceId;
    if (!currentDeviceId) {
      currentDeviceId = await getHardwareDeviceId();
      set({ deviceId: currentDeviceId });
    }
    set({ isRedeeming: true, isChecking: false });
    try {
      const result = await redeemCardKey(currentDeviceId, cardKey);
      if (result.success && result.status) {
        licenseStatusRequestId += 1;
        set({
          baseStatus: result.status,
          status: result.status,
          devOverride: null,
          error: null
        });
      }
      return result;
    } finally {
      set({ isRedeeming: false });
    }
  },

  setDevOverride: (override) => {
    if (!import.meta.env.DEV) return;
    const baseStatus = get().baseStatus;
    if (!baseStatus.licenseKey) return;
    set({ devOverride: override, status: resolveStatus(baseStatus, override) });
  }
}));

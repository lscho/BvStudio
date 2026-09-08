import { create } from "zustand";
import {
  DEFAULT_VIP_STATUS,
  getHardwareDeviceId,
  redeemCardKey,
  verifyVipStatus
} from "@/services/license";
import type { RedeemResult, VipStatus } from "@/services/license";

interface LicenseState {
  deviceId: string;
  status: VipStatus;
  isInitialized: boolean;
  isChecking: boolean;
  isRedeeming: boolean;
  error: string | null;
  lastCheckedAt: number | null;
  initialize: () => Promise<void>;
  checkVipStatus: () => Promise<void>;
  redeem: (cardKey: string) => Promise<RedeemResult>;
}

export const useLicenseStore = create<LicenseState>((set, get) => ({
  deviceId: "",
  status: DEFAULT_VIP_STATUS,
  isInitialized: false,
  isChecking: false,
  isRedeeming: false,
  error: null,
  lastCheckedAt: null,

  initialize: async () => {
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
        isInitialized: true
      });
    }
  },

  checkVipStatus: async () => {
    const currentDeviceId = get().deviceId || (await getHardwareDeviceId());
    set({ deviceId: currentDeviceId, isChecking: true, error: null });
    try {
      const status = await verifyVipStatus(currentDeviceId);
      set({
        status,
        lastCheckedAt: Date.now(),
        isChecking: false
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "联网识别会员状态失败",
        isChecking: false
      });
    }
  },

  redeem: async (cardKey: string) => {
    let currentDeviceId = get().deviceId;
    if (!currentDeviceId) {
      currentDeviceId = await getHardwareDeviceId();
      set({ deviceId: currentDeviceId });
    }
    set({ isRedeeming: true });
    try {
      const result = await redeemCardKey(currentDeviceId, cardKey);
      if (result.success && result.status) {
        set({
          status: result.status,
          error: null
        });
      }
      return result;
    } finally {
      set({ isRedeeming: false });
    }
  }
}));

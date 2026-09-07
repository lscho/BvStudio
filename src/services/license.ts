import { invoke } from "@tauri-apps/api/core";
import { isDesktopRuntime } from "@/services/runtime";

export interface VipStatus {
  isVip: boolean;
  planName: string;
  expireAt: number | null;
  activatedAt: number | null;
  licenseKey?: string | null;
}

export interface RedeemResult {
  success: boolean;
  message: string;
  status?: VipStatus;
}

export interface HardwareDeviceInfo {
  deviceId: string;
  platform: string;
  isDesktop: boolean;
}

export const DEFAULT_VIP_STATUS: VipStatus = {
  isVip: false,
  planName: "普通用户",
  expireAt: null,
  activatedAt: null,
  licenseKey: null
};

const BROWSER_DEVICE_ID_KEY = "bvideo:hardware-device-id";
const VIP_STATUS_STORAGE_KEY = "bvideo:vip-status";

/**
 * 校验 VIP 状态当前是否依然在有效期内。
 */
export function isVipActive(status: VipStatus | null | undefined): boolean {
  if (!status || !status.isVip) return false;
  if (status.expireAt === null || status.expireAt === undefined) return true;
  return status.expireAt > Date.now();
}

/**
 * 脱敏展示卡密（保留首尾字符）。
 */
export function maskLicenseKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "********";
  return `${trimmed.slice(0, 4)}****${trimmed.slice(-4)}`;
}

/**
 * 生成符合统一规范的浏览器端兜底唯一设备码。
 * 格式：BV-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX
 */
function generateBrowserDeviceId(): string {
  const hexChars = "0123456789ABCDEF";
  let randomHex = "";
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    randomHex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0").toUpperCase())
      .join("");
  } else {
    for (let i = 0; i < 32; i += 1) {
      randomHex += hexChars.charAt(Math.floor(Math.random() * hexChars.length));
    }
  }

  return `BV-${randomHex.slice(0, 8)}-${randomHex.slice(8, 16)}-${randomHex.slice(16, 24)}-${randomHex.slice(24, 32)}`;
}

/**
 * 获取本机硬件唯一编码。
 * 桌面端通过 Rust 原生系统能力提取（macOS IOPlatformUUID、Windows MachineGuid、Linux machine-id 加盐哈希）。
 * 浏览器端通过本地持久化客户端标识兜底。
 */
export async function getHardwareDeviceId(): Promise<string> {
  if (isDesktopRuntime()) {
    try {
      const deviceId = await invoke<string>("get_device_id");
      if (deviceId && typeof deviceId === "string" && deviceId.trim()) {
        return deviceId.trim();
      }
    } catch (error) {
      console.warn("Failed to get device id from Tauri runtime, falling back to local storage:", error);
    }
  }

  // 浏览器环境或桌面调用异常时的安全兜底
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(BROWSER_DEVICE_ID_KEY);
      if (stored && stored.trim().startsWith("BV-")) {
        return stored.trim();
      }
      const generated = generateBrowserDeviceId();
      localStorage.setItem(BROWSER_DEVICE_ID_KEY, generated);
      return generated;
    }
  } catch {
    // 忽略在无权限或测试环境下的 storage 异常
  }

  return generateBrowserDeviceId();
}

/**
 * 获取硬件设备概要信息。
 */
export async function getHardwareDeviceInfo(): Promise<HardwareDeviceInfo> {
  const deviceId = await getHardwareDeviceId();
  const isDesktop = isDesktopRuntime();
  let platform = "web";
  if (isDesktop) {
    try {
      const info = await invoke<{ deviceId: string; platform: string }>("get_device_info");
      platform = info.platform;
    } catch {
      platform = "desktop";
    }
  }
  return { deviceId, platform, isDesktop };
}

/**
 * 读取本地缓存的 VIP 授权状态。
 */
export function readCachedVipStatus(): VipStatus {
  try {
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(VIP_STATUS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<VipStatus>;
        if (typeof parsed.isVip === "boolean") {
          return {
            isVip: parsed.isVip,
            planName: parsed.planName || (parsed.isVip ? "VIP 会员" : "普通用户"),
            expireAt: typeof parsed.expireAt === "number" ? parsed.expireAt : null,
            activatedAt: typeof parsed.activatedAt === "number" ? parsed.activatedAt : null,
            licenseKey: parsed.licenseKey || null
          };
        }
      }
    }
  } catch {
    // 解析异常降级至默认
  }
  return { ...DEFAULT_VIP_STATUS };
}

/**
 * 保存 VIP 授权状态至本地缓存。
 */
export function saveCachedVipStatus(status: VipStatus): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(VIP_STATUS_STORAGE_KEY, JSON.stringify(status));
    }
  } catch {
    // 忽略异常
  }
}

/**
 * 清除本地保存的 VIP 授权状态（用于测试或注销授权）。
 */
export function clearCachedVipStatus(): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(VIP_STATUS_STORAGE_KEY);
    }
  } catch {
    // 忽略异常
  }
}

/**
 * 联网识别当前设备是否具备 VIP 权限。
 * 每次打开应用时调用。
 *
 * 【接口待接入说明】：
 * 未来在此发起真实网络请求（例如 POST ${LICENSE_SERVER_URL}/api/license/verify），
 * 请求体传入 { deviceId }，服务端校验并返回绑定的最新会员状态及有效期。
 * 当前接口留空：读取并校验本地授权缓存，以供离线与预留联调使用。
 */
export async function verifyVipStatus(deviceId: string): Promise<VipStatus> {
  if (!deviceId) return { ...DEFAULT_VIP_STATUS };

  // TODO: 【服务端接口待接入】
  // 示例契约实现：
  // const response = await fetch("https://api.yourdomain.com/api/license/verify", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ deviceId })
  // });
  // if (!response.ok) {
  //   throw new Error("联网校验会员状态失败");
  // }
  // const data = (await response.json()) as { status: VipStatus };
  // saveCachedVipStatus(data.status);
  // return data.status;

  // 接口留空阶段：读取本地缓存并核验有效性
  const cached = readCachedVipStatus();
  if (cached.isVip && !isVipActive(cached)) {
    // 已过期
    const expiredStatus: VipStatus = {
      ...cached,
      isVip: false,
      planName: "会员已过期"
    };
    saveCachedVipStatus(expiredStatus);
    return expiredStatus;
  }

  return cached;
}

/**
 * 请求服务端将当前硬件唯一编码与卡密进行绑定并激活 VIP。
 *
 * 【接口待接入说明】：
 * 未来在此发起真实网络请求（例如 POST ${LICENSE_SERVER_URL}/api/license/redeem），
 * 请求体传入 { deviceId, cardKey }，服务端校验卡密合法性并绑定当前硬件。
 * 当前接口留空：提供前置格式校验与本地预置联调模拟，支持开发者与用户在无后端时预览会员状态切换。
 */
export async function redeemCardKey(deviceId: string, cardKey: string): Promise<RedeemResult> {
  const trimmedKey = cardKey.trim();
  if (!deviceId) {
    return {
      success: false,
      message: "未获取到有效的硬件编码，请稍后重试"
    };
  }
  if (!trimmedKey) {
    return {
      success: false,
      message: "请输入卡密兑换码"
    };
  }
  if (trimmedKey.length < 6) {
    return {
      success: false,
      message: "卡密格式无效，长度至少为 6 个字符"
    };
  }

  // TODO: 【服务端接口待接入】
  // 示例契约实现：
  // const response = await fetch("https://api.yourdomain.com/api/license/redeem", {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ deviceId, cardKey: trimmedKey })
  // });
  // if (!response.ok) {
  //   const errData = await response.json().catch(() => ({ message: "兑换失败，请检查卡密有效性" }));
  //   return { success: false, message: errData.message || "卡密兑换失败" };
  // }
  // const result = (await response.json()) as { message: string; status: VipStatus };
  // saveCachedVipStatus(result.status);
  // return { success: true, message: result.message || "兑换成功", status: result.status };

  // 接口留空阶段的本地联调与激活机制：
  // 模拟成功激活（永久专业会员），保存本地缓存并返回状态
  const newStatus: VipStatus = {
    isVip: true,
    planName: "终身 VIP 会员",
    expireAt: null, // null 表示永久
    activatedAt: Date.now(),
    licenseKey: maskLicenseKey(trimmedKey)
  };

  saveCachedVipStatus(newStatus);

  return {
    success: true,
    message: "卡密兑换成功，VIP 权限已与当前设备绑定并激活！",
    status: newStatus
  };
}

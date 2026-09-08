import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { isDesktopRuntime } from "@/services/runtime";

export interface VipStatus {
  isVip: boolean;
  planName: string;
  expireAt: number | null;
  activatedAt: number | null;
  licenseKey?: string | null;
  /** 本地缓存写入时间，用于离线宽限期判定；非服务端契约字段 */
  cachedAt?: number | null;
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
            licenseKey: parsed.licenseKey || null,
            cachedAt: typeof parsed.cachedAt === "number" ? parsed.cachedAt : null
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
      localStorage.setItem(VIP_STATUS_STORAGE_KEY, JSON.stringify({ ...status, cachedAt: Date.now() }));
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

/* ------------------------------------------------------------------ */
/* 授权服务网络验证（ESA 边缘函数后端）                                  */
/* ------------------------------------------------------------------ */

/**
 * 授权服务地址与验签密钥通过构建期环境变量注入：
 * - VITE_LICENSE_SERVER_URL：ESA 边缘函数绑定的 API 域名（如 https://license.example.com）
 * - VITE_LICENSE_RESPONSE_KEY：响应 HMAC 密钥，须与 edge/config.js 的 HMAC_SECRET 一致
 * 两者均未配置时保持纯本地缓存模式（开发预览用），发布构建必须配置。
 */
function licenseServerConfig(): { baseUrl: string; responseKey: string } | null {
  const baseUrl = String(import.meta.env.VITE_LICENSE_SERVER_URL ?? "").trim().replace(/\/+$/, "");
  const responseKey = String(import.meta.env.VITE_LICENSE_RESPONSE_KEY ?? "").trim();
  return baseUrl && responseKey ? { baseUrl, responseKey } : null;
}

/** 离线宽限期：联网核验失败时，宽限期内的缓存会员状态仍然生效。 */
const OFFLINE_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

/** 与 edge/license-core.mjs 的 canonicalLicenseString 保持一致，调整需两侧同步。 */
const LICENSE_SIGNATURE_CONTEXT = "bvideo-license-v1";
const LICENSE_SIGNATURE_MAX_AGE_MS = 5 * 60 * 1000;

const vipStatusSchema = z.object({
  isVip: z.boolean(),
  planName: z.string(),
  expireAt: z.number().nullable(),
  activatedAt: z.number().nullable(),
  licenseKey: z.string().nullable().optional()
});

const licenseEnvelopeSchema = z.object({
  status: vipStatusSchema,
  ts: z.number(),
  sig: z.string().regex(/^[0-9a-f]{64}$/)
});

const redeemEnvelopeSchema = licenseEnvelopeSchema.extend({ message: z.string() });

function canonicalLicenseString(status: VipStatus, ts: number): string {
  return [
    LICENSE_SIGNATURE_CONTEXT,
    String(ts),
    String(status.isVip),
    status.planName ?? "",
    status.expireAt ?? "",
    status.activatedAt ?? "",
    status.licenseKey ?? ""
  ].join("\n");
}

async function hmacSha256Hex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** 验签失败视为响应不可信，由调用方降级处理。 */
async function verifyStatusEnvelope(responseKey: string, envelope: LicenseEnvelope): Promise<boolean> {
  if (Math.abs(Date.now() - envelope.ts) > LICENSE_SIGNATURE_MAX_AGE_MS) return false;
  const expected = await hmacSha256Hex(responseKey, canonicalLicenseString(envelope.status, envelope.ts));
  return envelope.sig === expected;
}

class LicenseApiError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "LicenseApiError";
  }
}

type LicenseEnvelope = z.infer<typeof licenseEnvelopeSchema>;

async function postLicenseApi<T extends z.ZodType<LicenseEnvelope>>(
  config: { baseUrl: string; responseKey: string },
  path: string,
  body: Record<string, unknown>,
  schema: T
): Promise<z.infer<T>> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch {
    throw new LicenseApiError("网络异常，无法连接授权服务，请检查网络后重试", 0);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new LicenseApiError(
      typeof payload?.message === "string" && payload.message ? payload.message : "授权服务请求失败，请稍后重试",
      response.status
    );
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new LicenseApiError("授权服务响应格式异常，请稍后重试", response.status);
  }
  if (!(await verifyStatusEnvelope(config.responseKey, parsed.data))) {
    throw new LicenseApiError("授权服务响应校验失败，请稍后重试", response.status);
  }
  return parsed.data;
}

function toVipStatus(parsed: z.infer<typeof vipStatusSchema>): VipStatus {
  return {
    isVip: parsed.isVip,
    planName: parsed.planName,
    expireAt: parsed.expireAt,
    activatedAt: parsed.activatedAt,
    licenseKey: parsed.licenseKey ?? null
  };
}

/**
 * 离线降级：到期立即失效；配置了授权服务时额外施加宽限期，
 * 长时间无法联网核验则保守降级（不写缓存，恢复联网后自动还原）。
 */
function offlineVipStatus(enforceGrace: boolean): VipStatus {
  const cached = readCachedVipStatus();
  if (cached.isVip && !isVipActive(cached)) {
    const expiredStatus: VipStatus = {
      ...cached,
      isVip: false,
      planName: "会员已过期"
    };
    saveCachedVipStatus(expiredStatus);
    return expiredStatus;
  }
  if (enforceGrace && cached.isVip) {
    const withinGrace = typeof cached.cachedAt === "number" && Date.now() - cached.cachedAt <= OFFLINE_GRACE_MS;
    if (!withinGrace) {
      return { ...cached, isVip: false, planName: "待联网核验会员状态" };
    }
  }
  return cached;
}

/**
 * 联网识别当前设备是否具备 VIP 权限。
 * 每次打开应用时调用。配置了授权服务时优先联网核验（成功结果写入本地缓存）；
 * 联网失败或未配置授权服务时，回退到本地缓存并执行到期与宽限期判定。
 */
export async function verifyVipStatus(deviceId: string): Promise<VipStatus> {
  if (!deviceId) return { ...DEFAULT_VIP_STATUS };

  const config = licenseServerConfig();
  if (config) {
    try {
      const envelope = await postLicenseApi(config, "/api/license/verify", { deviceId }, licenseEnvelopeSchema);
      const status = toVipStatus(envelope.status);
      saveCachedVipStatus(status);
      return status;
    } catch (error) {
      console.warn("授权服务联网核验失败，回退至本地缓存状态:", error);
    }
  }

  return offlineVipStatus(config !== null);
}

/**
 * 请求服务端将当前硬件唯一编码与卡密进行绑定并激活 VIP。
 * 配置了授权服务时发起真实网络兑换（请求体 { deviceId, cardKey }）；
 * 未配置时使用本地模拟激活，仅供开发预览。一张卡密仅可绑定一台设备，重复兑换返回当前绑定状态。
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

  const config = licenseServerConfig();
  if (config) {
    try {
      const envelope = await postLicenseApi(config, "/api/license/redeem", { deviceId, cardKey: trimmedKey }, redeemEnvelopeSchema);
      const status = toVipStatus(envelope.status);
      saveCachedVipStatus(status);
      return { success: true, message: envelope.message || "卡密兑换成功", status };
    } catch (error) {
      return {
        success: false,
        message: error instanceof LicenseApiError ? error.message : "卡密兑换失败，请稍后重试"
      };
    }
  }

  // 未配置授权服务时的本地联调与激活机制（仅开发预览使用，发布构建必须配置 VITE_LICENSE_SERVER_URL）：
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

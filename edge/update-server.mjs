/**
 * BVideo 桌面更新服务的请求处理层（ESA Edge Routine）。
 *
 * KV 通过参数注入，便于单元测试；部署入口见 index.js。
 * 客户端契约见 docs/updater-api.md：动态格式响应、204 表示无更新、
 * 响应头必须 Cache-Control: no-store（客户端 15s 超时内不做缓存复用）。
 */
import { decideUpdateResponse, isValidUpdatePlatform, releaseKeyFor } from "./release-core.mjs";

const UPDATE_PATH = "/api/desktop-updates/latest";
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

/** 精确匹配更新路由；其它路径继续交给授权服务处理。 */
export function isUpdateRoute(pathname) {
  return (pathname.replace(/\/+$/, "") || "/") === UPDATE_PATH;
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS, ...NO_STORE_HEADERS }
  });
}

export async function handleUpdateRequest(request, { kv }) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "GET") {
    return jsonResponse(405, { message: "更新查询仅支持 GET 请求" });
  }

  const platform = new URL(request.url).searchParams.get("platform") ?? "";
  if (!isValidUpdatePlatform(platform)) {
    return jsonResponse(400, { message: "platform 参数缺失或不受支持" });
  }

  try {
    const { status, payload } = decideUpdateResponse(await kv.get(releaseKeyFor(platform)), platform);
    if (status === 204) {
      return new Response(null, { status: 204, headers: { ...CORS_HEADERS, ...NO_STORE_HEADERS } });
    }
    if (status !== 200) {
      return jsonResponse(503, { message: "更新包元数据不完整，请稍后重试" });
    }
    return jsonResponse(200, payload);
  } catch (error) {
    console.error("DEBUG:", error);
    return jsonResponse(500, { message: "服务暂时不可用，请稍后重试" });
  }
}

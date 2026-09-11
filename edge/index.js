/**
 * ESA 边缘函数部署入口（真实部署使用，测试不加载本文件）。
 *
 * 部署前：
 * 1. 复制 config.example.js 为 config.js（已被 .gitignore 忽略，禁止提交）；
 * 2. 填入实际 KV 命名空间与强随机 HMAC 密钥；
 * 3. 将本目录代码粘贴至 ESA 控制台边缘函数编辑器，或使用 erc CLI 部署。
 *
 * 同一份函数承载三条互不相干的业务：
 * - GET /api/desktop-updates/latest  桌面更新元数据（见 update-server.mjs）；
 * - GET / 或 /download 等官网页面   产品特性与全平台客户端下载（见 site-server.mjs）；
 * - POST /api/license/verify|redeem  会员授权（见 license-server.mjs）。
 * 先按精确路径分发，避免不同业务处理层的路由判断互相干扰。
 */
import { createEdgeKv, handleLicenseRequest } from "./license-server.mjs";
import { handleUpdateRequest, isUpdateRoute } from "./update-server.mjs";
import { handleSiteRequest, isSiteRoute } from "./site-server.mjs";
import { CONFIG } from "./config.js";

const kv = createEdgeKv(CONFIG.KV_NAMESPACE);

export default {
  async fetch(request) {
    const pathname = new URL(request.url).pathname;
    if (isUpdateRoute(pathname)) {
      return handleUpdateRequest(request, { kv });
    }
    if (isSiteRoute(pathname)) {
      return handleSiteRequest(request, { kv });
    }
    return handleLicenseRequest(request, { kv, secret: CONFIG.HMAC_SECRET });
  }
};

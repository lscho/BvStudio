/**
 * ESA 边缘函数部署入口（真实部署使用，测试不加载本文件）。
 *
 * 部署前：
 * 1. 复制 config.example.js 为 config.js（已被 .gitignore 忽略，禁止提交）；
 * 2. 填入实际 KV 命名空间与强随机 HMAC 密钥；
 * 3. 将本目录代码粘贴至 ESA 控制台边缘函数编辑器，或使用 erc CLI 部署。
 */
import { createEdgeKv, handleLicenseRequest } from "./license-server.mjs";
import { CONFIG } from "./config.js";

const kv = createEdgeKv(CONFIG.KV_NAMESPACE);

export default {
  async fetch(request) {
    return handleLicenseRequest(request, { kv, secret: CONFIG.HMAC_SECRET });
  }
};

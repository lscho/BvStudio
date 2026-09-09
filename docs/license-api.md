# 会员授权服务协议（ESA 边缘函数）

客户端 Pro 会员验证由阿里云 ESA 边缘函数（Edge Routine）+ EdgeKV 实现：卡密一卡一机绑定，服务端持有唯一真值，客户端联网核验并缓存。仓库内 `edge/` 是该服务的完整源码，本仓库不负责部署与运营。

## 架构

```
桌面端 / 浏览器
  │  POST {deviceId} / {deviceId, cardKey}
  ▼
ESA Edge Routine（edge/index.js）
  │  KV 读写（最终一致）
  ▼
EdgeKV 命名空间
  card:{sha256(cardKey)}  卡密状态（unused / bound / revoked）
  device:{deviceId}       设备会员状态（含 cardHash 回链）
  fail:{deviceId}         兑换失败限速计数（1 小时窗口 10 次）
```

- 设备编码由客户端 Rust 侧生成（macOS IOPlatformUUID / Windows MachineGuid / Linux machine-id 加盐 SHA-256），格式 `BV-XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX`。
- 卡密只存 SHA-256 哈希，明文仅存在于发放环节（见下文卡密生成）。
- 到期判定在读取时即时计算（`expireAt <= now` 即降级），无需后台任务。
- 卡密级自愈：verify 时回读设备记录指向的卡密，发现 `revoked` 或已改绑其他设备，即清除设备记录并返回 Free。运营侧只需在 EdgeKV 控制台改 `card:*` 的 `status` 即可吊销。
- EdgeKV 无事务。redeem 在写入后回读二次确认，收敛并发绑定同一张卡的竞态窗口；若确认失败返回 `409`。

## API 契约

所有请求为 `POST` + JSON；响应带 CORS 头。每个 200 响应附带 HMAC-SHA256 签名信封：

```json
{ "status": { "isVip": true, "planName": "终身 VIP 会员", "expireAt": null, "activatedAt": 1700000000000, "licenseKey": "VIP-****QRST" }, "ts": 1700000000000, "sig": "<64 位小写十六进制>" }
```

- 签名输入为规范化串（`edge/license-core.mjs` 的 `canonicalLicenseString`，客户端在 `src/services/license.ts` 有同一实现）：

```
bvideo-license-v1\n{ts}\n{isVip}\n{planName}\n{expireAt}\n{activatedAt}\n{licenseKey}
```

- `ts` 与服务器时间偏差超过 5 分钟视为过期，客户端验签失败。
- 错误响应：`{ "message": "<用户可读的简体中文提示>" }`。

### POST /api/license/verify

请求 `{"deviceId": "BV-..."}`。

| 状态 | 含义 |
| --- | --- |
| 200 | 返回签名后的最新会员状态；无记录 / 已到期 / 卡密被吊销或改绑均返回 `isVip: false` |
| 400 | 设备编码格式无效 |

### POST /api/license/redeem

请求 `{"deviceId": "BV-...", "cardKey": "VIP-XXXX-XXXX-XXXX-XXXX"}`（大小写不敏感）。同一设备重复兑换同一张卡幂等成功。

| 状态 | 含义 |
| --- | --- |
| 200 | 兑换成功 / 幂等命中，附 `message` 与签名状态 |
| 400 | 卡密不存在、已被其他设备绑定或已吊销（`message` 区分） |
| 409 | 并发绑定冲突（EdgeKV 最终一致性），可重试 |
| 429 | 该设备 1 小时窗口内失败次数超过 10 次 |

## 客户端接入

构建期注入两个环境变量（见 `.env.production.example`）：

| 变量 | 说明 |
| --- | --- |
| `VITE_LICENSE_SERVER_URL` | 边缘函数绑定的 API 域名，如 `https://license.example.com` |
| `VITE_LICENSE_RESPONSE_KEY` | 响应 HMAC 密钥，须与 `edge/config.js` 的 `HMAC_SECRET` 一致 |

- 两者均未配置时客户端保持纯本地缓存模式（仅开发预览；发布构建必须配置）。
- 联网核验失败时回退本地缓存：会员到期立即失效；离线宽限期 72 小时内仍视为有效，超时降级为"待联网核验"（不写缓存，恢复联网后自动还原）。
- 签名密钥随客户端分发，仅用于拦截伪造响应服务，不能防御逆向；真正的控制力在服务端吊销与到期判定。

## 部署步骤

1. ESA 控制台创建 EdgeKV 命名空间（仅字母、数字、中划线、下划线）。
2. 复制 `edge/config.example.js` 为 `edge/config.js`（已被 `.gitignore` 忽略），填入命名空间与至少 32 位强随机 `HMAC_SECRET`。
3. 将 `edge/` 下 `license-core.mjs`、`license-server.mjs`、`index.js`、`config.js` 粘贴到 ESA 边缘函数编辑器（或用 esa-cli 部署，见仓库根目录 `esa.jsonc`），绑定域名并开启函数。
4. 客户端发布构建注入上表两个环境变量。

## 卡密生成与导入


完整命令与参数见 [`license-card-operations.md`](license-card-operations.md)。速查：

```bash
# 生成 100 张永久卡并直接写入线上 KV，终端输出卡密列表
npm run esa:import -- --count 100 --plan lifetime

# 月卡（兑换后固定 30 天到期）
npm run esa:import -- --count 100 --plan monthly

# 限时卡（365 天）
npm run esa:import -- --count 50 --plan period --days 365

# 只生成不入库
node scripts/generate-license-cards.mjs --count 100 --plan lifetime --output license-cards-batch1.json
npm run esa:import -- --input license-cards-batch1.json
```

- 输出 JSON 含卡密明文与可直接导入的 KV 记录；文件已被 `.gitignore` 忽略，仅限离线保存与发放。
- 卡密字符集剔除易混淆的 `I/L/O/0/1`，格式 `VIP-XXXX-XXXX-XXXX-XXXX`（见 `edge/license-core.mjs` 的 `CARD_KEY_RE`）。
- 导入：对每张卡在 EdgeKV 执行 `put(cards[i].kvKey, JSON.stringify(cards[i].kvValue))`（脚本已自动完成）。
- 吊销：将对应 `card:*` 记录的 `status` 改为 `"revoked"`；该设备下次 verify 自动降级。

## 本地验证

- 边缘函数逻辑：`npx vitest run edge/`。
- 客户端网络模式：`npx vitest run src/services/license.test.ts`（含签名、伪造响应、宽限期与兑换失败透传用例）。
- 卡密脚本：`npm run test:release`。

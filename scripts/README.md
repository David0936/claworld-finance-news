# 自动抓取 X 推文

每小时由 GitHub Actions（`.github/workflows/fetch.yml`）自动抓取，写入 `data/live/<id>.json`，
提交后触发部署，网站推文随之更新。**不填 key 时抓取会自动跳过，不影响站点。**

## 一次性设置（你只需做这一步）

1. 准备一个第三方抓取 API 的 key（如 twitterapi.io：注册 → 充值 → 拿 API Key）。
2. 仓库 → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `TWITTER_API_KEY`
   - Value: 你的 key
3. 完成。到 **Actions → Fetch X tweets → Run workflow** 手动跑一次验证；之后每小时自动跑。

## 换数据源 / 改端点（可选）

若用的服务商端点不同，在 **Settings → Secrets and variables → Actions → Variables** 里设（都可留空用默认）：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `TWITTER_API_BASE` | `https://api.twitterapi.io` | API 根地址 |
| `TWITTER_API_PATH` | `/twitter/user/last_tweets` | 取用户最新推文的路径（会自动拼 `?userName=<handle>`）|
| `TWITTER_API_KEY_HEADER` | `X-API-Key` | 鉴权请求头名 |

## 抓哪些博主

编辑 `scripts/handles.json`：`{ "id": 博主id, "handle": X用户名(不带@) }`。
id 必须和 `data/bloggers.ts` 里的博主 id 一致。占位博主（quantflow/chiplens）没有真实账号，未列入。

## 本地测试（不联网）

```bash
node scripts/fetch-x.mjs --dry-run   # 用 scripts/fixtures/<handle>.json 验证管线
```

## 当前能自动更新的范围

- ✅ 推文流（总览 / 推文 / 多源 标签页）、提及的 $代码、提及次数
- ⛔ GPT 情绪/风险、战绩、提及后收益 等分析字段仍是手写快照（需再接 LLM，二期）

# 自动抓取 X 推文

每小时由 GitHub Actions（`.github/workflows/fetch.yml`）自动抓取，写入 `data/live/<id>.json`，
提交后触发部署，网站推文随之更新。**只有显式 `--dry-run` 才会使用 fixture；正式抓取不会再用假数据。**

## 已研究出的原站机制

`https://analysissite.vercel.app` 是 Next/Vercel App Router 站点。它没有暴露公开业务 JSON API；
动态数据在服务端/构建阶段已经算好，并被预渲染进各个路由的 HTML/RSC payload：

- `/tweets`：最新 5 条推文、相关公司、推文链接与互动数
- `/stocks`：股票层事实表（约 706 条），字段包括 `current_view`、`author_stance`、`recent_mentions_24h`、`recent_stock_news_7d`、`revenue_yoy_pct`
- `/mentions`：AI 提及后收益表（约 225 条），含基准价、1W/1M/6M/1Y/至今收益、链条分类
- `/performance`：战绩热力图、1M 校准表、Signal kind、Freshness、反身性窗口、Stance、最近 30 天衰减、隐含组合 proxy

因此新增了 `scripts/sync-analysissite.py`：抓取这些公开页面，解析 `self.__next_f.push(...)`
里的 RSC 数据，归一化后写入 `data/live/aleabitoreddit.json`。这条链路是当前默认真数据源。
脚本对上游页面读取做了 3 次重试；`/stocks`、`/mentions` 页面较大，偶发超时会自动重拉。

前端也提供与原站对齐的静态路由：`/tweets/`、`/stocks/`、`/mentions/`、`/performance/`、
`/supply-chain/`、`/sources/`、`/industries/`、`/llm/`、`/follow/`。

本地手动同步：

```bash
python3 scripts/sync-analysissite.py
node scripts/validate-data.mjs
```

## 一次性设置（你只需做这一步）

1. 默认先同步 analysissite 公开动态快照，不需要 key。
2. 如果要绕开原站、直接抓 X，再准备一个抓取 API 的 key。**省钱首选 Apify「最便宜抓取器」（约 1000 条/天免费）**，配法见下方「选数据源 · 方案 B」；图省事也可用 twitterapi.io（方案 A）。
2. 仓库 → **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `TWITTER_API_KEY`
   - Value: 你的 key（Apify 则填 Apify token，并按方案 B 再设几个 Variable）
3. 完成。到 **Actions → Fetch X tweets → Run workflow** 手动跑一次验证；之后按 cron 自动跑。

## 选数据源（便宜 / 免费方案）

脚本支持 GET（默认）和 POST 两种源，**换源只改 Variables，不动代码**。

### 方案 A · twitterapi.io（默认，按量付费，最省事）
只配 `TWITTER_API_KEY` 即可。量大时偏贵。

### 方案 B · Apify「最便宜抓取器」（推荐，按你的量基本免费）⭐
免费额度约 **1000 条推文/天**，超出 $0.25/千条。注册 [apify.com](https://apify.com) → Settings → Integrations 拿 API token。
在 **Settings → Secrets and variables → Actions** 设：

| 变量 | 值 | 类型 |
|---|---|---|
| `TWITTER_API_KEY` | 你的 Apify token | Secret |
| `TWITTER_API_BASE` | `https://api.apify.com` | Variable |
| `TWITTER_API_PATH` | `/v2/acts/kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest/run-sync-get-dataset-items` | Variable |
| `TWITTER_API_METHOD` | `POST` | Variable |
| `TWITTER_API_TOKEN_QUERY` | `token` | Variable |

请求体默认就是「取该博主最新 N 条」，无需额外配置。

### 方案 C · 无 key 公开镜像源（默认 Sotwe）
没有 `TWITTER_API_KEY` 时，脚本会尝试 `TWITTER_PUBLIC_SOURCE=sotwe`，读取公开页面并解析真实公开推文。
这条链路不稳定，推荐作为兜底；生产长期跑还是建议配置 Apify。

可选 Variables：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `TWITTER_PUBLIC_SOURCE` | `sotwe` | 无 key 时使用的公开源；设 `none` 可禁用 |
| `SOTWE_BASE` | `https://www.sotwe.com` | Sotwe 镜像域名，域名变动时可替换 |

### 方案 D · 已授权浏览器 / 会员频道导入
公开推文继续走方案 A/B。会员频道这类受限内容，不在 Action 里自动登录抓取；你可以把自己已授权可见的内容导出成 JSON / 文本，放到本地 `scripts/captures/`，再导入为同一套 `data/live/<id>.json`：

```bash
node scripts/import-x-capture.mjs scripts/captures/aleabit-member.json aleabitoreddit-member aleabitoreddit --restricted
```

`scripts/captures/` 已加入 `.gitignore`，不要提交会员频道原文。

### 💡 省额度技巧（任何方案通用）
- **降频**：`fetch.yml` 里 cron 默认每小时。给小白推研报用不着这么勤，改成每 3–4 小时（`0 */4 * * *`）能把用量砍掉 3/4。
  > 注意：每小时 × 2 博主 × 20 条 ≈ 960 条/天，已逼近 Apify 免费线；**加博主或想留余量就务必降频**，或调小下面的 `MAX_TWEETS`。
- **调量**：Variable `MAX_TWEETS`（默认 20）改小，如 `10`。

### 其它可调端点变量（都可留空用默认）

| 变量 | 默认值 | 说明 |
|---|---|---|
| `TWITTER_API_KEY_HEADER` | `X-API-Key` | key 放请求头时的头名（方案 A 用）|
| `TWITTER_API_USER_PARAM` | `userName` | GET 时拼的用户名参数名 |
| `TWITTER_API_BODY` | （Apify 默认体）| POST 自定义请求体模板，占位符 `{{handle}}` `{{max}}` |

## 抓哪些博主

编辑 `scripts/handles.json`：`{ "id": 博主id, "handle": X用户名(不带@) }`。
id 必须和 `data/bloggers.ts` 里的博主 id 一致。占位博主（quantflow/chiplens）没有真实账号，未列入。

## 本地测试（不联网）

```bash
node scripts/fetch-x.mjs --dry-run   # 用 scripts/fixtures/<handle>.json 验证管线
```

## 当前能自动更新的范围

- ✅ 推文流（总览 / 推文 / 多源 标签页）、提及的 $代码、提及次数
- ✅ 股票池、提及表现、战绩页的 analysissite 动态快照字段（含胜率热力图、校准曲线、分组表）
- ✅ 已授权导入的会员频道内容（本地导入后进入同一 live 管线）
- ⛔ GPT 情绪/风险仍以 analysissite 已解析字段和手写规则为主；会员频道私密原文不自动抓取

---

# Vercel 发布

项目改为 Vercel 托管。当前 `vercel.json` 固定了安装和构建命令：

```json
{
  "framework": "nextjs",
  "installCommand": "npm ci",
  "buildCommand": "npm run build",
  "outputDirectory": null
}
```

推荐在 Vercel 项目里连接 GitHub 仓库 `David0936/claworld-Financial-Newa`：

1. Vercel → Add New Project → Import Git Repository。
2. Framework 选择 Next.js，Build Command 保持 `npm run build`。
3. Output Directory 留空，交给 Vercel 的 Next.js 构建接管产物；`vercel.json` 里用 `null` 覆盖旧的 `out` 配置。
4. Production Branch 设为 `main`。

定时抓取 workflow 在 `data/live` 有变化时会提交到 `main`；Vercel 的 Git 集成会自动重新部署。

---

# 投研快讯 IM 推送（飞书 / Telegram）

每次抓取后（`fetch.yml` 里 fetch 之后、commit 之前）自动运行 `scripts/push-im.mjs`，
把**新推文**整理成卡片推到飞书群 / Telegram。**任一渠道不配置就自动跳过，绝不报错、绝不阻断抓取。**
靠 `data/live/_push-state.json` 记录已推条目去重，不会重复刷屏。

## 要配置的 Secrets（按需，缺哪个跳哪个）

仓库 → **Settings → Secrets and variables → Actions**：

| 名称 | 类型 | 怎么拿 |
|---|---|---|
| `FEISHU_WEBHOOK` | Secret | 飞书目标群 → 设置 → 群机器人 → 添加机器人 → **自定义机器人** → 复制 Webhook 地址 |
| `FEISHU_SECRET` | Secret | 仅当机器人勾了「签名校验」才需要，把那串密钥填这里；没勾就不用建 |
| `TELEGRAM_BOT_TOKEN` | Secret | Telegram 里找 **@BotFather** → `/newbot` → 拿到 `123456:ABC...` token |
| `TELEGRAM_CHAT_ID` | Secret | 把 bot 拉进群/频道后，访问 `https://api.telegram.org/bot<token>/getUpdates` 看 `chat.id`（群是负数）|
| `SITE_URL` | **Variable** | 完整看板地址（卡片底部按钮指向它），= 主站 `assets/data.js` 里的 `FFC_LINKS.tweetsBoard` |

> 微信群没有开放 webhook；要推微信走**企业微信群机器人**（同样是一个 webhook，可后续加），个人微信不行。
> 龙虾(workbuddy) 若有 bot/webhook，按 Telegram 那套加一个渠道即可。

## 调参（可选，Variables 里设）

| 变量 | 默认 | 说明 |
|---|---|---|
| `PUSH_MAX` | `12` | 单条卡片最多列几条推文 |
| `PUSH_WINDOW_H` | `24` | 只推最近多少小时内的推文 |

## 本地测试（不发送、不写状态）

```bash
node scripts/fetch-x.mjs --dry-run   # 先用 fixtures 喂出 data/live
node scripts/push-im.mjs --dry-run   # 打印将要推送的卡片内容
```

# 实时博主推文 + 飞书弹消息（含 A股喊单检测 + 中英双语）

目标：**@aleabitoreddit 一发推 → 飞书机器人马上弹卡片 + 网站 /tweets 十几秒内自动刷新**，
不用你手动、不用每条推都重新部署。并且：

- **A股喊单检测**：推文里点名沪深 A 股（六位代码或公司名）时，飞书卡片**变红置顶**、
  网站推文卡片标红，醒目提示是哪只票。代码命中 ~5400 只 A股白名单（自动排除指数/基金/
  浏览量等噪声），公司名走精度优先的匹配（最长匹配、常用词去噪）。
  ⚠️ 卡片标注「仅信息提示、非投资建议、请自行判断与风控」。
- **中英双语**：每条新推都用 Claude 翻成中文 + 英文，一并推给飞书。

## 它是怎么跑的

```
┌─ 常驻 worker（scripts/realtime-worker.mjs，部署到 Railway/Fly/Render）
│   每 15s 轮询 twitterapi.io 取 @aleabitoreddit 最新推文
│   发现新推：
│     ① 立刻 POST 飞书机器人  ← 你要的"弹消息"
│     ② 更新内存里的最新推文，并通过 HTTP /api/tweets 对外提供（带 CORS）
│
└─ 网站（Vercel 上的 Next 站点）
    components/LiveTweets.tsx（客户端）每 15s 拉 worker 的 /api/tweets
    → /tweets 页顶部"实时推文"条秒级刷新，无需重新构建/部署
    worker 没配/离线时，自动回退到构建期快照，页面永远不空
```

- **密钥只在 worker 端**（TWITTER_API_KEY / FEISHU_WEBHOOK），不进前端、不进 git。
- 现有每 30 分钟的 GitHub Actions 管线（fetch.yml）原样保留，做兜底和分析数据来源。

---

## 一、拿 twitterapi.io 的 API Key（约 2 分钟）

1. 打开 https://twitterapi.io ，注册/登录。
2. 控制台 → API Keys，复制你的 Key（形如 `xxxxxxxxxxxxxxxx`）。
3. 充一点额度（按调用计费，很便宜）。15s 轮询一天约 5760 次请求，成本极低。

## 二、建飞书自定义机器人，拿 Webhook（约 2 分钟）

1. 飞书里进你要接收消息的群 → 右上「设置」→「群机器人」→「添加机器人」→「自定义机器人」。
2. 复制 **Webhook 地址**（形如 `https://open.feishu.cn/open-apis/bot/v2/hook/xxxx`）。
3. （可选）若勾选「签名校验」，把那串密钥记下来当 `FEISHU_SECRET`。

## 三、部署 worker 到 Railway（最省事，约 5 分钟）

> 也可用 Fly.io / Render，任意 always-on 容器平台都行，用仓库根的 `worker.Dockerfile`。

1. https://railway.app → New Project → Deploy from GitHub repo → 选 `claworld-Financial-Newa`。
2. Settings → **Build**：Dockerfile path 填 `worker.Dockerfile`。
3. Variables（环境变量）里加：

   | 变量 | 值 |
   |---|---|
   | `TWITTER_API_KEY` | 你的 twitterapi.io Key |
   | `FEISHU_WEBHOOK` | 你的飞书机器人 webhook |
   | `FEISHU_SECRET` | （可选）飞书签名密钥 |
   | `ANTHROPIC_API_KEY` | （可选）开启中英双语翻译用的 Claude API Key；不填则只发原文 |
   | `TRANSLATE_MODEL` | （可选）默认 `claude-opus-4-8`；想更快更省可设 `claude-haiku-4-5` |
   | `SITE_URL` | `https://claworld-financial-newa.vercel.app/tweets/` |
   | `X_HANDLE` | `aleabitoreddit` |
   | `POLL_INTERVAL` | `15` |

4. Settings → Networking → **Generate Domain**，得到一个公网地址，形如
   `https://ffc-worker-production.up.railway.app`。
5. 打开 `https://<那个域名>/health`，看到 `{"ok":true,...,"feishu":true}` 即成功。

## 四、把 worker 地址告诉网站（Vercel）

1. Vercel 项目 → Settings → Environment Variables，加：

   | 变量 | 值 |
   |---|---|
   | `NEXT_PUBLIC_REALTIME_URL` | 第三步拿到的 Railway 域名（**不要带结尾斜杠**） |

2. 重新部署一次（Deployments → 右上 ⋯ → Redeploy，或随便 push 一次）。
   `NEXT_PUBLIC_*` 是构建期注入的，所以改完必须重新部署一次。

## 五、验证

- 打开 `https://claworld-financial-newa.vercel.app/tweets/`，
  顶部「实时推文」条左侧圆点应为**绿色 + 跳动**，标签显示「实时」。
- 让博主发条推（或等他发），15 秒内：
  - 飞书群弹出红色卡片 `🚨 @aleabitoreddit 发新推`；
  - 网站顶部最新推文出现，带绿色 `NEW` 高亮。

---

## 本地自测

```bash
# 只测 HTTP 与种子（dummy key 会 401，但能确认服务正常起、回退正常）
TWITTER_API_KEY=dummy PORT=8099 npm run realtime
curl localhost:8099/health
curl localhost:8099/api/tweets

# 真测（会真发飞书）：
TWITTER_API_KEY=你的key FEISHU_WEBHOOK=你的webhook npm run realtime
```

前端本地联调：在 `.env.local` 写 `NEXT_PUBLIC_REALTIME_URL=http://localhost:8099`，再 `npm run dev`。

## 环境变量速查（worker）

| 变量 | 必填 | 默认 | 说明 |
|---|---|---|---|
| `TWITTER_API_KEY` | ✅ | — | twitterapi.io Key |
| `FEISHU_WEBHOOK` | 否 | — | 留空则只更新网站、不推飞书 |
| `FEISHU_SECRET` | 否 | — | 机器人开了签名校验才填 |
| `ANTHROPIC_API_KEY` | 否 | — | 开启中英双语翻译；留空只发原文 |
| `TRANSLATE_MODEL` | 否 | `claude-opus-4-8` | 翻译模型，可设 `claude-haiku-4-5` 更快更省 |
| `SITE_URL` | 否 | — | 飞书卡片底部按钮指向的看板地址 |
| `X_HANDLE` | 否 | `aleabitoreddit` | 追哪个博主 |
| `POLL_INTERVAL` | 否 | `15` | 轮询间隔（秒） |
| `MAX_TWEETS` | 否 | `20` | 每次取多少条 |
| `PORT` | 否 | `8080` | HTTP 端口 |

## A 股白名单（喊单检测的数据底座）

- 文件：`data/ashares.json`（代码 → 中文简称，~5400 只沪深 A 股）。已随仓库提交，作为**种子**。
- 重建种子：`python3 scripts/build-ashares.py`（枚举沪深代码空间 → 查腾讯行情拿在市清单+中文名）。
- **线上自动刷新**：worker 启动后会尝试用东方财富 `push2 clist` 接口拉**完整、当日最新**的中文名单
  覆盖种子，并每 24 小时刷新一次。东方财富对部分 IP 限流（本地沙箱拿不到），但 Railway 等服务器可以；
  失败时自动保留种子，不影响运行。
- 检测逻辑在 `scripts/ashare-match.mjs`：代码优先（白名单裁决 + 金额/日期去噪），公司名其次
  （最长匹配 + 常用词 deny-list + 短名需上下文）。`/health` 里的 `ashareCount` 能看到当前白名单条数。

## 升级想法（以后）

- 想更省：把 `POLL_INTERVAL` 调大（如 30/60s）。想更快：保持 15s 或更低。
- 想多博主：在 worker 里扩展成读 `scripts/handles.json` 循环；目前先单博主。
- 会员频道（superfollows）原文**不要**走这条公开链路，按背景说明用私有授权环境另存。

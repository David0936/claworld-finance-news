#!/usr/bin/env node
/**
 * 实时博主推文 worker（常驻进程，部署到 Railway / Fly / Render 等always-on 平台）。
 *
 * 做两件事：
 *   1) 每 POLL_INTERVAL 秒轮询一次 twitterapi.io，拿 @<handle> 的最新推文。
 *      发现新推 → 立刻推飞书机器人（你要的"弹消息"），并更新内存里的最新推文列表。
 *   2) 起一个超轻量 HTTP 服务，把最新推文以 JSON 暴露给网站前端（带 CORS）。
 *      网站 components/LiveTweets.tsx 每 15s 拉一次 → 秒级刷新，无需重新部署。
 *
 * 密钥（TWITTER_API_KEY / FEISHU_WEBHOOK）只留在本进程，绝不进前端、不进 git。
 *
 * ── 环境变量 ──
 *   TWITTER_API_KEY   必填，twitterapi.io 的 API Key（https://twitterapi.io 注册后在控制台拿）
 *   X_HANDLE          要追的博主，默认 aleabitoreddit
 *   FEISHU_WEBHOOK    飞书群自定义机器人 webhook（留空则只更新网站、不推飞书）
 *   FEISHU_SECRET     可选，机器人开了"签名校验"时才填
 *   SITE_URL          看板地址，飞书卡片底部按钮指向它
 *   POLL_INTERVAL     轮询间隔秒，默认 15
 *   MAX_TWEETS        每次取多少条，默认 20
 *   PORT              HTTP 端口，默认 8080
 *   TWITTER_API_BASE  默认 https://api.twitterapi.io
 *   TWITTER_API_PATH  默认 /twitter/user/last_tweets
 *
 * 本地跑：TWITTER_API_KEY=xxx FEISHU_WEBHOOK=xxx node scripts/realtime-worker.mjs
 */
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHmac } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAshareState, buildAshareState, detectAshares } from "./ashare-match.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const ASHARE_FILE = join(ROOT, "data", "ashares.json");

// A 股白名单检测状态（启动时从 data/ashares.json 载入；线上再从东方财富刷新到完整名单）
let ashareState = buildAshareState({});

const API_KEY = (process.env.TWITTER_API_KEY || "").trim();
const HANDLE = (process.env.X_HANDLE || "aleabitoreddit").replace(/^@/, "").trim();
const API_BASE = (process.env.TWITTER_API_BASE || "https://api.twitterapi.io").replace(/\/$/, "");
const API_PATH = process.env.TWITTER_API_PATH || "/twitter/user/last_tweets";
const KEY_HEADER = process.env.TWITTER_API_KEY_HEADER || "X-API-Key";
const USER_PARAM = process.env.TWITTER_API_USER_PARAM || "userName";
const POLL_MS = Math.max(5, Number(process.env.POLL_INTERVAL || 15)) * 1000;
const MAX_TWEETS = Number(process.env.MAX_TWEETS || 20);
const PORT = Number(process.env.PORT || 8080);

const FEISHU_WEBHOOK = (process.env.FEISHU_WEBHOOK || "").trim();
const FEISHU_SECRET = (process.env.FEISHU_SECRET || "").trim();
const SITE_URL = (process.env.SITE_URL || "").trim();

// 翻译：用 Anthropic Messages API 把推文同时给出中文 + 英文。没配 key 则跳过翻译，只推原文。
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const ANTHROPIC_BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
const TRANSLATE_MODEL = process.env.TRANSLATE_MODEL || "claude-opus-4-8"; // 想更快更省可设 claude-haiku-4-5

const SEED_FILE = join(ROOT, "data", "live", `${HANDLE}.tweets.json`);
const STATE_FILE = join(__dirname, ".realtime-state.json");

// ── 内存状态（同时持久化到 STATE_FILE，重启不重复推送、不返回空）──
const state = {
  id: HANDLE,
  handle: HANDLE,
  source: API_BASE,
  fetchedAt: null,
  feed: [], // 最新推文，最多 MAX_TWEETS 条，新→旧
  seen: [], // 已处理过的 tweet id，避免重复推飞书
  lastPollAt: null,
  lastError: null,
};

const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (d) =>
  `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
const fmtDateTime = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(
    d.getUTCMinutes()
  )}`;

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

const TICKER_RE = /\$([A-Z]{1,6})\b/g;
function extractTickers(text) {
  const out = new Set();
  let m;
  while ((m = TICKER_RE.exec(text)) !== null) out.add(m[1]);
  return [...out];
}

function tweetDate(t) {
  const raw = t.createdAt || t.created_at || t.date || t.time || null;
  if (raw == null) return new Date(0);
  if (typeof raw === "number") return new Date(raw * (raw < 1e12 ? 1000 : 1));
  const d = new Date(raw);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

// twitterapi.io 返回结构兼容：{tweets:[...]} / {data:{tweets:[...]}} / [...]
function pickTweets(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  return json.tweets || json.data?.tweets || json.data?.data || (Array.isArray(json.data) ? json.data : null) || json.results || [];
}

function normalize(raw) {
  const text = (raw.text || raw.full_text || raw.content || "").trim();
  if (!text) return null;
  const d = tweetDate(raw);
  const tickers = extractTickers(text);
  const ticker = tickers[0] || "";
  const id =
    raw.id || raw.id_str || raw.tweet_id || raw.rest_id || `${d.getTime()}|${text.slice(0, 40)}`;
  const url = raw.url || raw.twitterUrl || raw.permalink || `https://x.com/${HANDLE}/status/${id}`;
  const ashare = detectAshares(text, ashareState); // A股喊单检测
  return {
    id: String(id),
    time: fmtTime(d),
    type: "推文",
    ticker,
    tickers,
    ashare,
    title: ashare.length
      ? `🅰️ A股点名 · ${ashare.map((a) => a.code).join(" ")}`
      : ticker
      ? `推文线索 · ${ticker}`
      : `推文 · @${HANDLE}`,
    body: text,
    author: `@${HANDLE}`,
    datetime: fmtDateTime(d),
    url,
    stats: {
      views: fmtNum(raw.viewCount ?? raw.views ?? raw.view_count),
      likes: fmtNum(raw.likeCount ?? raw.favorite_count ?? raw.likes),
      reposts: fmtNum(raw.retweetCount ?? raw.retweet_count ?? raw.reposts),
      bookmarks: fmtNum(raw.bookmarkCount ?? raw.bookmark_count ?? raw.bookmarks),
    },
    ts: d.getTime(),
  };
}

async function fetchLatest() {
  const url = new URL(`${API_BASE}${API_PATH}`);
  url.searchParams.set(USER_PARAM, HANDLE);
  const res = await fetch(url, { headers: { [KEY_HEADER]: API_KEY } });
  if (!res.ok) throw new Error(`twitterapi.io HTTP ${res.status} ${res.statusText}`);
  const json = await res.json().catch(() => null);
  const items = pickTweets(json)
    .map(normalize)
    .filter(Boolean)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_TWEETS);
  return items;
}

// ── 飞书推送（复用 push-im.mjs 的卡片风格，只推"新"推文）──
function feishuSign(ts, secret) {
  return createHmac("sha256", `${ts}\n${secret}`).update("").digest("base64");
}
const clip = (s, n) => {
  s = (s || "").replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n) + "…" : s;
};

// 用 Anthropic Messages API 把一条推文翻成 {zh, en}。失败/未配 key 返回 null（推送会回退到只发原文）。
const TRANSLATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { zh: { type: "string" }, en: { type: "string" } },
  required: ["zh", "en"],
};
async function translate(text) {
  if (!ANTHROPIC_API_KEY || !text) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${ANTHROPIC_BASE}/v1/messages`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: TRANSLATE_MODEL,
        max_tokens: 1024,
        thinking: { type: "disabled" },
        system:
          "你是财经新闻翻译。把给定推文同时给出忠实的中文版(zh)和英文版(en)。" +
          "保留所有 $股票代码、数字、6位A股代码、@账号、链接原样不变；不要增删观点、不要加解释。" +
          "若原文已是中文，zh 为清理后的原文、en 为英文翻译；若原文是英文则反之。只输出译文本身。",
        output_config: { format: { type: "json_schema", schema: TRANSLATE_SCHEMA } },
        messages: [{ role: "user", content: text }],
      }),
    });
    if (!res.ok) {
      console.error(`  · 翻译 HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const block = (data.content || []).find((b) => b.type === "text");
    if (!block) return null;
    const parsed = JSON.parse(block.text);
    return parsed && parsed.zh && parsed.en ? parsed : null;
  } catch (e) {
    console.error("  · 翻译失败：", e.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 单条推文 → 一个飞书 lark_md 文本块（含 A股点名提示 + 中/英双语 + 互动数据）
function buildItemBlock(it) {
  const head = `${it.ticker ? `$${it.ticker} ` : ""}${it.author}`;
  const headMd = it.url ? `[**${head}**](${it.url})` : `**${head}**`;
  const s = it.stats || {};
  const stat = `👁 ${s.views || 0} · 👍 ${s.likes || 0} · 🔁 ${s.reposts || 0} · 🔖 ${s.bookmarks || 0}`;
  const parts = [`${headMd}　<font color="grey">${it.time || ""}</font>`];

  // A股点名：最高优先级，置顶醒目
  if (it.ashare && it.ashare.length) {
    const list = it.ashare.map((a) => `**${a.code}${a.name ? " " + a.name : ""}**`).join("　");
    parts.push(`🅰️ <font color="red">**A股点名**</font>：${list}\n<font color="grey">该账号历史 2 次点名 A 股均涨停（用户观察）。⚠️ 仅信息提示，非投资建议，请自行判断与风控。</font>`);
  }

  const tr = it.translation;
  if (tr && (tr.zh || tr.en)) {
    parts.push(`🇨🇳 ${clip(tr.zh || it.body, 200)}`);
    if (tr.en) parts.push(`🇬🇧 ${clip(tr.en, 220)}`);
  } else {
    parts.push(clip(it.body, 200)); // 没翻译就发原文
  }
  parts.push(`<font color="grey">${stat}</font>`);
  return parts.join("\n");
}

async function pushFeishu(newItems) {
  if (!FEISHU_WEBHOOK || !newItems.length) return;
  const hasAshare = newItems.some((it) => it.ashare && it.ashare.length);
  const blocks = newItems.map(buildItemBlock);
  const tickers = [...new Set(newItems.flatMap((it) => it.tickers || []))];
  let body = blocks.join("\n\n———\n\n");
  if (tickers.length) body += `\n\n🏷 标的：${tickers.map((t) => `$${t}`).join("  ")}`;

  const elements = [{ tag: "div", text: { tag: "lark_md", content: body } }];
  if (SITE_URL) {
    elements.push({ tag: "hr" });
    elements.push({
      tag: "action",
      actions: [{ tag: "button", text: { tag: "plain_text", content: "查看实时看板" }, type: "primary", url: SITE_URL }],
    });
  }
  const title = hasAshare
    ? `🅰️ A股点名！@${HANDLE} 发新推（${newItems.length} 条）`
    : `🚨 @${HANDLE} 发新推（${newItems.length} 条）`;
  const card = {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: hasAshare ? "red" : "blue",
        title: { tag: "plain_text", content: title },
      },
      elements,
    },
  };
  let payload = card;
  if (FEISHU_SECRET) {
    const ts = Math.floor(Date.now() / 1000).toString();
    payload = { timestamp: ts, sign: feishuSign(ts, FEISHU_SECRET), ...card };
  }
  try {
    const res = await fetch(FEISHU_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log(`  · 飞书推送 HTTP ${res.status}（${newItems.length} 条新推）`);
  } catch (e) {
    console.error("  · 飞书推送失败：", e.message);
  }
}

async function loadState() {
  // 优先恢复上次运行状态；首次启动用构建期种子文件，避免把历史推文当"新推"刷屏
  if (existsSync(STATE_FILE)) {
    try {
      const s = JSON.parse(await readFile(STATE_FILE, "utf8"));
      Object.assign(state, s);
      console.log(`已恢复状态：${state.feed.length} 条缓存推文，${state.seen.length} 个已知 id`);
      return;
    } catch {}
  }
  if (existsSync(SEED_FILE)) {
    try {
      const seed = JSON.parse(await readFile(SEED_FILE, "utf8"));
      const feed = (seed.feed || []).filter((f) => f.type === "推文");
      state.feed = feed.slice(0, MAX_TWEETS);
      state.seen = feed.map((f) => f.id || `${f.datetime}|${(f.body || "").slice(0, 40)}`);
      console.log(`用种子文件初始化：${state.feed.length} 条历史推文（不会推飞书）`);
    } catch {}
  }
}

async function saveState() {
  try {
    await writeFile(
      STATE_FILE,
      JSON.stringify({ ...state, seen: state.seen.slice(-2000) }, null, 2)
    );
  } catch (e) {
    console.error("写状态失败：", e.message);
  }
}

let polling = false;
async function pollOnce() {
  if (polling) return;
  polling = true;
  try {
    const items = await fetchLatest();
    state.lastPollAt = new Date().toISOString();
    state.lastError = null;
    if (items.length) {
      state.feed = items;
      state.fetchedAt = fmtDateTime(new Date());
      const seen = new Set(state.seen);
      const fresh = items.filter((it) => !seen.has(it.id)).sort((a, b) => a.ts - b.ts);
      if (fresh.length) {
        for (const it of fresh) state.seen.push(it.id);
        const aCount = fresh.filter((it) => it.ashare && it.ashare.length).length;
        console.log(
          `[${state.lastPollAt}] 发现 ${fresh.length} 条新推${aCount ? `（${aCount} 条点名 A 股）` : ""} → 翻译+推送飞书`
        );
        // 并行翻译每条新推（失败则回退原文），再统一推送
        await Promise.all(
          fresh.map(async (it) => {
            it.translation = await translate(it.body);
          })
        );
        await pushFeishu(fresh);
      }
      await saveState();
    }
  } catch (e) {
    state.lastError = e.message;
    console.error(`[poll] ${e.message}`);
  } finally {
    polling = false;
  }
}

// ── HTTP 服务：给网站前端取最新推文（CORS 开放，只暴露公开推文）──
function json(res, code, obj) {
  const payload = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "no-store, max-age=0",
  });
  res.end(payload);
}

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    });
    return res.end();
  }
  const path = (req.url || "/").split("?")[0].replace(/\/$/, "") || "/";
  if (path === "/health") {
    return json(res, 200, {
      ok: !state.lastError,
      handle: HANDLE,
      count: state.feed.length,
      lastPollAt: state.lastPollAt,
      lastError: state.lastError,
      feishu: Boolean(FEISHU_WEBHOOK),
      translate: Boolean(ANTHROPIC_API_KEY),
      ashareCount: ashareState.size,
    });
  }
  if (path === "/api/tweets" || path === "/tweets" || path === "/") {
    return json(res, 200, {
      id: state.id,
      handle: state.handle,
      source: state.source,
      fetchedAt: state.fetchedAt,
      lastPollAt: state.lastPollAt,
      feed: state.feed,
    });
  }
  return json(res, 404, { error: "not found" });
});

// ── A 股白名单：启动用 data/ashares.json 种子，线上再从东方财富刷新到完整最新名单 ──
const EASTMONEY_HOSTS = [
  "https://82.push2.eastmoney.com",
  "https://push2.eastmoney.com",
  "https://1.push2.eastmoney.com",
];
async function fetchEastmoneyAshares() {
  // fs 段：沪主板 m:0 t:6、科创 m:0 t:80、深主板 m:1 t:2、创业板 m:1 t:23（不含北交所）
  const fs = "m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"; // 必须原样，不要 URL 编码 +
  const qs = `pn=1&pz=6000&po=1&np=1&fltt=2&invt=2&fid=f12&fs=${fs}&fields=f12,f14`;
  for (const host of EASTMONEY_HOSTS) {
    try {
      const res = await fetch(`${host}/api/qt/clist/get?${qs}`, {
        headers: { "User-Agent": "Mozilla/5.0", Referer: "https://quote.eastmoney.com/" },
      });
      if (!res.ok) continue;
      const j = await res.json();
      const diff = j?.data?.diff;
      const rows = Array.isArray(diff) ? diff : diff ? Object.values(diff) : [];
      const stocks = {};
      for (const r of rows) {
        const code = String(r.f12 || "");
        const name = String(r.f14 || "");
        if (/^\d{6}$/.test(code) && name) stocks[code] = name;
      }
      if (Object.keys(stocks).length > 1000) return stocks; // 合理性校验
    } catch {
      /* 换下一个镜像 */
    }
  }
  return null;
}

async function refreshAshares() {
  try {
    const stocks = await fetchEastmoneyAshares();
    if (stocks) {
      ashareState = buildAshareState(stocks);
      console.log(`  · A股白名单已从东方财富刷新：${ashareState.size} 只`);
      // 写回文件，供 worker 重启后直接用最新种子（容器内临时写，无副作用）
      try {
        await writeFile(
          ASHARE_FILE,
          JSON.stringify(
            { updatedAt: fmtDateTime(new Date()) + " UTC", source: "eastmoney push2 clist", count: ashareState.size, named: ashareState.size, stocks },
            null,
            0
          ) + "\n"
        );
      } catch {}
    }
  } catch (e) {
    console.error("  · A股白名单刷新失败（保留种子）：", e.message);
  }
}

async function main() {
  if (!API_KEY) {
    console.error("❌ 缺少 TWITTER_API_KEY，worker 无法轮询。请在部署平台设置该环境变量。");
    process.exit(1);
  }
  await loadState();
  ashareState = await loadAshareState(ASHARE_FILE);
  console.log(`已载入 A股白名单种子：${ashareState.size} 只（${ashareState.names.length} 个可名称匹配）`);
  server.listen(PORT, () => {
    console.log(`实时 worker 已启动 :${PORT}  追踪 @${HANDLE}  每 ${POLL_MS / 1000}s 轮询`);
    console.log(`  GET /api/tweets  → 最新推文 JSON`);
    console.log(`  GET /health      → 运行状态`);
    console.log(`  飞书推送：${FEISHU_WEBHOOK ? "已开启" : "未配置（只更新网站）"}`);
    console.log(`  翻译：${ANTHROPIC_API_KEY ? `已开启（${TRANSLATE_MODEL}）` : "未配置（只发原文）"}`);
  });
  refreshAshares(); // best-effort：线上拉东方财富完整名单，失败保留种子
  setInterval(refreshAshares, 24 * 3600 * 1000); // 每天刷新一次
  await pollOnce();
  setInterval(pollOnce, POLL_MS);
}

main().catch((e) => {
  console.error("worker 启动失败：", e);
  process.exit(1);
});

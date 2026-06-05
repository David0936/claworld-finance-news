#!/usr/bin/env node
/**
 * 投研快讯 IM 推送：把 data/live 里的新推文整理成卡片，推到飞书群机器人 / Telegram Bot。
 * 复用 fetch-x.mjs 抓好的数据；在 GitHub Action 里「fetch 之后、commit 之前」运行。
 *
 * ── 配置（全部走环境变量 / GitHub Secrets，留空则跳过该渠道，绝不报错）──
 *   FEISHU_WEBHOOK      飞书群机器人 webhook（群设置 → 添加机器人 → 自定义机器人 → 复制地址）
 *   FEISHU_SECRET       可选；机器人勾了「签名校验」时才需要填
 *   TELEGRAM_BOT_TOKEN  Telegram @BotFather 申请的 bot token
 *   TELEGRAM_CHAT_ID    推到哪个 chat/群/频道的 id（把 bot 拉进群后可用 getUpdates 查）
 *   SITE_URL            完整看板地址，卡片底部「查看完整看板」按钮指向它（= 主站 FFC_LINKS.tweetsBoard）
 *   PUSH_MAX            单次最多列几条（默认 12）
 *   PUSH_WINDOW_H       只推最近多少小时内的推文（默认 24）
 *
 * ── 本地测试（不发送、不写状态，只打印将要推送的内容）──
 *   node scripts/push-im.mjs --dry-run
 */
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LIVE_DIR = join(ROOT, "data", "live");
const STATE_FILE = join(LIVE_DIR, "_push-state.json"); // 记录已推过的条目，避免重复推送

const DRY_RUN = process.argv.includes("--dry-run");
const MAX = Number(process.env.PUSH_MAX || 12);
const WINDOW_H = Number(process.env.PUSH_WINDOW_H || 24);
const SITE_URL = (process.env.SITE_URL || "").trim();

const FEISHU_WEBHOOK = (process.env.FEISHU_WEBHOOK || "").trim();
const FEISHU_SECRET = (process.env.FEISHU_SECRET || "").trim();
const TG_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const TG_CHAT = (process.env.TELEGRAM_CHAT_ID || "").trim();

// datetime 形如 "YYYY-MM-DD HH:MM"（UTC，由 fetch-x.mjs 生成）
function parseDT(s) {
  const m = /(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s || "");
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : 0;
}
const keyOf = (it) => `${it.author}|${it.datetime}|${(it.body || "").slice(0, 60)}`;
const clip = (s, n) => { s = (s || "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n) + "…" : s; };
const escHtml = (s) => (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function loadState() {
  try { return JSON.parse(await readFile(STATE_FILE, "utf8")); }
  catch { return { pushed: [], updatedAt: null }; }
}
async function loadAllowedSources() {
  try {
    const handles = JSON.parse(await readFile(join(__dirname, "handles.json"), "utf8"));
    const ids = new Set();
    const handlesOnly = new Set();
    for (const item of handles || []) {
      if (item.id) ids.add(String(item.id).toLowerCase());
      if (item.handle) handlesOnly.add(String(item.handle).toLowerCase());
    }
    return { ids, handles: handlesOnly };
  } catch {
    return { ids: new Set(), handles: new Set() };
  }
}
async function loadLiveItems() {
  let files = [];
  try { files = await readdir(LIVE_DIR); } catch { return []; }
  const allowed = await loadAllowedSources();
  const items = [];
  for (const f of files) {
    if (!f.endsWith(".json") || f.startsWith("_")) continue; // 跳过状态文件
    try {
      const j = JSON.parse(await readFile(join(LIVE_DIR, f), "utf8"));
      const id = String(j.id || f.replace(/\.json$/, "")).toLowerCase();
      const handle = String(j.handle || "").toLowerCase();
      if (
        allowed.ids.size > 0 &&
        !allowed.ids.has(id) &&
        !allowed.handles.has(handle)
      ) {
        continue;
      }
      for (const it of j.feed || []) items.push(it);
    } catch { /* 单文件坏了不影响整体 */ }
  }
  return items;
}

function buildContent(items) {
  // 热度：统计本批新推文涉及的标的
  const heat = {};
  for (const it of items) if (it.ticker) heat[it.ticker] = (heat[it.ticker] || 0) + 1;
  const heatLine = Object.entries(heat).sort((a, b) => b[1] - a[1]).slice(0, 8)
    .map(([t, n]) => `$${t}×${n}`).join("  ·  ");

  const shown = items.slice(0, MAX);
  const more = items.length - shown.length;

  // 飞书 lark_md（标题做成原文链接）
  const fsLines = shown.map((it) => {
    const head = `${it.ticker ? `$${it.ticker} ` : ""}${it.author}`;
    const headMd = it.url ? `[**${head}**](${it.url})` : `**${head}**`;
    return `${headMd}　<font color="grey">${it.time || ""}</font>\n${clip(it.body, 110)}`;
  });
  let fsBody = fsLines.join("\n\n");
  if (heatLine) fsBody += `\n\n🔥 **本批热度**：${heatLine}`;
  if (more > 0) fsBody += `\n\n…另有 ${more} 条，见完整看板`;

  // Telegram HTML（标题做成原文链接）
  const tgLines = shown.map((it) => {
    const head = `${it.ticker ? `$${escHtml(it.ticker)} ` : ""}${escHtml(it.author)}`;
    const headHtml = it.url ? `<a href="${escHtml(it.url)}"><b>${head}</b></a>` : `<b>${head}</b>`;
    return `${headHtml}  <i>${escHtml(it.time || "")}</i>\n${escHtml(clip(it.body, 110))}`;
  });
  let tgBody = `📊 <b>FFC 投研快讯</b>\n\n` + tgLines.join("\n\n");
  if (heatLine) tgBody += `\n\n🔥 <b>本批热度</b>：${escHtml(heatLine)}`;
  if (more > 0) tgBody += `\n\n…另有 ${more} 条，见完整看板`;
  if (SITE_URL) tgBody += `\n\n👉 <a href="${escHtml(SITE_URL)}">查看完整投研看板</a>`;

  return { fsBody, tgBody, count: shown.length };
}

function feishuSign(ts, secret) {
  // 飞书签名：key = timestamp + "\n" + secret，对空串做 HMAC-SHA256，base64
  return createHmac("sha256", `${ts}\n${secret}`).update("").digest("base64");
}

async function postFeishu(fsBody) {
  if (!FEISHU_WEBHOOK) { console.log("  · 跳过飞书（未配置 FEISHU_WEBHOOK）"); return; }
  const elements = [{ tag: "div", text: { tag: "lark_md", content: fsBody } }];
  if (SITE_URL) {
    elements.push({ tag: "hr" });
    elements.push({
      tag: "action",
      actions: [{ tag: "button", text: { tag: "plain_text", content: "查看完整看板" }, type: "primary", url: SITE_URL }],
    });
  }
  const payload = {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: { template: "blue", title: { tag: "plain_text", content: "📊 FFC 投研快讯" } },
      elements,
    },
  };
  let body = payload;
  if (FEISHU_SECRET) {
    const ts = Math.floor(Date.now() / 1000).toString();
    body = { timestamp: ts, sign: feishuSign(ts, FEISHU_SECRET), ...payload };
  }
  const res = await fetch(FEISHU_WEBHOOK, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const txt = await res.text();
  console.log(`  · 飞书：HTTP ${res.status} ${txt.slice(0, 120)}`);
}

async function postTelegram(tgBody) {
  if (!TG_TOKEN || !TG_CHAT) { console.log("  · 跳过 Telegram（未配置 TOKEN/CHAT_ID）"); return; }
  const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: TG_CHAT, text: tgBody, parse_mode: "HTML", disable_web_page_preview: true }),
  });
  const txt = await res.text();
  console.log(`  · Telegram：HTTP ${res.status} ${txt.slice(0, 120)}`);
}

async function main() {
  const state = await loadState();
  const seen = new Set(state.pushed || []);
  const all = await loadLiveItems();

  const cutoff = Date.now() - WINDOW_H * 3.6e6;
  const fresh = all
    .filter((it) => parseDT(it.datetime) >= cutoff && !seen.has(keyOf(it)))
    .sort((a, b) => parseDT(b.datetime) - parseDT(a.datetime));

  if (!fresh.length) { console.log("无新内容（窗口内无未推送推文），跳过推送。"); return; }

  const { fsBody, tgBody, count } = buildContent(fresh);
  console.log(`发现 ${fresh.length} 条新推文，推送其中 ${count} 条${DRY_RUN ? "（DRY-RUN）" : ""}：`);
  console.log("────────────\n" + tgBody.replace(/<[^>]+>/g, "") + "\n────────────");

  if (DRY_RUN) { console.log("DRY-RUN：不发送、不写状态。"); return; }

  await postFeishu(fsBody);
  await postTelegram(tgBody);

  // 记下已推过的条目（含未在卡片内展示的，避免下次刷屏），保留最近 1000 条
  const updated = [...(state.pushed || []), ...fresh.map(keyOf)].slice(-1000);
  await writeFile(STATE_FILE, JSON.stringify({ pushed: updated, updatedAt: new Date().toISOString() }, null, 2) + "\n");
  console.log(`已更新推送状态：${updated.length} 条记录。`);
}

main().catch((e) => { console.error("推送失败：", e); process.exit(0); }); // 推送失败不阻断 Action

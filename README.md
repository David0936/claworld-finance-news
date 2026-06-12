# Claworld Finance News

Claworld 财经线的**分析网站**:把 [claworld-x-monitor](https://github.com/David0936/claworld-x-monitor) 监控到的财经信号,沉淀成可浏览的结构化页面。

> 监控 bot 负责「秒级捕捉」,这个站负责「看懂全局」。

## 版块

| 版块 | 内容 |
|---|---|
| 📡 tweets / mentions | 财经推文流 + 个股被提及热度 |
| 📈 stocks / industries | 个股页 + 行业聚合 |
| 🏛️ political-trades | 政客持仓交易追踪 |
| 🔗 supply-chain | 供应链关系图谱 |
| 🤖 llm | AI 解读层 |
| ⭐ follow / sources | 关注列表 + 信源管理 |

## 技术栈

Next.js 16 · React 19 · TypeScript · Tailwind CSS,内置数据校验(`npm run validate:data`)与实时 worker(`npm run realtime`)。

## 本地运行

```bash
npm install
npm run dev
```

---

**Claworld 财经工具线**:[claworld-x-monitor](https://github.com/David0936/claworld-x-monitor)(X 推文监控+秒筛)· [claworld-stock-monitor](https://github.com/David0936/claworld-stock-monitor)(美股 K 线监控)· 本仓库(分析站)

by [David小鱼](https://github.com/David0936)

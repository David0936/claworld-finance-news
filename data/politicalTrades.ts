export type TradeSide = "buy" | "sell" | "mixed" | "watch";

export type SignalLevel = "high" | "medium" | "low";

export interface SourceLink {
  label: string;
  url: string;
}

export interface TelecomIssuer {
  ticker: string;
  company: string;
  price: string;
  marketCap: string;
  trades3y: number;
  filings3y: number;
  volume3y: string;
  politicians3y: number;
  republican: {
    trades: number;
    buy: number;
    sell: number;
  };
  democrat: {
    trades: number;
    buy: number;
    sell: number;
  };
  latestSignal: string;
  interpretation: string;
  source: SourceLink;
}

export interface TradeEvent {
  ticker: string;
  company: string;
  politician: string;
  party: "R" | "D" | "O";
  chamber: "House" | "Senate";
  state: string;
  side: TradeSide;
  traded: string;
  published: string;
  filedAfter: string;
  amount: string;
  signal: SignalLevel;
  read: string;
  source: SourceLink;
}

export interface PoliticianRadar {
  name: string;
  party: "R" | "D" | "O";
  state: string;
  chamber: "House" | "Senate";
  volume: string;
  trades: string;
  issuers: string;
  lastTraded: string;
  ecosystem: string;
  focus: string[];
  read: string;
  source: SourceLink;
}

export interface PolicyCatalyst {
  date: string;
  title: string;
  impact: string;
  tickers: string[];
  read: string;
  source: SourceLink;
}

export interface WatchIdea {
  ticker: string;
  name: string;
  price: string;
  change: string;
  role: string;
  why: string;
  risk: string;
}

export interface RawResearchEntry {
  label: string;
  url: string;
  description: string;
  tags: string[];
}

export interface AiResearchLayer {
  label: string;
  value: string;
  description: string;
}

export interface ClueMiningLens {
  label: string;
  score: string;
  description: string;
  example: string;
}

export interface CluePipelineStep {
  step: string;
  title: string;
  description: string;
}

export interface HoldingClue {
  politician: string;
  party: "R" | "D" | "O";
  chamber: "House" | "Senate";
  state: string;
  issuer: string;
  ticker: string;
  published: string;
  traded: string;
  filedAfter: string;
  owner: string;
  type: TradeSide | "exchange";
  size: string;
  price: string;
  theme: string;
  aiScore: number;
  aiRead: string;
  source: SourceLink;
}

export const politicalTradeSources = {
  capitolHome: {
    label: "CapitolTrades",
    url: "https://www.capitoltrades.com/",
  },
  capitolTrades: {
    label: "CapitolTrades all trades",
    url: "https://www.capitoltrades.com/trades",
  },
  capitolPoliticians: {
    label: "CapitolTrades politician tracker",
    url: "https://www.capitoltrades.com/politicians",
  },
  attIssuer: {
    label: "CapitolTrades AT&T issuer page",
    url: "https://www.capitoltrades.com/issuers/429914",
  },
  verizonIssuer: {
    label: "CapitolTrades Verizon issuer page",
    url: "https://www.capitoltrades.com/issuers/435673",
  },
  tmobileIssuer: {
    label: "CapitolTrades T-Mobile issuer page",
    url: "https://www.capitoltrades.com/issuers/435282",
  },
  attAnnouncement: {
    label: "AT&T / T-Mobile / Verizon JV announcement",
    url: "https://about.att.com/story/2026/new-joint-venture.html",
  },
  verizonAnnouncement: {
    label: "Verizon JV announcement",
    url: "https://www.verizon.com/about/news/att-t-mobile-verizon-plan-launch-joint-venture-helps-end-dead-zones",
  },
  theInformation: {
    label: "The Information D2D brief",
    url: "https://www.theinformation.com/briefings/u-s-wireless-carriers-work-together-direct-mobile-service",
  },
  astsFcc: {
    label: "FCC AST SpaceMobile authorization",
    url: "https://docs.fcc.gov/public/attachments/DA-26-391A1.pdf",
  },
  tonyWiedTrump: {
    label: "AP: Tony Wied received Trump endorsement",
    url: "https://abc17news.com/ap-national/2024/04/08/former-gas-station-chain-owner-gets-trump-endorsement-in-wisconsin-congressional-race/",
  },
  texasTrades: {
    label: "CapitolTrades Texas page",
    url: "https://www.capitoltrades.com/states/tx",
  },
};

export const rawResearchEntries: RawResearchEntry[] = [
  {
    label: "原站总入口",
    url: politicalTradeSources.capitolHome.url,
    description: "适合自由检索、看最新披露、核验 AI 页面没有覆盖到的政客和标的。",
    tags: ["原始数据", "全站"],
  },
  {
    label: "全部交易流",
    url: politicalTradeSources.capitolTrades.url,
    description: "用于追踪最新披露。建议按金额、党派、披露日期排序，再回到 AI 页看是否值得继续挖。",
    tags: ["交易流", "最新", "持仓线索"],
  },
  {
    label: "政客排行榜",
    url: politicalTradeSources.capitolPoliticians.url,
    description: "看谁交易最多、资金最大。AI 雷达会优先压缩这里的高资金、知名、政策相关样本。",
    tags: ["政客", "资金", "核心入口"],
  },
  {
    label: "德州政客页",
    url: politicalTradeSources.texasTrades.url,
    description: "适合找能源、边境、税制、工业政策相关的共和党持仓线索。",
    tags: ["德州", "能源", "共和党"],
  },
  {
    label: "案例：AT&T 发行人页",
    url: politicalTradeSources.attIssuer.url,
    description: "仅作为事件拆解案例：核验一个标的的三年交易、党派买卖比例和近期披露。",
    tags: ["案例", "发行人"],
  },
  {
    label: "案例：Verizon 发行人页",
    url: politicalTradeSources.verizonIssuer.url,
    description: "仅作为事件拆解案例：比较同一主题下不同标的的党派方向差异。",
    tags: ["案例", "发行人"],
  },
  {
    label: "案例：T-Mobile 发行人页",
    url: politicalTradeSources.tmobileIssuer.url,
    description: "仅作为事件拆解案例：看合作方、竞争方和事件催化如何影响交易解读。",
    tags: ["案例", "发行人"],
  },
];

export const aiResearchLayers: AiResearchLayer[] = [
  {
    label: "第一层",
    value: "找异常",
    description: "从原站交易流里先抓金额大、重复买、披露快、政策相关的异常持仓线索。",
  },
  {
    label: "第二层",
    value: "降噪",
    description: "区分真实主动交易、配偶/子女交易、RSU/期权、基金/债券配置和单纯再平衡。",
  },
  {
    label: "第三层",
    value: "成线索",
    description: "输出政客名单、持仓主题、待核验字段和后续监控条件，而不是直接给买卖结论。",
  },
];

export const clueMiningLenses: ClueMiningLens[] = [
  {
    label: "资金权重",
    score: "40%",
    description: "优先看 $50K 以上、$250K 以上、$1M 以上的交易；低金额只作为辅助证据。",
    example: "Chip Roy / AESI 这类 5M-25M 线索优先级高，但必须回原始披露核验 owner 和交易类型。",
  },
  {
    label: "政客权重",
    score: "25%",
    description: "优先看知名度、委员会暴露、州产业结构、是否靠近特朗普政策议程。",
    example: "McCaul 适合看国家安全/科技/防务资产配置；德州共和党适合看能源和工业链。",
  },
  {
    label: "重复性",
    score: "15%",
    description: "单笔大额可疑，连续买入更强；同一政客、同一主题、跨多日重复出现才升权重。",
    example: "同一政客连续加仓同一行业，比一次小额买入某个热点股更值得进入研报。",
  },
  {
    label: "事件关系",
    score: "15%",
    description: "交易前后若出现监管、财政、关税、国防、能源、医保等政策催化，标成事件线索。",
    example: "三大运营商只是这个框架的样例：先看政策事件，再看政客是否有同步持仓变化。",
  },
  {
    label: "降权项",
    score: "-",
    description: "披露滞后过长、金额过小、ETF/基金过宽、RSU/期权归属、配偶自动交易都要降权。",
    example: "不是每条 CapitolTrades 都有信息含量；AI 层的价值主要是帮用户过滤这些低含量交易。",
  },
];

export const cluePipelineSteps: CluePipelineStep[] = [
  {
    step: "01",
    title: "从人开始",
    description: "先锁定高资金、知名共和党、特朗普生态、关键委员会和重点州政客。",
  },
  {
    step: "02",
    title: "再看持仓主题",
    description: "把交易聚成能源、国防、AI/数据中心、金融、医保、债券/现金管理等主题。",
  },
  {
    step: "03",
    title: "找异常变化",
    description: "看金额突然放大、连续买入、从卖转买、同党派多人同向、事件前后交易。",
  },
  {
    step: "04",
    title: "回原站核验",
    description: "核验 owner、transaction type、amount range、filed date、是否 amend，再写进研报。",
  },
];

export const holdingClues: HoldingClue[] = [
  {
    politician: "Chip Roy",
    party: "R",
    chamber: "House",
    state: "TX",
    issuer: "Atlas Energy Solutions",
    ticker: "AESI:US",
    published: "2026-04-30",
    traded: "2026-04-30",
    filedAfter: "0d",
    owner: "Spouse / verify",
    type: "buy",
    size: "5M-25M",
    price: "$16.68",
    theme: "Energy / Texas industrial policy",
    aiScore: 92,
    aiRead: "金额极高，属于优先核验线索。先确认 owner、是否 RSU/配偶交易，再进入能源主题研报。",
    source: politicalTradeSources.texasTrades,
  },
  {
    politician: "Michael McCaul",
    party: "R",
    chamber: "House",
    state: "TX",
    issuer: "Multi-issuer portfolio",
    ticker: "500+ issuers",
    published: "2026-04",
    traded: "2026-03/04",
    filedAfter: "var.",
    owner: "Mixed",
    type: "mixed",
    size: "$500M+ 3Y volume",
    price: "N/A",
    theme: "National security / defense / tech / bonds",
    aiScore: 88,
    aiRead: "资金体量和政策暴露都高。更适合看资产配置迁移和主题聚类，而不是只盯单只股票。",
    source: politicalTradeSources.capitolPoliticians,
  },
  {
    politician: "Kevin Hern",
    party: "R",
    chamber: "House",
    state: "OK",
    issuer: "Devon Energy Corp",
    ticker: "DVN:US",
    published: "2026-06-06",
    traded: "2026-05-08",
    filedAfter: "25d",
    owner: "Joint / Undisclosed",
    type: "exchange",
    size: "15K-50K",
    price: "$45.61",
    theme: "Energy basket rotation",
    aiScore: 76,
    aiRead: "CapitolTrades 最新交易流显示能源标的交换。金额中等，但同一政客多笔能源相关交易值得聚类。",
    source: politicalTradeSources.capitolTrades,
  },
  {
    politician: "Kevin Hern",
    party: "R",
    chamber: "House",
    state: "OK",
    issuer: "Coterra Energy",
    ticker: "CTRA:US",
    published: "2026-06-06",
    traded: "2026-05-08",
    filedAfter: "25d",
    owner: "Joint / Undisclosed",
    type: "exchange",
    size: "15K-50K",
    price: "N/A",
    theme: "Energy basket rotation",
    aiScore: 72,
    aiRead: "与 DVN 同日同方向出现，说明看点在能源组合变化，而不是单笔 CTRA。",
    source: politicalTradeSources.capitolTrades,
  },
  {
    politician: "Virginia Foxx",
    party: "R",
    chamber: "House",
    state: "NC",
    issuer: "Alliance Resource Partners",
    ticker: "ARLP:US",
    published: "2026-06-06",
    traded: "2026-05-15",
    filedAfter: "18d",
    owner: "Undisclosed",
    type: "buy",
    size: "1K-15K",
    price: "$25.13",
    theme: "Coal / energy income",
    aiScore: 59,
    aiRead: "金额小，单独信号弱；若同党派或同州能源买入增多，可提升权重。",
    source: politicalTradeSources.capitolTrades,
  },
  {
    politician: "Tony Wied",
    party: "R",
    chamber: "House",
    state: "WI",
    issuer: "Multi-issuer portfolio",
    ticker: "35 issuers",
    published: "2026-04/05",
    traded: "2026-04",
    filedAfter: "var.",
    owner: "Mixed",
    type: "mixed",
    size: "$8.42M volume",
    price: "N/A",
    theme: "Trump-endorsed business owner",
    aiScore: 74,
    aiRead: "特朗普背书的新晋议员，高频且资金不小。适合跟踪其行业偏好是否形成稳定主题。",
    source: politicalTradeSources.tonyWiedTrump,
  },
  {
    politician: "Buddy Carter",
    party: "R",
    chamber: "House",
    state: "GA",
    issuer: "Concentrated holdings",
    ticker: "3 issuers",
    published: "2026-05",
    traded: "2026-05",
    filedAfter: "var.",
    owner: "Mixed",
    type: "watch",
    size: "$13.48M volume",
    price: "N/A",
    theme: "Healthcare / pharmacy / concentrated assets",
    aiScore: 71,
    aiRead: "交易数量少但金额大。需要拆出具体发行人，判断是否与医保/药房政策相关。",
    source: politicalTradeSources.capitolPoliticians,
  },
  {
    politician: "Tim Moore",
    party: "R",
    chamber: "House",
    state: "NC",
    issuer: "AT&T",
    ticker: "T:US",
    published: "2026-05-20",
    traded: "2026-05-18",
    filedAfter: "1d",
    owner: "Self",
    type: "buy",
    size: "15K-50K",
    price: "$22.75",
    theme: "Telecom case study",
    aiScore: 63,
    aiRead: "保留为事件拆解案例。金额不大，不是主线，但适合示范如何从新闻事件回查交易。",
    source: politicalTradeSources.attIssuer,
  },
];

export const reportMeta = {
  title: "美国政客持仓线索追踪",
  subtitle:
    "从 CapitolTrades 原始披露中挖掘高资金政客、共和党与特朗普生态相关的持仓和交易线索。",
  asOf: "2026-06-06",
  timezone: "Asia/Shanghai",
  dataCutoff: "当前为研报原型：政客/标的样本来自 CapitolTrades 可核验页面和公开新闻源；三大运营商仅作为事件拆解案例。",
};

export const thesisBullets = [
  "核心不是看某个行业，而是先找“谁的钱大、谁有政策暴露、谁在重复买、谁的交易发生在事件前后”。",
  "原站负责完整数据，AI 负责把交易压缩成少数可核验线索；小白默认看 AI 摘要，研究员再点原站深挖。",
  "三大运营商只保留为案例：展示如何把一个新闻事件拆成政客交易、党派方向、金额强弱和后续监控条件。",
];

export const telecomIssuers: TelecomIssuer[] = [
  {
    ticker: "T",
    company: "AT&T",
    price: "$22.75",
    marketCap: "$159.9B",
    trades3y: 86,
    filings3y: 65,
    volume3y: "$2.25M",
    politicians3y: 30,
    republican: { trades: 55, buy: 24, sell: 31 },
    democrat: { trades: 31, buy: 16, sell: 15 },
    latestSignal: "Tim Moore 5/18 买入 $15K-$50K，发生在 D2D JV 公告后。",
    interpretation:
      "T 是三大里共和党交易占比最高的标的，但近三年仍偏卖多于买；更像股息/防守仓位轮动，不是单边押注。",
    source: politicalTradeSources.attIssuer,
  },
  {
    ticker: "VZ",
    company: "Verizon",
    price: "$45.37",
    marketCap: "$191.0B",
    trades3y: 94,
    filings3y: 64,
    volume3y: "$2.04M",
    politicians3y: 28,
    republican: { trades: 23, buy: 10, sell: 13 },
    democrat: { trades: 69, buy: 21, sell: 48 },
    latestSignal: "4 月有 Lloyd Smucker 小额卖出、Jennifer McClellan 大额卖出。",
    interpretation:
      "VZ 的近期披露不是共和党净买入，而是高息防守股的分散减仓；JV 对它是战略选择权，不是短期业绩确认。",
    source: politicalTradeSources.verizonIssuer,
  },
  {
    ticker: "TMUS",
    company: "T-Mobile US",
    price: "$178.10",
    marketCap: "$196.3B",
    trades3y: 55,
    filings3y: 39,
    volume3y: "$770K",
    politicians3y: 12,
    republican: { trades: 11, buy: 6, sell: 5 },
    democrat: { trades: 44, buy: 27, sell: 17 },
    latestSignal: "4 月交易主要来自民主党，最近共和党披露是 Dan Newhouse 2025-12 买入。",
    interpretation:
      "TMUS 与 Starlink 既合作又被 JV 稀释排他性，交易信号偏弱；更适合作为政策事件观察对象。",
    source: politicalTradeSources.tmobileIssuer,
  },
];

export const telecomTradeEvents: TradeEvent[] = [
  {
    ticker: "T",
    company: "AT&T",
    politician: "Tim Moore",
    party: "R",
    chamber: "House",
    state: "NC",
    side: "buy",
    traded: "2026-05-18",
    published: "2026-05-20",
    filedAfter: "1d",
    amount: "$15K-$50K",
    signal: "medium",
    read: "公告后买入，方向与 D2D JV 一致；金额不大，但披露很快，适合继续跟踪是否加仓。",
    source: politicalTradeSources.attIssuer,
  },
  {
    ticker: "T",
    company: "AT&T",
    politician: "Mark Alford",
    party: "R",
    chamber: "House",
    state: "MO",
    side: "sell",
    traded: "2026-03-16",
    published: "2026-04-01",
    filedAfter: "15d",
    amount: "$1K-$15K",
    signal: "low",
    read: "4 月发布但 3 月成交，小额卖出；不能支持“4 月共和党买入 AT&T”的结论。",
    source: politicalTradeSources.attIssuer,
  },
  {
    ticker: "T",
    company: "AT&T",
    politician: "Ro Khanna",
    party: "D",
    chamber: "House",
    state: "CA",
    side: "buy",
    traded: "2026-04-24",
    published: "2026-05-13",
    filedAfter: "17d",
    amount: "$1K-$15K",
    signal: "low",
    read: "4 月真实买入但非共和党；可作为跨党派防守股兴趣的背景。",
    source: politicalTradeSources.attIssuer,
  },
  {
    ticker: "VZ",
    company: "Verizon",
    politician: "Lloyd Smucker",
    party: "R",
    chamber: "House",
    state: "PA",
    side: "sell",
    traded: "2026-04-23",
    published: "2026-05-01",
    filedAfter: "7d",
    amount: "$1K-$15K",
    signal: "low",
    read: "共和党 4 月 VZ 交易是卖出，不是买入；对“运营商合力抗 Starlink”主题为反向证据。",
    source: politicalTradeSources.verizonIssuer,
  },
  {
    ticker: "VZ",
    company: "Verizon",
    politician: "Jennifer McClellan",
    party: "D",
    chamber: "House",
    state: "VA",
    side: "sell",
    traded: "2026-04-07",
    published: "2026-04-17",
    filedAfter: "9d",
    amount: "$100K-$250K",
    signal: "medium",
    read: "金额较大但方向为卖出，显示 4 月 VZ 并非一致性拥挤买入。",
    source: politicalTradeSources.verizonIssuer,
  },
  {
    ticker: "TMUS",
    company: "T-Mobile US",
    politician: "Bill Keating",
    party: "D",
    chamber: "House",
    state: "MA",
    side: "buy",
    traded: "2026-04-17",
    published: "2026-05-19",
    filedAfter: "31d",
    amount: "$1K-$15K",
    signal: "low",
    read: "4 月买入但非共和党，且金额小；适合作为 JV 前个股线索，不宜拔高。",
    source: politicalTradeSources.tmobileIssuer,
  },
  {
    ticker: "TMUS",
    company: "T-Mobile US",
    politician: "Ro Khanna",
    party: "D",
    chamber: "House",
    state: "CA",
    side: "sell",
    traded: "2026-04-24",
    published: "2026-05-13",
    filedAfter: "17d",
    amount: "$15K-$50K",
    signal: "low",
    read: "与同日 AT&T 买入形成轮动，而不是三大运营商全买。",
    source: politicalTradeSources.tmobileIssuer,
  },
];

export const politicianRadar: PoliticianRadar[] = [
  {
    name: "Michael McCaul",
    party: "R",
    state: "TX",
    chamber: "House",
    volume: "$500M+",
    trades: "4,500+",
    issuers: "500+",
    lastTraded: "2026-04-30 / 2026-03-31 口径差异",
    ecosystem: "国家安全、国防、科技、金融",
    focus: ["高资金", "高频", "共和党", "外委会/中国线"],
    read: "最值得长期挂雷达的人之一。资金体量压倒性大，单笔常见债券/基金/大盘科技，适合观察“政策-产业-资产配置”大方向，而不是单一股票。",
    source: politicalTradeSources.capitolPoliticians,
  },
  {
    name: "Chip Roy",
    party: "R",
    state: "TX",
    chamber: "House",
    volume: "$15.82M",
    trades: "10",
    issuers: "7",
    lastTraded: "2026-04-30",
    ecosystem: "能源、德州、监管放松",
    focus: ["高单笔", "AESI", "能源链"],
    read: "CapitolTrades Texas 页显示 AESI 5M-25M 买入线索。若确认为 RSU/配偶或非主动交易，需要降权；但能源链金额足够大，必须进观察池。",
    source: politicalTradeSources.texasTrades,
  },
  {
    name: "Tony Wied",
    party: "R",
    state: "WI",
    chamber: "House",
    volume: "$8.42M",
    trades: "66",
    issuers: "35",
    lastTraded: "2026-04-30",
    ecosystem: "特朗普背书、能源/便利店经营背景",
    focus: ["Trump-endorsed", "新晋", "高频"],
    read: "特朗普背书的新晋议员，交易频率和资产量都不低。更适合作为“特朗普基层商业派”样本，而非国会核心政策人物。",
    source: politicalTradeSources.tonyWiedTrump,
  },
  {
    name: "Kevin Hern",
    party: "R",
    state: "OK",
    chamber: "House",
    volume: "$11.54M / 1Y",
    trades: "39 / 1Y",
    issuers: "30 / 1Y",
    lastTraded: "2026-04-29",
    ecosystem: "税改、企业、能源州",
    focus: ["高资金", "共和党领导层", "税制敏感"],
    read: "一年期交易额靠前，适合配合税改、企业利润、能源监管主题做趋势观察。",
    source: politicalTradeSources.capitolPoliticians,
  },
  {
    name: "Buddy Carter",
    party: "R",
    state: "GA",
    chamber: "House",
    volume: "$13.48M",
    trades: "10",
    issuers: "3",
    lastTraded: "2026-05-07",
    ecosystem: "医保、药房、共和党南方票仓",
    focus: ["大额集中", "低频", "行业集中"],
    read: "交易数量少但金额大，优先看是否集中在单一行业或政策敏感资产。",
    source: politicalTradeSources.capitolPoliticians,
  },
  {
    name: "Maria Elvira Salazar",
    party: "R",
    state: "FL",
    chamber: "House",
    volume: "$6.45M",
    trades: "57",
    issuers: "34",
    lastTraded: "2026-05-01",
    ecosystem: "佛州共和党、移民/拉美政策",
    focus: ["名气", "佛州", "多标的"],
    read: "交易覆盖较广，金额不如 McCaul/Chip Roy，但适合观察佛州共和党与金融、消费、拉美暴露标的。",
    source: politicalTradeSources.capitolPoliticians,
  },
];

export const policyCatalysts: PolicyCatalyst[] = [
  {
    date: "2026-05-14",
    title: "AT&T、T-Mobile、Verizon 达成 D2D 卫星直连手机 JV 意向",
    impact: "三大运营商把频谱和技术标准合作化，意图让多个卫星运营商通过统一平台服务用户。",
    tickers: ["T", "TMUS", "VZ", "ASTS", "SATS", "TSLA"],
    read: "这不是简单利好运营商股价，而是利好“运营商控制入口”的产业结构；对 Starlink 是降低排他性、抬高合规/互联门槛。",
    source: politicalTradeSources.attAnnouncement,
  },
  {
    date: "2026-04-21",
    title: "FCC 批准 AST SpaceMobile 248 颗卫星商业授权",
    impact: "ASTS 获得美国 SCS/D2D 商业化监管框架，使用低频频段与 AT&T、Verizon、FirstNet 协作。",
    tickers: ["ASTS", "T", "VZ"],
    read: "这是 D2D 主题的硬监管催化，发生在运营商 JV 前约三周；若政客随后买入运营商或 ASTS，信号权重上调。",
    source: politicalTradeSources.astsFcc,
  },
  {
    date: "2026-05",
    title: "T-Mobile 与 Starlink 合作进入“非独家化”讨论期",
    impact: "市场关注 T-Mobile 原 Starlink 路线是否被三大 JV 稀释。",
    tickers: ["TMUS", "TSLA", "ASTS"],
    read: "The Information 指出 T-Mobile 的 Starlink Mobile 美国排他协议今年到期，JV 可能改变运营商与 Starlink/ASTS/Globalstar 的关系。",
    source: politicalTradeSources.theInformation,
  },
];

export const watchIdeas: WatchIdea[] = [
  {
    ticker: "T",
    name: "AT&T",
    price: "$22.75",
    change: "-0.04%",
    role: "运营商入口 / 高股息防守",
    why: "共和党交易占比高，Tim Moore 公告后买入；JV 中强调统一平台和客户选择。",
    risk: "重资本、债务、低增长；政客交易金额普遍小。",
  },
  {
    ticker: "VZ",
    name: "Verizon",
    price: "$45.37",
    change: "+1.15%",
    role: "运营商入口 / ASTS 合作方",
    why: "与 AT&T 共同处于 ASTS 低频合作链；JV 增强多卫星供应商议价。",
    risk: "4 月披露偏卖出；股价催化更取决于现金流和竞争格局。",
  },
  {
    ticker: "TMUS",
    name: "T-Mobile US",
    price: "$178.10",
    change: "+0.62%",
    role: "Starlink 合作方 / JV 参与方",
    why: "既是 Starlink 现有渠道，也是三大 JV 的一员；最能体现从独家合作到行业平台的张力。",
    risk: "估值高于 T/VZ；卫星服务短期收入贡献不确定。",
  },
  {
    ticker: "ASTS",
    name: "AST SpaceMobile",
    price: "$93.60",
    change: "-12.82%",
    role: "D2D 纯弹性标的",
    why: "FCC 248 星授权和三大运营商 JV 均指向运营商伙伴模式。",
    risk: "执行、融资、发射、估值波动都很大。",
  },
  {
    ticker: "SATS",
    name: "EchoStar",
    price: "$116.28",
    change: "-6.72%",
    role: "频谱资产 / SpaceX 交易线",
    why: "围绕频谱出售与 Starlink D2D 扩容，属于政策审批和资产重估标的。",
    risk: "事件性强，交易监管与融资条件变化大。",
  },
  {
    ticker: "AESI",
    name: "Atlas Energy Solutions",
    price: "$16.68",
    change: "-8.52%",
    role: "能源链 / 德州共和党大额线索",
    why: "Chip Roy 相关大额 AESI 线索足够进入高优先级核验池。",
    risk: "可能是 RSU/配偶/非主动交易，需回到原始披露确认。",
  },
];

export const actionChecklist = [
  "把 T/VZ/TMUS 的后续披露做 30 日滚动监控：只在共和党买入金额超过 $50K 或连续两次买入时上调权重。",
  "对 Chip Roy / AESI 回原始 PTR 核验 owner、transaction type、是否 RSU；确认前只放入“高金额待验证”。",
  "把 McCaul 的 2026-04 市政债、基金、科技/工业交易拆成资产类别，观察是否从权益切到债券/现金管理。",
  "D2D 事件链继续跟 FCC docket、ASTS 发射/融资、SATS/SpaceX 频谱审批，以及三大 JV 是否签 definitive agreement。",
];

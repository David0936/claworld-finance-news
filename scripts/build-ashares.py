#!/usr/bin/env python3
"""
生成 A 股白名单 data/ashares.json（代码 → 中文简称），供 realtime-worker 的喊单检测用。

做法：枚举全部沪深 A 股候选代码（按真实前缀），逐批查腾讯行情 qt.gtimg.cn
（GBK，名称在 ~ 分隔的第 1 个字段）。腾讯对真实在市代码返回中文简称，不存在的代码返回空，
据此得到完整、当前、带中文名的清单（独立于任何可能过时的第三方列表）。

注意：这是"种子/兜底"。线上 worker 还会用东方财富 push2 clist 接口刷新
（东方财富对部分 IP 限流，本沙箱拿不到，但 Railway 等服务器可以）。

用法：python3 scripts/build-ashares.py
"""
import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "ashares.json"

# 枚举候选：沪 600/601/603/605/688/689，深 000/001/002/003/300/301，各 000-999
PREFIXES = ["600", "601", "603", "605", "688", "689",
            "000", "001", "002", "003", "300", "301"]
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}


def fetch(url, decode="utf-8"):
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=20).read().decode(decode, "ignore")


def candidate_codes():
    """枚举全部 A 股候选六位代码。"""
    out = set()
    for p in PREFIXES:
        for n in range(1000):
            out.add(f"{p}{n:03d}")
    return out


def market(code):
    return "sh" if code[0] == "6" else "sz"  # 6→沪；0/3→深


def tencent_names(codes):
    """批量查腾讯行情拿中文简称：code -> 名称。"""
    names = {}
    codes = sorted(codes)
    BATCH = 50
    for i in range(0, len(codes), BATCH):
        batch = codes[i : i + BATCH]
        q = ",".join(f"{market(c)}{c}" for c in batch)
        try:
            raw = fetch(f"https://qt.gtimg.cn/q={q}", decode="gbk")
        except Exception as e:
            print(f"  批次 {i//BATCH} 失败：{e}")
            time.sleep(0.5)
            continue
        for line in raw.splitlines():
            # v_sh600519="1~贵州茅台~600519~...";
            m = re.search(r'v_(?:sh|sz)(\d{6})="([^"]*)"', line)
            if not m:
                continue
            code, payload = m.group(1), m.group(2)
            parts = payload.split("~")
            name = parts[1].strip() if len(parts) > 1 else ""
            if name and name not in ("None", "-"):
                names[code] = name
        if (i // BATCH) % 10 == 0:
            print(f"  已处理 {min(i+BATCH, len(codes))}/{len(codes)}…")
        time.sleep(0.12)
    return names


def main():
    cands = candidate_codes()
    print(f"枚举候选代码 {len(cands)} 个，逐批查腾讯行情拿真实在市清单+中文名…")
    names = tencent_names(cands)
    print(f"  真实在市 A 股 {len(names)} 个")

    stocks = {c: names[c] for c in sorted(names)}

    payload = {
        "updatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "source": "tencent:qt.gtimg.cn enumerate (seed; worker refreshes from eastmoney)",
        "count": len(stocks),
        "named": len(stocks),
        "stocks": stocks,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"已写入 {OUT}（{len(stocks)} 条，其中 {len(names)} 条带中文名）")


if __name__ == "__main__":
    main()

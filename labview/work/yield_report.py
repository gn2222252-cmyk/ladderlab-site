import argparse, json, os, sys
from pathlib import Path

VERSION = "1.1.1"

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    ap.add_argument("--db")
    ap.add_argument("--station")                  # ST01
    ap.add_argument("--start")                    # "2026-11-14 08:00:00"
    ap.add_argument("--end")                      # "2026-11-14 20:00:00"
    ap.add_argument("--pbar", type=float, default=0.02)   # 品保定的基準 FAIL 率
    ap.add_argument("--out")
    a = ap.parse_args()
    if not a.selftest:                            # 少了哪個參數，說清楚
        miss = [k for k in ("db", "station", "start", "end", "out")
                if getattr(a, k) is None]
        if miss:
            ap.error("missing: " + ", ".join(miss))   # 結束碼 2
    import sqlite3                                # import 放在 try 裡面：
    import pandas as pd                           # 沒裝套件也回一行 JSON
    import matplotlib
    matplotlib.use("Agg")                         # 不開視窗，只存檔
    import matplotlib.pyplot as plt
    if a.selftest:
        print(json.dumps({"ok": True, "ver": VERSION, "selftest": True}))
        return 0
    uri = Path(a.db).resolve().as_uri() + "?mode=ro"   # 唯讀：路徑錯了不會建空檔
    con = sqlite3.connect(uri, uri=True)
    df = pd.read_sql_query(
        "SELECT ts, result FROM tests WHERE station = ? "
        "AND ts >= ? AND ts < ? ORDER BY ts",
        con, params=(a.station, a.start, a.end))
    df = df[df.result.isin(["PASS", "FAIL"])].reset_index(drop=True).copy()  # ERROR 不算（W6）
    if len(df) < 50:
        print(json.dumps({"ok": False, "err": "too few tests",
                          "n": len(df), "ver": VERSION}))
        return 3
    df["grp"] = df.index // 50                    # 每 50 片一個子群（W14）
    g = df.groupby("grp").result.agg(
        n="size", fail=lambda r: int((r == "FAIL").sum()))
    g = g[g.n >= 25]                              # 最後不滿的一組太小就不判
    p0 = a.pbar
    g["p"] = g.fail / g.n
    g["ucl"] = p0 + 3 * (p0 * (1 - p0) / g.n) ** 0.5
    fig, ax = plt.subplots(figsize=(6, 3))
    ax.plot(g.index, g.p, "o-", label="p")
    ax.plot(g.index, g.ucl, "r--", label="UCL")
    ax.axhline(p0, color="gray", label="p0")
    ax.legend()
    tag = a.start[:16].replace("-", "").replace(":", "").replace(" ", "_")  # 20261114_0800：兩班不互蓋
    png = os.path.join(a.out, f"p_{a.station}_{tag}.png")
    fig.savefig(png)
    n, fail = int(len(df)), int((df.result == "FAIL").sum())
    print(json.dumps({"ok": True, "ver": VERSION, "n": n, "fail": fail,
                      "p": round(fail / n, 4),
                      "alarm": bool((g.p > g.ucl).any()), "png": png}))
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise                                     # argparse 的錯誤：結束碼 2
    except Exception as e:
        print(json.dumps({"ok": False, "err": type(e).__name__,
                          "ver": VERSION}))
        import traceback
        traceback.print_exc()                     # 印到 stderr
        sys.exit(2)

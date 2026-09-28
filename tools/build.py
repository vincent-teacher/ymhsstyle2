# -*- coding: utf-8 -*-
"""
楊梅高中梅岡風 網站建置工具
用法：python tools/build.py        （由 更新網站.bat 呼叫）
流程：
  1. 掃描 ../梅岡風 資料夾中「梅岡風[期別]期第[版次]版.JPG」（也接受無副檔名 / .jpg / .png / .webp）
  2. 產生網頁用大圖 img/web 與縮圖 img/thumb（WebP，增量處理，只處理新增或變更的檔案）
  3. 呼叫 Windows 內建 OCR（tools/ocr.ps1）辨識文字，供全文檢索
  4. 輸出 data/issues.js，並更新 index.html 的快取版本號
"""
import json, os, re, subprocess, sys, time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parent.parent          # 楊梅高中梅岡風/
SRC = ROOT.parent / "梅岡風"                            # 原始掃描圖
WEB, THUMB, OCRSRC = ROOT / "img/web", ROOT / "img/thumb", ROOT / "tools/_ocrsrc"
DATA = ROOT / "data"
OCRDIR = DATA / "ocr"
PAT = re.compile(r"梅岡風\s*0*(\d+)\s*期\s*第\s*0*(\d+)\s*版", re.I)
EXTS = {"", ".jpg", ".jpeg", ".png", ".webp"}
WEB_W, THUMB_W, OCR_W = 2000, 420, 3400

for d in (WEB, THUMB, OCRSRC, OCRDIR):
    d.mkdir(parents=True, exist_ok=True)


def scan():
    pages = []
    for f in sorted(SRC.iterdir()):
        if not f.is_file() or f.suffix.lower() not in EXTS:
            continue
        m = PAT.search(f.stem if f.suffix else f.name)
        if not m:
            print("  略過（檔名格式不符）：", f.name)
            continue
        no, p = int(m.group(1)), int(m.group(2))
        st = f.stat()
        pages.append(dict(no=no, p=p, src=f, key=f"{no:02d}-{p}", sig=f"{st.st_size}-{int(st.st_mtime)}"))
    return pages


def convert(job):
    src, key = job
    im = Image.open(src)
    im = im.convert("RGB")
    w, h = im.size
    out = {}
    for d, tw, q in ((WEB, WEB_W, 78), (THUMB, THUMB_W, 72)):
        r = im.resize((tw, round(h * tw / w)), Image.LANCZOS)
        r.save(d / f"{key}.webp", "WEBP", quality=q, method=5)
    o = im.convert("L").resize((OCR_W, round(h * OCR_W / w)), Image.LANCZOS)
    o.save(OCRSRC / f"{key}.png", "PNG")
    return key, w, h


def main():
    t0 = time.time()
    cache_f = DATA / "cache.json"
    cache = json.loads(cache_f.read_text("utf-8")) if cache_f.exists() else {}
    pages = scan()
    print(f"找到 {len(pages)} 個版面，共 {len({x['no'] for x in pages})} 期")

    todo = [x for x in pages if cache.get(x["key"], {}).get("sig") != x["sig"]
            or not (WEB / f"{x['key']}.webp").exists()]
    if todo:
        print(f"轉換圖片 {len(todo)} 張 …")
        with ProcessPoolExecutor(max(1, (os.cpu_count() or 2) - 1)) as ex:
            for i, (key, w, h) in enumerate(ex.map(convert, [(x["src"], x["key"]) for x in todo]), 1):
                x = next(y for y in todo if y["key"] == key)
                cache[key] = dict(sig=x["sig"], w=w, h=h, ocr=False)
                print(f"  [{i}/{len(todo)}] {key}")
                cache_f.write_text(json.dumps(cache, ensure_ascii=False), "utf-8")

    # OCR
    need = [x["key"] for x in pages if not (OCRDIR / f"{x['key']}.json").exists() or not cache[x["key"]].get("ocr")]
    need = [k for k in need if (OCRSRC / f"{k}.png").exists()]
    if need:
        print(f"文字辨識 {len(need)} 張（Windows OCR）…")
        ps = ROOT / "tools/ocr.ps1"
        for i in range(0, len(need), 20):
            chunk = need[i:i + 20]
            subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps),
                            "-InDir", str(OCRSRC), "-OutDir", str(OCRDIR), "-Keys", ",".join(chunk)], check=False)
            for k in chunk:
                if (OCRDIR / f"{k}.json").exists():
                    cache[k]["ocr"] = True
            print(f"  已完成 {min(i + 20, len(need))}/{len(need)}")
            cache_f.write_text(json.dumps(cache, ensure_ascii=False), "utf-8")

    write_data(pages, cache)
    print(f"完成！耗時 {time.time() - t0:.0f} 秒")


CN = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}


def cnum(s):
    if s.isdigit():
        return int(s)
    if s == "十":
        return 10
    if s.startswith("十"):
        return 10 + CN.get(s[1:], 0)
    if s.endswith("十"):
        return CN.get(s[0], 0) * 10
    if "十" in s:
        a, b = s.split("十")
        return CN.get(a, 0) * 10 + CN.get(b, 0)
    return CN.get(s, 0)


def parse_page(key, meta):
    f = OCRDIR / f"{key}.json"
    if not f.exists():
        return dict(sec="", heads=[], L=[], text="")
    raw = json.loads(f.read_text("utf-8-sig"))
    W, H = meta["ow"], meta["oh"]
    lines = []
    for ln in raw.get("lines", []):
        t = ln["t"].replace(" ", "")
        if not t:
            continue
        x0, y0, x1, y1 = ln["b"]
        lines.append([t, round(x0 * 1000 / W), round(y0 * 1000 / H), round(x1 * 1000 / W), round(y1 * 1000 / H)])
    hs = sorted(l[4] - l[2] for l in lines) or [1]
    med = hs[len(hs) // 2] or 1
    def good_head(l):
        t = l[0]
        if l[2] < 50 or len(t) < 4 or (l[4] - l[2]) < 1.8 * med:
            return False
        if re.search(r"(19|20)\d\d年|月號|中華民國|第.版|學校要聞|梅岡風", t):
            return False
        cjk = len(re.findall(r"[一-鿿]", t))
        return cjk >= 4 and cjk / len(t) >= 0.6
    heads = list(dict.fromkeys(l[0] for l in lines if good_head(l)))[:8]
    # 版頭（頁面最上方一列）：例「2007年五月號　學校要聞　第一版」→ 對照已知版名
    top = "".join(l[0] for l in sorted((l for l in lines if l[2] < 50), key=lambda l: l[1]))
    sec = ""
    for key, name in SECTIONS:
        if key in top:
            sec = name
            break
    return dict(sec=sec, heads=heads, L=lines, text="".join(l[0] for l in lines), top=top)


# 已知版名（關鍵字 → 顯示名稱），辨識不到時留白
SECTIONS = [("學校要聞", "學校要聞"), ("校慶活動特刊", "校慶活動特刊"), ("校慶特", "校慶特輯"), ("藝智", "藝智園"),
            ("生活與休", "生活與休閒"), ("生活", "生活與休閒"), ("擲地", "擲地有聲"), ("多元學", "多元學習"), ("多元", "多元學習"),
            ("在地文化", "在地文化"), ("繽紛文藝", "繽紛文藝"), ("新生體驗", "新生體驗營"), ("不抱怨", "不抱怨運動")]


def find_date(texts):
    for t in texts:
        t = t.replace(" ", "")
        m = re.search(r"(20\d\d|19\d\d)\s*年\s*([一二三四五六七八九十0-9]{1,3})\s*月", t)
        if m and 1 <= cnum(m.group(2)) <= 12:
            return f"{m.group(1)}-{cnum(m.group(2)):02d}"
        m = re.search(r"(\d{2,3})\s*年\s*([一二三四五六七八九十0-9]{1,3})\s*月", t)
        if m and 80 <= int(m.group(1)) <= 130 and 1 <= cnum(m.group(2)) <= 12:
            return f"{int(m.group(1)) + 1911}-{cnum(m.group(2)):02d}"
    return ""


def write_data(pages, cache):
    meta_f = DATA / "meta.json"
    if not meta_f.exists():
        meta_f.write_text(json.dumps({"說明": "可在此手動覆寫各期資料，例如 \"44\": {\"date\": \"2024-06\", \"title\": \"畢業特刊\", \"note\": \"\"}",
                                      "issues": {}}, ensure_ascii=False, indent=2), "utf-8")
    meta = json.loads(meta_f.read_text("utf-8")).get("issues", {})
    issues = {}
    for x in sorted(pages, key=lambda y: (y["no"], y["p"])):
        c = cache[x["key"]]
        info = parse_page(x["key"], dict(ow=OCR_W, oh=round(c["h"] * OCR_W / c["w"])))
        iss = issues.setdefault(x["no"], dict(no=x["no"], pages=[]))
        iss["pages"].append(dict(p=x["p"], key=x["key"], orig="../梅岡風/" + x["src"].name,
                                 w=WEB_W, h=round(c["h"] * WEB_W / c["w"]),
                                 sec=info["sec"], heads=info["heads"], L=info["L"]))
        iss.setdefault("_t", []).append(info.get("top", ""))
    out = []
    for no, iss in sorted(issues.items()):
        m = meta.get(str(no), {}) or meta.get(f"{no:02d}", {})
        iss["date"] = m.get("date") or find_date(iss.pop("_t"))
        iss.pop("_t", None)
        iss["title"] = m.get("title", "")
        iss["note"] = m.get("note", "")
        out.append(iss)
    # 版名辨識不到時，參考前後三期同一版次最常見的版名
    from collections import Counter
    for i, iss in enumerate(out):
        for pg in iss["pages"]:
            if not pg["sec"]:
                c = Counter(q["sec"] for j in range(max(0, i - 3), min(len(out), i + 4)) if j != i
                            for q in out[j]["pages"] if q["p"] == pg["p"] and q["sec"])
                if c:
                    pg["sec"] = c.most_common(1)[0][0]
    # 無法辨識日期者標記 est
    for i, iss in enumerate(out):
        if not iss["date"]:
            iss["est"] = True
    ver = str(int(time.time()))
    js = "/* 自動產生，請勿手動修改。執行 更新網站.bat 重新產生 */\nwindow.MGF_DATA = " + \
         json.dumps(dict(built=time.strftime("%Y-%m-%d %H:%M"), issues=out), ensure_ascii=False, separators=(",", ":")) + ";\n"
    (DATA / "issues.js").write_text(js, "utf-8")
    idx = ROOT / "index.html"
    if idx.exists():
        s = idx.read_text("utf-8")
        s = re.sub(r"data/issues\.js\?v=\d*", f"data/issues.js?v={ver}", s)
        idx.write_text(s, "utf-8")
    print(f"已輸出 data/issues.js（{len(out)} 期，{sum(len(i['pages']) for i in out)} 版）")


if __name__ == "__main__":
    main()

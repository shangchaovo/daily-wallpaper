#!/usr/bin/env python3
"""Build word-library JSON files for the daily-wallpaper site.

Source of truth: ECDICT (https://github.com/skywind3000/ECDICT), a free
English-Chinese dictionary (770k entries) with phonetic, Chinese translation,
Collins star rating, BNC/COCA frequency, and an exam `tag` column
(zk/gk/cet4/cet6/ky/toefl/ielts/gre).

We filter ECDICT by each exam's tag, rank by "how core is this word"
(Collins star, then frequency), and take the top ~N per exam so the library is
genuinely useful high-frequency vocabulary — not a token 100-word sample, and
not a firehose of obscure words.

IELTS additionally merges the rich local list from ~/.openclaw/workspace/dailystudy
(examples/collocations/topic) on top of the ECDICT ielts-tagged core.

Expected ECDICT location: /tmp/ecdict.csv  (override with --ecdict PATH)
Download: https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv

Output schema (one JSON array per library in data/):
  [{ "word", "phonetic", "pos", "meaning", "example"?, "topic"? }, ...]
Optional fields are omitted when empty so the renderer skips them.
"""
import argparse
import csv
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
DAILYSTUDY = os.path.expanduser("~/.openclaw/workspace/dailystudy")

# How many core words to keep per exam library.
CAPS = {
    "chuzhong": 1500,   # 初中 (zk)
    "gaozhong": 2000,   # 高中 (gk)
    "cet4": 2500,
    "cet6": 2500,
    "kaoyan": 2800,     # 考研 (ky)
    "ielts": 3000,
    "toefl": 3000,
    "gre": 2500,
}
# ECDICT tag -> our library id
TAG_TO_ID = {
    "zk": "chuzhong",
    "gk": "gaozhong",
    "cet4": "cet4",
    "cet6": "cet6",
    "ky": "kaoyan",
    "ielts": "ielts",
    "toefl": "toefl",
    "gre": "gre",
}
LIB_META = {
    "chuzhong": {"name": "初中", "desc": "中考核心词汇", "emoji": "🎒"},
    "gaozhong": {"name": "高中", "desc": "高考核心词汇", "emoji": "✏️"},
    "cet4": {"name": "四级 CET4", "desc": "大学英语四级", "emoji": "📗"},
    "cet6": {"name": "六级 CET6", "desc": "大学英语六级", "emoji": "📘"},
    "kaoyan": {"name": "考研", "desc": "考研英语核心", "emoji": "📕"},
    "ielts": {"name": "雅思 IELTS", "desc": "出国考试核心词", "emoji": "🎓"},
    "toefl": {"name": "托福 TOEFL", "desc": "托福核心词汇", "emoji": "🌍"},
    "gre": {"name": "GRE", "desc": "出国读研核心", "emoji": "🗽"},
}

_POS_MAP = {
    "n": "n.", "v": "v.", "vt": "v.", "vi": "v.", "adj": "adj.", "a": "adj.",
    "adv": "adv.", "ad": "adv.", "prep": "prep.", "conj": "conj.", "pron": "pron.",
    "num": "num.", "art": "art.", "int": "int.", "aux": "aux.",
}


def clean_phonetic(ph):
    """Normalize ECDICT phonetic into a clean /.../ form, drop if junky."""
    if not ph:
        return ""
    ph = ph.strip().strip(",").strip()
    if not ph:
        return ""
    # already bracketed?
    if ph.startswith("/") or ph.startswith("["):
        inner = ph.strip("/[]")
    else:
        inner = ph
    if not inner or len(inner) > 40:
        return ""
    return f"/{inner}/"


def parse_translation(trans):
    """ECDICT 'translation' is Chinese, possibly multi-line 'pos. meaning'.

    Returns (pos, meaning) using the FIRST line's pos if present. Strips domain
    tags like [计]/[经], collapses literal '\\n', keeps it short for wallpaper.
    """
    if not trans:
        return "", ""
    # ECDICT uses a literal backslash-n in the CSV, not real newlines.
    trans = trans.replace("\\n", "\n")
    lines = [l.strip() for l in trans.splitlines() if l.strip()]
    if not lines:
        return "", ""
    pos = ""
    meanings = []
    for ln in lines:
        m = re.match(r"^([a-z]+)\.\s*(.*)$", ln)
        if m:
            p = _POS_MAP.get(m.group(1).lower(), m.group(1) + ".")
            if not pos:
                pos = p
            txt = m.group(2).strip()
        else:
            txt = ln
        # drop domain markers like [计] [经] [医]
        txt = re.sub(r"\[[^\]]*\]", "", txt)
        txt = txt.strip()
        if txt:
            meanings.append(txt)
    # take up to 2 sense-groups, split into senses, dedupe, keep it short
    sense_text = "；".join(meanings[:2])
    sense_text = re.sub(r"\s+", " ", sense_text)
    parts = [p.strip() for p in re.split(r"[,，;；/]", sense_text) if p.strip()]
    seen = set()
    uniq = []
    for p in parts:
        if p not in seen:
            seen.add(p)
            uniq.append(p)
    meaning = "，".join(uniq[:3])
    if len(meaning) > 30:
        meaning = meaning[:30].rstrip("，,；; ") + "…"
    return pos, meaning


# Tiny stopword set — these dominate frequency but make lousy "daily word" cards.
_STOP = {
    "the", "be", "to", "of", "and", "a", "an", "in", "that", "it", "is", "was",
    "i", "you", "he", "she", "we", "they", "for", "on", "with", "as", "at", "by",
    "this", "are", "from", "or", "not", "but", "what", "all", "were", "when",
    "your", "can", "said", "there", "use", "each", "which", "do", "how", "their",
    "if", "will", "up", "other", "about", "out", "many", "then", "them", "these",
    "so", "some", "her", "would", "make", "like", "him", "into", "time", "has",
    "look", "two", "more", "go", "see", "no", "way", "could", "my", "than",
}


def score(row):
    """Higher = more core. Collins star dominates, then frequency rank.

    Stopwords and very short words are pushed down so content words lead.
    """
    word = (row.get("word") or "").lower()
    try:
        collins = int(row.get("collins") or 0)
    except ValueError:
        collins = 0
    try:
        frq = int(row.get("frq") or 0)
    except ValueError:
        frq = 0
    try:
        bnc = int(row.get("bnc") or 0)
    except ValueError:
        bnc = 0
    rank = frq or bnc or 99999
    freq = 1.0 / (1.0 + rank / 2000.0)
    s = collins * 2.0 + freq
    if word in _STOP:
        s -= 3.0
    if len(word) < 3:
        s -= 2.0
    return s


def load_ecdict(path):
    """Return {tag: [entry,...]} filtered + ranked per exam tag."""
    by_tag = {t: [] for t in TAG_TO_ID}
    seen_word = set()
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            word = (row.get("word") or "").strip()
            if not word or " " in word or len(word) > 20 or len(word) < 2:
                continue
            if not re.match(r"^[A-Za-z][A-Za-z'-]*[A-Za-z]$", word):
                continue
            lw = word.lower()
            if lw in seen_word:
                continue
            tag = (row.get("tag") or "").lower()
            if not tag:
                continue
            pos, meaning = parse_translation(row.get("translation") or "")
            if not meaning:
                continue
            phonetic = clean_phonetic(row.get("phonetic") or "")
            entry = {"word": word, "phonetic": phonetic, "pos": pos, "meaning": meaning}
            s = score(row)
            for t in tag.split():
                if t in by_tag:
                    by_tag[t].append((s, entry))
            seen_word.add(lw)
    # rank + cap
    out = {}
    for t, items in by_tag.items():
        lib = TAG_TO_ID[t]
        items.sort(key=lambda x: -x[0])
        cap = CAPS[lib]
        out[lib] = [e for _, e in items[:cap]]
    return out


def build_ielts_rich(existing):
    """Overlay the rich local IELTS list (examples/topic) onto ECDICT ielts core.

    Rich entries go first (they have example/topic), then ECDICT core fills up
    to the cap with words not already present.
    """
    rich_path = os.path.join(DAILYSTUDY, "ielts_vocabulary.json")
    if not os.path.exists(rich_path):
        return existing
    with open(rich_path, encoding="utf-8") as f:
        rich = json.load(f)
    seen = set()
    out = []
    for w in rich:
        word = (w.get("word") or "").strip()
        if not word:
            continue
        lw = word.lower()
        if lw in seen:
            continue
        seen.add(lw)
        e = {
            "word": word,
            "phonetic": w.get("phonetic") or "",
            "pos": (w.get("pos") or "").strip(),
            "meaning": w.get("meaning") or "",
        }
        if w.get("example"):
            e["example"] = w["example"]
        if w.get("topic"):
            e["topic"] = w["topic"]
        out.append(e)
    for e in existing:
        lw = e["word"].lower()
        if lw in seen:
            continue
        seen.add(lw)
        out.append(e)
    cap = CAPS["ielts"]
    return out[:cap]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ecdict", default="/tmp/ecdict.csv", help="path to ecdict.csv")
    args = ap.parse_args()
    if not os.path.exists(args.ecdict):
        raise SystemExit(
            f"ECDICT not found at {args.ecdict}\n"
            "Download: curl -L -o /tmp/ecdict.csv "
            "https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv"
        )

    os.makedirs(DATA, exist_ok=True)
    libs = load_ecdict(args.ecdict)
    libs["ielts"] = build_ielts_rich(libs.get("ielts", []))

    manifest = []
    for lib, entries in libs.items():
        meta = LIB_META.get(lib, {"name": lib, "desc": "", "emoji": "📚"})
        path = os.path.join(DATA, f"words_{lib}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, separators=(",", ":"))
        manifest.append({
            "id": lib, "name": meta["name"], "desc": meta["desc"],
            "emoji": meta["emoji"], "count": len(entries),
        })
        print(f"wrote {path}  ({len(entries)} words)")

    with open(os.path.join(DATA, "libraries.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print("done")


if __name__ == "__main__":
    main()

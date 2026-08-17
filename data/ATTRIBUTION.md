# 词书来源与说明

## 日语 JLPT N5 / N4

- **分级框架：** 日本语能力试验（JLPT）的 N5、N4 等级体系。JLPT 官方说明考试会考查词汇能力，但不发布唯一、固定的“官方指定词表”。
- **本地词条：** 依据 [Open Anki JLPT Decks](https://github.com/jamsinclair/open-anki-jlpt-decks) 整理，保留原项目的 MIT 许可证说明；本项目中的 N5 为 718 条、N4 为 668 条。
- **界面表述：** 因此产品中称为“JLPT 分级 · 开放词表整理”，而不把开放词表误称作 JLPT 官方指定词表。

词条生成脚本为 `scripts/import_jlpt_open_anki.js`，用于在更新来源数据时可复现地重新生成 JSON 文件。

---

## 法语 / 西班牙语 高频核心词

- **收词顺序：** [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) 的法语、西班牙语 50k 词频表(基于 OpenSubtitles 字幕语料统计,MIT/开源发布),各取头部经清洗后约 1155 / 1400 词。
- **法语释义：** [CFDICT 中法词典](https://chine.in/mandarin/dictionnaire/)(CC BY-SA 3.0,Chine-Informations / David Houstin),由「中文→法语」反查为「法语→中文」,并用现代汉语白名单过滤文言/方言头词;高频功能词与常见不规则动词为人工校对释义(词卡背原形,不收支位变位)。
- **西语释义：** [X2CNDICT](https://github.com/kaysonwu/x2cndict) 的西汉词典(西语→中文,约 1.9 万条),按词频取前两组词性/释义;高频功能词同样人工校对。
- **生成脚本：** `scripts/build_romance_libs.py`,来源数据更新后可复现重建 `data/words_french.json` / `data/words_spanish.json`。

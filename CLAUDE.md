# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

每日壁纸 Daily Wallpaper — 把每日单词 + 当天提醒做成手机/电脑壁纸的**纯前端**工具。打开即「左控制面板 / 右 canvas 实时预览」，两种版式 × 多尺寸 × 六主题，下载 PNG 或进入实时壁纸模式。无后端、无打包、零运行时依赖，数据全在浏览器 `localStorage`（命名空间 `wp:`）。

**V3 现状**（2026-08）：8 个 ECDICT 词库（每库 1500–3000 核心词）+ 我的词库；日期/时钟已从壁纸移除（更干净、更专注）；**整个排版可视化拖拽**——单词块/提醒块/自定义文字都能在预览上按住拖到任意位置；字体风格（黑/宋/楷/圆/粗黑）+ 文字颜色可选；背景可上传**自定义照片**（cover-fit + 留白 scrim 保证可读）。

## Commands

```bash
node server.js                 # 开发服务器 http://localhost:8770（端口被占自动 +1）
python3 scripts/e2e.py         # 端到端验证（33 项断言，自带独立空闲端口，不碰 8770）
python3 scripts/render_v3.py   # v3 渲染验证：真渲染 PNG 到 scripts/out_v3/ 并做像素级断言
python3 scripts/build_wordlibs.py  # 从 ECDICT 重新生成 data/words_*.json（需 /tmp/ecdict.csv）
```

- **没有构建 / lint / 单测框架，也没有 `package.json`** —— 不要去 `npm run`。`js/` 是浏览器经典脚本（IIFE），改完刷新即可。
- `scripts/e2e.py` 自包含：在**临时空闲端口**拉起自己的 `server.js`，跑完即杀。首次需 `pip install playwright && playwright install chromium`。末尾断言无 `pageerror` / `console.error`。
- 常驻（可选）：`cp launchd/com.daily-wallpaper.server.plist ~/Library/LaunchAgents/ && launchctl load -w ...`

## Architecture — 跨文件才看得懂的点

**运行时模型**：无打包器、无 ESM。`index.html` 按固定顺序加载
`store → words → importer → ocr → reminders → render → engine → app`；
每个文件是 IIFE，向外暴露一个具名全局（`Store / Words / Importer / OCR / Reminders / Render / Engine / App`），彼此直接读全局。**改加载顺序或把某文件改成 ESM 会破坏这条链。** SheetJS（Excel 导入）走 CDN `defer`，是**可选**的——没有它 CSV/粘贴导入照常工作。

**核心数据流**：`app.js` 的 `refresh(manual)` 是唯一渲染入口。它向 `Engine.current(settings)`（或手动时 `Engine.reshuffle`）要「当前该显示哪些词」，拿到 `{dateStr, words}` 后交给 `Render.render({width,height,layout,page,theme,words,reminders,settings,dateStr})` 画到一个离屏 canvas，再 `drawImage` 进 `#preview-canvas`（预览）和 `#live-canvas`（实时模式）。**任何设置变更都走 `commit()` → `saveSettings()` + `refresh()`，别绕过它单独重画。**

**每日选词的确定性**（`words.js`）：`pickForDate(list, count, dateStr, order)` 用日期字符串做种子（FNV 哈希 + mulberry32 PRNG），所以**同一天无论哪台设备、刷新多少次，得到的是同一组词**。`sequential` 按 epoch 天偏移顺序切片，`random` 按种子洗牌。想加新选词模式，保持「同日同结果」这条不变量。`engine.js` 的定时轮换把一天按 `rotateMinutes` 切成 bucket，每个 bucket 一个种子，因此**轮换间隔内稳定、跨间隔自动前进**。

**canvas 渲染的版面**（`render.js` v3）：
- **背景**：`settings.bgImage`（解码后的 `Image`，由 app.js 注入，**不存进 settings 对象**——settings 里只存 dataURL 字符串）存在时 cover-fit 铺照片 + 浅 scrim；否则走主题渐变 + 纹理。
- **文字**：`fontStack(settings)` 选系统字体族（hei/song/kai/yuan/heiti），`ink()/subInk()` 解析正文/次要颜色（`settings.inkOverride` 覆盖主题色）。**只用本地系统字体栈，不引网络字体**（否则下载的 PNG 换机器会变样）。
- **单词组 `renderGroup`**：行高 `rowH` 按**内容**定（≈ `wordFs*3.0`），不强制填满整条自由带——所以单词块比自由空间小，**锚点（靠上/居中/靠下）+ 拖拽偏移才能真正移动它**。行高够高时单词+释义堆叠，不够时（横屏/词多）自动单行横排。`blockTopFor(anchor, offY, top, bottom, blockH, H)` 把「锚点基准 + 分数偏移」解析成最终 Y。
- **提醒块**：`remindersHeight()` 预估高度，同样走 `blockTopFor` + `offReminders`，可与单词块各自独立摆。
- **自定义文字 `drawCustomBlocks`**：title/footer 是**自由浮动块**，位置存 `settings.custom.pos[key] = {x, y, scale}`（0..1 分数），居中绘制在该点。
- 新增会被画出来的字段，空值时要跳过（词库 schema 本就省略空字段）。

**可视化拖拽**（`app.js` 的 `bindDrag`/`hitTestBlock`）：`pointerdown` 命中测试决定抓的是哪块（自定义文字优先，其次按 `remindersSplitY()` 分单词/提醒），按下即 `applyDisplaySize(disp, disp, true)` **把预览缩到视口内**（整个壁纸都在视野里，拖哪儿都看得见），`pointermove` 把位移写回 `offWords/offReminders`（分数偏移，x clamp ±0.5、y clamp ±1.0）或 `custom.pos[key]`（绝对分数位置，clamp 0.02..0.98），重画用 **rAF 合帧**（一帧只重画一次，拖拽顺滑）。拖拽期间 `dragHl={kind,key}` 传入渲染，`render.js` 的 `drawHlRect` 画主题色**虚线框**标出正在拖的块；抬起后 `dragHl` 清空、预览恢复大尺寸、`saveSettings()`。偏移都是**分数**（相对 W/H），换尺寸不漂移。`render.js` 的 `blockTopFor` 只把块钳在「至少露出一部分」的范围内，**不再限制在自由带内**——可以拖到画布任意位置（含压到提醒块上）。

**持久化键**（`store.js`，前缀 `wp:`）：`wp:settings`（合并到 `DEFAULT_SETTINGS` 之上，升级时新键自动出现；`custom.pos`/`offWords`/`offReminders` 单独深合并）、`wp:customWords`、`wp:reminders`、`wp:engine`、`wp:seeded`。改 `DEFAULT_SETTINGS` 加新键时，UI 默认值要在 `applySettingsToUI` 里同步。

**实时壁纸 + 防误触**（`app.js` 的 `enterLive/setupAntiTouch`）：进入后 `body.live` 隐藏控制面板、`#live-overlay` 全屏 cover-fit 画布，并 `setTimeout` 到次日 00:00:05 自动翻页（叠加 `rotateEnabled` 的间隔刷新）。`antiTouch` 开启时按住满 `antiTouchMs` 才唤出 `#live-peek`（带环形进度），短按/抬起即取消。右上角 `#btn-exit-live` 始终可达。

**桌面伴侣 `companion.js`**（Node，零依赖）：起一个静态服务器（同网站）+ macOS 上 (a) 用 `buildSVG` 生成 SVG、`sips` 转 PNG、`osascript` 设为桌面壁纸（`pushWallpaper`，定时），(b) 做一个**无边框置顶小窗**（`startPet`，显示今日单词+提醒），(c) `/ocr` 端点走 Apple Vision OCR 供网页「截图导入」。它的 `buildSVG` 独立复刻 group/poster 版面（也已移除日期/时钟）。配置 `companion-config.json` 首跑自动生成。

**小窗为什么不用 WKWebView**：实测 WKWebView 会吞掉鼠标事件，`movableByWindowBackground` / 盖透明把手都拖不动窗口（也踩过本机 JXA `ObjC.registerSubclass` 的 protocol 崩溃坑）。所以小窗改成 `buildPetSVG` 把卡片渲成 SVG → `rasterizeSVG`(sips) 出 PNG → JXA 里 `registerSubclass` 一个 `DWGrip`：**自定义拖动**（`mouseDown:/mouseDragged:/mouseUp:` + `NSEvent.mouseLocation` + `setFrameOrigin`，按住任意位置即拖，右上角 ✕ 区域则 `orderOut` + `terminate` 关闭小窗并写 `pet-closed` 标记），`drawRect:` 把 PNG 画出来。位置每 3s 存 `pet-position.json`，重启留在原位；`pet-closed` 在伴侣启动时清掉，所以**重启伴侣即可恢复小窗**。

**一键启用（主路径，零下载）**：网页「一键启用桌面伴侣」按钮 POST `/companion/start`（`server.js` 的 `startCompanion`）。前提是 server 就跑在用户自己 Mac 上（本来就是 `node server.js`）：先 `probeCompanion()` 探测 8771 是否已有 companion（`/status.json` 返回带 `config`），没有就 `spawn(process.execPath, [companion.js], {cwd, detached, stdio 落到 ~/Library/Logs/daily-wallpaper-companion.log})` 拉起并轮询等它起来，返回 `{ok, already|spawned}`。`child.unref()` 让它在 server 退出后继续跑。`?dry=1` 只返回不真正拉起（e2e 用）。主 server 也回 `/status.json` 为 `{ok:true, companion:false}`，供前端 `syncCompanionButton` 区分「本页是不是伴侣提供的」。

**下载独立版（兜底）**：`/companion.zip`（`serveCompanionZip` 即时跑 `scripts/package_companion.py`）——zip 内含 `启动伴侣.command`（bash 启动器，zip 里以 `external_attr` 0o755 落盘可双击）、`companion.js`、`data/words_*.json` ×8、`使用说明.txt`。用户**解压 → 双击启动器**即用，不用敲命令；启动器找不到 node 会给指引并打开 nodejs.org。注意：浏览器下载不会带 `+x`，所以单文件 `.command` 双击会「Permission denied」，独立版必须走 zip（Finder 解压会保留 +x）。

**两条设计纪律**：
- 壁纸正文只用本地系统字体栈（PingFang SC / Hiragino / Microsoft YaHei / Noto Sans CJK SC / Songti / Kaiti 等），**不引入网络字体**。
- 强调色/印泥红 `#B3402A` 只用于「沙·暖」主题 accent 和 `.btn.danger`，别挪作普通按钮强调（普通强调用 `#17503F`）。

## 改东西时的多文件触点

- **加一套主题**：`app.js` 的 `THEMES` 加 `{name,bg,bg2,ink,sub,accent,accentSoft,line,blob}` 一项即可（swatch 由 `renderThemeSwatches` 自动生成）。
- **加一个尺寸**：`app.js` 的 `SIZES` 加 `{w,h,label}`，`fillSizeSelect` 自动进下拉。
- **加一种字体风格**：`render.js` 的 `FONT_STACKS` 加一族，`index.html` 的 `#sel-fontstyle` 加一个 `<option>`（值 = 该键）。
- **加一种版式**：`render.js` 写渲染器并在 `Render.draw` 分支；`index.html` 的 `#layout-switch` 加 `seg-btn`；`store.js` 的 `layout` 默认值；`app.js` 的 `updateMeta`、`syncDependentUI`。
- **加一个内置词库**：`scripts/build_wordlibs.py` 的 `CAPS`/`TAG_TO_ID`/`LIB_META` 加一项并跑一遍生成 `data/words_<id>.json`；`app.js` 的 `LIBRARIES` 加一项；e2e 的卡片总数断言 +1。
- **改提醒呈现**：`render.js` 的 `drawReminders` + `remindersHeight` 要**一起改**（预估高度必须与实际逐行高度一致，否则吸底错位）。

## 验证矩阵

`scripts/e2e.py`（33 项）覆盖主路径 + v3 控件存在性 + 伴侣一键包 zip + 一键启用端点；`scripts/render_v3.py`（7 项）真渲染 PNG 并做像素级断言（字体栈写入、文字颜色持久化、背景照片铺满且非主题色、**锚点真的移动单词块**、自定义文字拖拽位置持久化、海报+楷体）。手工补查：两版式 × 六主题 × 手机/桌面各抽查一张 PNG（用 canvas 的 `toDataURL` 导出看，别用元素截图）；竖屏 6 词、横屏 6 词都不溢出、不压提醒块；导入 Excel/CSV/粘贴三路径；实时壁纸长按能唤出、短按不唤出。

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, spawn } = require('child_process');

const DEFAULT_PORT = Number(process.env.PORT || 8770);
const HOST = process.env.HOST || '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

function serveStatic(req, res) {
  let pathname = req.url.split('?')[0];
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(__dirname, pathname);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ['.html', '.css', '.js', '.json', '.csv'].includes(ext)
        ? 'no-cache'
        : 'max-age=3600',
    });
    res.end(data);
  });
}

/* Build the companion zip (companion + double-click launcher + word data) and
 * stream it back. Rebuilt on each request so the download is always current. */
function serveCompanionZip(req, res) {
  const script = path.join(__dirname, 'scripts', 'package_companion.py');
  execFile('python3', [script], { timeout: 30000 }, (err, stdout, stderr) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('打包失败：' + (stderr || err.message));
      return;
    }
    const zipPath = path.join(__dirname, 'scripts', '每日壁纸伴侣.zip');
    fs.readFile(zipPath, (e2, data) => {
      if (e2) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('读取安装包失败');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="daily-wallpaper-companion.zip"; filename*=UTF-8\'\'%E6%AF%8F%E6%97%A5%E5%A3%81%E7%BA%B8%E4%BC%B4%E4%BE%A3.zip',
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

/* Probe whether the desktop companion is already up on its default port 8771. */
function probeCompanion(cb) {
  const req = http.get({ host: '127.0.0.1', port: 8771, path: '/status.json', timeout: 1200 }, res => {
    let body = '';
    res.on('data', c => (body += c));
    res.on('end', () => {
      try { cb(Boolean(JSON.parse(body).config)); } catch { cb(false); }
    });
  });
  req.on('error', () => cb(false));
  req.on('timeout', () => { req.destroy(); cb(false); });
}

/* Forward a companion-only endpoint (e.g. /pet.php) to the companion on 8771.
 * The main server itself has no pet — the floating window belongs to companion.js. */
function proxyToCompanion(req, res, path) {
  let done = false;
  const send = obj => { if (!done) { done = true; json(res, 200, obj); } };
  const r = http.request({ host: '127.0.0.1', port: 8771, path, method: req.method, timeout: 2000 }, r2 => {
    let b = '';
    r2.on('data', c => (b += c));
    r2.on('end', () => {
      done = true;
      res.writeHead(r2.statusCode || 200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(b);
    });
  });
  r.on('error', () => send({ ok: false, companion: false }));
  r.on('timeout', () => { r.destroy(); send({ ok: false, companion: false }); });
  r.end();
}

/* 一键启用：直接在用户自己的 Mac 上把 companion 拉起来，零下载。
 * server.js 本来就在用户的机器上跑（`node server.js`），companion.js 也就在本仓库，
 * 所以不用下载 / 解压 / 双击，点一下按钮即可。*/
function startCompanion(req, res) {
  if (req.url.includes('dry=1')) return json(res, 200, { ok: true, dry: true }); // e2e only
  probeCompanion(up => {
    if (up) return json(res, 200, { ok: true, already: true });
    const companionJs = path.join(__dirname, 'companion.js');
    if (!fs.existsSync(companionJs)) return json(res, 500, { ok: false, error: 'companion.js 不存在（可改用下载独立版）' });
    const logPath = path.join(os.homedir(), 'Library', 'Logs', 'daily-wallpaper-companion.log');
    let logFd = 2;
    try { logFd = fs.openSync(logPath, 'a'); } catch {}
    const child = spawn(process.execPath, [companionJs], { cwd: __dirname, detached: true, stdio: ['ignore', logFd, logFd] });
    child.unref(); // keep running after this server responds / exits
    if (logFd !== 2) { try { fs.closeSync(logFd); } catch {} } // child already inherited its copy
    const startAt = Date.now();
    const timer = setInterval(() => {
      probeCompanion(up2 => {
        if (up2) { clearInterval(timer); json(res, 200, { ok: true, spawned: true }); }
        else if (Date.now() - startAt > 8000) { clearInterval(timer); json(res, 200, { ok: false, error: '启动超时，看日志 ' + logPath }); }
      });
    }, 500);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const pathname = req.url.split('?')[0];
  if (pathname === '/companion.zip') return serveCompanionZip(req, res);
  if (pathname === '/companion/start') {
    if (req.method !== 'POST') { res.writeHead(405); res.end(); return; }
    return startCompanion(req, res);
  }
  // pet summon/hide lives on the companion; proxy it if the companion is up.
  if (pathname === '/pet.php') return proxyToCompanion(req, res, req.url);
  if (pathname === '/pet-size.php') return proxyToCompanion(req, res, req.url);
  // same-origin probe: report the companion's full status when it's up so the
  // website can show pet visibility + hotkey health from either port.
  if (pathname === '/status.json') {
    const r2 = http.get({ host: '127.0.0.1', port: 8771, path: '/status.json', timeout: 1200 }, res2 => {
      let b = '';
      res2.on('data', c => (b += c));
      res2.on('end', () => {
        try {
          const j = JSON.parse(b);
          if (j.config) return json(res, 200, { ok: true, companion: true, pet: j.pet, hotkey: j.hotkey });
        } catch {}
        json(res, 200, { ok: true, companion: false });
      });
    });
    r2.on('error', () => json(res, 200, { ok: true, companion: false }));
    r2.on('timeout', () => { r2.destroy(); json(res, 200, { ok: true, companion: false }); });
    return;
  }
  serveStatic(req, res);
});

let activePort = DEFAULT_PORT;

server.on('listening', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : activePort;
  console.log(`每日壁纸 Daily Wallpaper server running at http://localhost:${port}`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE' && !process.env.PORT && activePort === DEFAULT_PORT) {
    activePort = DEFAULT_PORT + 1;
    console.warn(`Port ${DEFAULT_PORT} is in use, trying ${activePort}...`);
    server.listen(activePort, HOST);
    return;
  }
  throw err;
});

server.listen(activePort, HOST);

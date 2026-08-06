const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

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

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const pathname = req.url.split('?')[0];
  if (pathname === '/companion.zip') return serveCompanionZip(req, res);
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

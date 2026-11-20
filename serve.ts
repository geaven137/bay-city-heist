// Neon Bay — tiny static server for local play.
// Serves game/ at http://localhost:8080 so the game can be
// opened in desktop Chrome. Standard library only; no build.

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const gameDir = path.join(here, 'game');
const port = Number(process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const file = path.join(gameDir, rel);
  if (!file.startsWith(gameDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found: ' + urlPath + '\n');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { 'content-type': TYPES[ext] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, () => {
  console.log('NEON BAY at http://localhost:' + port + ' (serving game/)');
});

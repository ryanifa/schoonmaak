/* Alleen om de app tijdens het ontwikkelen te bekijken; in productie doet
   GitHub Pages dit. Serveert de map app/ op http://localhost:4321. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const wortel = path.join(import.meta.dirname, '..', 'app');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

http.createServer((req, res) => {
  const pad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const bestand = path.join(wortel, pad === '/' ? 'index.html' : pad);
  if (!bestand.startsWith(wortel) || !fs.existsSync(bestand) || !fs.statSync(bestand).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Niet gevonden');
  }
  res.writeHead(200, {
    'content-type': MIME[path.extname(bestand)] || 'application/octet-stream',
    'cache-control': 'no-store',
  });
  res.end(fs.readFileSync(bestand));
}).listen(4321, () => console.log('App draait op http://localhost:4321'));

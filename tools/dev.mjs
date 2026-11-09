/* Local server for the deck and its page editor. It serves the files and runs api/*.mjs the way Vercel does.
     node tools/dev.mjs            then open http://127.0.0.1:3000/?edit
   Publishing needs GitHub, so locally it only works with tools/test_editor.py, which points the functions at a
   stand-in GitHub (tools/mock_github.mjs). Everything else in the editor works here as it does on the live site. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = +(process.env.PORT || 3000);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };
const loaded = new Map();

async function handler(name) {
  if (!/^[\w/-]+$/.test(name) || name.split('/').some(p => p.startsWith('_'))) return null;
  const file = path.join(ROOT, 'api', name + '.mjs');
  if (!fs.existsSync(file)) return null;
  if (!loaded.has(file)) loaded.set(file, (await import(pathToFileURL(file).href)).default);
  return loaded.get(file);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || '127.0.0.1:' + PORT));
  try {
    if (url.pathname.startsWith('/api/')) {
      const h = await handler(url.pathname.slice(5).replace(/\/$/, ''));
      if (!h) { res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"no such function"}'); return; }
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) if (v != null) [].concat(v).forEach(x => headers.append(k, x));
      const r = await h.fetch(new Request(url, { method: req.method, headers, body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks) }));
      const out = {};
      r.headers.forEach((v, k) => { if (k !== 'set-cookie') out[k] = v; });
      const cookies = r.headers.getSetCookie();
      if (cookies.length) out['set-cookie'] = cookies;
      res.writeHead(r.status, out);
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep) || /[\\/]\.git([\\/]|$)/.test(file) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String((e && e.stack) || e));
  }
}).listen(PORT, '127.0.0.1', () => console.log('deck on http://127.0.0.1:' + PORT + '/?edit'));

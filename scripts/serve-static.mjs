// Serves the built site (.vercel/output/static) with the headers from vercel.json,
// so browser tests see the same CSP as production. Test use only; no API routes.
// Usage: node scripts/serve-static.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.vercel/output/static');
const port = Number(process.argv[2] ?? 4399);
const headers = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).headers.flatMap((h) => h.headers);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json',
};

if (!fs.existsSync(root)) {
  console.error(`No build at ${root}. Run npm run build first.`);
  process.exit(1);
}

http
  .createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    let file = path.join(root, p);
    if (!file.startsWith(root)) file = root; // no path traversal
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    let code = 200;
    if (!fs.existsSync(file)) {
      file = path.join(root, '404.html');
      code = 404;
    }
    for (const h of headers) res.setHeader(h.key, h.value);
    res.setHeader('content-type', types[path.extname(file)] ?? 'application/octet-stream');
    res.writeHead(code);
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));

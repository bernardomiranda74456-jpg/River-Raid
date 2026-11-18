#!/usr/bin/env node
// Servidor estático simples para a versão web (dist/), com fallback de rota (SPA).
// Uso: node scripts/serve-web.js [porta] [base]   ex.: node scripts/serve-web.js 4180
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'dist');
const port = Number(process.argv[2] || 4180);
const base = (process.argv[3] || '').replace(/\/$/, '');
const types = { '.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.css': 'text/css', '.map': 'application/json' };

http
  .createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (base && p.startsWith(base)) p = p.slice(base.length) || '/';
    let file = path.normalize(path.join(root, p));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, '0.0.0.0', () => console.log(`Ritmo web em http://localhost:${port}${base}/`));

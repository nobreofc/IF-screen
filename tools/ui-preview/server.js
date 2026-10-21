// Pré-visualização da interface da Central no navegador (sem Electron), usando um banco real.
// Uso: node server.js caminho/para/banco.db [porta]
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const C = path.join(__dirname, '..', '..', 'central');
const { Database } = require(path.join(C, 'src', 'db'));
const { Store, localDate, addDays } = require(path.join(C, 'src', 'store'));

(async () => {
  const db = await Database.open(process.argv[2]);
  db.file = null; // não grava no arquivo
  const store = new Store(db);
  const H = {
    overview: () => store.overview(), devices: () => store.devices(), device: (id) => store.device(id),
    link: (a) => store.link(a.code, a.participant), unlink: (id) => store.unlink(id), setStudyStart: (a) => store.setStudyStart(a.deviceId, a.date),
    days: (a) => store.days(a.deviceId, a.from, a.to), sessions: (a) => store.sessions(a.deviceId, a.date), hourly: (a) => store.hourly(a.deviceId, a.date),
    questionnaires: (a) => store.questionnaires(a.from, a.to), validation: (a) => store.validation(a || {}),
    setReference: (a) => store.setReference(a.deviceId, a.date, a.minutes, a.note), settings: () => store.settings(),
    saveSettings: (o) => { store.setSettings(o); return { ok: true }; },
    status: () => ({ localPort: 8787, ips: [{ address: '192.168.0.10' }], relay: { ok: true, lastPull: Date.now() - 20000 }, today: localDate(), version: '1.0.0', dataDir: 'C:\\Users\\Pesquisa\\AppData\\Roaming\\IF Screen Central' }),
    testRelay: () => ({ ok: true, health: { devices: 60 } }), syncNow: () => ({}), logs: () => db.all('SELECT ts, level, msg FROM log ORDER BY ts DESC LIMIT 30'),
    exportCsv: () => ({ ok: false }), printPdf: () => ({ ok: true }), chooseLogo: () => ({ ok: false }), removeLogo: () => ({ ok: true }), logo: () => null,
    openDataDir: () => ({}), dates: () => ({ today: localDate(), yesterday: addDays(localDate(), -1) }),
  };
  const mock = `window.api = new Proxy({}, { get: (_, n) => n === 'onUpdate' ? () => {} : (arg) => fetch('/api/' + n, { method: 'POST', body: JSON.stringify(arg === undefined ? null : arg) }).then(r => r.json()) });`;
  http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const name = req.url.slice(5);
      let body = ''; for await (const c of req) body += c;
      const arg = body ? JSON.parse(body) : null;
      const out = await H[name](arg === null ? undefined : arg);
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out === undefined ? null : out)); return;
    }
    let f = req.url === '/' ? 'index.html' : req.url.slice(1).split('?')[0];
    const p = path.join(C, 'renderer', f);
    if (!fs.existsSync(p)) { res.writeHead(404); res.end(); return; }
    let data = fs.readFileSync(p);
    if (f === 'index.html') data = Buffer.from(data.toString().replace('<script src="vendor/chart.umd.min.js"></script>', `<script>${mock}</script><script src="vendor/chart.umd.min.js"></script>`).replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/, ''));
    const type = f.endsWith('.css') ? 'text/css' : f.endsWith('.js') ? 'text/javascript' : 'text/html';
    res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }); res.end(data);
  }).listen(Number(process.argv[3] || 5199), () => console.log('preview pronto'));
})();
